<?php
// api/apply_migration.php
require_once __DIR__ . '/../config/database.php';

echo "Applying migration...\n";

// 1. Fix the broken 'before_insert_ticket' trigger
// The original trigger used NEW.id_ticket which is 0 in BEFORE INSERT, causing duplicates.
// We will change it to use NEW.id_pedido which is unique per ticket (1-to-1).

$sql_drop_old_trigger = "DROP TRIGGER IF EXISTS `before_insert_ticket`";
if ($conn->query($sql_drop_old_trigger) === TRUE) {
    echo "Dropped broken trigger 'before_insert_ticket'.\n";
}

$sql_fix_trigger = "
CREATE TRIGGER `before_insert_ticket` 
BEFORE INSERT ON `tickets`
FOR EACH ROW
BEGIN
  IF NEW.numero_ticket IS NULL OR NEW.numero_ticket = '' THEN
    -- Use id_pedido instead of id_ticket to ensure uniqueness and availability
    SET NEW.numero_ticket = CONCAT('TKT-', LPAD(NEW.id_pedido, 6, '0'));
  END IF;
END
";

if ($conn->query($sql_fix_trigger) === TRUE) {
    echo "Created fixed trigger 'before_insert_ticket'.\n";
} else {
    echo "Error creating fixed trigger: " . $conn->error . "\n";
    die();
}

// 2. Create the new trigger to auto-create tickets
$sql_drop = "DROP TRIGGER IF EXISTS `trg_create_ticket_after_order`";
$conn->query($sql_drop);

$sql_create = "
CREATE TRIGGER `trg_create_ticket_after_order`
AFTER INSERT ON `pedidos`
FOR EACH ROW
BEGIN
    -- Insertar automáticamente un ticket para el nuevo pedido
    -- The fixed 'before_insert_ticket' will generate numero_ticket based on id_pedido
    INSERT INTO `tickets` (id_pedido, estado_ticket, fecha_creacion, fecha_actualizacion)
    VALUES (NEW.id_pedido, 'pendiente', NOW(), NOW());
END
";

if ($conn->query($sql_create) === TRUE) {
    echo "Created trigger 'trg_create_ticket_after_order' successfully.\n";
} else {
    echo "Error creating trigger: " . $conn->error . "\n";
    die();
}

echo "Migration applied.\n";

// 3. Backfill missing tickets
echo "Backfilling missing tickets...\n";

// We don't need to specify numero_ticket, the trigger will handle it.
$sql_backfill = "
    INSERT INTO tickets (id_pedido, estado_ticket, fecha_creacion, fecha_actualizacion)
    SELECT p.id_pedido, 'pendiente', NOW(), NOW()
    FROM pedidos p
    LEFT JOIN tickets t ON p.id_pedido = t.id_pedido
    WHERE t.id_ticket IS NULL
";

if ($conn->query($sql_backfill) === TRUE) {
    echo "Backfill completed. Rows affected: " . $conn->affected_rows . "\n";
} else {
    echo "Error backfilling tickets: " . $conn->error . "\n";
}

$conn->close();
?>
