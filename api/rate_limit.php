<?php
// api/rate_limit.php
// Sistema de rate limiting para prevenir ataques de fuerza bruta

/**
 * Verifica si se ha excedido el límite de intentos
 * @param string $identifier Identificador único (usuario, IP, etc.)
 * @param int $maxAttempts Número máximo de intentos permitidos
 * @param int $timeWindow Ventana de tiempo en segundos
 * @return bool True si está dentro del límite, False si se excedió
 */
function checkRateLimit($identifier, $maxAttempts = 5, $timeWindow = 300) {
    $cacheDir = sys_get_temp_dir() . '/rate_limit';
    
    // Crear directorio si no existe
    if (!is_dir($cacheDir)) {
        @mkdir($cacheDir, 0755, true);
    }
    
    $cacheFile = $cacheDir . '/' . md5($identifier) . '.json';
    
    $attempts = [];
    if (file_exists($cacheFile)) {
        $data = file_get_contents($cacheFile);
        $attempts = json_decode($data, true) ?: [];
    }
    
    // Limpiar intentos antiguos fuera de la ventana de tiempo
    $currentTime = time();
    $attempts = array_filter($attempts, function($timestamp) use ($currentTime, $timeWindow) {
        return ($currentTime - $timestamp) < $timeWindow;
    });
    
    // Reindexar array
    $attempts = array_values($attempts);
    
    // Verificar si se excedió el límite
    if (count($attempts) >= $maxAttempts) {
        return false;
    }
    
    // Registrar nuevo intento
    $attempts[] = $currentTime;
    file_put_contents($cacheFile, json_encode($attempts));
    
    return true;
}

/**
 * Obtiene el tiempo restante hasta que se pueda intentar de nuevo
 * @param string $identifier Identificador único
 * @param int $timeWindow Ventana de tiempo en segundos
 * @return int Segundos restantes, 0 si no hay bloqueo
 */
function getRateLimitRemainingTime($identifier, $timeWindow = 300) {
    $cacheDir = sys_get_temp_dir() . '/rate_limit';
    $cacheFile = $cacheDir . '/' . md5($identifier) . '.json';
    
    if (!file_exists($cacheFile)) {
        return 0;
    }
    
    $data = file_get_contents($cacheFile);
    $attempts = json_decode($data, true) ?: [];
    
    if (empty($attempts)) {
        return 0;
    }
    
    $currentTime = time();
    $oldestAttempt = min($attempts);
    $remaining = $timeWindow - ($currentTime - $oldestAttempt);
    
    return max(0, $remaining);
}

/**
 * Obtiene el número de intentos restantes antes de ser bloqueado
 * @param string $identifier Identificador único
 * @param int $maxAttempts Número máximo de intentos permitidos
 * @param int $timeWindow Ventana de tiempo en segundos
 * @return array ['remaining' => int, 'total' => int, 'blocked' => bool]
 */
function getRateLimitAttempts($identifier, $maxAttempts = 5, $timeWindow = 300) {
    $cacheDir = sys_get_temp_dir() . '/rate_limit';
    $cacheFile = $cacheDir . '/' . md5($identifier) . '.json';
    
    $attempts = [];
    if (file_exists($cacheFile)) {
        $data = file_get_contents($cacheFile);
        $attempts = json_decode($data, true) ?: [];
    }
    
    // Limpiar intentos antiguos fuera de la ventana de tiempo
    $currentTime = time();
    $attempts = array_filter($attempts, function($timestamp) use ($currentTime, $timeWindow) {
        return ($currentTime - $timestamp) < $timeWindow;
    });
    
    // Reindexar array
    $attempts = array_values($attempts);
    
    $remaining = max(0, $maxAttempts - count($attempts));
    $blocked = count($attempts) >= $maxAttempts;
    
    return [
        'remaining' => $remaining,
        'total' => $maxAttempts,
        'used' => count($attempts),
        'blocked' => $blocked
    ];
}

