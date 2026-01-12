<?php
// api/test_login.php
// Script de diagnóstico para problemas de login
// SOLO PARA DESARROLLO

require_once '../config/environment.php';
require_once '../config/database.php';
require_once '../config/security.php';

header('Content-Type: application/json');

if (!IS_PRODUCTION) {
    $email = $_GET['email'] ?? 'admin@pizzasteve.com';
    $password = $_GET['password'] ?? 'Admin123!';
    
    $results = [
        'test_email' => $email,
        'test_password' => '***',
        'checks' => []
    ];
    
    // 1. Verificar conexión a base de datos
    if ($conn->connect_error) {
        $results['checks']['database_connection'] = [
            'status' => 'error',
            'message' => 'Error de conexión: ' . $conn->connect_error
        ];
    } else {
        $results['checks']['database_connection'] = [
            'status' => 'ok',
            'message' => 'Conexión exitosa'
        ];
    }
    
    // 2. Verificar si el usuario existe
    $isEmail = filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    
    if ($isEmail) {
        $sql = "SELECT u.*, r.nombre as role_name FROM usuarios u JOIN roles r ON u.rol_id = r.id_rol WHERE u.correo_electronico = ?";
    } else {
        $sql = "SELECT u.*, r.nombre as role_name FROM usuarios u JOIN roles r ON u.rol_id = r.id_rol WHERE u.nombre = ?";
    }
    
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        $results['checks']['user_lookup'] = [
            'status' => 'error',
            'message' => 'Error al preparar consulta: ' . $conn->error
        ];
    } else {
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows === 0) {
            $results['checks']['user_lookup'] = [
                'status' => 'error',
                'message' => 'Usuario no encontrado',
                'suggestion' => 'Ejecuta api/create_admin.php para crear el usuario admin'
            ];
        } else {
            $user = $result->fetch_assoc();
            $results['checks']['user_lookup'] = [
                'status' => 'ok',
                'message' => 'Usuario encontrado',
                'user_data' => [
                    'id' => $user['id_usuario'],
                    'nombre' => $user['nombre'],
                    'email' => $user['correo_electronico'],
                    'rol' => $user['role_name'],
                    'activa' => (bool)$user['activa']
                ]
            ];
            
            // 3. Verificar si el usuario está activo
            if (!$user['activa']) {
                $results['checks']['user_active'] = [
                    'status' => 'error',
                    'message' => 'Usuario desactivado'
                ];
            } else {
                $results['checks']['user_active'] = [
                    'status' => 'ok',
                    'message' => 'Usuario activo'
                ];
            }
            
            // 4. Verificar contraseña
            $passwordHash = $user['contrasena'];
            $isHashed = password_get_info($passwordHash)['algo'] !== null;
            
            $results['checks']['password_format'] = [
                'status' => $isHashed ? 'ok' : 'warning',
                'message' => $isHashed ? 'Contraseña está hasheada' : 'Contraseña NO está hasheada (texto plano)',
                'password_length' => strlen($passwordHash)
            ];
            
            if ($isHashed) {
                $passwordValid = password_verify($password, $passwordHash);
                $results['checks']['password_verification'] = [
                    'status' => $passwordValid ? 'ok' : 'error',
                    'message' => $passwordValid ? 'Contraseña correcta' : 'Contraseña incorrecta'
                ];
            } else {
                // Comparación directa (solo para desarrollo)
                $passwordValid = ($passwordHash === $password);
                $results['checks']['password_verification'] = [
                    'status' => $passwordValid ? 'warning' : 'error',
                    'message' => $passwordValid ? 'Contraseña correcta (pero en texto plano - inseguro)' : 'Contraseña incorrecta',
                    'note' => 'La contraseña debería estar hasheada. Usa api/fix_password.php para corregirlo.'
                ];
            }
            
            // 5. Verificar sesión
            if (session_status() === PHP_SESSION_NONE) {
                session_start();
            }
            $results['checks']['session'] = [
                'status' => 'ok',
                'message' => 'Sesión iniciada',
                'session_id' => session_id()
            ];
        }
        $stmt->close();
    }
    
    // 6. Verificar configuración de seguridad
    $results['checks']['security_config'] = [
        'status' => 'ok',
        'message' => 'Configuración de seguridad cargada',
        'is_production' => IS_PRODUCTION
    ];
    
    echo json_encode($results, JSON_PRETTY_PRINT);
} else {
    echo json_encode(['error' => 'Este script solo está disponible en desarrollo']);
}

$conn->close();
?>

