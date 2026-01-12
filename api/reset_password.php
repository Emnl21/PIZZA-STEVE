<?php
// api/reset_password.php
require_once '../config/environment.php';
require_once '../config/database.php';
require_once '../config/security.php';
require_once '../config/security_headers.php';
require_once 'auth_middleware.php';

setSecurityHeaders();
header('Content-Type: application/json');

// Solo admin puede restablecer contraseñas
$current_user = requireAuth(['admin']);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$usuario_id = $data['usuario_id'] ?? null;

if (!$usuario_id || !is_numeric($usuario_id)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'ID de usuario requerido.']);
    exit;
}

$usuario_id = (int)$usuario_id;

// Obtener información del usuario, incluyendo C.I. si existe
$sql = "SELECT id_usuario, nombre, correo_electronico, ci FROM usuarios WHERE id_usuario = ?";
$stmt = $conn->prepare($sql);
$stmt->bind_param('i', $usuario_id);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    $stmt->close();
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Usuario no encontrado.']);
    exit;
}

$user = $result->fetch_assoc();
$stmt->close();

// Obtener C.I. del usuario (si existe en la BD, si no usar un valor por defecto)
$ci = $user['ci'] ?? null;

// Si no hay C.I. en la BD, intentar obtenerlo de otra forma o usar un valor temporal
// Por ahora, si no hay C.I., usaremos el ID del usuario como contraseña temporal
if (empty($ci)) {
    // Intentar extraer C.I. del nombre o usar ID como fallback
    // En producción, deberías tener un campo CI en la tabla usuarios
    $ci = (string)$usuario_id; // Temporal: usar ID como C.I.
}

// Hashear la nueva contraseña (C.I.)
$hashed_password = password_hash($ci, PASSWORD_DEFAULT);

// Verificar si la columna debe_cambiar_password existe
$check_column = "SHOW COLUMNS FROM usuarios LIKE 'debe_cambiar_password'";
$column_exists = $conn->query($check_column);
$has_password_change_field = ($column_exists && $column_exists->num_rows > 0);

// Actualizar contraseña y marcar que debe cambiarla si el campo existe
if ($has_password_change_field) {
    $sql_update = "UPDATE usuarios SET contrasena = ?, debe_cambiar_password = 1 WHERE id_usuario = ?";
    $stmt_update = $conn->prepare($sql_update);
    if ($stmt_update) {
        $stmt_update->bind_param('si', $hashed_password, $usuario_id);
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
        $stmt_update->bind_param('si', $hashed_password, $usuario_id);
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
    'message' => "Contraseña restablecida exitosamente para {$user['nombre']}. La nueva contraseña es su C.I. ({$ci}) y deberá cambiarla al iniciar sesión.",
    'ci' => $ci
]);

$conn->close();
?>

