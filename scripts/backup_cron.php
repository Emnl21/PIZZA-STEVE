<?php
/**
 * Script para ejecutar backups automáticos desde cron
 * 
 * Uso en crontab:
 * # Backup diario a las 2:00 AM
 * 0 2 * * * /usr/bin/php /ruta/al/proyecto/scripts/backup_cron.php >> /ruta/al/proyecto/logs/backup_cron.log 2>&1
 * 
 * # Backup cada 6 horas
 * 0 */6 * * * /usr/bin/php /ruta/al/proyecto/scripts/backup_cron.php >> /ruta/al/proyecto/logs/backup_cron.log 2>&1
 */

// Cambiar al directorio del proyecto
$project_dir = dirname(__DIR__);
chdir($project_dir);

// Cargar configuración
require_once __DIR__ . '/../config/environment.php';
require_once __DIR__ . '/../config/database.php';

// Configuración
$backup_dir = $project_dir . '/backups';
$max_backups = 30;
$backup_prefix = 'pizzasteve_backup_';

// Asegurar que el directorio de backups existe
if (!is_dir($backup_dir)) {
    @mkdir($backup_dir, 0755, true);
}

// Función para logging
function logMessage($message) {
    $log_file = dirname(__DIR__) . '/logs/backup_cron.log';
    $timestamp = date('Y-m-d H:i:s');
    $log_entry = "[$timestamp] $message\n";
    file_put_contents($log_file, $log_entry, FILE_APPEND);
    echo $log_entry;
}

// Detectar tipo de base de datos
function getDatabaseType() {
    global $servername;
    
    if (stripos($servername, 'supabase') !== false || 
        stripos($servername, 'postgres') !== false ||
        stripos($servername, '.supabase.co') !== false) {
        return 'postgresql';
    }
    
    return 'mysql';
}

// Crear backup MySQL
function createMySQLBackup($host, $user, $password, $database, $backup_file) {
    $command = sprintf(
        'mysqldump --host=%s --user=%s --password=%s --single-transaction --routines --triggers %s > %s 2>&1',
        escapeshellarg($host),
        escapeshellarg($user),
        escapeshellarg($password),
        escapeshellarg($database),
        escapeshellarg($backup_file)
    );
    
    exec($command, $output, $return_var);
    
    if ($return_var !== 0) {
        $error = implode("\n", $output);
        throw new Exception("Error al crear backup MySQL: " . $error);
    }
    
    return filesize($backup_file) > 0;
}

// Crear backup PostgreSQL
function createPostgreSQLBackup($host, $user, $password, $database, $backup_file) {
    $pg_host = parse_url($host, PHP_URL_HOST) ?: $host;
    $pg_port = parse_url($host, PHP_URL_PORT) ?: 5432;
    
    putenv("PGPASSWORD=" . $password);
    
    $command = sprintf(
        'pg_dump --host=%s --port=%s --username=%s --dbname=%s --no-password --format=custom --file=%s 2>&1',
        escapeshellarg($pg_host),
        escapeshellarg($pg_port),
        escapeshellarg($user),
        escapeshellarg($database),
        escapeshellarg($backup_file)
    );
    
    exec($command, $output, $return_var);
    putenv("PGPASSWORD");
    
    if ($return_var !== 0) {
        $error = implode("\n", $output);
        throw new Exception("Error al crear backup PostgreSQL: " . $error);
    }
    
    return filesize($backup_file) > 0;
}

// Limpiar backups antiguos
function cleanupOldBackups($backup_dir, $prefix, $max_backups) {
    $files = glob($backup_dir . '/' . $prefix . '*.sql');
    $files_custom = glob($backup_dir . '/' . $prefix . '*.dump');
    $all_files = array_merge($files, $files_custom);
    
    usort($all_files, function($a, $b) {
        return filemtime($b) - filemtime($a);
    });
    
    if (count($all_files) > $max_backups) {
        $to_delete = array_slice($all_files, $max_backups);
        $deleted = 0;
        foreach ($to_delete as $file) {
            if (@unlink($file)) {
                $deleted++;
            }
        }
        return $deleted;
    }
    
    return 0;
}

// Ejecutar backup
try {
    logMessage("Iniciando backup automático...");
    
    $db_type = getDatabaseType();
    $timestamp = date('Y-m-d_His');
    
    if ($db_type === 'postgresql') {
        $backup_file = $backup_dir . '/' . $backup_prefix . $timestamp . '.dump';
        $created = createPostgreSQLBackup($servername, $username, $password, $dbname, $backup_file);
    } else {
        $backup_file = $backup_dir . '/' . $backup_prefix . $timestamp . '.sql';
        $created = createMySQLBackup($servername, $username, $password, $dbname, $backup_file);
    }
    
    if (!$created || !file_exists($backup_file)) {
        throw new Exception("No se pudo crear el archivo de backup.");
    }
    
    $file_size = filesize($backup_file);
    $file_size_mb = round($file_size / 1024 / 1024, 2);
    
    logMessage("Backup creado exitosamente: " . basename($backup_file) . " (" . $file_size_mb . " MB)");
    
    // Limpiar backups antiguos
    $deleted = cleanupOldBackups($backup_dir, $backup_prefix, $max_backups);
    if ($deleted > 0) {
        logMessage("Eliminados $deleted backups antiguos.");
    }
    
    logMessage("Backup completado exitosamente.");
    exit(0);
    
} catch (Exception $e) {
    logMessage("ERROR: " . $e->getMessage());
    exit(1);
}
?>

