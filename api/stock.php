<?php
// api/stock.php - Actualizar stock de productos
require_once '../config/environment.php';
require_once '../config/database.php';
require_once '../config/security.php';
require_once '../config/security_headers.php';
require_once 'auth_middleware.php';

setSecurityHeaders();
header('Content-Type: application/json');

// Verificar autenticación
$current_user = requireAuth(['admin', 'vendedor']);

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'PUT':
        $data = json_decode(file_get_contents('php://input'), true);
        $id_producto = $data['id_producto'] ?? '';
        $cantidad = $data['cantidad'] ?? 0;
        $operacion = $data['operacion'] ?? 'agregar'; // 'agregar' o 'establecer'

        if (empty($id_producto)) {
            echo json_encode(['success' => false, 'message' => 'ID de producto es requerido.']);
            exit;
        }

        // Obtener stock actual
        $sql = "SELECT stock_disponible FROM productos WHERE id_producto = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $id_producto);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows === 0) {
            echo json_encode(['success' => false, 'message' => 'Producto no encontrado.']);
            $stmt->close();
            exit;
        }
        
        $current_stock = $result->fetch_assoc()['stock_disponible'];
        $stmt->close();

        // Calcular nuevo stock
        if ($operacion === 'agregar') {
            $new_stock = $current_stock + $cantidad;
            if ($new_stock < 0) {
                echo json_encode(['success' => false, 'message' => 'No se puede restar más stock del disponible.']);
                exit;
            }
        } else {
            $new_stock = $cantidad;
            if ($new_stock < 0) {
                echo json_encode(['success' => false, 'message' => 'El stock no puede ser negativo.']);
                exit;
            }
        }

        // Actualizar stock
        $sql = "UPDATE productos SET stock_disponible = ? WHERE id_producto = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('ii', $new_stock, $id_producto);

        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Stock actualizado exitosamente.', 'stock_anterior' => $current_stock, 'stock_nuevo' => $new_stock]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Error al actualizar el stock: ' . $stmt->error]);
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

