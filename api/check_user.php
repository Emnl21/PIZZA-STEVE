<?php
// api/check_user.php
// Script de diagnóstico para verificar usuarios
// SOLO PARA DESARROLLO - ELIMINAR EN PRODUCCIÓN

require_once '../config/environment.php';
require_once '../config/database.php';

header('Content-Type: application/json');

if (!IS_PRODUCTION) {
    $email = $_GET['email'] ?? '';
    
    if (empty($email)) {
        echo json_encode(['error' => 'Proporciona un email como parámetro: ?email=tu@email.com']);
        exit;
    }
    
    // Buscar por email
    $sql = "SELECT u.id_usuario, u.nombre, u.correo_electronico, u.contrasena, u.activa, r.nombre as rol_nombre 
            FROM usuarios u 
            JOIN roles r ON u.rol_id = r.id_rol 
            WHERE u.correo_electronico = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 1) {
        $user = $result->fetch_assoc();
        
        // Verificar si la contraseña está hasheada
        $isHashed = password_get_info($user['contrasena'])['algo'] !== null;
        
        echo json_encode([
            'found' => true,
            'user' => [
                'id' => $user['id_usuario'],
                'nombre' => $user['nombre'],
                'email' => $user['correo_electronico'],
                'rol' => $user['rol_nombre'],
                'activa' => (bool)$user['activa'],
                'password_hashed' => $isHashed,
                'password_length' => strlen($user['contrasena'])
            ]
        ]);
    } else {
        // Buscar por nombre
        $sql = "SELECT u.id_usuario, u.nombre, u.correo_electronico, u.contrasena, u.activa, r.nombre as rol_nombre 
                FROM usuarios u 
                JOIN roles r ON u.rol_id = r.id_rol 
                WHERE u.nombre = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows === 1) {
            $user = $result->fetch_assoc();
            $isHashed = password_get_info($user['contrasena'])['algo'] !== null;
            
            echo json_encode([
                'found' => true,
                'user' => [
                    'id' => $user['id_usuario'],
                    'nombre' => $user['nombre'],
                    'email' => $user['correo_electronico'],
                    'rol' => $user['rol_nombre'],
                    'activa' => (bool)$user['activa'],
                    'password_hashed' => $isHashed,
                    'password_length' => strlen($user['contrasena'])
                ],
                'note' => 'Usuario encontrado por nombre, no por email'
            ]);
        } else {
            echo json_encode([
                'found' => false,
                'message' => 'Usuario no encontrado con email o nombre: ' . htmlspecialchars($email)
            ]);
        }
    }
    
    $stmt->close();
} else {
    echo json_encode(['error' => 'Este script solo está disponible en desarrollo']);
}

$conn->close();
?>

