<?php
// tests/test_ticket_details.php
require_once __DIR__ . '/../config/database.php';

// 1. Get a valid ticket
$result = $conn->query("SELECT id_ticket FROM tickets LIMIT 1");
if (!$result || $result->num_rows === 0) {
    echo "No tickets found. Creating one...\n";
    // Logic to create a ticket if needed, but for now let's assume one exists or fail
    // We can reuse the logic from reproduce_issue.php if we really need to create one
    // But let's try to find one first.
    
    // Attempt to create one using the logic from reproduce_issue.php
    // ... (omitted for brevity, assuming we can find one or user has data)
    die("Please run reproduce_issue.php first to generate a ticket.\n");
}

$ticket_id = $result->fetch_assoc()['id_ticket'];
echo "Testing with Ticket ID: $ticket_id\n";

// 2. Execute the query from api/tickets.php
$sql = "
    SELECT 
        t.id_ticket,
        t.numero_ticket,
        t.id_pedido,
        t.estado_ticket,
        t.notas_vendedor,
        t.fecha_creacion,
        t.fecha_actualizacion,
        t.vendedor_id,
        p.usuario_id,
        p.sucursal_id,
        p.total,
        p.descuento,
        p.es_cumpleanero,
        p.metodo_pago,
        p.fecha_pedido,
        u.nombre AS cliente_nombre,
        u.telefono AS cliente_telefono,
        u.correo_electronico AS cliente_email,
        de.direccion AS cliente_direccion,
        s.nombre AS sucursal_nombre,
        s.telefono AS sucursal_telefono,
        s.direccion AS sucursal_direccion,
        v.nombre AS vendedor_nombre
    FROM tickets t
    JOIN pedidos p ON t.id_pedido = p.id_pedido
    JOIN usuarios u ON p.usuario_id = u.id_usuario
    JOIN direcciones_entrega de ON p.direccion_id = de.id_direccion
    JOIN sucursales s ON p.sucursal_id = s.id_sucursal
    LEFT JOIN usuarios v ON t.vendedor_id = v.id_usuario
    WHERE t.id_ticket = ?
";

$stmt = $conn->prepare($sql);
if (!$stmt) {
    die("Prepare failed: " . $conn->error . "\n");
}
$stmt->bind_param('i', $ticket_id);
$stmt->execute();
$result = $stmt->get_result();
$ticket = $result->fetch_assoc();
$stmt->close();

if ($ticket) {
    echo "SUCCESS: Ticket details found.\n";
    print_r($ticket);
    
    // Check products
    $sql_products = "
        SELECT 
            pp.id_producto,
            p.nombre AS producto_nombre,
            pp.cantidad_producto,
            pp.precio_u,
            (pp.cantidad_producto * pp.precio_u) AS subtotal
        FROM pedidos_productos pp
        JOIN productos p ON pp.id_producto = p.id_producto
        WHERE pp.id_pedido = ?
    ";
    
    $stmt_products = $conn->prepare($sql_products);
    $stmt_products->bind_param('i', $ticket['id_pedido']);
    $stmt_products->execute();
    $result_products = $stmt_products->get_result();
    
    $products = [];
    while ($row = $result_products->fetch_assoc()) {
        $products[] = $row;
    }
    $stmt_products->close();
    
    echo "Products found: " . count($products) . "\n";
    print_r($products);
    
} else {
    echo "FAILURE: Ticket details NOT found for ID $ticket_id.\n";
}

$conn->close();
?>
