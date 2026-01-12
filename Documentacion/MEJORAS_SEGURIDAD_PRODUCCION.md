# 🔒 Mejoras de Seguridad para Producción

## ⚠️ PROBLEMAS CRÍTICOS ENCONTRADOS

### 1. **Errores Expuestos en Producción** 🔴 CRÍTICO
**Problema:** Todos los archivos API tienen `error_reporting(E_ALL)` y `ini_set('display_errors', 1)` que exponen información sensible.

**Archivos afectados:**
- `api/login.php`
- `api/users.php`
- `api/products.php`
- `api/orders.php`
- `api/branches.php`
- `api/delivery.php`
- `api/promotions.php`
- `api/stock.php`
- `api/stats.php`
- `api/roles.php`

**Solución:** Crear archivo de configuración que detecte el entorno.

### 2. **Vulnerabilidad XSS (Cross-Site Scripting)** 🔴 CRÍTICO
**Problema:** Datos del usuario se insertan directamente en HTML sin escapar.

**Ejemplos encontrados:**
- `assets/js/main.js` línea 117: `result.nombre` insertado directamente
- `views/admin/js/main.js` línea 1043-1044: `item.nombre`, `item.correo_electronico`
- `renderProducts()` inserta datos sin escapar

**Solución:** Implementar función de escape HTML.

### 3. **Falta de Protección CSRF** 🔴 CRÍTICO
**Problema:** No hay tokens CSRF en formularios, permitiendo ataques de falsificación de solicitudes.

**Solución:** Implementar tokens CSRF.

### 4. **Credenciales Hardcodeadas** 🔴 CRÍTICO
**Problema:** Credenciales de base de datos están en el código fuente.

**Archivo:** `database/connect.php`

**Solución:** Usar variables de entorno.

### 5. **Sesiones No Seguras** 🟡 IMPORTANTE
**Problema:** Cookies de sesión no tienen flags `Secure`, `HttpOnly`, `SameSite`.

**Solución:** Configurar parámetros de sesión seguros.

### 6. **Falta de Rate Limiting** 🟡 IMPORTANTE
**Problema:** No hay protección contra fuerza bruta en login.

**Solución:** Implementar rate limiting.

### 7. **Fallback de Contraseña en Texto Plano** 🔴 CRÍTICO
**Problema:** `api/login.php` tiene fallback que acepta contraseñas en texto plano.

**Solución:** Eliminar fallback.

### 8. **Falta de Headers de Seguridad** 🟡 IMPORTANTE
**Problema:** No hay CSP, HSTS, X-Frame-Options, etc.

**Solución:** Agregar headers de seguridad.

### 9. **Falta de Validación de Origen** 🟡 IMPORTANTE
**Problema:** No se verifica el origen de las peticiones.

**Solución:** Implementar validación de origen.

### 10. **Falta de Sanitización de Salida** 🟡 IMPORTANTE
**Problema:** Datos se muestran sin `htmlspecialchars` o escape.

**Solución:** Escapar todos los datos antes de mostrar.

---

## ✅ SOLUCIONES A IMPLEMENTAR

### 1. Archivo de Configuración de Entorno

Crear `config/environment.php`:

```php
<?php
// config/environment.php

// Detectar si estamos en producción
define('IS_PRODUCTION', getenv('APP_ENV') === 'production' || 
                        (isset($_SERVER['SERVER_NAME']) && $_SERVER['SERVER_NAME'] !== 'localhost'));

// Configurar manejo de errores según el entorno
if (IS_PRODUCTION) {
    error_reporting(0);
    ini_set('display_errors', 0);
    ini_set('log_errors', 1);
    ini_set('error_log', __DIR__ . '/../logs/php-errors.log');
} else {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
}
?>
```

### 2. Variables de Entorno para Credenciales

Crear `config/database.php`:

```php
<?php
// config/database.php
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
        
        list($name, $value) = explode('=', $line, 2);
        $name = trim($name);
        $value = trim($value);
        
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

// Obtener credenciales de variables de entorno
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

$conn->set_charset("utf8mb4");

$GLOBALS['conn'] = $conn;
?>
```

Crear `.env.example`:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=pizzasteve_db
APP_ENV=development
```

### 3. Función de Escape HTML

Crear `config/security.php`:

```php
<?php
// config/security.php

/**
 * Escapa datos para prevenir XSS
 */
function escapeHtml($data) {
    if (is_array($data)) {
        return array_map('escapeHtml', $data);
    }
    return htmlspecialchars($data, ENT_QUOTES, 'UTF-8');
}

