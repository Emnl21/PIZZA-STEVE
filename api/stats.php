<?php
// api/stats.php
require_once '../config/environment.php';
require_once '../config/database.php';
require_once '../config/security.php';
require_once '../config/security_headers.php';
require_once 'auth_middleware.php';

setSecurityHeaders();
header('Content-Type: application/json');

// Verificar autenticación
$current_user = requireAuth(['admin']);

try {
    $stats = [];
    
    // Total de ventas del día
    $sql = "SELECT COALESCE(SUM(total), 0) as total FROM pedidos WHERE DATE(fecha_pedido) = CURDATE() AND estado = 'completed'";
    $result = $conn->query($sql);
    $stats['sales_today'] = $result->fetch_assoc()['total'] ?? 0;
    
    // Total de ventas del mes
    $sql = "SELECT COALESCE(SUM(total), 0) as total FROM pedidos WHERE MONTH(fecha_pedido) = MONTH(CURDATE()) AND YEAR(fecha_pedido) = YEAR(CURDATE()) AND estado = 'completed'";
    $result = $conn->query($sql);
    $stats['sales_month'] = $result->fetch_assoc()['total'] ?? 0;
    
    // Pedidos pendientes (todos los que no están completados o cancelados)
    $sql = "SELECT COUNT(*) as count FROM pedidos WHERE estado IN ('pending', 'preparing', 'ready_for_delivery', 'out_for_delivery')";
    $result = $conn->query($sql);
    $stats['pending_orders'] = $result->fetch_assoc()['count'] ?? 0;
    
    // Pedidos completados (hoy)
    $sql = "SELECT COUNT(*) as count FROM pedidos WHERE DATE(fecha_pedido) = CURDATE() AND estado = 'completed'";
    $result = $conn->query($sql);
    $stats['completed_today'] = $result->fetch_assoc()['count'] ?? 0;
    
    // Total de ingresos
    $sql = "SELECT COALESCE(SUM(total), 0) as total FROM pedidos WHERE estado = 'completed'";
    $result = $conn->query($sql);
    $stats['total_revenue'] = $result->fetch_assoc()['total'] ?? 0;
    
    // Usuarios activos
    $sql = "SELECT COUNT(*) as count FROM usuarios WHERE activa = 1";
    $result = $conn->query($sql);
    $stats['active_users'] = $result->fetch_assoc()['count'] ?? 0;
    
    // Productos activos
    $sql = "SELECT COUNT(*) as count FROM productos WHERE activa = 1";
    $result = $conn->query($sql);
    $stats['active_products'] = $result->fetch_assoc()['count'] ?? 0;
    
    // Ventas por día de la última semana
    $sql = "SELECT DATE(fecha_pedido) as date, COALESCE(SUM(total), 0) as total 
            FROM pedidos 
            WHERE fecha_pedido >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) 
            AND estado = 'completed'
            GROUP BY DATE(fecha_pedido) 
            ORDER BY date";
    $result = $conn->query($sql);
    $stats['sales_by_day'] = [];
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $stats['sales_by_day'][] = $row;
        }
    }
    
    // Productos más vendidos
    $sql = "SELECT p.nombre, SUM(pp.cantidad_producto) as cantidad 
            FROM pedidos_productos pp
            JOIN productos p ON pp.id_producto = p.id_producto
            JOIN pedidos ped ON pp.id_pedido = ped.id_pedido
            WHERE ped.estado = 'completed'
            GROUP BY p.id_producto, p.nombre
            ORDER BY cantidad DESC
            LIMIT 5";
    $result = $conn->query($sql);
    $stats['top_products'] = [];
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $stats['top_products'][] = $row;
        }
    }
    
    echo json_encode(['success' => true, 'data' => $stats]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}

$conn->close();
?>

