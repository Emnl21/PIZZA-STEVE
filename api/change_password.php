<?php
// api/change_password.php
require_once '../config/environment.php';
require_once '../config/database.php';
require_once '../config/security.php';
require_once '../config/security_headers.php';
require_once 'auth_middleware.php';

setSecurityHeaders();
header('Content-Type: application/json');

// Usuario autenticado puede cambiar su propia contraseña
$current_user = requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$current_password = $data['current_password'] ?? '';
$new_password = $data['new_password'] ?? '';
$confirm_password = $data['confirm_password'] ?? '';
$force_change = isset($data['force_change']) && $data['force_change'] === true;

// Validaciones
if (empty($new_password)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'La nueva contraseña es requerida.']);
    exit;
}

if (strlen($new_password) < 6) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'La nueva contraseña debe tener al menos 6 caracteres.']);
    exit;
}

if ($new_password !== $confirm_password) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Las contraseñas no coinciden.']);
    exit;
}

// Si no es un cambio forzado, verificar contraseña actual
if (!$force_change) {
    if (empty($current_password)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'La contraseña actual es requerida.']);
        exit;
    }
    
    // Obtener contraseña actual del usuario
    $sql = "SELECT contrasena FROM usuarios WHERE id_usuario = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('i', $current_user['id_usuario']);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        $stmt->close();
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Usuario no encontrado.']);
        exit;
    }
    
    $user_data = $result->fetch_assoc();
    $stmt->close();
    
    // Verificar contraseña actual
    if (!password_verify($current_password, $user_data['contrasena'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'La contraseña actual es incorrecta.']);
        exit;
    }
}

// Verificar que la nueva contraseña no sea igual a la actual (solo si no es cambio forzado)
if (!$force_change) {
    if (password_verify($new_password, $user_data['contrasena'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'La nueva contraseña debe ser diferente a la actual.']);
        exit;
    }
}

// Hashear nueva contraseña
$hashed_password = password_hash($new_password, PASSWORD_DEFAULT);

// Verificar si la columna debe_cambiar_password existe
$check_column = "SHOW COLUMNS FROM usuarios LIKE 'debe_cambiar_password'";
$column_exists = $conn->query($check_column);
$has_password_change_field = ($column_exists && $column_exists->num_rows > 0);

// Actualizar contraseña y quitar el flag de debe_cambiar_password si existe
if ($has_password_change_field) {
    $sql_update = "UPDATE usuarios SET contrasena = ?, debe_cambiar_password = 0 WHERE id_usuario = ?";
    $stmt_update = $conn->prepare($sql_update);
    if ($stmt_update) {
        $stmt_update->bind_param('si', $hashed_password, $current_user['id_usuario']);
        if (!$stmt_update->execute()) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error al actualizar la contraseña: ' . $stmt_update->error]);
            $stmt_update->close();
            exit;
        }
        $stmt_update->close();
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Error al preparar la consulta: ' . $conn->error]);
        exit;
    }
} else {
    // Si no existe la columna, solo actualizar la contraseña
    $sql_update = "UPDATE usuarios SET contrasena = ? WHERE id_usuario = ?";
    $stmt_update = $conn->prepare($sql_update);
    if ($stmt_update) {
        $stmt_update->bind_param('si', $hashed_password, $current_user['id_usuario']);
        if (!$stmt_update->execute()) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error al actualizar la contraseña: ' . $stmt_update->error]);
            $stmt_update->close();
            exit;
        }
        $stmt_update->close();
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Error al preparar la consulta: ' . $conn->error]);
        exit;
    }
}

echo json_encode([
    'success' => true,
    'message' => 'Contraseña actualizada exitosamente.'
]);

$conn->close();
?>

