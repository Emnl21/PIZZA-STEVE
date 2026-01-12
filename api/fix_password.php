<?php
// api/fix_password.php
// Script para actualizar contraseña de un usuario
// SOLO PARA DESARROLLO - ELIMINAR EN PRODUCCIÓN

require_once '../config/environment.php';
require_once '../config/database.php';

header('Content-Type: application/json');

if (!IS_PRODUCTION && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $email = trim($data['email'] ?? '');
    $newPassword = $data['password'] ?? '';
    
    if (empty($email) || empty($newPassword)) {
        echo json_encode(['success' => false, 'message' => 'Email y contraseña son requeridos']);
        exit;
    }
    
    // Buscar usuario por email o nombre
    $sql = "SELECT id_usuario, correo_electronico, nombre FROM usuarios WHERE correo_electronico = ? OR nombre = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('ss', $email, $email);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 1) {
        $user = $result->fetch_assoc();
        
        // Hashear nueva contraseña
        $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
        
        // Actualizar contraseña
        $updateSql = "UPDATE usuarios SET contrasena = ? WHERE id_usuario = ?";
        $updateStmt = $conn->prepare($updateSql);
        $updateStmt->bind_param('si', $hashedPassword, $user['id_usuario']);
        
        if ($updateStmt->execute()) {
            echo json_encode([
                'success' => true,
                'message' => 'Contraseña actualizada exitosamente para: ' . $user['nombre'] . ' (' . $user['correo_electronico'] . ')'
            ]);
        } else {
            echo json_encode([
                'success' => false,
                'message' => 'Error al actualizar: ' . $updateStmt->error
            ]);
        }
        
        $updateStmt->close();
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Usuario no encontrado'
        ]);
    }
    
    $stmt->close();
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método no permitido o solo disponible en desarrollo']);
}

$conn->close();
?>

