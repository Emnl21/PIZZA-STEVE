<?php
// api/products.php
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
        // GET es público - no requiere autenticación para ver productos
        if ($id) {
            // Usar función almacenada para obtener producto por ID
            $stmt = $conn->prepare("CALL sp_get_product_by_id(?)");
            $stmt->bind_param('i', $id);
            $stmt->execute();
            $result = $stmt->get_result();
            $product = $result->fetch_assoc();
            echo json_encode($product);
            $stmt->close();
            // Cerrar resultados adicionales de procedimientos almacenados
            while ($conn->more_results()) {
                $conn->next_result();
                if ($result = $conn->store_result()) {
                    $result->free();
                }
            }
        } else {
            // Usar función almacenada para obtener todos los productos activos
            $stmt = $conn->prepare("CALL sp_get_active_products()");
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($result === false) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Error en la consulta SQL: ' . $conn->error]);
                $stmt->close();
                exit;
            }
            
            $products = [];
            while ($row = $result->fetch_assoc()) {
                // Limpiar y convertir a UTF-8 cada campo string
                $cleaned_row = [];
                foreach ($row as $key => $value) {
                    if (is_string($value)) {
                        // Detectar y limpiar caracteres UTF-8 inválidos
                        if (!mb_check_encoding($value, 'UTF-8')) {
                            $value = mb_convert_encoding($value, 'UTF-8', 'ISO-8859-1');
                            if (!mb_check_encoding($value, 'UTF-8')) {
                                $value = mb_convert_encoding($value, 'UTF-8', 'Windows-1252');
                            }
                            if (!mb_check_encoding($value, 'UTF-8')) {
                                $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $value);
                            }
                        }
                        $cleaned_row[$key] = $value;
                    } else {
                        $cleaned_row[$key] = $value;
                    }
                }
                $products[] = $cleaned_row;
            }
            
            // Asegurar que siempre devolvemos un array, incluso si está vacío
            $json_output = json_encode($products, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            
            if ($json_output === false) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Error al generar JSON: ' . json_last_error_msg()]);
                $stmt->close();
                exit;
            }
            
            echo $json_output;
            $stmt->close();
            // Cerrar resultados adicionales de procedimientos almacenados
            while ($conn->more_results()) {
                $conn->next_result();
                if ($result = $conn->store_result()) {
                    $result->free();
                }
            }
        }
        break;
    case 'POST':
        // POST requiere autenticación de admin o vendedor
        $current_user = requireAuth(['admin', 'vendedor']);
        
        $data = json_decode(file_get_contents('php://input'), true);
        $name = $data['name'] ?? '';
        $description = $data['description'] ?? '';
        $price = $data['price'] ?? 0;
        $categoria = $data['categoria'] ?? 'Pizza';
        $stock_disponible = $data['stock_disponible'] ?? 0;
        $sucursal_id = $data['sucursal_id'] ?? null;

        if (empty($name) || empty($price)) {
            echo json_encode(['success' => false, 'message' => 'Nombre y precio son requeridos.']);
            exit;
        }
        
        // Validar nombre (solo letras, espacios y acentos - sin números)
        $name = trim($name);
        if (strlen($name) < 2) {
            echo json_encode(['success' => false, 'message' => 'El nombre del producto debe tener al menos 2 caracteres.']);
            exit;
        }
        
        // Validar que el nombre no contenga números ni caracteres especiales (excepto espacios, guiones y apóstrofes)
        if (!preg_match("/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/", $name)) {
            echo json_encode(['success' => false, 'message' => 'El nombre del producto solo puede contener letras, espacios y acentos. No se permiten números ni caracteres especiales.']);
            exit;
        }
        
        // Validar precio
        if ($price <= 0) {
            echo json_encode(['success' => false, 'message' => 'El precio debe ser mayor a 0.']);
            exit;
        }
        
        // Validar stock
        if ($stock_disponible < 0 || !is_numeric($stock_disponible) || !is_int($stock_disponible + 0)) {
            echo json_encode(['success' => false, 'message' => 'El stock debe ser un número entero mayor o igual a 0.']);
            exit;
        }
        
        // Validar sucursal si se proporciona
        if ($sucursal_id !== null && $sucursal_id !== '') {
            if (!is_numeric($sucursal_id)) {
                echo json_encode(['success' => false, 'message' => 'ID de sucursal debe ser numérico.']);
                exit;
            }
            
            $sucursal_id = (int)$sucursal_id;
            $sql_check_branch = "SELECT id_sucursal, activa FROM sucursales WHERE id_sucursal = ?";
            $stmt_check = $conn->prepare($sql_check_branch);
            $stmt_check->bind_param('i', $sucursal_id);
            $stmt_check->execute();
            $result_check = $stmt_check->get_result();
            
            if ($result_check->num_rows === 0) {
                $stmt_check->close();
                echo json_encode(['success' => false, 'message' => 'Sucursal no encontrada.']);
                exit;
            }
            
            $branch = $result_check->fetch_assoc();
            if (!$branch['activa']) {
                $stmt_check->close();
                echo json_encode(['success' => false, 'message' => 'La sucursal no está activa.']);
                exit;
            }
            
            $stmt_check->close();
        } else {
            $sucursal_id = null;
        }

        // Usar función almacenada para crear producto
        $sucursal_id_value = $sucursal_id ? $sucursal_id : 0; // 0 o NULL para todas las sucursales
        $stmt = $conn->prepare("CALL sp_create_product(?, ?, ?, ?, ?, ?, @p_product_id, @p_success, @p_message)");
        $stmt->bind_param('ssdsii', $name, $description, $price, $categoria, $stock_disponible, $sucursal_id_value);
        
        if ($stmt->execute()) {
            // Obtener los valores de salida
            $result = $conn->query("SELECT @p_product_id as product_id, @p_success as success, @p_message as message");
            $output = $result->fetch_assoc();
            
            if ($output['success']) {
                echo json_encode([
                    'success' => true, 
                    'message' => $output['message'],
                    'product_id' => $output['product_id']
                ]);
            } else {
                echo json_encode([
                    'success' => false, 
                    'message' => $output['message']
                ]);
            }
        } else {
            echo json_encode(['success' => false, 'message' => 'Error al agregar el producto: ' . $stmt->error]);
        }
        $stmt->close();
        // Cerrar resultados adicionales de procedimientos almacenados
        while ($conn->more_results()) {
            $conn->next_result();
            if ($result = $conn->store_result()) {
                $result->free();
            }
        }
        break;
    case 'PUT':
        // PUT requiere autenticación de admin o vendedor
        $current_user = requireAuth(['admin', 'vendedor']);
        
        $data = json_decode(file_get_contents('php://input'), true);
        $id = $data['id'] ?? '';
        $name = $data['name'] ?? '';
        $description = $data['description'] ?? '';
        $price = $data['price'] ?? 0;
        $categoria = $data['categoria'] ?? 'Pizza';
        $stock_disponible = $data['stock_disponible'] ?? 0;
        $sucursal_id = $data['sucursal_id'] ?? null;

        if (empty($id) || empty($name) || empty($price)) {
            echo json_encode(['success' => false, 'message' => 'ID, nombre y precio son requeridos.']);
            exit;
        }
        
        // Validar ID
        if (!is_numeric($id)) {
            echo json_encode(['success' => false, 'message' => 'ID debe ser numérico.']);
            exit;
        }
        
        // Validar nombre (solo letras, espacios y acentos - sin números)
        $name = trim($name);
        if (strlen($name) < 2) {
            echo json_encode(['success' => false, 'message' => 'El nombre del producto debe tener al menos 2 caracteres.']);
            exit;
        }
        
        // Validar que el nombre no contenga números ni caracteres especiales (excepto espacios, guiones y apóstrofes)
        if (!preg_match("/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/", $name)) {
            echo json_encode(['success' => false, 'message' => 'El nombre del producto solo puede contener letras, espacios y acentos. No se permiten números ni caracteres especiales.']);
            exit;
        }
        
        // Validar precio
        if ($price <= 0) {
            echo json_encode(['success' => false, 'message' => 'El precio debe ser mayor a 0.']);
            exit;
        }
        
        // Validar stock
        if ($stock_disponible < 0) {
            echo json_encode(['success' => false, 'message' => 'El stock no puede ser negativo.']);
            exit;
        }
        
        // Validar sucursal si se proporciona
        if ($sucursal_id !== null && $sucursal_id !== '') {
            if (!is_numeric($sucursal_id)) {
                echo json_encode(['success' => false, 'message' => 'ID de sucursal debe ser numérico.']);
                exit;
            }
            
            $sucursal_id = (int)$sucursal_id;
            $sql_check_branch = "SELECT id_sucursal, activa FROM sucursales WHERE id_sucursal = ?";
            $stmt_check = $conn->prepare($sql_check_branch);
            $stmt_check->bind_param('i', $sucursal_id);
            $stmt_check->execute();
            $result_check = $stmt_check->get_result();
            
            if ($result_check->num_rows === 0) {
                $stmt_check->close();
                echo json_encode(['success' => false, 'message' => 'Sucursal no encontrada.']);
                exit;
            }
            
            $branch = $result_check->fetch_assoc();
            if (!$branch['activa']) {
                $stmt_check->close();
                echo json_encode(['success' => false, 'message' => 'La sucursal no está activa.']);
                exit;
            }
            
            $stmt_check->close();
        } else {
            $sucursal_id = null;
        }

        // Usar función almacenada para actualizar producto
        $sucursal_id_value = $sucursal_id ? $sucursal_id : 0; // 0 o NULL para todas las sucursales
        $stmt = $conn->prepare("CALL sp_update_product(?, ?, ?, ?, ?, ?, ?, @p_success, @p_message)");
        $stmt->bind_param('issdsii', $id, $name, $description, $price, $categoria, $stock_disponible, $sucursal_id_value);
        
        if ($stmt->execute()) {
            // Obtener los valores de salida
            $result = $conn->query("SELECT @p_success as success, @p_message as message");
            $output = $result->fetch_assoc();
            
            echo json_encode([
                'success' => (bool)$output['success'], 
                'message' => $output['message']
            ]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Error al actualizar el producto: ' . $stmt->error]);
        }
        $stmt->close();
        // Cerrar resultados adicionales de procedimientos almacenados
        while ($conn->more_results()) {
            $conn->next_result();
            if ($result = $conn->store_result()) {
                $result->free();
            }
        }
        break;
    case 'DELETE':
        // DELETE requiere autenticación de admin o vendedor
        $current_user = requireAuth(['admin', 'vendedor']);
        
        // MODIFICADO: Implementación de borrado lógico
        $id = $_GET['id'] ?? '';

        if (empty($id)) {
            echo json_encode(['success' => false, 'message' => 'ID de producto requerido.']);
            exit;
        }

        $sql = "UPDATE productos SET activa = 0 WHERE id_producto = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $id);

        if ($stmt->execute()) {
            if ($stmt->affected_rows > 0) {
                echo json_encode(['success' => true, 'message' => 'Producto desactivado exitosamente.']);
            } else {
                echo json_encode(['success' => false, 'message' => 'Producto no encontrado.']);
            }
        } else {
            echo json_encode(['success' => false, 'message' => 'Error al desactivar el producto: ' . $stmt->error]);
        }
        $stmt->close();
        break;
    default:
        echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
        break;
}

$conn->close();
?>