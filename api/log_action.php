<?php
// api/log_action.php
// Función helper para registrar acciones en los logs del sistema

function logSystemAction($conn, $nivel, $usuario_id, $usuario_nombre, $accion, $detalles = null, $ip_address = null, $user_agent = null) {
    try {
        // Verificar si la tabla existe
        $check_table = "SHOW TABLES LIKE 'logs_sistema'";
        $result_check = $conn->query($check_table);
        
        if ($result_check->num_rows === 0) {
            // Crear tabla si no existe
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
        
        // Obtener IP y User Agent si no se proporcionan
        if ($ip_address === null) {
            $ip_address = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        }
        if ($user_agent === null) {
            $user_agent = $_SERVER['HTTP_USER_AGENT'] ?? null;
        }
        
        // Insertar log
        $sql = "INSERT INTO logs_sistema (nivel, usuario_id, usuario_nombre, accion, detalles, ip_address, user_agent) 
                VALUES (?, ?, ?, ?, ?, ?, ?)";
        $stmt = $conn->prepare($sql);
        
        if ($stmt) {
            $stmt->bind_param('sisssss', $nivel, $usuario_id, $usuario_nombre, $accion, $detalles, $ip_address, $user_agent);
            $stmt->execute();
            $stmt->close();
            return true;
        }
        
        return false;
    } catch (Exception $e) {
        error_log("Error al registrar log: " . $e->getMessage());
        return false;
    }
}
?>

