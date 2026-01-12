<?php
// api/register.php
// Endpoint para registro público de usuarios
require_once '../config/environment.php';
require_once '../config/database.php';
require_once '../config/security.php';
require_once '../config/security_headers.php';
require_once 'rate_limit.php';

setSecurityHeaders();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Rate limiting para registro
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $identifier = 'register_' . $ip;
    
    if (!checkRateLimit($identifier, 3, 600)) { // 3 intentos cada 10 minutos
        $remainingTime = getRateLimitRemainingTime($identifier, 600);
        http_response_code(429);
        echo json_encode([
            'success' => false, 
            'message' => 'Demasiados intentos de registro. Por favor espere ' . ceil($remainingTime / 60) . ' minutos.'
        ]);
        exit;
    }
    
    // Obtener datos del formulario (puede venir como JSON o FormData)
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (strpos($contentType, 'application/json') !== false) {
        $data = json_decode(file_get_contents('php://input'), true);
    } else {
        $data = $_POST;
    }
    
    $nombre = trim($data['nombre'] ?? '');
    $email = trim($data['email'] ?? '');
    $password = $data['password'] ?? '';
    $telefono = trim($data['telefono'] ?? '');
    
    // Validaciones
    if (empty($nombre) || empty($email) || empty($password)) {
        echo json_encode(['success' => false, 'message' => 'Nombre, email y contraseña son requeridos.']);
        exit;
    }
    
    // Validar nombre (solo letras, espacios, acentos)
    if (!preg_match("/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/", $nombre) || strlen($nombre) < 2) {
        echo json_encode(['success' => false, 'message' => 'El nombre solo puede contener letras, espacios y acentos. Mínimo 2 caracteres.']);
        exit;
    }
    
    // Validar email
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['success' => false, 'message' => 'El formato del email no es válido.']);
        exit;
    }
    
    // Validar teléfono si se proporciona
    if (!empty($telefono)) {
        $phoneDigits = preg_replace('/\D/', '', $telefono);
        if (strlen($phoneDigits) < 7 || strlen($phoneDigits) > 15) {
            echo json_encode(['success' => false, 'message' => 'El teléfono debe tener entre 7 y 15 dígitos.']);
            exit;
        }
    }
    
    // Validar contraseña
    if (strlen($password) < 6) {
        echo json_encode(['success' => false, 'message' => 'La contraseña debe tener al menos 6 caracteres.']);
        exit;
    }
    
    // Verificar si el usuario ya existe
    $checkSql = "SELECT id_usuario FROM usuarios WHERE nombre = ? OR correo_electronico = ?";
    $checkStmt = $conn->prepare($checkSql);
    if (!$checkStmt) {
        if (IS_PRODUCTION) {
            error_log("Register check prepare failed: " . $conn->error);
            echo json_encode(['success' => false, 'message' => 'Error del servidor.']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Error: ' . $conn->error]);
        }
        exit;
    }
    
    $checkStmt->bind_param('ss', $nombre, $email);
    $checkStmt->execute();
    $checkResult = $checkStmt->get_result();
    
    if ($checkResult->num_rows > 0) {
        echo json_encode(['success' => false, 'message' => 'El nombre de usuario o email ya está registrado.']);
        $checkStmt->close();
        exit;
    }
    $checkStmt->close();
    
    // Obtener el rol para clientes finales (soporta nombres "Usuario" o "Cliente")
    $rolSql = "
        SELECT id_rol 
        FROM roles 
        WHERE LOWER(nombre) IN ('usuario', 'cliente')
        ORDER BY CASE LOWER(nombre)
            WHEN 'usuario' THEN 0
            WHEN 'cliente' THEN 1
            ELSE 2
        END
        LIMIT 1
    ";
    $rolResult = $conn->query($rolSql);
    if ($rolResult && $rolResult->num_rows > 0) {
        $rol = $rolResult->fetch_assoc();
        $rol_id = (int)$rol['id_rol'];
    } else {
        // Fallback seguro al ID 1 (Cliente) cuando no se encuentra el rol
        $rol_id = 1;
    }
    
    // Hashear contraseña
    $hashed_password = password_hash($password, PASSWORD_DEFAULT);
    
    // Insertar usuario
    $sql = "INSERT INTO usuarios (nombre, contrasena, correo_electronico, telefono, fecha_creacion, rol_id, activa) VALUES (?, ?, ?, ?, CURDATE(), ?, 1)";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        if (IS_PRODUCTION) {
            error_log("Register insert prepare failed: " . $conn->error);
            echo json_encode(['success' => false, 'message' => 'Error del servidor.']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Error: ' . $conn->error]);
        }
        exit;
    }
    
    $stmt->bind_param('ssssi', $nombre, $hashed_password, $email, $telefono, $rol_id);
    
    if ($stmt->execute()) {
        echo json_encode([
            'success' => true, 
            'message' => 'Registro exitoso. Ahora puedes iniciar sesión.'
        ]);
    } else {
        if (IS_PRODUCTION) {
            error_log("Register insert failed: " . $stmt->error);
            echo json_encode(['success' => false, 'message' => 'Error al registrar el usuario.']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Error al registrar: ' . $stmt->error]);
        }
    }
    
    $stmt->close();
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
}

