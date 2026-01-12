<?php
// api/addresses.php
require_once '../config/environment.php';
require_once '../config/database.php';
require_once '../config/security.php';
require_once '../config/security_headers.php';
require_once 'auth_middleware.php';

setSecurityHeaders();
header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$user_id = $_GET['user_id'] ?? null;
$id = $_GET['id'] ?? null;

switch ($method) {
    case 'GET':
        // Verificar autenticación
        $current_user = requireAuth();
        
        // Si se especifica un user_id, verificar que sea el mismo usuario o admin
        if ($user_id) {
            $user_id = (int)$user_id;
            $is_admin = verifyRole(['admin']);
            
            if (!$is_admin && $current_user['id_usuario'] != $user_id) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'No tiene permisos para ver estas direcciones.']);
                exit;
            }
        } else {
            $user_id = $current_user['id_usuario'];
        }
        
        if ($id) {
            // Obtener una dirección específica
            $id = (int)$id;
            $sql = "SELECT id_direccion, usuario_id, direccion, latitud, longitud, es_principal 
                    FROM direcciones_entrega 
                    WHERE id_direccion = ? AND usuario_id = ?";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param('ii', $id, $user_id);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($result->num_rows > 0) {
                $address = $result->fetch_assoc();
                echo json_encode($address);
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Dirección no encontrada.']);
            }
            $stmt->close();
        } else {
            // Obtener todas las direcciones del usuario
            $sql = "SELECT id_direccion, usuario_id, direccion, latitud, longitud, es_principal 
                    FROM direcciones_entrega 
                    WHERE usuario_id = ? 
                    ORDER BY es_principal DESC, id_direccion DESC";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param('i', $user_id);
            $stmt->execute();
            $result = $stmt->get_result();
            
            $addresses = [];
            while ($row = $result->fetch_assoc()) {
                $addresses[] = [
                    'id_direccion' => (int)$row['id_direccion'],
                    'usuario_id' => (int)$row['usuario_id'],
                    'direccion' => $row['direccion'],
                    'latitud' => $row['latitud'] ? (float)$row['latitud'] : null,
                    'longitud' => $row['longitud'] ? (float)$row['longitud'] : null,
                    'es_principal' => (bool)$row['es_principal'],
                    'alias' => 'Dirección ' . $row['id_direccion'], // Alias por defecto
                    'calle_numero' => $row['direccion'],
                    'colonia' => '',
                    'codigo_postal' => '',
                    'referencias' => ''
                ];
            }
            $stmt->close();
            echo json_encode($addresses);
        }
        break;
        
    case 'POST':
        // Crear nueva dirección
        $current_user = requireAuth();
        $data = json_decode(file_get_contents('php://input'), true);
        
        $usuario_id = $current_user['id_usuario'];
        // Admin puede crear direcciones para otros usuarios
        if (verifyRole(['admin']) && isset($data['usuario_id'])) {
            $usuario_id = (int)$data['usuario_id'];
        }
        
        $direccion = trim($data['direccion'] ?? $data['address'] ?? '');
        $lat = isset($data['lat']) ? (float)$data['lat'] : null;
        $lng = isset($data['lng']) ? (float)$data['lng'] : null;
        $es_principal = isset($data['es_principal']) ? (int)$data['es_principal'] : 0;
        
        if (empty($direccion)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'La dirección es requerida.']);
            exit;
        }
        
        // Si se marca como principal, quitar principal de otras direcciones
        if ($es_principal) {
            $sql_update = "UPDATE direcciones_entrega SET es_principal = 0 WHERE usuario_id = ?";
            $stmt_update = $conn->prepare($sql_update);
            $stmt_update->bind_param('i', $usuario_id);
            $stmt_update->execute();
            $stmt_update->close();
        }
        
        $sql = "INSERT INTO direcciones_entrega (usuario_id, direccion, latitud, longitud, es_principal) 
                VALUES (?, ?, ?, ?, ?)";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('isddi', $usuario_id, $direccion, $lat, $lng, $es_principal);
        
        if ($stmt->execute()) {
            $id_direccion = $conn->insert_id;
            echo json_encode([
                'success' => true,
                'message' => 'Dirección guardada exitosamente.',
                'id_direccion' => $id_direccion
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error al guardar la dirección: ' . $stmt->error]);
        }
        $stmt->close();
        break;
        
    case 'DELETE':
        // Eliminar dirección
        $current_user = requireAuth();
        
        if (!$id || !is_numeric($id)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ID de dirección requerido.']);
            exit;
        }
        
        $id = (int)$id;
        
        // Verificar que la dirección pertenece al usuario o es admin
        $sql_check = "SELECT usuario_id FROM direcciones_entrega WHERE id_direccion = ?";
        $stmt_check = $conn->prepare($sql_check);
        $stmt_check->bind_param('i', $id);
        $stmt_check->execute();
        $result_check = $stmt_check->get_result();
        
        if ($result_check->num_rows === 0) {
            $stmt_check->close();
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Dirección no encontrada.']);
            exit;
        }
        
        $address_data = $result_check->fetch_assoc();
        $stmt_check->close();
        
        $is_admin = verifyRole(['admin']);
        if (!$is_admin && $address_data['usuario_id'] != $current_user['id_usuario']) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'No tiene permisos para eliminar esta dirección.']);
            exit;
        }
        
        $sql = "DELETE FROM direcciones_entrega WHERE id_direccion = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $id);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Dirección eliminada exitosamente.']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error al eliminar la dirección: ' . $stmt->error]);
        }
        $stmt->close();
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
        break;
}

$conn->close();
?>

