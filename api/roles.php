<?php
// api/roles.php
require_once '../config/environment.php';
require_once '../config/database.php';
require_once '../config/security.php';
require_once '../config/security_headers.php';
require_once 'auth_middleware.php';

setSecurityHeaders();
header('Content-Type: application/json');

// Verificar autenticación
$current_user = requireAuth(['admin']);

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $sql = "SELECT id_rol, nombre, descripcion FROM roles ORDER BY nombre";
        $result = $conn->query($sql);
        
        if ($result === false) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error en la consulta SQL: ' . $conn->error]);
            exit;
        }

        $roles = [];
        while ($row = $result->fetch_assoc()) {
            $roles[] = $row;
        }
        echo json_encode($roles);
        break;
    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
        break;
}

$conn->close();
?>

