<?php
// api/session_check.php
// Endpoint para verificar el estado de la sesión del usuario

require_once '../config/environment.php';
require_once '../config/database.php';
require_once '../config/security.php';
require_once '../config/security_headers.php';
require_once 'auth_middleware.php';

setSecurityHeaders();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $user = verifySession();
    
    if ($user) {
        echo json_encode([
            'success' => true,
            'authenticated' => true,
            'user' => [
                'id' => $user['id_usuario'],
                'username' => escapeHtml($user['nombre']),
                'role' => escapeHtml($user['rol_nombre']),
                'active' => (bool)$user['activa'],
                'sucursal_id' => isset($user['sucursal_id']) ? (int)$user['sucursal_id'] : null
            ]
        ]);
    } else {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'authenticated' => false,
            'message' => 'Sesión inválida o usuario desactivado',
            'redirect' => true
        ]);
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
}

?>

