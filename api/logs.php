<?php
// api/logs.php
// Sistema de logs del sistema

require_once '../config/environment.php';
require_once '../config/database.php';
require_once '../config/security.php';
require_once '../config/security_headers.php';
require_once 'auth_middleware.php';

setSecurityHeaders();
header('Content-Type: application/json');

// Solo administradores pueden ver logs
$current_user = requireAuth(['admin']);

$level = $_GET['level'] ?? '';
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 100;
$limit = min(max($limit, 1), 1000); // Limitar entre 1 y 1000

try {
    // Verificar si la tabla de logs existe, si no, crearla
    $check_table = "SHOW TABLES LIKE 'logs_sistema'";
    $result_check = $conn->query($check_table);
    
    if ($result_check->num_rows === 0) {
        // Crear tabla de logs si no existe
        $create_table = "CREATE TABLE IF NOT EXISTS logs_sistema (
            id_log INT AUTO_INCREMENT PRIMARY KEY,
            fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            nivel ENUM('info', 'warning', 'error', 'success') NOT NULL DEFAULT 'info',
            usuario_id INT,
            usuario_nombre VARCHAR(255),
            accion VARCHAR(255) NOT NULL,
            detalles TEXT,
            ip_address VARCHAR(45),
            user_agent TEXT,
            INDEX idx_fecha (fecha_hora),
            INDEX idx_nivel (nivel),
            INDEX idx_usuario (usuario_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
        
        $conn->query($create_table);
    }
    
    // Construir consulta con filtros
    $where_conditions = [];
    $params = [];
    $types = '';
    
    if (!empty($level) && in_array($level, ['info', 'warning', 'error', 'success'])) {
        $where_conditions[] = "nivel = ?";
        $params[] = $level;
        $types .= 's';
    }
    
    $where_clause = !empty($where_conditions) ? "WHERE " . implode(" AND ", $where_conditions) : "";
    
    $sql = "SELECT 
        id_log,
        fecha_hora,
        nivel,
        usuario_id,
        usuario_nombre,
        accion,
        detalles,
        ip_address
        FROM logs_sistema
        $where_clause
        ORDER BY fecha_hora DESC
        LIMIT ?";
    
    $params[] = $limit;
    $types .= 'i';
    
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception('Error al preparar consulta: ' . $conn->error);
    }
    
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    
    $stmt->execute();
    $result = $stmt->get_result();
    
    $logs = [];
    while ($row = $result->fetch_assoc()) {
        $logs[] = [
            'id' => $row['id_log'],
            'fecha_hora' => $row['fecha_hora'],
            'nivel' => $row['nivel'],
            'usuario_id' => $row['usuario_id'],
            'usuario_nombre' => $row['usuario_nombre'] ?? 'Sistema',
            'accion' => $row['accion'],
            'detalles' => $row['detalles'],
            'ip_address' => $row['ip_address']
        ];
    }
    
    $stmt->close();
    
    echo json_encode([
        'success' => true,
        'logs' => $logs,
        'total' => count($logs)
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error al obtener logs: ' . $e->getMessage()
    ]);
}

$conn->close();
?>