/**
 * Genera token CSRF
 */
function generateCSRFToken() {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    
    return $_SESSION['csrf_token'];
}

/**
 * Verifica token CSRF
 */
function verifyCSRFToken($token) {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    return isset($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token);
}

/**
 * Configura sesiones seguras
 */
function configureSecureSession() {
    if (session_status() === PHP_SESSION_NONE) {
        // Configurar parámetros de sesión seguros
        ini_set('session.cookie_httponly', 1);
        ini_set('session.cookie_secure', isset($_SERVER['HTTPS']) ? 1 : 0);
        ini_set('session.cookie_samesite', 'Strict');
        ini_set('session.use_strict_mode', 1);
        ini_set('session.cookie_lifetime', 3600); // 1 hora
        
        session_start();
        
        // Regenerar ID de sesión periódicamente
        if (!isset($_SESSION['created'])) {
            $_SESSION['created'] = time();
        } else if (time() - $_SESSION['created'] > 1800) { // 30 minutos
            session_regenerate_id(true);
            $_SESSION['created'] = time();
        }
    }
}
?>
```

### 4. Rate Limiting para Login

Crear `api/rate_limit.php`:

```php
<?php
// api/rate_limit.php

function checkRateLimit($identifier, $maxAttempts = 5, $timeWindow = 300) {
    $cacheFile = sys_get_temp_dir() . '/rate_limit_' . md5($identifier) . '.json';
    
    $attempts = [];
    if (file_exists($cacheFile)) {
        $attempts = json_decode(file_get_contents($cacheFile), true) ?: [];
    }
    
    // Limpiar intentos antiguos
    $currentTime = time();
    $attempts = array_filter($attempts, function($timestamp) use ($currentTime, $timeWindow) {
        return ($currentTime - $timestamp) < $timeWindow;
    });
    
    // Verificar límite
    if (count($attempts) >= $maxAttempts) {
        return false;
    }
    
    // Registrar intento
    $attempts[] = $currentTime;
    file_put_contents($cacheFile, json_encode($attempts));
    
    return true;
}
?>
```

### 5. Headers de Seguridad

Crear `config/security_headers.php`:

```php
<?php
// config/security_headers.php

function setSecurityHeaders() {
    // Prevenir clickjacking
    header('X-Frame-Options: DENY');
    
    // Prevenir MIME type sniffing
    header('X-Content-Type-Options: nosniff');
    
    // XSS Protection (legacy, pero útil)
    header('X-XSS-Protection: 1; mode=block');
    
    // Referrer Policy
    header('Referrer-Policy: strict-origin-when-cross-origin');
    
    // Content Security Policy (ajustar según necesidades)
    header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; connect-src 'self';");
    
    // HSTS (solo en HTTPS)
    if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') {
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    }
    
    // Permissions Policy
    header('Permissions-Policy: geolocation=(), microphone=(), camera=()');
}
?>
```

### 6. Actualizar `api/login.php`

```php
<?php
// api/login.php
require_once '../config/environment.php';
require_once '../config/database.php';
require_once '../config/security.php';
require_once '../config/security_headers.php';
require_once 'rate_limit.php';

setSecurityHeaders();
configureSecureSession();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';
    
    // Rate limiting
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $identifier = $username . '_' . $ip;
    
    if (!checkRateLimit($identifier, 5, 300)) {
        http_response_code(429);
        echo json_encode([
            'success' => false, 
            'message' => 'Demasiados intentos. Por favor espere 5 minutos.'
        ]);
        exit;
    }
    
    if (empty($username) || empty($password)) {
        echo json_encode(['success' => false, 'message' => 'Usuario y contraseña son requeridos.']);
        exit;
    }
    
    $sql = "SELECT u.*, r.nombre as role_name FROM usuarios u JOIN roles r ON u.rol_id = r.id_rol WHERE u.nombre = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('s', $username);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 1) {
        $user = $result->fetch_assoc();
        
        if (!$user['activa']) {
            echo json_encode(['success' => false, 'message' => 'Su cuenta ha sido desactivada. Contacte al administrador.']);
            $stmt->close();
            exit;
        }
        
        // SOLO verificar con password_verify (eliminar fallback)
        if (password_verify($password, $user['contrasena'])) {
            session_regenerate_id(true); // Prevenir session fixation
            $_SESSION['user_id'] = $user['id_usuario'];
            $_SESSION['username'] = escapeHtml($user['nombre']);
            $_SESSION['role'] = escapeHtml($user['role_name']);
            $_SESSION['last_activity'] = time();
            
            echo json_encode([
                'success' => true, 
                'role' => strtolower($user['role_name']),
                'user_id' => $user['id_usuario'],
                'username' => escapeHtml($user['nombre'])
            ]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Usuario o contraseña incorrectos.']);
        }
    } else {
        // Mismo mensaje para no revelar si el usuario existe
        echo json_encode(['success' => false, 'message' => 'Usuario o contraseña incorrectos.']);
    }
    
    $stmt->close();
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
}
?>
```

### 7. Función JavaScript para Escape HTML

Crear `assets/js/security.js`:

```javascript
// assets/js/security.js

