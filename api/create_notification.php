<?php
// api/create_notification.php - Función helper para crear notificaciones
// Esta función puede ser llamada desde otros archivos PHP

function createNotification($conn, $user_id, $order_id, $tipo, $titulo, $mensaje = null) {
    try {
        // Verificar que la tabla existe
        $check_table = "SHOW TABLES LIKE 'notificaciones'";
        $result = $conn->query($check_table);
        
        if ($result && $result->num_rows > 0) {
            $sql = "INSERT INTO notificaciones (id_usuario, id_pedido, tipo, titulo, mensaje) VALUES (?, ?, ?, ?, ?)";
            $stmt = $conn->prepare($sql);
            
            if ($stmt) {
                $stmt->bind_param('iisss', $user_id, $order_id, $tipo, $titulo, $mensaje);
                $stmt->execute();
                $stmt->close();
                return true;
            }
        }
        return false;
    } catch (Exception $e) {
        error_log("Error al crear notificación: " . $e->getMessage());
        return false;
    }
}

?>

