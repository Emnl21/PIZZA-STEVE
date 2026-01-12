<?php
// api/logout.php
// Endpoint para cerrar sesión

require_once '../config/environment.php';
require_once '../config/security.php';
require_once '../config/security_headers.php';
require_once 'auth_middleware.php';

setSecurityHeaders();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Destruir sesión
    destroySession();
    
    echo json_encode([
        'success' => true,
        'message' => 'Sesión cerrada exitosamente'
    ]);
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
}

?>

