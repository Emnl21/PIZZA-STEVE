<?php
// tests/reproduce_issue.php
require_once __DIR__ . '/../config/database.php';

// 1. Get a valid user, sucursal, and product
$result = $conn->query("SELECT id_usuario FROM usuarios LIMIT 1");
if (!$result || $result->num_rows === 0) {
    die("No users found. Please create a user first.\n");
}
$user_id = $result->fetch_assoc()['id_usuario'];

$result = $conn->query("SELECT id_sucursal FROM sucursales WHERE activa = 1 LIMIT 1");
if (!$result || $result->num_rows === 0) {
    die("No active sucursales found.\n");
}
$sucursal_id = $result->fetch_assoc()['id_sucursal'];

// 2. Create an order using sp_create_order
$total = 100.00;
$descuento = 0.00;
$es_cumpleanero = 0;
$metodo_pago = 'efectivo';
$pago_confirmado = 0;
$direccion_id = 1; // Assuming address 1 exists or NULL if allowed. sp_create_order takes direccion_id.
// Let's check if we need a valid address.
$result = $conn->query("SELECT id_direccion FROM direcciones_entrega LIMIT 1");
if ($result && $result->num_rows > 0) {
    $direccion_id = $result->fetch_assoc()['id_direccion'];
} else {
    // Create a dummy address
    $conn->query("INSERT INTO direcciones_entrega (usuario_id, direccion, latitud, longitud) VALUES ($user_id, 'Test Address', -16.5, -68.1)");
    $direccion_id = $conn->insert_id;
}

echo "Creating order for User: $user_id, Sucursal: $sucursal_id, Address: $direccion_id\n";

$stmt = $conn->prepare("CALL sp_create_order(?, ?, ?, ?, ?, ?, ?, ?, @p_order_id, @p_success, @p_message)");
$stmt->bind_param('iiiddisi', $user_id, $sucursal_id, $direccion_id, $total, $descuento, $es_cumpleanero, $metodo_pago, $pago_confirmado);
$stmt->execute();
$stmt->close();

$result = $conn->query("SELECT @p_order_id as order_id, @p_success as success, @p_message as message");
$output = $result->fetch_assoc();

if (!$output['success']) {
    die("Failed to create order: " . $output['message'] . "\n");
}

$order_id = $output['order_id'];
echo "Order created successfully. ID: $order_id\n";

// 3. Check if a ticket exists for this order
$stmt = $conn->prepare("SELECT * FROM tickets WHERE id_pedido = ?");
$stmt->bind_param('i', $order_id);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows > 0) {
    $ticket = $result->fetch_assoc();
    echo "SUCCESS: Ticket found for order $order_id. Ticket ID: " . $ticket['id_ticket'] . "\n";
} else {
    echo "FAILURE: No ticket found for order $order_id.\n";
}

$stmt->close();
$conn->close();
?>
