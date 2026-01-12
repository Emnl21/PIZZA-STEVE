<?php
// api/notifications.php - Sistema de notificaciones
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

// Crear tabla de notificaciones si no existe
try {
    $create_table = "CREATE TABLE IF NOT EXISTS notificaciones (
        id_notificacion INT AUTO_INCREMENT PRIMARY KEY,
        id_usuario INT NOT NULL,
        id_pedido INT,
        tipo ENUM('pedido_entregado', 'pedido_preparando', 'pedido_listo', 'otro') NOT NULL,
        titulo VARCHAR(255) NOT NULL,
        mensaje TEXT,
        leida BOOLEAN DEFAULT FALSE,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
        FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    $conn->query($create_table);
} catch (Exception $e) {
    // La tabla ya existe o hay un error, continuar
}

switch ($method) {
    case 'GET':
        // Obtener notificaciones del usuario
        $role_name = strtolower($current_user['rol_nombre'] ?? '');
        $user_id = $current_user['id_usuario'];
        
        // Solo obtener notificaciones no leídas por defecto
        $only_unread = isset($_GET['only_unread']) && $_GET['only_unread'] === '1';
        
        $sql = "SELECT * FROM notificaciones WHERE id_usuario = ?";
        if ($only_unread) {
            $sql .= " AND leida = FALSE";
        }
        $sql .= " ORDER BY fecha_creacion DESC LIMIT 50";
        
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $user_id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $notifications = [];
        while ($row = $result->fetch_assoc()) {
            $notifications[] = $row;
        }
        $stmt->close();
        
        echo json_encode($notifications);
        break;
        
    case 'POST':
        // Marcar notificación como leída
        $data = json_decode(file_get_contents('php://input'), true);
        $notification_id = $data['notification_id'] ?? null;
        
        if (!$notification_id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ID de notificación requerido.']);
            exit;
        }
        
        $sql = "UPDATE notificaciones SET leida = TRUE WHERE id_notificacion = ? AND id_usuario = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('ii', $notification_id, $current_user['id_usuario']);
        
        if ($stmt->execute()) {
            $stmt->close();
            echo json_encode(['success' => true, 'message' => 'Notificación marcada como leída.']);
        } else {
            $stmt->close();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error al actualizar la notificación.']);
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
        break;
}

$conn->close();
?>

