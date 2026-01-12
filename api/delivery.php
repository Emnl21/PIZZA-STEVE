<?php
// api/delivery.php (Repartidores)
// Evitar cualquier output antes del JSON
error_reporting(E_ALL);
ini_set('display_errors', 0);

// Iniciar buffer de salida al inicio
if (!ob_get_level()) {
    ob_start();
}

// Limpiar cualquier output previo
if (ob_get_level() > 0) {
    ob_clean();
}

require_once '../config/environment.php';
require_once '../config/database.php';
require_once '../config/security.php';
require_once '../config/security_headers.php';
require_once 'auth_middleware.php';

// Limpiar cualquier output que haya ocurrido durante los requires
if (ob_get_level() > 0) {
    ob_clean();
}

setSecurityHeaders();
header('Content-Type: application/json');

// Verificar autenticación para todas las operaciones
try {
    $current_user = requireAuth(['admin']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error de autenticación: ' . $e->getMessage()]);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

// Wrapper para manejo de errores
try {
    switch ($method) {
        case 'GET':
            if ($id) {
                $sql = "SELECT * FROM repartidores WHERE id_repartidor = ?";
                $stmt = $conn->prepare($sql);
                if (!$stmt) {
                    http_response_code(500);
                    echo json_encode(['success' => false, 'message' => 'Error al preparar la consulta: ' . $conn->error]);
                    exit;
                }
                $stmt->bind_param('i', $id);
                $stmt->execute();
                $result = $stmt->get_result();
                $delivery = $result->fetch_assoc();
                $stmt->close();
                
                if ($delivery === null) {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'message' => 'Repartidor no encontrado']);
                } else {
                    // Limpiar y convertir a UTF-8
                    $cleaned_delivery = [];
                    foreach ($delivery as $key => $value) {
                        if (is_string($value)) {
                            $cleaned_delivery[$key] = mb_convert_encoding($value, 'UTF-8', 'UTF-8');
                            if (!mb_check_encoding($cleaned_delivery[$key], 'UTF-8')) {
                                $cleaned_delivery[$key] = filter_var($value, FILTER_SANITIZE_STRING, FILTER_FLAG_STRIP_HIGH);
                            }
                        } else {
                            $cleaned_delivery[$key] = $value;
                        }
                    }
                    echo json_encode($cleaned_delivery, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                }
            } else {
                $sql = "SELECT * FROM repartidores ORDER BY nombre";
                $result = $conn->query($sql);
                
                if ($result === false) {
                    http_response_code(500);
                    echo json_encode(['success' => false, 'message' => 'Error en la consulta SQL: ' . $conn->error]);
                    exit;
                }
                
                $deliveries = [];
                while ($row = $result->fetch_assoc()) {
                    // Limpiar y convertir a UTF-8 cada campo
                    $cleaned_row = [];
                    foreach ($row as $key => $value) {
                        if (is_string($value)) {
                            // Detectar y limpiar caracteres UTF-8 inválidos
                            if (!mb_check_encoding($value, 'UTF-8')) {
                                // Intentar convertir desde diferentes codificaciones comunes
                                $value = mb_convert_encoding($value, 'UTF-8', 'ISO-8859-1');
                                if (!mb_check_encoding($value, 'UTF-8')) {
                                    $value = mb_convert_encoding($value, 'UTF-8', 'Windows-1252');
                                }
                                // Si aún falla, remover caracteres inválidos
                                if (!mb_check_encoding($value, 'UTF-8')) {
                                    $value = mb_convert_encoding($value, 'UTF-8', 'UTF-8');
                                    // Remover caracteres no válidos
                                    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $value);
                                }
                            }
                            $cleaned_row[$key] = $value;
                        } else {
                            $cleaned_row[$key] = $value;
                        }
                    }
                    $deliveries[] = $cleaned_row;
                }
                
                // Cerrar el resultado
                $result->close();
                
                // Asegurar que siempre devolvemos un array, incluso si está vacío
                // Usar JSON_UNESCAPED_UNICODE para mantener caracteres especiales correctamente
                // JSON_PARTIAL_OUTPUT_ON_ERROR permite generar JSON parcial si hay problemas
                $json_output = json_encode($deliveries, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
                
                // Verificar que el JSON se generó correctamente
                if ($json_output === false) {
                    http_response_code(500);
                    $error_msg = json_last_error_msg();
                    
                    // Intentar una limpieza más agresiva
                    $cleaned_deliveries = [];
                    foreach ($deliveries as $item) {
                        $cleaned_item = [];
                        foreach ($item as $key => $value) {
                            if (is_string($value)) {
                                // Limpieza más agresiva
                                $cleaned_value = iconv('UTF-8', 'UTF-8//IGNORE', $value);
                                if ($cleaned_value === false) {
                                    $cleaned_value = mb_convert_encoding($value, 'UTF-8', 'UTF-8');
                                    $cleaned_value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $cleaned_value);
                                }
                                $cleaned_item[$key] = $cleaned_value;
                            } else {
                                $cleaned_item[$key] = $value;
                            }
                        }
                        $cleaned_deliveries[] = $cleaned_item;
                    }
                    
                    $json_output = json_encode($cleaned_deliveries, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                    
                    if ($json_output === false) {
                        echo json_encode(['success' => false, 'message' => 'Error al generar JSON: ' . $error_msg . ' (Error code: ' . json_last_error() . ')']);
                        exit;
                    }
                }
                
                echo $json_output;
            }
            break;
    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        $nombre = $data['nombre'] ?? '';
        $telefono = $data['telefono'] ?? '';
        $correo_electronico = $data['correo_electronico'] ?? '';
        $estado = $data['estado'] ?? 'disponible';
        $fecha_inicio_trabajo = $data['fecha_inicio_trabajo'] ?? date('Y-m-d');

        if (empty($nombre)) {
            echo json_encode(['success' => false, 'message' => 'Nombre es requerido.']);
            exit;
        }
        
        // Validar estado
        $valid_states = ['disponible', 'ocupado'];
        if (!in_array($estado, $valid_states)) {
            echo json_encode(['success' => false, 'message' => 'Estado no válido. Estados permitidos: ' . implode(', ', $valid_states)]);
            exit;
        }

        $sql = "INSERT INTO repartidores (nombre, telefono, correo_electronico, estado, fecha_inicio_trabajo) VALUES (?, ?, ?, ?, ?)";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('sssss', $nombre, $telefono, $correo_electronico, $estado, $fecha_inicio_trabajo);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Repartidor agregado exitosamente.']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Error al agregar el repartidor: ' . $stmt->error]);
        }
        $stmt->close();
        break;
    case 'PUT':
        $data = json_decode(file_get_contents('php://input'), true);
        $id = $data['id'] ?? '';
        $nombre = $data['nombre'] ?? '';
        $telefono = $data['telefono'] ?? '';
        $correo_electronico = $data['correo_electronico'] ?? '';
        $estado = $data['estado'] ?? 'disponible';

        if (empty($id) || !is_numeric($id)) {
            echo json_encode(['success' => false, 'message' => 'ID es requerido y debe ser numérico.']);
            exit;
        }
        
        if (empty($nombre)) {
            echo json_encode(['success' => false, 'message' => 'Nombre es requerido.']);
            exit;
        }
        
        // Validar nombre (solo letras, espacios, acentos)
        if (!preg_match("/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/", trim($nombre)) || strlen(trim($nombre)) < 2) {
            echo json_encode(['success' => false, 'message' => 'El nombre solo puede contener letras, espacios y acentos. Mínimo 2 caracteres.']);
            exit;
        }
        
        // Validar email si se proporciona
        if (!empty($correo_electronico) && !filter_var($correo_electronico, FILTER_VALIDATE_EMAIL)) {
            echo json_encode(['success' => false, 'message' => 'El formato del email no es válido.']);
            exit;
        }
        
        // Validar teléfono si se proporciona
        if (!empty($telefono)) {
            $phoneDigits = preg_replace('/\D/', '', $telefono);
            if (strlen($phoneDigits) < 7 || strlen($phoneDigits) > 15) {
                echo json_encode(['success' => false, 'message' => 'El teléfono debe tener entre 7 y 15 dígitos.']);
                exit;
            }
        }
        
        // Validar estado
        $valid_states = ['disponible', 'ocupado'];
        if (!in_array($estado, $valid_states)) {
            echo json_encode(['success' => false, 'message' => 'Estado no válido. Estados permitidos: ' . implode(', ', $valid_states)]);
            exit;
        }
        
        $id = (int)$id;

        $sql = "UPDATE repartidores SET nombre = ?, telefono = ?, correo_electronico = ?, estado = ? WHERE id_repartidor = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('ssssi', $nombre, $telefono, $correo_electronico, $estado, $id);

        if ($stmt->execute()) {
            if ($stmt->affected_rows > 0) {
                echo json_encode(['success' => true, 'message' => 'Repartidor actualizado exitosamente.']);
            } else {
                echo json_encode(['success' => false, 'message' => 'Repartidor no encontrado o sin cambios.']);
            }
        } else {
            echo json_encode(['success' => false, 'message' => 'Error al actualizar el repartidor: ' . $stmt->error]);
        }
        $stmt->close();
        break;
    case 'DELETE':
        $id = $_GET['id'] ?? '';

        if (empty($id)) {
            echo json_encode(['success' => false, 'message' => 'ID de repartidor requerido.']);
            exit;
        }

        // Verificar si el repartidor tiene pedidos asignados
        $sql = "SELECT COUNT(*) as count FROM pedidos WHERE repartidor_id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $count = $result->fetch_assoc()['count'];
        $stmt->close();

        if ($count > 0) {
            echo json_encode(['success' => false, 'message' => 'No se puede eliminar el repartidor porque tiene pedidos asignados.']);
            exit;
        }

        $sql = "DELETE FROM repartidores WHERE id_repartidor = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $id);

        if ($stmt->execute()) {
            if ($stmt->affected_rows > 0) {
                echo json_encode(['success' => true, 'message' => 'Repartidor eliminado exitosamente.']);
            } else {
                echo json_encode(['success' => false, 'message' => 'Repartidor no encontrado.']);
            }
        } else {
            echo json_encode(['success' => false, 'message' => 'Error al eliminar el repartidor: ' . $stmt->error]);
        }
        $stmt->close();
        break;
    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
        break;
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error interno del servidor: ' . $e->getMessage()]);
} catch (Error $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error fatal: ' . $e->getMessage()]);
}

if (isset($conn)) {
    $conn->close();
}

// Limpiar y enviar el buffer
if (ob_get_level() > 0) {
    ob_end_flush();
}
?>

