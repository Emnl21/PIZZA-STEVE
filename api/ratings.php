<?php
// api/ratings.php - Sistema de valoraciones
error_reporting(E_ALL);
ini_set('display_errors', 0);
ob_start();

try {
    require_once '../config/environment.php';
    require_once '../config/database.php';
    require_once '../config/security.php';
    require_once '../config/security_headers.php';
    require_once 'auth_middleware.php';

    setSecurityHeaders();
    header('Content-Type: application/json');
    
    // Verificar autenticación
    $current_user = requireAuth();
} catch (Exception $e) {
    ob_end_clean();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error de inicialización: ' . $e->getMessage()]);
    exit;
}

ob_end_clean();

$method = $_SERVER['REQUEST_METHOD'];

// Crear tabla de valoraciones si no existe
try {
    $create_table = "CREATE TABLE IF NOT EXISTS valoraciones (
        id_valoracion INT AUTO_INCREMENT PRIMARY KEY,
        id_pedido INT NOT NULL,
        id_usuario INT NOT NULL,
        satisfaccion ENUM('satisfecho', 'insatisfecho', 'neutral') NOT NULL,
        comentario TEXT,
        fecha_valoracion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido) ON DELETE CASCADE,
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
        UNIQUE KEY unique_pedido_usuario (id_pedido, id_usuario)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    $conn->query($create_table);
} catch (Exception $e) {
    // La tabla ya existe o hay un error, continuar
}

switch ($method) {
    case 'POST':
        // Crear nueva valoración
        $data = json_decode(file_get_contents('php://input'), true);
        $orderId = $data['order_id'] ?? null;
        $satisfaccion = $data['satisfaccion'] ?? null;
        $comentario = $data['comentario'] ?? '';
        
        if (!$orderId || !$satisfaccion) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ID de pedido y satisfacción son requeridos.']);
            exit;
        }
        
        if (!in_array($satisfaccion, ['satisfecho', 'insatisfecho', 'neutral'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Valor de satisfacción inválido.']);
            exit;
        }
        
        // Verificar que el pedido pertenece al usuario
        $sql_check = "SELECT id_pedido, usuario_id FROM pedidos WHERE id_pedido = ?";
        $stmt_check = $conn->prepare($sql_check);
        $stmt_check->bind_param('i', $orderId);
        $stmt_check->execute();
        $result_check = $stmt_check->get_result();
        
        if ($result_check->num_rows === 0) {
            $stmt_check->close();
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Pedido no encontrado.']);
            exit;
        }
        
        $order_data = $result_check->fetch_assoc();
        $stmt_check->close();
        
        $role_name = strtolower($current_user['rol_nombre'] ?? '');
        $can_manage_all = in_array($role_name, ['admin', 'vendedor']);
        
        if (!$can_manage_all && $order_data['usuario_id'] != $current_user['id_usuario']) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'No tienes permisos para valorar este pedido.']);
            exit;
        }
        
        // Insertar o actualizar valoración
        $sql = "INSERT INTO valoraciones (id_pedido, id_usuario, satisfaccion, comentario) 
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                satisfaccion = VALUES(satisfaccion), 
                comentario = VALUES(comentario),
                fecha_valoracion = CURRENT_TIMESTAMP";
        
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('iiss', $orderId, $current_user['id_usuario'], $satisfaccion, $comentario);
        
        if ($stmt->execute()) {
            $stmt->close();
            echo json_encode([
                'success' => true,
                'message' => 'Valoración guardada exitosamente.'
            ]);
        } else {
            $stmt->close();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error al guardar la valoración.']);
        }
        break;
        
    case 'GET':
        // Obtener valoraciones
        $orderId = $_GET['order_id'] ?? null;
        
        if ($orderId) {
            // Obtener valoración de un pedido específico
            $sql = "SELECT * FROM valoraciones WHERE id_pedido = ?";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param('i', $orderId);
            $stmt->execute();
            $result = $stmt->get_result();
            $rating = $result->fetch_assoc();
            $stmt->close();
            
            echo json_encode($rating ?: null);
        } else {
            // Obtener todas las valoraciones (solo admin)
            $role_name = strtolower($current_user['rol_nombre'] ?? '');
            if ($role_name !== 'admin') {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'No tienes permisos para ver todas las valoraciones.']);
                exit;
            }
            
            $sql = "SELECT v.*, u.nombre as usuario_nombre, p.id_pedido 
                    FROM valoraciones v
                    LEFT JOIN usuarios u ON v.id_usuario = u.id_usuario
                    LEFT JOIN pedidos p ON v.id_pedido = p.id_pedido
                    ORDER BY v.fecha_valoracion DESC";
            $result = $conn->query($sql);
            $ratings = [];
            while ($row = $result->fetch_assoc()) {
                $ratings[] = $row;
            }
            echo json_encode($ratings);
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
        break;
}

$conn->close();
?>

