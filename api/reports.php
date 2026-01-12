<?php
// api/reports.php
// Sistema de reportes y análisis de negocio

require_once '../config/environment.php';
require_once '../config/database.php';
require_once '../config/security.php';
require_once '../config/security_headers.php';
require_once 'auth_middleware.php';

setSecurityHeaders();
header('Content-Type: application/json');

// Solo administradores pueden ver reportes
$current_user = requireAuth(['admin']);

$period = $_GET['period'] ?? 'month';

// Calcular fechas según el período
$dateFilter = '';
switch ($period) {
    case 'today':
        $dateFilter = "DATE(p.fecha_pedido) = CURDATE()";
        break;
    case 'week':
        $dateFilter = "YEARWEEK(p.fecha_pedido, 1) = YEARWEEK(CURDATE(), 1)";
        break;
    case 'month':
        $dateFilter = "YEAR(p.fecha_pedido) = YEAR(CURDATE()) AND MONTH(p.fecha_pedido) = MONTH(CURDATE())";
        break;
    case 'year':
        $dateFilter = "YEAR(p.fecha_pedido) = YEAR(CURDATE())";
        break;
    case 'all':
    default:
        $dateFilter = "1=1";
        break;
}

// Crear versión sin alias para subconsultas que no tienen alias de tabla
$dateFilterNoAlias = str_replace('p.fecha_pedido', 'fecha_pedido', $dateFilter);

try {
    // Resumen General - Usando vista v_ventas_por_dia
    // Ajustar el filtro de fecha para la vista
    $dateFilterView = '';
    switch ($period) {
        case 'today':
            $dateFilterView = "fecha = CURDATE()";
            break;
        case 'week':
            $dateFilterView = "YEARWEEK(fecha, 1) = YEARWEEK(CURDATE(), 1)";
            break;
        case 'month':
            $dateFilterView = "YEAR(fecha) = YEAR(CURDATE()) AND MONTH(fecha) = MONTH(CURDATE())";
            break;
        case 'year':
            $dateFilterView = "YEAR(fecha) = YEAR(CURDATE())";
            break;
        case 'all':
        default:
            $dateFilterView = "1=1";
            break;
    }
    
    $sql_summary = "SELECT 
        COALESCE(SUM(total_ventas), 0) as total_sales,
        COALESCE(SUM(total_pedidos), 0) as total_orders,
        COALESCE(AVG(ticket_promedio), 0) as average_ticket,
        (SELECT COALESCE(SUM(cantidad_producto), 0) 
         FROM pedidos_productos pp 
         INNER JOIN pedidos p ON pp.id_pedido = p.id_pedido 
         WHERE p.estado != 'cancelled' AND $dateFilter) as total_products
        FROM v_ventas_por_dia
        WHERE $dateFilterView";
    
    $result_summary = $conn->query($sql_summary);
    $summary = $result_summary->fetch_assoc();
    
    // Top Productos Más Vendidos - Usando vista v_productos_mas_vendidos
    $sql_top_products = "SELECT 
        nombre,
        cantidad_vendida as cantidad,
        total_vendido as total
        FROM v_productos_mas_vendidos
        WHERE id_producto IN (
            SELECT DISTINCT pp.id_producto 
            FROM pedidos_productos pp 
            INNER JOIN pedidos p ON pp.id_pedido = p.id_pedido 
            WHERE p.estado != 'cancelled' AND $dateFilter
        )
        ORDER BY cantidad_vendida DESC
        LIMIT 20";
    
    $result_top = $conn->query($sql_top_products);
    $topProducts = [];
    while ($row = $result_top->fetch_assoc()) {
        $topProducts[] = $row;
    }
    
    // Pedidos por Hora del Día - Usando vista v_pedidos_por_hora
    $sql_orders_hour = "SELECT 
        hora,
        cantidad_pedidos as cantidad
        FROM v_pedidos_por_hora
        WHERE hora IN (
            SELECT DISTINCT HOUR(fecha_pedido) 
            FROM pedidos 
            WHERE estado != 'cancelled' AND $dateFilterNoAlias
        )
        ORDER BY hora";
    
    $result_hour = $conn->query($sql_orders_hour);
    $ordersByHour = [];
    while ($row = $result_hour->fetch_assoc()) {
        $ordersByHour[] = $row;
    }
    
    // Ventas por Día - Usando vista v_ventas_por_dia
    $sql_sales_day = "SELECT 
        fecha,
        total_ventas as total,
        total_pedidos as cantidad
        FROM v_ventas_por_dia
        WHERE $dateFilterView
        ORDER BY fecha DESC
        LIMIT 30";
    
    $result_day = $conn->query($sql_sales_day);
    $salesByDay = [];
    while ($row = $result_day->fetch_assoc()) {
        $salesByDay[] = $row;
    }
    
    // Ventas por Sucursal - Filtrar desde la vista usando subconsulta
    $sql_sales_branch = "SELECT 
        sucursal_nombre as sucursal,
        total_ventas as total,
        total_pedidos as cantidad
        FROM v_ventas_por_sucursal
        WHERE sucursal_id IN (
            SELECT DISTINCT sucursal_id 
            FROM pedidos 
            WHERE estado != 'cancelled' AND $dateFilterNoAlias
        )
        ORDER BY total_ventas DESC";
    
    $result_branch = $conn->query($sql_sales_branch);
    $salesByBranch = [];
    while ($row = $result_branch->fetch_assoc()) {
        $salesByBranch[] = $row;
    }
    
    // Métodos de Pago - Filtrar desde la vista usando subconsulta
    $sql_payment = "SELECT 
        metodo_pago,
        total_ventas as total,
        cantidad_pedidos as cantidad
        FROM v_metodos_pago
        WHERE metodo_pago IN (
            SELECT DISTINCT COALESCE(metodo_pago, 'desconocido')
            FROM pedidos 
            WHERE estado != 'cancelled' AND $dateFilterNoAlias
        )
        ORDER BY total_ventas DESC";
    
    $result_payment = $conn->query($sql_payment);
    $paymentMethods = [];
    while ($row = $result_payment->fetch_assoc()) {
        $paymentMethods[] = $row;
    }
    
    // Categorías Más Vendidas - Usando vista v_categorias_vendidas
    $sql_categories = "SELECT 
        categoria,
        cantidad_vendida as cantidad,
        total_vendido as total
        FROM v_categorias_vendidas
        WHERE categoria IN (
            SELECT DISTINCT pr.categoria 
            FROM pedidos_productos pp 
            INNER JOIN pedidos p ON pp.id_pedido = p.id_pedido 
            INNER JOIN productos pr ON pp.id_producto = pr.id_producto 
            WHERE p.estado != 'cancelled' AND $dateFilter
        )
        ORDER BY cantidad_vendida DESC";
    
    $result_categories = $conn->query($sql_categories);
    $categories = [];
    while ($row = $result_categories->fetch_assoc()) {
        $categories[] = $row;
    }
    
    echo json_encode([
        'success' => true,
        'period' => $period,
        'summary' => $summary,
        'topProducts' => $topProducts,
        'ordersByHour' => $ordersByHour,
        'salesByDay' => $salesByDay,
        'salesByBranch' => $salesByBranch,
        'paymentMethods' => $paymentMethods,
        'categories' => $categories
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

