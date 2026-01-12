<?php
// api/login.php
require_once '../config/environment.php';
require_once '../config/database.php';
require_once '../config/security.php';
require_once '../config/security_headers.php';
require_once 'rate_limit.php';
require_once 'log_action.php';

setSecurityHeaders();
configureSecureSession();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';
    
    // Rate limiting
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $identifier = $username . '_' . $ip;
    $maxAttempts = 5;
    $timeWindow = 300;
    
    // Obtener información de intentos antes de verificar
    $attemptsInfo = getRateLimitAttempts($identifier, $maxAttempts, $timeWindow);
    
    if (!checkRateLimit($identifier, $maxAttempts, $timeWindow)) {
        $remainingTime = getRateLimitRemainingTime($identifier, $timeWindow);
        http_response_code(429);
        echo json_encode([
            'success' => false, 
            'message' => 'Demasiados intentos. Por favor espere ' . ceil($remainingTime / 60) . ' minutos.',
            'attempts_remaining' => 0,
            'attempts_total' => $maxAttempts
        ]);
        exit;
    }
    
    if (empty($username) || empty($password)) {
        echo json_encode(['success' => false, 'message' => 'Usuario y contraseña son requeridos.']);
        exit;
    }

    // Permitir login con nombre de usuario o correo electrónico
    // Verificar si el input parece un email
    $isEmail = filter_var($username, FILTER_VALIDATE_EMAIL) !== false;
    
    // Seleccionar columnas específicas en lugar de u.* para evitar problemas si falta alguna columna
    $base_columns = "u.id_usuario, u.nombre, u.correo_electronico, u.contrasena, u.telefono, u.direccion, u.fecha_creacion, u.ultimo_inicio_sesion, u.rol_id, u.activa, u.fecha_cumpleaños";
    
    // Verificar si la columna debe_cambiar_password existe de forma segura
    $has_password_change_field = false;
    try {
        $check_column = "SHOW COLUMNS FROM usuarios LIKE 'debe_cambiar_password'";
        $column_result = $conn->query($check_column);
        if ($column_result && $column_result->num_rows > 0) {
            $has_password_change_field = true;
        }
    } catch (Exception $e) {
        // Si hay error, asumir que la columna no existe
        $has_password_change_field = false;
    }
    
    // Construir SQL sin incluir la columna problemática en el SELECT principal
    // Usaremos un valor por defecto de 0 y solo intentaremos leer la columna real después
    if ($isEmail) {
        $sql = "SELECT $base_columns, r.nombre as role_name FROM usuarios u JOIN roles r ON u.rol_id = r.id_rol WHERE u.correo_electronico = ?";
    } else {
        $sql = "SELECT $base_columns, r.nombre as role_name FROM usuarios u JOIN roles r ON u.rol_id = r.id_rol WHERE u.nombre = ?";
    }
    
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        if (IS_PRODUCTION) {
            error_log("Login prepare failed: " . $conn->error);
            echo json_encode(['success' => false, 'message' => 'Error del servidor.']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Error: ' . $conn->error]);
        }
        exit;
    }
    
    $stmt->bind_param('s', $username);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 1) {
        $user = $result->fetch_assoc();
        
        // Verificar que el usuario está activo
        if (!$user['activa']) {
            echo json_encode(['success' => false, 'message' => 'Su cuenta ha sido desactivada. Contacte al administrador.']);
            $stmt->close();
            exit;
        }
        
        // SOLO verificar con password_verify (eliminar fallback de texto plano)
        if (password_verify($password, $user['contrasena'])) {
            // Regenerar ID de sesión para prevenir session fixation
            session_regenerate_id(true);
            
            $_SESSION['user_id'] = $user['id_usuario'];
            $_SESSION['username'] = escapeHtml($user['nombre']);
            $_SESSION['role'] = escapeHtml($user['role_name']);
            $_SESSION['last_activity'] = time();
            $_SESSION['created'] = time();
            
            // Verificar si debe cambiar contraseña
            // Intentar leer el valor de la columna si existe, de lo contrario usar 0
            $debe_cambiar_password = false;
            if ($has_password_change_field) {
                // Intentar leer el valor directamente de la base de datos
                try {
                    $check_pwd_sql = "SELECT debe_cambiar_password FROM usuarios WHERE id_usuario = ?";
                    $check_pwd_stmt = $conn->prepare($check_pwd_sql);
                    if ($check_pwd_stmt) {
                        $check_pwd_stmt->bind_param('i', $user['id_usuario']);
                        $check_pwd_stmt->execute();
                        $check_pwd_result = $check_pwd_stmt->get_result();
                        if ($check_pwd_result && $check_pwd_result->num_rows > 0) {
                            $pwd_row = $check_pwd_result->fetch_assoc();
                            $debe_cambiar_password = isset($pwd_row['debe_cambiar_password']) && $pwd_row['debe_cambiar_password'] == 1;
                        }
                        $check_pwd_stmt->close();
                    }
                } catch (Exception $e) {
                    // Si falla, usar false
                    $debe_cambiar_password = false;
                }
            }
            
            // Registrar inicio de sesión exitoso en logs
            $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
            $user_agent = $_SERVER['HTTP_USER_AGENT'] ?? null;
            logSystemAction(
                $conn,
                'success',
                $user['id_usuario'],
                escapeHtml($user['nombre']),
                'Inicio de sesión exitoso',
                "Usuario: " . escapeHtml($user['nombre']) . " | Rol: " . escapeHtml($user['role_name']),
                $ip,
                $user_agent
            );
            
            echo json_encode([
                'success' => true, 
                'role' => strtolower($user['role_name']),
                'user_id' => $user['id_usuario'],
                'username' => escapeHtml($user['nombre']),
                'debe_cambiar_password' => $debe_cambiar_password
            ]);
        } else {
            // Registrar intento de inicio de sesión fallido en logs
            $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
            $user_agent = $_SERVER['HTTP_USER_AGENT'] ?? null;
            logSystemAction(
                $conn,
                'warning',
                null,
                $username,
                'Intento de inicio de sesión fallido',
                "Usuario/Email: " . escapeHtml($username) . " | Contraseña incorrecta",
                $ip,
                $user_agent
            );
            
            // Obtener información actualizada de intentos después del intento fallido
            $attemptsInfo = getRateLimitAttempts($identifier, $maxAttempts, $timeWindow);
            // Mismo mensaje para no revelar si el usuario existe
            echo json_encode([
                'success' => false, 
                'message' => 'Usuario o contraseña incorrectos.',
                'attempts_remaining' => $attemptsInfo['remaining'],
                'attempts_total' => $maxAttempts
            ]);
        }
    } else {
        // Registrar intento de inicio de sesión fallido (usuario no existe) en logs
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $user_agent = $_SERVER['HTTP_USER_AGENT'] ?? null;
        logSystemAction(
            $conn,
            'warning',
            null,
            $username,
            'Intento de inicio de sesión fallido',
            "Usuario/Email: " . escapeHtml($username) . " | Usuario no encontrado",
            $ip,
            $user_agent
        );
        
        // Obtener información actualizada de intentos después del intento fallido
        $attemptsInfo = getRateLimitAttempts($identifier, $maxAttempts, $timeWindow);
        // Mismo mensaje para no revelar si el usuario existe
        echo json_encode([
            'success' => false, 
            'message' => 'Usuario o contraseña incorrectos.',
            'attempts_remaining' => $attemptsInfo['remaining'],
            'attempts_total' => $maxAttempts
        ]);
    }

    $stmt->close();
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
}
?>