<?php
// api/branches.php (Sucursales)
require_once '../config/environment.php';
require_once '../config/database.php';
require_once '../config/security.php';
require_once '../config/security_headers.php';
require_once 'auth_middleware.php';

setSecurityHeaders();
header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

switch ($method) {
    case 'GET':
        // GET disponible para admin, vendedor y repartidor (solo lectura)
        $current_user = requireAuth(['admin', 'vendedor', 'repartidor']);
        if ($id) {
            $sql = "SELECT id_sucursal, nombre, direccion, telefono, horario_apertura, horario_cierre, latitud, longitud, activa FROM sucursales WHERE id_sucursal = ?";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param('i', $id);
            $stmt->execute();
            $result = $stmt->get_result();
            $branch = $result->fetch_assoc();
            if ($branch) {
                // Asegurar que activa sea un entero
                $branch['activa'] = (int)$branch['activa'];
                // Asegurar que las coordenadas sean números
                if (isset($branch['latitud'])) {
                    $branch['latitud'] = $branch['latitud'] ? (float)$branch['latitud'] : null;
                }
                if (isset($branch['longitud'])) {
                    $branch['longitud'] = $branch['longitud'] ? (float)$branch['longitud'] : null;
                }
            }
            echo json_encode($branch);
            $stmt->close();
        } else {
            // Permitir filtrar solo activas (aceptar ?activa=1 o ?actividad=1)
            $activa_param = $_GET['activa'] ?? $_GET['actividad'] ?? null;
            $only_active = isset($activa_param) && ((string)$activa_param === '1' || strtolower((string)$activa_param) === 'true');
            if ($only_active) {
                $sql = "SELECT id_sucursal, nombre, direccion, telefono, horario_apertura, horario_cierre, latitud, longitud, activa FROM sucursales WHERE activa = 1 ORDER BY nombre";
            } else {
                $sql = "SELECT id_sucursal, nombre, direccion, telefono, horario_apertura, horario_cierre, latitud, longitud, activa FROM sucursales ORDER BY nombre";
            }
            $result = $conn->query($sql);
            
            if ($result === false) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Error en la consulta SQL: ' . $conn->error]);
                exit;
            }
            
            $branches = [];
            while ($row = $result->fetch_assoc()) {
                // Asegurar que activa sea un entero
                $row['activa'] = (int)$row['activa'];
                // Asegurar que las coordenadas sean números
                if (isset($row['latitud'])) {
                    $row['latitud'] = $row['latitud'] ? (float)$row['latitud'] : null;
                }
                if (isset($row['longitud'])) {
                    $row['longitud'] = $row['longitud'] ? (float)$row['longitud'] : null;
                }
                $branches[] = $row;
            }
            echo json_encode($branches);
        }
        break;
    case 'POST':
        // POST solo para admin
        $current_user = requireAuth(['admin']);
        $data = json_decode(file_get_contents('php://input'), true);
        $nombre = trim($data['nombre'] ?? '');
        $direccion = trim($data['direccion'] ?? '');
        $telefono = trim($data['telefono'] ?? '');
        $horario_apertura = $data['horario_apertura'] ?? null;
        $horario_cierre = $data['horario_cierre'] ?? null;
        $activa = $data['activa'] ?? 1;

        if (empty($nombre) || empty($direccion)) {
            echo json_encode(['success' => false, 'message' => 'Nombre y dirección son requeridos.']);
            exit;
        }
        
        // Validar nombre (solo letras, espacios, acentos)
        if (!preg_match("/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/", $nombre) || strlen($nombre) < 2) {
            echo json_encode(['success' => false, 'message' => 'El nombre solo puede contener letras, espacios y acentos. Mínimo 2 caracteres.']);
            exit;
        }
        
        // Validar dirección (mínimo 5 caracteres)
        if (strlen($direccion) < 5) {
            echo json_encode(['success' => false, 'message' => 'La dirección debe tener al menos 5 caracteres.']);
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
        
        // Validar horarios si se proporcionan ambos
        if ($horario_apertura && $horario_cierre) {
            $hora_apertura = DateTime::createFromFormat('H:i', $horario_apertura);
            $hora_cierre = DateTime::createFromFormat('H:i', $horario_cierre);
            
            if (!$hora_apertura || !$hora_cierre) {
                echo json_encode(['success' => false, 'message' => 'Los horarios deben tener el formato HH:MM.']);
                exit;
            }
        }

        $latitud = isset($data['latitud']) ? (float)$data['latitud'] : null;
        $longitud = isset($data['longitud']) ? (float)$data['longitud'] : null;
        
        $sql = "INSERT INTO sucursales (nombre, direccion, telefono, horario_apertura, horario_cierre, latitud, longitud, activa) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('sssssddi', $nombre, $direccion, $telefono, $horario_apertura, $horario_cierre, $latitud, $longitud, $activa);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Sucursal agregada exitosamente.']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Error al agregar la sucursal: ' . $stmt->error]);
        }
        $stmt->close();
        break;
    case 'PUT':
        // PUT solo para admin
        $current_user = requireAuth(['admin']);
        $data = json_decode(file_get_contents('php://input'), true);
        $id = $data['id'] ?? '';
        $nombre = $data['nombre'] ?? '';
        $direccion = $data['direccion'] ?? '';
        $telefono = $data['telefono'] ?? '';
        $horario_apertura = $data['horario_apertura'] ?? null;
        $horario_cierre = $data['horario_cierre'] ?? null;
        // Asegurar que activa sea un entero (0 o 1)
        $activa = isset($data['activa']) ? (int)$data['activa'] : 1;

        if (empty($id) || !is_numeric($id)) {
            echo json_encode(['success' => false, 'message' => 'ID es requerido y debe ser numérico.']);
            exit;
        }
        
        if (empty($nombre) || empty($direccion)) {
            echo json_encode(['success' => false, 'message' => 'Nombre y dirección son requeridos.']);
            exit;
        }
        
        // Validar y normalizar horarios si se proporcionan
        if ($horario_apertura !== null && $horario_apertura !== '' && $horario_cierre !== null && $horario_cierre !== '') {
            // Normalizar: remover espacios y asegurar formato HH:MM
            $horario_apertura = trim($horario_apertura);
            $horario_cierre = trim($horario_cierre);
            
            // Si viene en formato HH:MM:SS, tomar solo HH:MM
            if (strlen($horario_apertura) > 5) {
                $horario_apertura = substr($horario_apertura, 0, 5);
            }
            if (strlen($horario_cierre) > 5) {
                $horario_cierre = substr($horario_cierre, 0, 5);
            }
            
            $hora_apertura = DateTime::createFromFormat('H:i', $horario_apertura);
            $hora_cierre = DateTime::createFromFormat('H:i', $horario_cierre);
            
            if (!$hora_apertura || !$hora_cierre) {
                echo json_encode(['success' => false, 'message' => 'Los horarios deben tener el formato HH:MM (ejemplo: 09:00).']);
                exit;
            }
        } else {
            // Si uno está vacío, ambos deben estar vacíos
            if (($horario_apertura !== null && $horario_apertura !== '') || ($horario_cierre !== null && $horario_cierre !== '')) {
                echo json_encode(['success' => false, 'message' => 'Debe proporcionar ambos horarios o ninguno.']);
                exit;
            }
            // Si ambos están vacíos, establecer como null
            $horario_apertura = null;
            $horario_cierre = null;
        }

        $latitud = isset($data['latitud']) ? (float)$data['latitud'] : null;
        $longitud = isset($data['longitud']) ? (float)$data['longitud'] : null;
        
        $sql = "UPDATE sucursales SET nombre = ?, direccion = ?, telefono = ?, horario_apertura = ?, horario_cierre = ?, latitud = ?, longitud = ?, activa = ? WHERE id_sucursal = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('sssssddii', $nombre, $direccion, $telefono, $horario_apertura, $horario_cierre, $latitud, $longitud, $activa, $id);

        if ($stmt->execute()) {
            if ($stmt->affected_rows > 0) {
                echo json_encode(['success' => true, 'message' => 'Sucursal actualizada exitosamente.']);
            } else {
                echo json_encode(['success' => false, 'message' => 'Sucursal no encontrada o sin cambios.']);
            }
        } else {
            echo json_encode(['success' => false, 'message' => 'Error al actualizar la sucursal: ' . $stmt->error]);
        }
        $stmt->close();
        break;
    case 'DELETE':
        // DELETE solo para admin
        $current_user = requireAuth(['admin']);
        $id = $_GET['id'] ?? '';

        if (empty($id)) {
            echo json_encode(['success' => false, 'message' => 'ID de sucursal requerido.']);
            exit;
        }

        $sql = "UPDATE sucursales SET activa = 0 WHERE id_sucursal = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $id);

        if ($stmt->execute()) {
            if ($stmt->affected_rows > 0) {
                echo json_encode(['success' => true, 'message' => 'Sucursal desactivada exitosamente.']);
            } else {
                echo json_encode(['success' => false, 'message' => 'Sucursal no encontrada.']);
            }
        } else {
            echo json_encode(['success' => false, 'message' => 'Error al desactivar la sucursal: ' . $stmt->error]);
        }
        $stmt->close();
        break;
    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
        break;
}

$conn->close();
?>