/**
 * Escapa HTML para prevenir XSS
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Crea elemento de forma segura
 */
function createSafeElement(tag, text, attributes = {}) {
    const element = document.createElement(tag);
    element.textContent = text; // textContent escapa automáticamente
    
    for (const [key, value] of Object.entries(attributes)) {
        if (key === 'innerHTML') {
            // Nunca usar innerHTML con datos del usuario
            console.warn('No usar innerHTML con datos del usuario');
            continue;
        }
        element.setAttribute(key, escapeHtml(value));
    }
    
    return element;
}
```

### 8. Actualizar `.htaccess`

```apache
# .htaccess

# Prevenir acceso a archivos sensibles
<FilesMatch "^\.">
    Order allow,deny
    Deny from all
</FilesMatch>

<FilesMatch "\.(env|log|sql)$">
    Order allow,deny
    Deny from all
</FilesMatch>

# Headers de seguridad
<IfModule mod_headers.c>
    Header set X-Frame-Options "DENY"
    Header set X-Content-Type-Options "nosniff"
    Header set X-XSS-Protection "1; mode=block"
    Header set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>

# Prevenir listado de directorios
Options -Indexes

# Habilitar compresión
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
</IfModule>
```

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

- [ ] Crear estructura de carpetas `config/` y `logs/`
- [ ] Crear archivo `.env` con credenciales (NO subir a git)
- [ ] Agregar `.env` al `.gitignore`
- [ ] Implementar `config/environment.php`
- [ ] Implementar `config/database.php`
- [ ] Implementar `config/security.php`
- [ ] Implementar `config/security_headers.php`
- [ ] Implementar `api/rate_limit.php`
- [ ] Actualizar todos los archivos API para usar la nueva configuración
- [ ] Eliminar `error_reporting` y `ini_set('display_errors')` de todos los archivos API
- [ ] Actualizar `database/connect.php` para usar `config/database.php`
- [ ] Implementar escape HTML en JavaScript (`assets/js/security.js`)
- [ ] Actualizar todos los `innerHTML` para usar escape
- [ ] Agregar tokens CSRF a todos los formularios
- [ ] Actualizar `.htaccess` con headers de seguridad
- [ ] Eliminar fallback de contraseña en texto plano de `api/login.php`
- [ ] Configurar sesiones seguras en `api/auth_middleware.php`
- [ ] Implementar rate limiting en login
- [ ] Probar todas las funcionalidades después de los cambios
- [ ] Configurar backups automáticos de base de datos
- [ ] Configurar SSL/HTTPS en producción
- [ ] Revisar permisos de archivos (644 para archivos, 755 para directorios)
- [ ] Configurar firewall del servidor

---

## 🚨 PRIORIDADES

### CRÍTICO (Implementar antes de producción):
1. Ocultar errores en producción
2. Eliminar fallback de contraseña en texto plano
3. Implementar escape HTML (prevenir XSS)
4. Mover credenciales a variables de entorno
5. Configurar sesiones seguras

### IMPORTANTE (Implementar pronto):
6. Implementar CSRF tokens
7. Implementar rate limiting
8. Agregar headers de seguridad
9. Validación de origen

### RECOMENDADO (Mejoras adicionales):
10. Logging de seguridad
11. Monitoreo de intentos de acceso
12. Auditoría de cambios
13. Backups automáticos

---

## 📝 NOTAS ADICIONALES

1. **Backups:** Configurar backups automáticos diarios de la base de datos
2. **SSL:** Asegurar que el sitio use HTTPS en producción
3. **Actualizaciones:** Mantener PHP y todas las dependencias actualizadas
4. **Monitoreo:** Implementar sistema de monitoreo y alertas
5. **Testing:** Realizar pruebas de penetración antes de producción

