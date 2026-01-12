<?php
// api/backup.php
// Sistema de backups automáticos de base de datos

require_once '../config/environment.php';
require_once '../config/database.php';
require_once '../config/security.php';
require_once '../config/security_headers.php';
require_once 'auth_middleware.php';

setSecurityHeaders();
header('Content-Type: application/json');

// Solo administradores pueden ejecutar backups
$current_user = requireAuth(['admin']);

$method = $_SERVER['REQUEST_METHOD'];

// Configuración de backups
$backup_dir = __DIR__ . '/../backups';
$max_backups = 30; // Mantener los últimos 30 backups
$backup_prefix = 'pizzasteve_backup_';

// Asegurar que el directorio de backups existe
if (!is_dir($backup_dir)) {
    @mkdir($backup_dir, 0755, true);
}

/**
 * Detectar el tipo de base de datos
 */
function getDatabaseType() {
    global $servername;
    
    // Si el host contiene 'supabase' o 'postgres', es PostgreSQL
    if (stripos($servername, 'supabase') !== false || 
        stripos($servername, 'postgres') !== false ||
        stripos($servername, '.supabase.co') !== false) {
        return 'postgresql';
    }
    
    // Por defecto, asumir MySQL/MariaDB
    return 'mysql';
}

/**
 * Crear backup de MySQL/MariaDB usando mysqldump
 */
