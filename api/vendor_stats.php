<?php
// api/vendor_stats.php
require_once '../config/environment.php';
require_once '../config/database.php';
require_once '../config/security.php';
require_once '../config/security_headers.php';
require_once 'auth_middleware.php';

setSecurityHeaders();
header('Content-Type: application/json');

function getUserBranchIdForStats($conn, $user) {
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

$current_user = requireAuth(['admin', 'vendedor']);

$requested_branch = $_GET['sucursal_id'] ?? null;
if ($requested_branch !== null) {
    if (!is_numeric($requested_branch)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'El ID de sucursal debe ser numérico.']);
        exit;
    }
    $requested_branch = (int)$requested_branch;
}

$user_role = strtolower($current_user['rol_nombre']);
if ($user_role === 'vendedor') {
    $vendor_branch = getUserBranchIdForStats($conn, $current_user);
    if ($vendor_branch) {
        $requested_branch = $vendor_branch;
    }
}

$branch_condition = $requested_branch ? " AND p.sucursal_id = " . (int)$requested_branch : '';
$active_condition = " AND p.estado <> 'cancelled'";

try {
    $stats = [
        'sucursal_id' => $requested_branch
    ];

    // Ventas del día, descuentos y cumpleañeros
    $sql = "
        SELECT 
            COALESCE(SUM(p.total), 0) AS ventas,
            COALESCE(SUM(p.descuento), 0) AS descuentos,
            COUNT(*) AS ordenes,
            SUM(CASE WHEN p.es_cumpleanero = 1 THEN 1 ELSE 0 END) AS cumpleaneros
        FROM pedidos p
        WHERE DATE(p.fecha_pedido) = CURDATE()
        $active_condition
        $branch_condition
    ";
    $result = $conn->query($sql);
    $row = $result ? $result->fetch_assoc() : null;
    $ventas_hoy = $row ? (float)$row['ventas'] : 0.0;
    $descuentos_hoy = $row ? (float)$row['descuentos'] : 0.0;
    $ordenes_hoy = $row ? (int)$row['ordenes'] : 0;
    $cumpleaneros = $row ? (int)$row['cumpleaneros'] : 0;

    // Ventas de ayer
    $sql = "
        SELECT 
            COALESCE(SUM(p.total), 0) AS ventas,
            COUNT(*) AS ordenes
        FROM pedidos p
        WHERE DATE(p.fecha_pedido) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
        $active_condition
        $branch_condition
    ";
    $result = $conn->query($sql);
    $row = $result ? $result->fetch_assoc() : null;
    $ventas_ayer = $row ? (float)$row['ventas'] : 0.0;
    $ordenes_ayer = $row ? (int)$row['ordenes'] : 0;

    // Clientes del día
    $sql = "
        SELECT COUNT(DISTINCT p.usuario_id) AS clientes
        FROM pedidos p
        WHERE DATE(p.fecha_pedido) = CURDATE()
        $active_condition
        $branch_condition
    ";
    $result = $conn->query($sql);
    $row = $result ? $result->fetch_assoc() : null;
    $clientes_hoy = $row ? (int)$row['clientes'] : 0;

    // Órdenes en curso
    $sql = "
        SELECT COUNT(*) AS en_curso
        FROM pedidos p
        WHERE p.estado IN ('pending','preparing','ready_for_delivery','out_for_delivery')
        $branch_condition
    ";
    $result = $conn->query($sql);
    $row = $result ? $result->fetch_assoc() : null;
    $ordenes_en_curso = $row ? (int)$row['en_curso'] : 0;

    // Producto más vendido del día
    $sql = "
        SELECT prod.nombre, SUM(pp.cantidad_producto) AS cantidad
        FROM pedidos_productos pp
        JOIN pedidos p ON pp.id_pedido = p.id_pedido
        JOIN productos prod ON pp.id_producto = prod.id_producto
        WHERE DATE(p.fecha_pedido) = CURDATE()
        $active_condition
        $branch_condition
        GROUP BY prod.id_producto, prod.nombre
        ORDER BY cantidad DESC
        LIMIT 1
    ";
    $result = $conn->query($sql);
    $top_producto = null;
    if ($result && $result->num_rows > 0) {
        $row = $result->fetch_assoc();
        $top_producto = [
            'nombre' => $row['nombre'],
            'cantidad' => (int)$row['cantidad']
        ];
    }

    // Hora pico del día
    $sql = "
        SELECT HOUR(p.fecha_pedido) AS hora, COUNT(*) AS total
        FROM pedidos p
        WHERE DATE(p.fecha_pedido) = CURDATE()
        $active_condition
        $branch_condition
        GROUP BY HOUR(p.fecha_pedido)
        ORDER BY total DESC
        LIMIT 1
    ";
    $result = $conn->query($sql);
    $hora_pico = null;
    if ($result && $result->num_rows > 0) {
        $row = $result->fetch_assoc();
        $hora_valor = str_pad((int)$row['hora'], 2, '0', STR_PAD_LEFT);
        $hora_pico = $hora_valor . ':00';
    }

    $stats['ventas_hoy'] = $ventas_hoy;
    $stats['descuentos_hoy'] = $descuentos_hoy;
    $stats['ordenes_hoy'] = $ordenes_hoy;
    $stats['ventas_ayer'] = $ventas_ayer;
    $stats['ordenes_ayer'] = $ordenes_ayer;
    $stats['ticket_promedio'] = $ordenes_hoy > 0 ? $ventas_hoy / $ordenes_hoy : 0;
    $stats['clientes_hoy'] = $clientes_hoy;
    $stats['cumpleaneros'] = $cumpleaneros;
    $stats['ordenes_en_curso'] = $ordenes_en_curso;
    $stats['top_producto'] = $top_producto;
    $stats['hora_pico'] = $hora_pico;

    echo json_encode(['success' => true, 'data' => $stats]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error al obtener estadísticas: ' . $e->getMessage()]);
}

$conn->close();
?>

