<?php
// api/users.php
require_once '../config/environment.php';
require_once '../config/database.php';
require_once '../config/security.php';
require_once '../config/security_headers.php';
require_once 'auth_middleware.php';

setSecurityHeaders();
header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

function getRoleNameById($conn, $rol_id) {
    if (empty($rol_id)) {
        return null;
    }
    $stmt = $conn->prepare("SELECT nombre FROM roles WHERE id_rol = ?");
    if (!$stmt) {
        return null;
    }
    $stmt->bind_param('i', $rol_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $role = $result ? $result->fetch_assoc() : null;
    $stmt->close();
    return $role ? $role['nombre'] : null;
}

function branchIsActive($conn, $sucursal_id) {
    if ($sucursal_id === null) {
        return false;
    }
    $stmt = $conn->prepare("SELECT id_sucursal FROM sucursales WHERE id_sucursal = ? AND activa = 1");
    if (!$stmt) {
        return false;
    }
    $stmt->bind_param('i', $sucursal_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $exists = $result && $result->num_rows > 0;
    $stmt->close();
    return $exists;
}

switch ($method) {
    case 'GET':
        // GET permite acceso a admin, vendedor y cliente (para ver sus propios datos)
        $current_user = requireAuth(['admin', 'vendedor', 'cliente']);
        $is_vendedor = (strtolower($current_user['rol_nombre']) === 'vendedor');
        $is_cliente = (strtolower($current_user['rol_nombre']) === 'cliente');
        $rol_filter = $is_vendedor ? 'vendedor' : '';
        
        if ($id) {
            // Si es cliente, solo puede ver sus propios datos
            if ($is_cliente && (int)$id !== (int)$current_user['id_usuario']) {
                http_response_code(403);
                echo json_encode([
                    'success' => false,
                    'message' => 'No tiene permisos para ver este usuario.'
                ]);
                exit;
            }
            
            // Usar función almacenada para obtener usuario por ID
            $stmt = $conn->prepare("CALL sp_get_user_by_id(?, ?)");
            $stmt->bind_param('is', $id, $rol_filter);
            $stmt->execute();
            $result = $stmt->get_result();
            $user = $result->fetch_assoc();
            if ($user) {
                // Asegurar que activa sea un entero si existe
                if (isset($user['activa'])) {
                    $user['activa'] = (int)$user['activa'];
                }
                if (array_key_exists('sucursal_id', $user)) {
                    $user['sucursal_id'] = $user['sucursal_id'] !== null ? (int)$user['sucursal_id'] : null;
                }
            }
            echo json_encode($user);
            $stmt->close();
            // Cerrar resultados adicionales de procedimientos almacenados
            while ($conn->more_results()) {
                $conn->next_result();
                if ($result = $conn->store_result()) {
                    $result->free();
                }
            }
        } else {
            // Si es cliente, solo puede ver sus propios datos (no lista de usuarios)
            if ($is_cliente) {
                http_response_code(403);
                echo json_encode([
                    'success' => false,
                    'message' => 'No tiene permisos para ver la lista de usuarios.'
                ]);
                exit;
            }
            // Usar función almacenada para obtener todos los usuarios
            $stmt = $conn->prepare("CALL sp_get_all_users(?)");
            $stmt->bind_param('s', $rol_filter);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($result === false) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Error en la consulta SQL: ' . $conn->error]);
                $stmt->close();
                exit;
            }

            $users = [];
            while ($row = $result->fetch_assoc()) {
                // Asegurar que activa sea un entero
                $row['activa'] = (int)$row['activa'];
                if (array_key_exists('sucursal_id', $row)) {
                    $row['sucursal_id'] = $row['sucursal_id'] !== null ? (int)$row['sucursal_id'] : null;
                }
                $users[] = $row;
            }
            echo json_encode($users);
            $stmt->close();
            // Cerrar resultados adicionales de procedimientos almacenados
            while ($conn->more_results()) {
                $conn->next_result();
                if ($result = $conn->store_result()) {
                    $result->free();
                }
            }
        }
        break;
    case 'POST':
        // POST solo para admin
        $current_user = requireAuth(['admin']);
        $data = json_decode(file_get_contents('php://input'), true);
        $nombre = $data['nombre'] ?? '';
        $password = $data['contrasena'] ?? '';
        $email = $data['correo_electronico'] ?? '';
        $telefono = $data['telefono'] ?? '';
        $direccion = $data['direccion'] ?? '';
        $fecha_cumpleaños = $data['fecha_cumpleaños'] ?? null;
        $ci = $data['ci'] ?? '';
        $rol_id = isset($data['rol_id']) ? (int)$data['rol_id'] : 0;
        $sucursal_id = isset($data['sucursal_id']) && $data['sucursal_id'] !== '' ? (int)$data['sucursal_id'] : null;

        if (empty($nombre) || empty($password) || empty($email) || empty($rol_id)) {
            echo json_encode(['success' => false, 'message' => 'Nombre, email, contraseña y rol son requeridos.']);
            exit;
        }
        
        // Validar nombre (solo letras, espacios, acentos)
        if (!preg_match("/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/", $nombre) || strlen($nombre) < 2) {
            echo json_encode(['success' => false, 'message' => 'El nombre solo puede contener letras, espacios y acentos. Mínimo 2 caracteres.']);
            exit;
        }
        
        // Validar email
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            echo json_encode(['success' => false, 'message' => 'El formato del email no es válido.']);
            exit;
        }
        
        // Validar C.I. si se proporciona
        if (!empty($ci)) {
            if (!preg_match("/^[0-9]{5,15}$/", $ci)) {
                echo json_encode(['success' => false, 'message' => 'El C.I. debe contener solo números (5-15 dígitos).']);
                exit;
            }
        }
        
        // Validar teléfono si se proporciona
        if (!empty($telefono)) {
            $phoneDigits = preg_replace('/\D/', '', $telefono);
            if (strlen($phoneDigits) < 7 || strlen($phoneDigits) > 15) {
                echo json_encode(['success' => false, 'message' => 'El teléfono debe tener entre 7 y 15 dígitos.']);
                exit;
            }
        }
        
        // Validar contraseña
        if (strlen($password) < 6) {
            echo json_encode(['success' => false, 'message' => 'La contraseña debe tener al menos 6 caracteres.']);
            exit;
        }

        $role_name = getRoleNameById($conn, $rol_id);
        if (!$role_name) {
            echo json_encode(['success' => false, 'message' => 'El rol seleccionado no existe.']);
            exit;
        }

        $is_vendor_role = (strtolower($role_name) === 'vendedor');
        if ($sucursal_id !== null && !branchIsActive($conn, $sucursal_id)) {
            echo json_encode(['success' => false, 'message' => 'La sucursal seleccionada no es válida o está inactiva.']);
            exit;
        }
        if ($is_vendor_role && $sucursal_id === null) {
            echo json_encode(['success' => false, 'message' => 'Debe seleccionar una sucursal para los vendedores.']);
            exit;
        }
        if (!$is_vendor_role) {
            $sucursal_id = null;
        }

        $hashed_password = password_hash($password, PASSWORD_DEFAULT);

        // Normalizar valores NULL y vacíos
        $ci_value = !empty($ci) ? $ci : null;
        $fecha_cumpleaños_value = (!empty($fecha_cumpleaños) && $fecha_cumpleaños !== 'null' && $fecha_cumpleaños !== '') ? $fecha_cumpleaños : null;
        $telefono_value = !empty($telefono) ? $telefono : null;
        $direccion_value = !empty($direccion) ? $direccion : null;
        
        // MySQLi no puede pasar NULL directamente a un parámetro INT con bind_param
        // Solución: usar el stored procedure cuando sucursal_id tiene valor,
        // o usar SQL directo cuando es NULL
        if ($sucursal_id === null) {
            // Verificar que el email no exista
            $sql_check_email = "SELECT COUNT(*) as count FROM usuarios WHERE correo_electronico = ?";
            $stmt_check = $conn->prepare($sql_check_email);
            $stmt_check->bind_param('s', $email);
            $stmt_check->execute();
            $result_check = $stmt_check->get_result();
            $email_exists = $result_check->fetch_assoc()['count'] > 0;
            $stmt_check->close();
            
            if ($email_exists) {
                echo json_encode(['success' => false, 'message' => 'El correo electrónico ya está registrado']);
                exit;
            }
            
            // Verificar que el C.I. no exista (si se proporciona)
            if (!empty($ci_value)) {
                $sql_check_ci = "SELECT COUNT(*) as count FROM usuarios WHERE ci = ?";
                $stmt_check_ci = $conn->prepare($sql_check_ci);
                $stmt_check_ci->bind_param('s', $ci_value);
                $stmt_check_ci->execute();
                $result_check_ci = $stmt_check_ci->get_result();
                $ci_exists = $result_check_ci->fetch_assoc()['count'] > 0;
                $stmt_check_ci->close();
                
                if ($ci_exists) {
                    echo json_encode(['success' => false, 'message' => 'El C.I. ya está registrado']);
                    exit;
                }
            }
            
            // Insertar directamente usando SQL cuando sucursal_id es NULL
            $sql_insert = "INSERT INTO usuarios (nombre, contrasena, correo_electronico, telefono, direccion, fecha_cumpleaños, ci, rol_id, sucursal_id, fecha_creacion, activa) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, CURDATE(), 1)";
            $stmt_insert = $conn->prepare($sql_insert);
            $stmt_insert->bind_param('sssssssi', 
                $nombre, 
                $hashed_password, 
                $email, 
                $telefono_value, 
                $direccion_value, 
                $fecha_cumpleaños_value, 
                $ci_value, 
                $rol_id
            );
            
            if ($stmt_insert->execute()) {
                $user_id = $conn->insert_id;
                echo json_encode([
                    'success' => true, 
                    'message' => 'Usuario creado exitosamente',
                    'user_id' => $user_id
                ]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Error al crear el usuario: ' . $stmt_insert->error]);
            }
            $stmt_insert->close();
            exit;
        }
        
        // Usar stored procedure cuando sucursal_id tiene valor
        $stmt = $conn->prepare("CALL sp_create_user(?, ?, ?, ?, ?, ?, ?, ?, ?, @p_user_id, @p_success, @p_message)");
        
        if (!$stmt) {
            echo json_encode(['success' => false, 'message' => 'Error al preparar la consulta: ' . $conn->error]);
            exit;
        }
        
        $stmt->bind_param('sssssssii', 
            $nombre, 
            $hashed_password, 
            $email, 
            $telefono_value, 
            $direccion_value, 
            $fecha_cumpleaños_value, 
            $ci_value, 
            $rol_id, 
            $sucursal_id
        );
        
        if ($stmt->execute()) {
            // Cerrar el statement antes de obtener los resultados
            $stmt->close();
            
            // Obtener los valores de salida
            $result = $conn->query("SELECT @p_user_id as user_id, @p_success as success, @p_message as message");
            if (!$result) {
                echo json_encode(['success' => false, 'message' => 'Error al obtener resultado: ' . $conn->error]);
                exit;
            }
            $output = $result->fetch_assoc();
            
            // Cerrar resultados adicionales de procedimientos almacenados
            while ($conn->more_results()) {
                $conn->next_result();
                if ($result = $conn->store_result()) {
                    $result->free();
                }
            }
            
            if ($output && isset($output['success']) && $output['success']) {
                echo json_encode([
                    'success' => true, 
                    'message' => $output['message'] ?? 'Usuario creado exitosamente',
                    'user_id' => $output['user_id'] ?? 0
                ]);
            } else {
                $error_message = ($output && isset($output['message'])) ? $output['message'] : 'Error desconocido al crear el usuario';
                echo json_encode([
                    'success' => false, 
                    'message' => $error_message
                ]);
            }
        } else {
            $error_msg = $stmt->error;
            $stmt->close();
            echo json_encode(['success' => false, 'message' => 'Error al ejecutar la consulta: ' . $error_msg]);
        }
        $stmt->close();
        // Cerrar resultados adicionales de procedimientos almacenados
        while ($conn->more_results()) {
            $conn->next_result();
            if ($result = $conn->store_result()) {
                $result->free();
            }
        }
        break;
    case 'PUT':
        // PUT permite a admin editar cualquier usuario, y a clientes editar solo sus propios datos
        $current_user = requireAuth(['admin', 'cliente']);
        $is_cliente = (strtolower($current_user['rol_nombre']) === 'cliente');
        $data = json_decode(file_get_contents('php://input'), true);
        $id = $data['id'] ?? $data['id_usuario'] ?? '';
        $nombre = trim($data['nombre'] ?? '');
        $email = trim($data['correo_electronico'] ?? '');
        $telefono = trim($data['telefono'] ?? '');
        $direccion = trim($data['direccion'] ?? '');
        $fecha_cumpleaños = $data['fecha_cumpleaños'] ?? null;
        $ci = trim($data['ci'] ?? '');
        $rol_id = isset($data['rol_id']) ? (int)$data['rol_id'] : 0;
        $password = $data['contrasena'] ?? '';
        $activa = isset($data['activa']) ? (int)$data['activa'] : null;
        $sucursal_id = isset($data['sucursal_id']) && $data['sucursal_id'] !== '' ? (int)$data['sucursal_id'] : null;

        if (empty($id)) {
            echo json_encode(['success' => false, 'message' => 'ID de usuario es requerido.']);
            exit;
        }

        // Si es cliente, solo puede editar sus propios datos y no puede cambiar rol, activa, o sucursal
        if ($is_cliente) {
            if ((int)$id !== (int)$current_user['id_usuario']) {
                http_response_code(403);
                echo json_encode([
                    'success' => false,
                    'message' => 'No tiene permisos para editar este usuario.'
                ]);
                exit;
            }
            // Los clientes no pueden cambiar su rol, estado activo, o sucursal
            $rol_id = $current_user['rol_id'];
            // Obtener el valor actual de activa del usuario para mantenerlo
            $sql_get_activa = "SELECT activa FROM usuarios WHERE id_usuario = ?";
            $stmt_get = $conn->prepare($sql_get_activa);
            $stmt_get->bind_param('i', $id);
            $stmt_get->execute();
            $result_get = $stmt_get->get_result();
            if ($result_get && $result_get->num_rows > 0) {
                $user_data = $result_get->fetch_assoc();
                $activa = (int)$user_data['activa'];
            } else {
                $activa = 1; // Valor por defecto
            }
            $stmt_get->close();
            $sucursal_id = null; // No permitir cambiar sucursal
        }

        // Validaciones básicas
        if (empty($nombre) || empty($email)) {
            echo json_encode(['success' => false, 'message' => 'Nombre y email son requeridos.']);
            exit;
        }

        // Si no es admin, el rol_id debe ser el del usuario actual
        if (!$is_cliente && empty($rol_id)) {
            echo json_encode(['success' => false, 'message' => 'Rol es requerido.']);
            exit;
        }
        
        // Validar nombre (solo letras, espacios, acentos)
        if (!preg_match("/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/", $nombre) || strlen($nombre) < 2) {
            echo json_encode(['success' => false, 'message' => 'El nombre solo puede contener letras, espacios y acentos. Mínimo 2 caracteres.']);
            exit;
        }
        
        // Validar email
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            echo json_encode(['success' => false, 'message' => 'El formato del email no es válido.']);
            exit;
        }
        
        // Validar C.I. si se proporciona
        if (!empty($ci)) {
            if (!preg_match("/^[0-9]{5,15}$/", $ci)) {
                echo json_encode(['success' => false, 'message' => 'El C.I. debe contener solo números (5-15 dígitos).']);
                exit;
            }
        }
        
        // Validar teléfono si se proporciona
        if (!empty($telefono)) {
            $phoneDigits = preg_replace('/\D/', '', $telefono);
            if (strlen($phoneDigits) < 7 || strlen($phoneDigits) > 15) {
                echo json_encode(['success' => false, 'message' => 'El teléfono debe tener entre 7 y 15 dígitos.']);
                exit;
            }
        }
        
        // Validar contraseña si se proporciona
        if (!empty($password) && strlen($password) < 6) {
            echo json_encode(['success' => false, 'message' => 'La contraseña debe tener al menos 6 caracteres.']);
            exit;
        }

        // Validar rol solo si no es cliente (los clientes mantienen su rol)
        if (!$is_cliente) {
            if (empty($rol_id)) {
                echo json_encode(['success' => false, 'message' => 'Rol inválido.']);
                exit;
            }

            $role_name = getRoleNameById($conn, $rol_id);
            if (!$role_name) {
                echo json_encode(['success' => false, 'message' => 'El rol seleccionado no existe.']);
                exit;
            }

            $is_vendor_role = (strtolower($role_name) === 'vendedor');
            if ($sucursal_id !== null && !branchIsActive($conn, $sucursal_id)) {
                echo json_encode(['success' => false, 'message' => 'La sucursal seleccionada no es válida o está inactiva.']);
                exit;
            }
            if ($is_vendor_role && $sucursal_id === null) {
                echo json_encode(['success' => false, 'message' => 'Debe seleccionar una sucursal para los vendedores.']);
                exit;
            }
            if (!$is_vendor_role) {
                $sucursal_id = null;
            }
        }
        // Para clientes, el rol_id ya fue establecido arriba (línea 376)

        $hashed_password = !empty($password) ? password_hash($password, PASSWORD_DEFAULT) : null;
        $ci_value = !empty($ci) ? $ci : null;
        
        // Asegurar que activa tenga un valor válido (0 o 1)
        if ($activa === null) {
            // Si no se proporcionó activa, obtener el valor actual del usuario
            $sql_get_activa = "SELECT activa FROM usuarios WHERE id_usuario = ?";
            $stmt_get = $conn->prepare($sql_get_activa);
            $stmt_get->bind_param('i', $id);
            $stmt_get->execute();
            $result_get = $stmt_get->get_result();
            if ($result_get && $result_get->num_rows > 0) {
                $user_data = $result_get->fetch_assoc();
                $activa = (int)$user_data['activa'];
            } else {
                $activa = 1; // Valor por defecto
            }
            $stmt_get->close();
        } else {
            $activa = (int)$activa;
        }
        
        // MySQLi no puede pasar NULL directamente a un parámetro INT con bind_param
        // Si sucursal_id es NULL, usar SQL directo en lugar del stored procedure
        if ($sucursal_id === null || $sucursal_id === '') {
            // Usar SQL directo cuando sucursal_id es NULL
            // Validar que el email no esté en uso por otro usuario
            $sql_check_email = "SELECT COUNT(*) as count FROM usuarios WHERE correo_electronico = ? AND id_usuario != ?";
            $stmt_check = $conn->prepare($sql_check_email);
            $stmt_check->bind_param('si', $email, $id);
            $stmt_check->execute();
            $result_check = $stmt_check->get_result();
            $email_exists = $result_check->fetch_assoc()['count'] > 0;
            $stmt_check->close();
            
            if ($email_exists) {
                echo json_encode(['success' => false, 'message' => 'El correo electrónico ya está en uso por otro usuario']);
                exit;
            }
            
            // Validar que el C.I. no esté en uso por otro usuario (si se proporciona)
            if (!empty($ci_value)) {
                $sql_check_ci = "SELECT COUNT(*) as count FROM usuarios WHERE ci = ? AND id_usuario != ?";
                $stmt_check_ci = $conn->prepare($sql_check_ci);
                $stmt_check_ci->bind_param('si', $ci_value, $id);
                $stmt_check_ci->execute();
                $result_check_ci = $stmt_check_ci->get_result();
                $ci_exists = $result_check_ci->fetch_assoc()['count'] > 0;
                $stmt_check_ci->close();
                
                if ($ci_exists) {
                    echo json_encode(['success' => false, 'message' => 'El C.I. ya está en uso por otro usuario']);
                    exit;
                }
            }
            
            // Actualizar directamente usando SQL cuando sucursal_id es NULL
            if (!empty($hashed_password)) {
                $sql_update = "UPDATE usuarios SET 
                    nombre = ?, 
                    correo_electronico = ?, 
                    telefono = ?, 
                    direccion = ?, 
                    fecha_cumpleaños = ?, 
                    ci = ?, 
                    rol_id = ?, 
                    contrasena = ?,
                    activa = ?
                WHERE id_usuario = ?";
                $stmt_update = $conn->prepare($sql_update);
                $stmt_update->bind_param('ssssssisii', 
                    $nombre, 
                    $email, 
                    $telefono, 
                    $direccion, 
                    $fecha_cumpleaños, 
                    $ci_value, 
                    $rol_id, 
                    $hashed_password,
                    $activa,
                    $id
                );
            } else {
                $sql_update = "UPDATE usuarios SET 
                    nombre = ?, 
                    correo_electronico = ?, 
                    telefono = ?, 
                    direccion = ?, 
                    fecha_cumpleaños = ?, 
                    ci = ?, 
                    rol_id = ?,
                    activa = ?
                WHERE id_usuario = ?";
                $stmt_update = $conn->prepare($sql_update);
                $stmt_update->bind_param('ssssssiii', 
                    $nombre, 
                    $email, 
                    $telefono, 
                    $direccion, 
                    $fecha_cumpleaños, 
                    $ci_value, 
                    $rol_id,
                    $activa,
                    $id
                );
            }
            
            if ($stmt_update->execute()) {
                $affected_rows = $stmt_update->affected_rows;
                $stmt_update->close();
                
                if ($affected_rows > 0) {
                    echo json_encode([
                        'success' => true, 
                        'message' => 'Usuario actualizado exitosamente'
                    ]);
                } else {
                    // Verificar si el usuario existe
                    $sql_check_user = "SELECT id_usuario FROM usuarios WHERE id_usuario = ?";
                    $stmt_check = $conn->prepare($sql_check_user);
                    $stmt_check->bind_param('i', $id);
                    $stmt_check->execute();
                    $result_check = $stmt_check->get_result();
                    $user_exists = $result_check->num_rows > 0;
                    $stmt_check->close();
                    
                    if (!$user_exists) {
                        http_response_code(404);
                        echo json_encode(['success' => false, 'message' => 'Usuario no encontrado']);
                    } else {
                        echo json_encode([
                            'success' => true, 
                            'message' => 'Usuario actualizado exitosamente (sin cambios)'
                        ]);
                    }
                }
            } else {
                $error_msg = $stmt_update->error;
                $stmt_update->close();
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Error al actualizar el usuario: ' . $error_msg]);
            }
            break;
        }
        
        // Si sucursal_id tiene valor, usar el stored procedure
        $sucursal_id_value = (int)$sucursal_id;
        $stmt = $conn->prepare("CALL sp_update_user(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @p_success, @p_message)");
        $stmt->bind_param('issssssisii', 
            $id, 
            $nombre, 
            $email, 
            $telefono, 
            $direccion, 
            $fecha_cumpleaños, 
            $ci_value, 
            $rol_id, 
            $hashed_password, 
            $activa,
            $sucursal_id_value
        );

        if ($stmt->execute()) {
            // Cerrar el statement antes de obtener los resultados
            $stmt->close();
            
            // Cerrar resultados adicionales de procedimientos almacenados primero
            while ($conn->more_results()) {
                $conn->next_result();
                if ($result = $conn->store_result()) {
                    $result->free();
                }
            }
            
            // Obtener los valores de salida
            $result = $conn->query("SELECT @p_success as success, @p_message as message");
            if (!$result) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Error al obtener resultado: ' . $conn->error]);
                exit;
            }
            $output = $result->fetch_assoc();
            
            if (!$output) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'No se pudo obtener el resultado del procedimiento almacenado']);
                exit;
            }
            
            echo json_encode([
                'success' => (bool)$output['success'], 
                'message' => $output['message'] ?? 'Usuario actualizado exitosamente'
            ]);
        } else {
            $error_msg = $stmt->error;
            $stmt->close();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error al actualizar el usuario: ' . $error_msg]);
        }
        break;
    case 'DELETE':
        // DELETE solo para admin
        $current_user = requireAuth(['admin']);
        if (empty($id) || !is_numeric($id)) {
            echo json_encode(['success' => false, 'message' => 'ID es requerido y debe ser numérico.']);
            exit;
        }
        
        $id = (int)$id;
        
        // Verificar que el usuario actual no se está desactivando a sí mismo
        if (!canModifyUser($id, $current_user['id_usuario'], 'deactivate')) {
            http_response_code(403);
            echo json_encode([
                'success' => false, 
                'message' => 'No puede desactivar su propia cuenta. Otro administrador debe hacerlo.'
            ]);
            exit;
        }
        
        // Verificar que el usuario objetivo existe
        $sql_check = "SELECT id_usuario, activa FROM usuarios WHERE id_usuario = ?";
        $stmt_check = $conn->prepare($sql_check);
        $stmt_check->bind_param('i', $id);
        $stmt_check->execute();
        $result_check = $stmt_check->get_result();
        
        if ($result_check->num_rows === 0) {
            $stmt_check->close();
            echo json_encode(['success' => false, 'message' => 'Usuario no encontrado.']);
            exit;
        }
        
        $target_user = $result_check->fetch_assoc();
        $stmt_check->close();
        
        // Usar función almacenada para desactivar usuario
        $stmt = $conn->prepare("CALL sp_deactivate_user(?, @p_success, @p_message)");
        $stmt->bind_param('i', $id);
        
        if ($stmt->execute()) {
            // Obtener los valores de salida
            $result = $conn->query("SELECT @p_success as success, @p_message as message");
            $output = $result->fetch_assoc();
            
            if ($output['success']) {
                echo json_encode([
                    'success' => true, 
                    'message' => $output['message'] . ' Su sesión será invalidada en la próxima verificación.'
                ]);
            } else {
                echo json_encode([
                    'success' => false, 
                    'message' => $output['message']
                ]);
            }
        } else {
            echo json_encode(['success' => false, 'message' => 'Error al desactivar el usuario: ' . $stmt->error]);
        }
        $stmt->close();
        // Cerrar resultados adicionales de procedimientos almacenados
        while ($conn->more_results()) {
            $conn->next_result();
            if ($result = $conn->store_result()) {
                $result->free();
            }
        }
        break;
    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
        break;
}

$conn->close();
?>