function createMySQLBackup($host, $user, $password, $database, $backup_file) {
    // Construir comando mysqldump
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

/**
 * Crear backup de PostgreSQL usando pg_dump
 */
function createPostgreSQLBackup($host, $user, $password, $database, $backup_file) {
    // Construir string de conexión
    $pg_host = parse_url($host, PHP_URL_HOST) ?: $host;
    $pg_port = parse_url($host, PHP_URL_PORT) ?: 5432;
    
    // Configurar variable de entorno para la contraseña
    putenv("PGPASSWORD=" . $password);
    
    // Construir comando pg_dump
    $command = sprintf(
        'pg_dump --host=%s --port=%s --username=%s --dbname=%s --no-password --format=custom --file=%s 2>&1',
        escapeshellarg($pg_host),
        escapeshellarg($pg_port),
        escapeshellarg($user),
        escapeshellarg($database),
        escapeshellarg($backup_file)
    );
    
    exec($command, $output, $return_var);
    
    // Limpiar variable de entorno
    putenv("PGPASSWORD");
    
    if ($return_var !== 0) {
        $error = implode("\n", $output);
        throw new Exception("Error al crear backup PostgreSQL: " . $error);
    }
    
    return filesize($backup_file) > 0;
}

/**
 * Crear backup usando PHP puro (fallback)
 */
function createPHPBackup($conn, $database, $backup_file) {
    $tables = [];
    $result = $conn->query("SHOW TABLES");
    
    if (!$result) {
        throw new Exception("No se pudieron obtener las tablas: " . $conn->error);
    }
    
    while ($row = $result->fetch_array()) {
        $tables[] = $row[0];
    }
    
    $output = "-- Backup de base de datos: $database\n";
    $output .= "-- Fecha: " . date('Y-m-d H:i:s') . "\n\n";
    $output .= "SET FOREIGN_KEY_CHECKS=0;\n\n";
    
    foreach ($tables as $table) {
        // Obtener estructura de la tabla
        $result = $conn->query("SHOW CREATE TABLE `$table`");
        if ($result) {
            $row = $result->fetch_array();
            $output .= "\n-- Estructura de tabla `$table`\n";
            $output .= "DROP TABLE IF EXISTS `$table`;\n";
            $output .= $row[1] . ";\n\n";
            
            // Obtener datos de la tabla
            $result_data = $conn->query("SELECT * FROM `$table`");
            if ($result_data && $result_data->num_rows > 0) {
                $output .= "-- Datos de tabla `$table`\n";
                $output .= "INSERT INTO `$table` VALUES\n";
                
                $rows = [];
                while ($row_data = $result_data->fetch_assoc()) {
                    $values = [];
                    foreach ($row_data as $value) {
                        if ($value === null) {
                            $values[] = 'NULL';
                        } else {
                            $values[] = "'" . $conn->real_escape_string($value) . "'";
                        }
                    }
                    $rows[] = "(" . implode(",", $values) . ")";
                }
                
                $output .= implode(",\n", $rows) . ";\n\n";
            }
        }
    }
    
    $output .= "SET FOREIGN_KEY_CHECKS=1;\n";
    
    return file_put_contents($backup_file, $output) !== false;
}

/**
 * Limpiar backups antiguos
 */
function cleanupOldBackups($backup_dir, $prefix, $max_backups) {
    $files = glob($backup_dir . '/' . $prefix . '*.sql');
    $files_custom = glob($backup_dir . '/' . $prefix . '*.dump'); // PostgreSQL custom format
    
    $all_files = array_merge($files, $files_custom);
    
    // Ordenar por fecha de modificación (más reciente primero)
    usort($all_files, function($a, $b) {
        return filemtime($b) - filemtime($a);
    });
    
    // Eliminar backups antiguos
    if (count($all_files) > $max_backups) {
        $to_delete = array_slice($all_files, $max_backups);
        foreach ($to_delete as $file) {
            @unlink($file);
        }
        return count($to_delete);
    }
    
    return 0;
}

/**
 * Obtener lista de backups
 */
function getBackupList($backup_dir, $prefix) {
    $files = glob($backup_dir . '/' . $prefix . '*.sql');
    $files_custom = glob($backup_dir . '/' . $prefix . '*.dump');
    $all_files = array_merge($files, $files_custom);
    
    $backups = [];
    foreach ($all_files as $file) {
        $backups[] = [
            'filename' => basename($file),
            'size' => filesize($file),
            'size_formatted' => formatBytes(filesize($file)),
            'date' => date('Y-m-d H:i:s', filemtime($file)),
            'timestamp' => filemtime($file)
        ];
    }
    
    // Ordenar por fecha (más reciente primero)
    usort($backups, function($a, $b) {
        return $b['timestamp'] - $a['timestamp'];
    });
    
    return $backups;
}

/**
 * Formatear bytes a formato legible
 */
function formatBytes($bytes, $precision = 2) {
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    
    $bytes /= pow(1024, $pow);
    
    return round($bytes, $precision) . ' ' . $units[$pow];
}

switch ($method) {
    case 'GET':
        // Si hay parámetro download, descargar el archivo
        if (isset($_GET['download'])) {
            $filename = $_GET['download'];
            
            // Validar que el archivo es un backup válido
            if (strpos($filename, $backup_prefix) !== 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Archivo de backup inválido.']);
                exit;
            }
            
            $file_path = $backup_dir . '/' . $filename;
            
            if (!file_exists($file_path)) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Backup no encontrado.']);
                exit;
            }
            
            // Determinar el tipo MIME según la extensión
            $mime_type = 'application/octet-stream';
            if (pathinfo($filename, PATHINFO_EXTENSION) === 'sql') {
                $mime_type = 'application/sql';
            } elseif (pathinfo($filename, PATHINFO_EXTENSION) === 'dump') {
                $mime_type = 'application/octet-stream';
            }
            
            // Enviar el archivo
            header('Content-Type: ' . $mime_type);
            header('Content-Disposition: attachment; filename="' . basename($filename) . '"');
            header('Content-Length: ' . filesize($file_path));
            header('Cache-Control: must-revalidate');
            header('Pragma: public');
            
            readfile($file_path);
            exit;
        }
        
        // Listar backups disponibles
        $backups = getBackupList($backup_dir, $backup_prefix);
        $deleted = cleanupOldBackups($backup_dir, $backup_prefix, $max_backups);
        
        echo json_encode([
            'success' => true,
            'backups' => $backups,
            'total' => count($backups),
            'deleted_old' => $deleted,
            'max_backups' => $max_backups
        ]);
        break;
        
    case 'POST':
        // Crear nuevo backup
        $data = json_decode(file_get_contents('php://input'), true);
        $manual = $data['manual'] ?? false;
        
        try {
            $db_type = getDatabaseType();
            $timestamp = date('Y-m-d_His');
            
            if ($db_type === 'postgresql') {
                $backup_file = $backup_dir . '/' . $backup_prefix . $timestamp . '.dump';
                $created = createPostgreSQLBackup($servername, $username, $password, $dbname, $backup_file);
            } else {
                $backup_file = $backup_dir . '/' . $backup_prefix . $timestamp . '.sql';
                
                // Intentar usar mysqldump primero
                $created = false;
                if (function_exists('exec') && !ini_get('safe_mode')) {
                    try {
                        $created = createMySQLBackup($servername, $username, $password, $dbname, $backup_file);
                    } catch (Exception $e) {
                        // Si falla mysqldump, usar método PHP
                        error_log("mysqldump falló, usando método PHP: " . $e->getMessage());
                    }
                }
                
                // Si mysqldump no está disponible, usar método PHP
                if (!$created) {
                    $created = createPHPBackup($conn, $dbname, $backup_file);
                }
            }
            
            if (!$created || !file_exists($backup_file)) {
                throw new Exception("No se pudo crear el archivo de backup.");
            }
            
            $file_size = filesize($backup_file);
            
            // Limpiar backups antiguos
            $deleted = cleanupOldBackups($backup_dir, $backup_prefix, $max_backups);
            
            echo json_encode([
                'success' => true,
                'message' => 'Backup creado exitosamente.',
                'filename' => basename($backup_file),
                'size' => $file_size,
                'size_formatted' => formatBytes($file_size),
                'date' => date('Y-m-d H:i:s'),
                'type' => $db_type,
                'deleted_old' => $deleted
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al crear backup: ' . $e->getMessage()
            ]);
        }
        break;
        
    case 'DELETE':
        // Eliminar un backup específico
        $filename = $_GET['filename'] ?? null;
        
        if (!$filename) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Nombre de archivo requerido.']);
            exit;
        }
        
        // Validar código de seguridad
        $data = json_decode(file_get_contents('php://input'), true);
        $security_code = $data['security_code'] ?? null;
        
        if (!$security_code) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Código de seguridad requerido para eliminar backups.']);
            exit;
        }
        
        // Verificar que el código de seguridad sea correcto
        if ($security_code !== BACKUP_DELETE_CODE) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Código de seguridad incorrecto. No se puede eliminar el backup.']);
            exit;
        }
        
        // Validar que el archivo es un backup válido
        if (strpos($filename, $backup_prefix) !== 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Archivo de backup inválido.']);
            exit;
        }
        
        $file_path = $backup_dir . '/' . $filename;
        
        if (!file_exists($file_path)) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Backup no encontrado.']);
            exit;
        }
        
        if (@unlink($file_path)) {
            echo json_encode([
                'success' => true,
                'message' => 'Backup eliminado exitosamente.'
            ]);
        } else {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al eliminar el backup.'
            ]);
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
        break;
}

$conn->close();
?>

