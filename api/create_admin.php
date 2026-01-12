<?php
// api/create_admin.php
// Script para crear usuario administrador
// SOLO PARA DESARROLLO - ELIMINAR EN PRODUCCIÓN

require_once '../config/environment.php';
require_once '../config/database.php';
require_once '../config/security.php';

header('Content-Type: application/json');

// Solo permitir en desarrollo
if (IS_PRODUCTION) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Este script solo está disponible en desarrollo']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Datos del administrador
    $nombre = 'Administrador';
    $email = 'admin@pizzasteve.com';
    $password = 'Admin123!';
    $telefono = '77712345';
    $direccion = 'Oficina Central';
    
    // Verificar que el rol Admin existe (id_rol = 2)
    $checkRoleSql = "SELECT id_rol FROM roles WHERE id_rol = 2 AND nombre = 'Admin'";
    $roleResult = $conn->query($checkRoleSql);
    
    if ($roleResult->num_rows === 0) {
        // Crear el rol Admin si no existe
        $createRoleSql = "INSERT INTO roles (id_rol, nombre, descripcion) VALUES (2, 'Admin', 'Administrador del sistema')";
        if (!$conn->query($createRoleSql)) {
            echo json_encode([
                'success' => false,
                'message' => 'Error al crear rol Admin: ' . $conn->error
            ]);
            exit;
        }
    }
    
    // Verificar si el usuario ya existe
    $checkUserSql = "SELECT id_usuario FROM usuarios WHERE correo_electronico = ?";
    $checkStmt = $conn->prepare($checkUserSql);
    $checkStmt->bind_param('s', $email);
    $checkStmt->execute();
    $checkResult = $checkStmt->get_result();
    
    // Hashear contraseña
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
    
    if ($checkResult->num_rows > 0) {
        // Actualizar usuario existente
        $user = $checkResult->fetch_assoc();
        $updateSql = "UPDATE usuarios SET 
            nombre = ?,
            contrasena = ?,
            telefono = ?,
            direccion = ?,
            rol_id = 2,
            activa = 1
            WHERE id_usuario = ?";
        $updateStmt = $conn->prepare($updateSql);
        $updateStmt->bind_param('ssssi', $nombre, $hashedPassword, $telefono, $direccion, $user['id_usuario']);
        
        if ($updateStmt->execute()) {
            echo json_encode([
                'success' => true,
                'message' => 'Usuario administrador actualizado exitosamente',
                'credentials' => [
                    'email' => $email,
                    'password' => $password,
                    'nombre' => $nombre
                ]
            ]);
        } else {
            echo json_encode([
                'success' => false,
                'message' => 'Error al actualizar usuario: ' . $updateStmt->error
            ]);
        }
        $updateStmt->close();
    } else {
        // Crear nuevo usuario
        $insertSql = "INSERT INTO usuarios (
            nombre,
            correo_electronico,
            contrasena,
            telefono,
            direccion,
            fecha_creacion,
            rol_id,
            activa
        ) VALUES (?, ?, ?, ?, ?, CURDATE(), 2, 1)";
        
        $insertStmt = $conn->prepare($insertSql);
        $insertStmt->bind_param('sssss', $nombre, $email, $hashedPassword, $telefono, $direccion);
        
        if ($insertStmt->execute()) {
            echo json_encode([
                'success' => true,
                'message' => 'Usuario administrador creado exitosamente',
                'credentials' => [
                    'email' => $email,
                    'password' => $password,
                    'nombre' => $nombre
                ]
            ]);
        } else {
            echo json_encode([
                'success' => false,
                'message' => 'Error al crear usuario: ' . $insertStmt->error
            ]);
        }
        $insertStmt->close();
    }
    
    $checkStmt->close();
} else {
    // GET - Mostrar información
    $checkSql = "SELECT u.id_usuario, u.nombre, u.correo_electronico, r.nombre as rol, u.activa 
                 FROM usuarios u 
                 JOIN roles r ON u.rol_id = r.id_rol 
                 WHERE u.rol_id = 2 AND u.correo_electronico = 'admin@pizzasteve.com'";
    $result = $conn->query($checkSql);
    
    if ($result && $result->num_rows > 0) {
        $admin = $result->fetch_assoc();
        echo json_encode([
            'exists' => true,
            'user' => $admin,
            'message' => 'Usuario administrador ya existe. Usa POST para actualizar o recrear.'
        ]);
    } else {
        echo json_encode([
            'exists' => false,
            'message' => 'Usuario administrador no existe. Usa POST para crearlo.',
            'instructions' => 'Haz una petición POST a este endpoint para crear el usuario admin'
        ]);
    }
}

$conn->close();
?>

