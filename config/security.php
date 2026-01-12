<?php
// config/security.php
// Funciones de seguridad

/**
 * Escapa datos para prevenir XSS
 * @param mixed $data Datos a escapar
 * @return mixed Datos escapados
 */
function escapeHtml($data) {
    if (is_array($data)) {
        return array_map('escapeHtml', $data);
    }
    if (is_object($data)) {
        foreach ($data as $key => $value) {
            $data->$key = escapeHtml($value);
        }
        return $data;
    }
    return htmlspecialchars($data, ENT_QUOTES, 'UTF-8');
}

/**
 * Genera token CSRF
 * @return string Token CSRF
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
 * @param string $token Token a verificar
 * @return bool True si el token es válido
 */
function verifyCSRFToken($token) {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    if (!isset($_SESSION['csrf_token'])) {
        return false;
    }
    
    return hash_equals($_SESSION['csrf_token'], $token);
}

/**
 * Configura sesiones seguras
 */
function configureSecureSession() {
    if (session_status() === PHP_SESSION_NONE) {
        // Configurar parámetros de sesión seguros
        ini_set('session.cookie_httponly', 1);
        ini_set('session.cookie_secure', isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 1 : 0);
        ini_set('session.cookie_samesite', 'Strict');
        ini_set('session.use_strict_mode', 1);
        ini_set('session.cookie_lifetime', 3600); // 1 hora
        ini_set('session.gc_maxlifetime', 3600); // 1 hora
        
        session_start();
        
        // Regenerar ID de sesión periódicamente para prevenir session fixation
        if (!isset($_SESSION['created'])) {
            $_SESSION['created'] = time();
        } else if (time() - $_SESSION['created'] > 1800) { // 30 minutos
            session_regenerate_id(true);
            $_SESSION['created'] = time();
        }
    }
}

/**
 * Sanitiza entrada de datos
 * @param mixed $data Datos a sanitizar
 * @return mixed Datos sanitizados
 */
function sanitizeInput($data) {
    if (is_array($data)) {
        return array_map('sanitizeInput', $data);
    }
    return trim(strip_tags($data));
}

