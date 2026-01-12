<?php
// api/vendor_reports.php
// Reportes de ventas para vendedores (día, semana, mes)

// Desactivar mostrar errores para evitar que se muestren antes del JSON
error_reporting(E_ALL);
ini_set('display_errors', 0);

// Iniciar buffer de salida para capturar cualquier error
ob_start();

try {
    require_once '../config/environment.php';
    require_once '../config/database.php';
    require_once '../config/security.php';
    require_once '../config/security_headers.php';
    require_once 'auth_middleware.php';

    setSecurityHeaders();
    header('Content-Type: application/json');

    // Verificar autenticación
    $current_user = requireAuth(['admin', 'vendedor']);
} catch (Exception $e) {
    ob_end_clean();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error de inicialización: ' . $e->getMessage()]);
    exit;
}

// Limpiar cualquier salida previa
ob_end_clean();

$period = $_GET['period'] ?? 'day'; // day, week, month

// Obtener sucursal del vendedor
function getUserBranchId($conn, $user) {
    if (isset($user['sucursal_id']) && !empty($user['sucursal_id'])) {
        return (int)$user['sucursal_id'];
    }
    if (!isset($user['id_usuario'])) {
        return null;
    }
    $stmt = $conn->prepare("SELECT sucursal_id FROM usuarios WHERE id_usuario = ? LIMIT 1");
    if (!$stmt) {
        return null;
    }
    $stmt->bind_param('i', $user['id_usuario']);
    $stmt->execute();
    $result = $stmt->get_result();
    $branch = $result ? $result->fetch_assoc() : null;
    $stmt->close();
    return $branch && !empty($branch['sucursal_id']) ? (int)$branch['sucursal_id'] : null;
}

$user_role = strtolower($current_user['rol_nombre'] ?? '');
$branch_id = null;

if ($user_role === 'vendedor') {
    $branch_id = getUserBranchId($conn, $current_user);
} elseif ($user_role === 'admin') {
    // Admin puede ver todas las sucursales o una específica
    $branch_id = isset($_GET['sucursal_id']) && is_numeric($_GET['sucursal_id']) ? (int)$_GET['sucursal_id'] : null;
}

$branch_condition = $branch_id ? " AND p.sucursal_id = " . (int)$branch_id : '';
$active_condition = " AND p.estado <> 'cancelled'";

// Calcular fechas según el período
$dateFilter = '';
switch ($period) {
    case 'day':
        $dateFilter = "DATE(p.fecha_pedido) = CURDATE()";
        break;
    case 'week':
        $dateFilter = "YEARWEEK(p.fecha_pedido, 1) = YEARWEEK(CURDATE(), 1)";
        break;
    case 'month':
        $dateFilter = "YEAR(p.fecha_pedido) = YEAR(CURDATE()) AND MONTH(p.fecha_pedido) = MONTH(CURDATE())";
        break;
    default:
        $dateFilter = "DATE(p.fecha_pedido) = CURDATE()";
        break;
}

try {
    // Verificar si la columna descuento existe
    $has_descuento = false;
    try {
        $check_column = "SHOW COLUMNS FROM pedidos LIKE 'descuento'";
        $column_result = $conn->query($check_column);
        if ($column_result && $column_result->num_rows > 0) {
            $has_descuento = true;
        }
    } catch (Exception $e) {
        $has_descuento = false;
    }
    
    // Resumen general
    $descuento_field = $has_descuento ? "COALESCE(SUM(p.descuento), 0) AS total_descuentos" : "0 AS total_descuentos";
    $sql = "
        SELECT 
            COALESCE(SUM(p.total), 0) AS total_ventas,
            COUNT(*) AS total_pedidos,
            COALESCE(AVG(p.total), 0) AS ticket_promedio,
            $descuento_field
        FROM pedidos p
        WHERE $dateFilter
        $active_condition
        $branch_condition
    ";
    $result = $conn->query($sql);
    if (!$result) {
        throw new Exception('Error en consulta SQL: ' . $conn->error);
    }
    $summary = $result ? $result->fetch_assoc() : null;
    
    // Ventas por día (últimos 7 días si es semana, últimos 30 si es mes)
    $daysLimit = $period === 'week' ? 7 : ($period === 'month' ? 30 : 1);
    $sql = "
        SELECT 
            DATE(p.fecha_pedido) AS fecha,
            COALESCE(SUM(p.total), 0) AS total,
            COUNT(*) AS cantidad
        FROM pedidos p
        WHERE $dateFilter
        $active_condition
        $branch_condition
        GROUP BY DATE(p.fecha_pedido)
        ORDER BY fecha DESC
        LIMIT $daysLimit
    ";
    $result = $conn->query($sql);
    if (!$result) {
        throw new Exception('Error en consulta de ventas por día: ' . $conn->error);
    }
    $salesByDay = [];
    while ($row = $result->fetch_assoc()) {
        $salesByDay[] = $row;
    }
    
    // Productos más vendidos
    $sql = "
        SELECT 
            prod.nombre,
            SUM(pp.cantidad_producto) AS cantidad,
            SUM(pp.precio_u * pp.cantidad_producto) AS total
        FROM pedidos_productos pp
        JOIN pedidos p ON pp.id_pedido = p.id_pedido
        JOIN productos prod ON pp.id_producto = prod.id_producto
        WHERE $dateFilter
        $active_condition
        $branch_condition
        GROUP BY prod.id_producto, prod.nombre
        ORDER BY cantidad DESC
        LIMIT 10
    ";
    $result = $conn->query($sql);
    if (!$result) {
        throw new Exception('Error en consulta de productos más vendidos: ' . $conn->error);
    }
    $topProducts = [];
    while ($row = $result->fetch_assoc()) {
        $topProducts[] = $row;
    }
    
    // Métodos de pago
    $sql = "
        SELECT 
            COALESCE(p.metodo_pago, 'desconocido') AS metodo,
            COUNT(*) AS cantidad,
            COALESCE(SUM(p.total), 0) AS total
        FROM pedidos p
        WHERE $dateFilter
        $active_condition
        $branch_condition
        GROUP BY p.metodo_pago
        ORDER BY total DESC
    ";
    $result = $conn->query($sql);
    if (!$result) {
        throw new Exception('Error en consulta de métodos de pago: ' . $conn->error);
    }
    $paymentMethods = [];
    while ($row = $result->fetch_assoc()) {
        $paymentMethods[] = $row;
    }
    
    echo json_encode([
        'success' => true,
        'period' => $period,
        'summary' => $summary,
        'salesByDay' => $salesByDay,
        'topProducts' => $topProducts,
        'paymentMethods' => $paymentMethods
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error al generar reportes: ' . $e->getMessage()
    ]);
}

$conn->close();
?>

