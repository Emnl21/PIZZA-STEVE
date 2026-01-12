<?php
// config/environment.php
// Configuración de entorno para desarrollo y producción

// Detectar si estamos en producción
// Puedes cambiar esto según tu configuración
define('IS_PRODUCTION', 
    getenv('APP_ENV') === 'production' || 
    (isset($_SERVER['SERVER_NAME']) && $_SERVER['SERVER_NAME'] !== 'localhost' && $_SERVER['SERVER_NAME'] !== '127.0.0.1')
);

// Configurar manejo de errores según el entorno
if (IS_PRODUCTION) {
    // En producción: ocultar errores y loguearlos
    error_reporting(0);
    ini_set('display_errors', 0);
    ini_set('log_errors', 1);
    
    // Crear directorio de logs si no existe
    $logDir = __DIR__ . '/../logs';
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0755, true);
    }
    
    ini_set('error_log', $logDir . '/php-errors.log');
} else {
    // En desarrollo: mostrar errores
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
}

// Timezone
date_default_timezone_set('America/La_Paz');

// Código de seguridad para eliminar backups
// IMPORTANTE: Cambia este código por uno seguro y guárdalo en un lugar seguro
// Este código se requiere para eliminar backups desde el panel de administración
define('BACKUP_DELETE_CODE', getenv('BACKUP_DELETE_CODE') ?: 'DELETE_BACKUP_2024');

