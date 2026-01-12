<?php
// config/database.php
// Configuración de base de datos con variables de entorno

require_once __DIR__ . '/environment.php';

// Cargar variables de entorno desde .env
function loadEnv($path) {
    if (!file_exists($path)) {
        return;
    }
    
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) {
            continue;
        }
        
        if (strpos($line, '=') === false) {
            continue;
        }
        
        list($name, $value) = explode('=', $line, 2);
        $name = trim($name);
        $value = trim($value);
        
        // Remover comillas si existen
        $value = trim($value, '"\'');
        
        if (!array_key_exists($name, $_SERVER) && !array_key_exists($name, $_ENV)) {
            putenv(sprintf('%s=%s', $name, $value));
            $_ENV[$name] = $value;
            $_SERVER[$name] = $value;
        }
    }
}

// Cargar .env si existe
$envPath = __DIR__ . '/../.env';
if (file_exists($envPath)) {
    loadEnv($envPath);
}

// Obtener credenciales de variables de entorno con valores por defecto
$servername = getenv('DB_HOST') ?: 'localhost';
$username = getenv('DB_USER') ?: 'root';
$password = getenv('DB_PASSWORD') ?: '';
$dbname = getenv('DB_NAME') ?: 'pizzasteve_db';

// Crear conexión
$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    if (IS_PRODUCTION) {
        error_log("Database connection failed: " . $conn->connect_error);
        die(json_encode(['success' => false, 'message' => 'Error de conexión a la base de datos.']));
    } else {
        die("Connection failed: " . $conn->connect_error);
    }
}

// Establecer el charset a utf8mb4 para soportar caracteres especiales
$conn->set_charset("utf8mb4");

// Hacer la conexión disponible globalmente para el middleware
$GLOBALS['conn'] = $conn;
$GLOBALS['servername'] = $servername;
$GLOBALS['username'] = $username;
$GLOBALS['password'] = $password;
$GLOBALS['dbname'] = $dbname;

