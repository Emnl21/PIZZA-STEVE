<?php
// api/auth_middleware.php
// Middleware para verificar autenticación y estado del usuario

// Cargar funciones de seguridad si no están cargadas
if (!function_exists('configureSecureSession')) {
    require_once __DIR__ . '/../config/security.php';
}

/**
 * Verifica si el usuario tiene una sesión válida y está activo
 * @return array|false Retorna los datos del usuario si es válido, false en caso contrario
 */
function verifySession() {
    // Usar sesiones seguras
    configureSecureSession();
    
    // Verificar si hay sesión iniciada
    if (!isset($_SESSION['user_id']) || !isset($_SESSION['username'])) {
        return false;
    }
    
    $user_id = $_SESSION['user_id'];
    
    // Verificar que el usuario existe y está activo en la base de datos
    // Usar la conexión global si existe, si no crear una nueva
    if (!isset($GLOBALS['conn']) || !$GLOBALS['conn']) {
        require_once '../database/connect.php';
    } else {
        $conn = $GLOBALS['conn'];
    }
    
$sql = "SELECT u.id_usuario, u.nombre, u.correo_electronico, u.rol_id, u.sucursal_id, u.activa, r.nombre as rol_nombre 
            FROM usuarios u 
            JOIN roles r ON u.rol_id = r.id_rol 
            WHERE u.id_usuario = ?";
    
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return false;
    }
    
    $stmt->bind_param('i', $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        // Usuario no existe en la base de datos
        destroySession();
        $stmt->close();
        return false;
    }
    
    $user = $result->fetch_assoc();
    $stmt->close();
    
    // Verificar que el usuario está activo
    if (!$user['activa']) {
        // Usuario desactivado, destruir sesión
        destroySession();
        return false;
    }
    
    // Verificar que los datos de la sesión coinciden con la base de datos
    if ($user['nombre'] !== $_SESSION['username']) {
        // Los datos han cambiado, actualizar sesión (escapar para prevenir XSS)
        if (!function_exists('escapeHtml')) {
            require_once __DIR__ . '/../config/security.php';
        }
        $_SESSION['username'] = escapeHtml($user['nombre']);
        $_SESSION['role'] = escapeHtml($user['rol_nombre']);
    }
    
    // Actualizar última actividad
    $_SESSION['last_activity'] = time();
    
    return $user;
}

/**
 * Verifica si el usuario tiene un rol específico
 * @param string|array $required_role Rol o roles permitidos
 * @return bool
 */
function verifyRole($required_role) {
    $user = verifySession();
    
    if (!$user) {
        return false;
    }
    
    if (is_array($required_role)) {
        return in_array(strtolower($user['rol_nombre']), array_map('strtolower', $required_role));
    }
    
    return strtolower($user['rol_nombre']) === strtolower($required_role);
}

/**
 * Requiere autenticación para acceder a la API
 * @param string|array|null $required_role Rol o roles requeridos (null para cualquier rol)
 * @return array Datos del usuario autenticado
 */
function requireAuth($required_role = null) {
    if (!isset($_SESSION)) {
        session_start();
    }
    
    $user = verifySession();
    
    if (!$user) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'message' => 'No autorizado. Por favor, inicie sesión.',
            'redirect' => true
        ]);
        exit;
    }
    
    // Verificar rol si se especifica
    if ($required_role !== null) {
        if (!verifyRole($required_role)) {
            http_response_code(403);
            header('Content-Type: application/json');
            echo json_encode([
                'success' => false,
                'message' => 'No tiene permisos para realizar esta acción.',
                'redirect' => true
            ]);
            exit;
        }
    }
    
    return $user;
}

/**
 * Destruye la sesión del usuario
 */
function destroySession() {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    $_SESSION = array();
    
    // Destruir la cookie de sesión
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params["path"], $params["domain"],
            $params["secure"], $params["httponly"]
        );
    }
    
    session_destroy();
}

/**
 * Verifica si un usuario puede modificar/eliminar a otro usuario
 * Previene que un admin se desactive a sí mismo
 * @param int $target_user_id ID del usuario objetivo
 * @param int $current_user_id ID del usuario actual
 * @param string $action Acción a realizar (delete, deactivate, etc.)
 * @return bool
 */
function canModifyUser($target_user_id, $current_user_id, $action = 'modify') {
    // Un usuario no puede modificar/eliminar a sí mismo
    if ($target_user_id == $current_user_id && ($action === 'delete' || $action === 'deactivate')) {
        return false;
    }
    
    return true;
}

?>

