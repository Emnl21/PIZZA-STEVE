<?php
// api/orders.php
require_once '../config/environment.php';
require_once '../config/database.php';
require_once '../config/security.php';
require_once '../config/security_headers.php';
require_once 'auth_middleware.php';

setSecurityHeaders();
header('Content-Type: application/json');

// Verificar autenticación para todas las operaciones
// Los repartidores pueden ver sus pedidos asignados, pero solo admin/vendedor pueden modificar
$current_user = requireAuth(); // Cualquier usuario autenticado puede ver pedidos

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

// --- Estados válidos de pedidos (estandarizados) ---
$valid_states = ['pending', 'preparing', 'ready_for_delivery', 'out_for_delivery', 'completed', 'cancelled'];

// --- Métodos de pago válidos ---
$valid_payment_methods = ['efectivo', 'qr', 'tarjeta', 'transferencia'];

$size_factors = [
    'small' => 1.00,
    'medium' => 1.30,
    'large' => 1.60
];

// --- Mapa de Coordenadas de Sucursales ---
$branch_coordinates = [
    1 => ['lat' => -16.507, 'lng' => -68.127] 
];

// --- Función para calcular distancia entre dos puntos (fórmula de Haversine) ---
function calculateDistance($lat1, $lon1, $lat2, $lon2) {
    $R = 6371; // Radio de la Tierra en kilómetros
    $dLat = deg2rad($lat2 - $lat1);
    $dLon = deg2rad($lon2 - $lon1);
    $a = 
        sin($dLat / 2) * sin($dLat / 2) +
        cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
        sin($dLon / 2) * sin($dLon / 2);
    $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
    return $R * $c; // Distancia en kilómetros
}

// --- Función para encontrar la sucursal más cercana ---
function findNearestBranch($conn, $userLat, $userLng) {
    $sql = "SELECT id_sucursal, nombre, latitud, longitud FROM sucursales WHERE activa = 1 AND latitud IS NOT NULL AND longitud IS NOT NULL";
    $result = $conn->query($sql);
    
    if (!$result || $result->num_rows === 0) {
        return null;
    }
    
    $nearestBranch = null;
    $minDistance = PHP_FLOAT_MAX;
    
    while ($row = $result->fetch_assoc()) {
        $distance = calculateDistance($userLat, $userLng, $row['latitud'], $row['longitud']);
        if ($distance < $minDistance) {
            $minDistance = $distance;
            $nearestBranch = $row;
        }
    }
    
    return $nearestBranch;
}

function pedidosProductosHasSizeColumns($conn) {
    static $hasColumns = null;
    if ($hasColumns !== null) {
        return $hasColumns;
    }

    $columnsNeeded = ['tamano', 'precio_base', 'recargo_tamano'];
    $result = $conn->query("SHOW COLUMNS FROM pedidos_productos");

    if (!$result) {
        $hasColumns = false;
        return $hasColumns;
    }

    $presentColumns = [];
    while ($row = $result->fetch_assoc()) {
        $presentColumns[] = $row['Field'];
    }
    $result->close();

    $hasColumns = count(array_intersect($columnsNeeded, $presentColumns)) === count($columnsNeeded);
    return $hasColumns;
}

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

// --- Función para validar estado ---
function isValidState($state, $valid_states) {
    return in_array($state, $valid_states);
}

// --- Función para validar método de pago ---
function isValidPaymentMethod($method, $valid_methods) {
    return in_array($method, $valid_methods);
}

switch ($method) {
    case 'GET':
        if ($id) {
            // Obtener un pedido específico con detalles
            $pedido_id = str_replace('ORD-', '', $id);
            
            // Validar que el ID sea numérico
            if (!is_numeric($pedido_id)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'ID de pedido inválido.']);
                exit;
            }
            
            $pedido_id = (int)$pedido_id;
            
            // Usar función almacenada para obtener pedido por ID
            $stmt = $conn->prepare("CALL sp_get_order_by_id(?)");
            $stmt->bind_param('i', $pedido_id);
            $stmt->execute();
            $result = $stmt->get_result();
            $order = $result->fetch_assoc();
            $stmt->close();
            // Cerrar resultados adicionales de procedimientos almacenados
            while ($conn->more_results()) {
                $conn->next_result();
                if ($result = $conn->store_result()) {
                    $result->free();
                }
            }

            if ($order) {
                $order['descuento'] = isset($order['descuento']) ? (float)$order['descuento'] : 0;
                $order['discount'] = $order['descuento'];
                $order['es_cumpleanero'] = !empty($order['es_cumpleanero']);
                $order['is_birthday'] = $order['es_cumpleanero'];
                // Obtener productos del pedido
                $sizeColumnsSelect = '';
                if (pedidosProductosHasSizeColumns($conn)) {
                    $sizeColumnsSelect = ",
                        pp.tamano,
                        pp.precio_base,
                        pp.recargo_tamano
                    ";
                }

                $sql_products = "
                    SELECT 
                        pp.id_producto,
                        p.nombre,
                        pp.cantidad_producto,
                        pp.precio_u
                        $sizeColumnsSelect
                    FROM pedidos_productos pp
                    JOIN productos p ON pp.id_producto = p.id_producto
                    WHERE pp.id_pedido = ?
                ";
                $stmt_products = $conn->prepare($sql_products);
                if ($stmt_products) {
                    $stmt_products->bind_param('i', $pedido_id);
                    $stmt_products->execute();
                    $result_products = $stmt_products->get_result();
                    $products = [];
                    while ($row = $result_products->fetch_assoc()) {
                        $products[] = $row;
                    }
                    $stmt_products->close();
                    $order['products'] = $products;
                } else {
                    $order['products'] = [];
                }

                // Obtener comprobantes del pedido
                // Usar COALESCE para manejar el caso donde la columna tipo_comprobante no existe
                $sql_receipts = "
                    SELECT 
                        id_comprobante,
                        ruta_archivo,
                        fecha_subida,
                        tipo_archivo,
                        tamano_archivo,
                        COALESCE(tipo_comprobante, 'pago') AS tipo_comprobante
                    FROM comprobantes_pago
                    WHERE id_pedido = ?
                    ORDER BY fecha_subida DESC
                ";
                $stmt_receipts = $conn->prepare($sql_receipts);
                if ($stmt_receipts) {
                    $stmt_receipts->bind_param('i', $pedido_id);
                    $stmt_receipts->execute();
                    $result_receipts = $stmt_receipts->get_result();
                    $receipts = [];
                    while ($row = $result_receipts->fetch_assoc()) {
                        // Si tipo_comprobante no existe en la BD, asignar 'pago' por defecto
                        if (!isset($row['tipo_comprobante']) || empty($row['tipo_comprobante'])) {
                            $row['tipo_comprobante'] = 'pago';
                        }
                        $receipts[] = $row;
                    }
                    $stmt_receipts->close();
                    $order['receipts'] = $receipts;
                } else {
                    $order['receipts'] = [];
                }

                $order['id'] = 'ORD-' . str_pad($order['id_pedido'], 3, '0', STR_PAD_LEFT);
                echo json_encode($order);
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Pedido no encontrado.']);
            }
        } else {
        // Verificar si el usuario es cliente (solo puede ver sus propios pedidos) o vendedor (filtrar por sucursal)
        $is_client = (strtolower($current_user['rol_nombre']) === 'cliente');
        $is_vendor_list = (strtolower($current_user['rol_nombre']) === 'vendedor');
        $vendor_branch_id = null;
        if ($is_vendor_list) {
            $vendor_branch_id = getUserBranchId($conn, $current_user);
        }
        $conditions = [];
        if ($is_client) {
            $conditions[] = "p.usuario_id = " . (int)$current_user['id_usuario'];
        }
        if ($is_vendor_list && $vendor_branch_id) {
            $conditions[] = "p.sucursal_id = " . (int)$vendor_branch_id;
        }
        $where_clause = '';
        if (!empty($conditions)) {
            $where_clause = ' WHERE ' . implode(' AND ', $conditions);
        }
            
            // Obtener todos los pedidos usando vista v_pedidos_completos
            // Construir WHERE clause para la vista
            $viewWhere = '';
            if (!empty($conditions)) {
                // Convertir condiciones para usar alias de la vista
                $viewConditions = [];
                foreach ($conditions as $condition) {
                    // Reemplazar alias de tabla por alias de vista
                    $viewCondition = str_replace('p.usuario_id', 'vpc.usuario_id', $condition);
                    $viewCondition = str_replace('p.sucursal_id', 'vpc.sucursal_id', $viewCondition);
                    $viewConditions[] = $viewCondition;
                }
                $viewWhere = ' WHERE ' . implode(' AND ', $viewConditions);
            }
            
            $sql = "
                SELECT 
                    vpc.id_pedido,
                    vpc.sucursal_id,
                    vpc.usuario_id,
                    vpc.sucursal_nombre AS branchName,
                    vpc.sucursal_latitud AS branch_lat,
                    vpc.sucursal_longitud AS branch_lng,
                    vpc.usuario_nombre AS customerName,
                    vpc.direccion_completa AS address,
                    vpc.estado AS status,
                    vpc.metodo_pago AS paymentType,
                    vpc.total AS price,
                    vpc.descuento,
                    vpc.es_cumpleanero,
                    DATE_FORMAT(vpc.fecha_pedido, '%Y-%m-%d %H:%i:%s') AS fecha_pedido,
                    vpc.pago_confirmado,
                    vpc.direccion_latitud AS lat,
                    vpc.direccion_longitud AS lng,
                    vpc.repartidor_nombre AS repartidorNombre,
                    (SELECT COUNT(*) FROM pedidos_productos pp WHERE pp.id_pedido = vpc.id_pedido) AS items_count
                FROM 
                    v_pedidos_completos AS vpc
                " . $viewWhere . "
                ORDER BY vpc.fecha_pedido DESC, vpc.id_pedido DESC
            ";

            $result = $conn->query($sql);

            if ($result) {
                $orders = [];
                while($row = $result->fetch_assoc()) {
                    $sucursal_id = $row['sucursal_id'];
                    $pedido_id = $row['id_pedido'];
                    
                    // Función para limpiar strings a UTF-8
                    $cleanString = function($value) {
                        if (is_string($value)) {
                            if (!mb_check_encoding($value, 'UTF-8')) {
                                $value = mb_convert_encoding($value, 'UTF-8', 'ISO-8859-1');
                                if (!mb_check_encoding($value, 'UTF-8')) {
                                    $value = mb_convert_encoding($value, 'UTF-8', 'Windows-1252');
                                }
                                if (!mb_check_encoding($value, 'UTF-8')) {
                                    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $value);
                                }
                            }
                        }
                        return $value;
                    };
                    
                    // Obtener productos del pedido - contar productos distintos y suma de cantidades
                    $sql_products = "SELECT COUNT(DISTINCT id_producto) as productos_distintos, SUM(cantidad_producto) as total_cantidad 
                                     FROM pedidos_productos WHERE id_pedido = ?";
                    $stmt_products = $conn->prepare($sql_products);
                    $items_count = 0;
                    $items_total = 0;
                    if ($stmt_products) {
                        $stmt_products->bind_param('i', $pedido_id);
                        $stmt_products->execute();
                        $result_products = $stmt_products->get_result();
                        if ($result_products && $result_products->num_rows > 0) {
                            $prod_data = $result_products->fetch_assoc();
                            $items_count = (int)($prod_data['productos_distintos'] ?? 0);
                            $items_total = (int)($prod_data['total_cantidad'] ?? 0);
                        }
                        $stmt_products->close();
                    }
                    
                    $branch_lat = isset($row['branch_lat']) ? (float)$row['branch_lat'] : null;
                    $branch_lng = isset($row['branch_lng']) ? (float)$row['branch_lng'] : null;
                    $orders[] = [
                        'id' => 'ORD-' . str_pad($row['id_pedido'], 3, '0', STR_PAD_LEFT),
                        'id_pedido' => $row['id_pedido'],
                        'usuario_id' => (int)$row['usuario_id'],
                        'customerName' => $cleanString($row['customerName']),
                        'address' => $cleanString($row['address']),
                        'status' => $row['status'],
                        'paymentType' => $row['paymentType'],
                        'price' => (float)$row['price'],
                        'discount' => isset($row['descuento']) ? (float)$row['descuento'] : 0,
                        'is_birthday' => !empty($row['es_cumpleanero']),
                        'fecha_pedido' => $row['fecha_pedido'],
                        'pago_confirmado' => (bool)$row['pago_confirmado'],
                        'repartidorNombre' => $cleanString($row['repartidorNombre']),
                        'items_count' => $items_count,
                        'items_total' => $items_total,
                        'coordinates' => [
                            'lat' => (float)$row['lat'],
                            'lng' => (float)$row['lng']
                        ],
                        'branch' => [
                            'id' => $sucursal_id,
                            'name' => $cleanString($row['branchName']),
                            'coordinates' => ($branch_lat !== null && $branch_lng !== null)
                                ? ['lat' => $branch_lat, 'lng' => $branch_lng]
                                : (isset($branch_coordinates[$sucursal_id]) ? $branch_coordinates[$sucursal_id] : null)
                        ]
                    ];
                }
                
                $json_output = json_encode($orders, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                
                if ($json_output === false) {
                    http_response_code(500);
                    echo json_encode(['success' => false, 'error' => 'Error al generar JSON: ' . json_last_error_msg()]);
                    exit;
                }
                
                echo $json_output;
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Ocurrió un error al procesar su solicitud: ' . $conn->error]);
            }
        }
        break;
    case 'POST':
        // Admin, vendedor y cliente pueden crear pedidos
        $can_manage_all_orders = verifyRole(['admin', 'vendedor']);
        if (!$can_manage_all_orders && !verifyRole(['cliente'])) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'No tiene permisos para crear pedidos.']);
            exit;
        }
        
        $data = json_decode(file_get_contents('php://input'), true);
        
        // Validar datos requeridos
        $usuario_id = $current_user['id_usuario'];
        if ($can_manage_all_orders && isset($data['usuario_id']) && is_numeric($data['usuario_id'])) {
            $usuario_id = (int)$data['usuario_id'];
        }
        $sucursal_id = $data['sucursal_id'] ?? null;
        $direccion_id = $data['direccion_id'] ?? null;
        $productos = $data['productos'] ?? [];
        if (empty($productos) && isset($data['items']) && is_array($data['items'])) {
            foreach ($data['items'] as $item) {
                $productos[] = [
                    'id_producto' => $item['id_producto'] ?? $item['id'] ?? $item['productId'] ?? null,
                    'cantidad' => $item['cantidad'] ?? $item['qty'] ?? $item['quantity'] ?? 0,
                    'precio' => $item['precio'] ?? $item['price'] ?? 0
                ];
            }
        }
        $metodo_pago = $data['metodo_pago'] ?? $data['paymentMethod'] ?? 'efectivo';
        $total = $data['total'] ?? ($data['monto_total'] ?? 0);
        $descuento = isset($data['descuento']) ? (float)$data['descuento'] : 0;
        $es_cumpleanero_flag = !empty($data['es_cumpleanero']);
        $promocion_id = $data['promocion_id'] ?? null;
        
        // Validaciones
        if (empty($productos) || !is_array($productos) || count($productos) === 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Debe incluir al menos un producto en el pedido.']);
            exit;
        }
        
        if ($total <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'El total del pedido debe ser mayor a 0.']);
            exit;
        }
        
        if (!isValidPaymentMethod($metodo_pago, $valid_payment_methods)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Método de pago no válido.']);
            exit;
        }
        
        // Obtener coordenadas del usuario para seleccionar sucursal más cercana
        $userLat = $data['lat'] ?? null;
        $userLng = $data['lng'] ?? null;
        
        // Si hay dirección_id, obtener coordenadas de la dirección
        if ($userLat === null || $userLng === null) {
            if ($direccion_id !== null) {
                $sql_dir_coords = "SELECT latitud, longitud FROM direcciones_entrega WHERE id_direccion = ?";
                $stmt_dir_coords = $conn->prepare($sql_dir_coords);
                $stmt_dir_coords->bind_param('i', $direccion_id);
                $stmt_dir_coords->execute();
                $result_dir_coords = $stmt_dir_coords->get_result();
                if ($result_dir_coords->num_rows > 0) {
                    $dir_data = $result_dir_coords->fetch_assoc();
                    $userLat = $dir_data['latitud'] ?? null;
                    $userLng = $dir_data['longitud'] ?? null;
                }
                $stmt_dir_coords->close();
            }
        }
        
        // Validar sucursal
        if ($sucursal_id === null) {
            // Intentar encontrar la sucursal más cercana si tenemos coordenadas
            if ($userLat !== null && $userLng !== null) {
                $nearestBranch = findNearestBranch($conn, $userLat, $userLng);
                if ($nearestBranch) {
                    $sucursal_id = $nearestBranch['id_sucursal'];
                }
            }
            
            // Si no se encontró sucursal cercana, obtener la primera sucursal activa
            if ($sucursal_id === null) {
                $sql_sucursal = "SELECT id_sucursal FROM sucursales WHERE activa = 1 LIMIT 1";
                $result_sucursal = $conn->query($sql_sucursal);
                if ($result_sucursal && $result_sucursal->num_rows > 0) {
                    $sucursal = $result_sucursal->fetch_assoc();
                    $sucursal_id = $sucursal['id_sucursal'];
                } else {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'No hay sucursales activas disponibles.']);
                    exit;
                }
            }
        } else {
            // Verificar que la sucursal existe y está activa
            $sql_check = "SELECT id_sucursal, activa FROM sucursales WHERE id_sucursal = ?";
            $stmt_check = $conn->prepare($sql_check);
            $stmt_check->bind_param('i', $sucursal_id);
            $stmt_check->execute();
            $result_check = $stmt_check->get_result();
            if ($result_check->num_rows === 0) {
                $stmt_check->close();
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Sucursal no encontrada.']);
                exit;
            }
            $sucursal_data = $result_check->fetch_assoc();
            if (!$sucursal_data['activa']) {
                $stmt_check->close();
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'La sucursal no está activa.']);
                exit;
            }
            $stmt_check->close();
        }
        
        // Validar dirección o crear una temporal
        if ($direccion_id === null) {
            // Crear dirección temporal si no se proporciona
            $direccion_temp = $data['direccion'] ?? 'Dirección no especificada';
            $lat = $data['lat'] ?? -16.507;
            $lng = $data['lng'] ?? -68.127;
            
            $sql_dir = "INSERT INTO direcciones_entrega (usuario_id, direccion, latitud, longitud) VALUES (?, ?, ?, ?)";
            $stmt_dir = $conn->prepare($sql_dir);
            $stmt_dir->bind_param('isdd', $usuario_id, $direccion_temp, $lat, $lng);
            if ($stmt_dir->execute()) {
                $direccion_id = $conn->insert_id;
            } else {
                $stmt_dir->close();
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Error al crear la dirección: ' . $stmt_dir->error]);
                exit;
            }
            $stmt_dir->close();
        }
        
        // Validar productos y calcular total
        $total_calculado = 0;
        $productos_calculados = [];

        foreach ($productos as $producto) {
            $id_producto = $producto['id_producto'] ?? $producto['id'] ?? null;
            $cantidad = $producto['cantidad'] ?? $producto['qty'] ?? 0;
            
            if (!$id_producto || $cantidad <= 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Datos de producto inválidos.']);
                exit;
            }
            
            // Verificar que el producto existe y está activo
            $sql_prod = "SELECT id_producto, precio, stock_disponible, activa FROM productos WHERE id_producto = ?";
            $stmt_prod = $conn->prepare($sql_prod);
            $stmt_prod->bind_param('i', $id_producto);
            $stmt_prod->execute();
            $result_prod = $stmt_prod->get_result();
            
            if ($result_prod->num_rows === 0) {
                $stmt_prod->close();
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Producto no encontrado: ID ' . $id_producto]);
                exit;
            }
            
            $prod_data = $result_prod->fetch_assoc();
            if (!$prod_data['activa']) {
                $stmt_prod->close();
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'El producto no está disponible.']);
                exit;
            }
            
            // Verificar stock disponible
            $stock_disponible = isset($prod_data['stock_disponible']) ? (int)$prod_data['stock_disponible'] : null;
            if ($stock_disponible !== null && $stock_disponible < $cantidad) {
                $stmt_prod->close();
                http_response_code(400);
                echo json_encode([
                    'success' => false, 
                    'message' => "No hay suficiente stock disponible. Stock actual: {$stock_disponible}, solicitado: {$cantidad}"
                ]);
                exit;
            }
            
            $tamano = strtolower($producto['size'] ?? $producto['tamano'] ?? 'medium');
            if (!array_key_exists($tamano, $size_factors)) {
                $tamano = 'medium';
            }

            $factor_tamano = $size_factors[$tamano];
            $precio_base = (float)$prod_data['precio'];
            $precio_final = round($precio_base * $factor_tamano, 2);
            $recargo_tamano = round($precio_final - $precio_base, 2);

            $total_calculado += $precio_final * $cantidad;
            $productos_calculados[] = [
                'id_producto' => $id_producto,
                'cantidad' => $cantidad,
                'precio_final' => $precio_final,
                'tamano' => $tamano,
                'precio_base' => $precio_base,
                'recargo' => $recargo_tamano
            ];
            $stmt_prod->close();
        }
        
        if ($descuento < 0) {
            $descuento = 0;
        }
        if ($descuento > $total_calculado) {
            $descuento = $total_calculado;
        }
        $es_cumpleanero = ($es_cumpleanero_flag && $descuento > 0) ? 1 : 0;
        
        // Aplicar descuento si existe
        $total_final = $total_calculado - $descuento;
        if ($total_final < 0) {
            $total_final = 0;
        }
        
        // Si se proporcionó un total, validar que sea razonable (con margen de error del 5%)
        if ($total > 0 && abs($total - $total_final) > ($total_final * 0.05)) {
            // Usar el total calculado en lugar del proporcionado
            $total = $total_final;
        } else if ($total <= 0) {
            $total = $total_final;
        }
        
        // Iniciar transacción
        $conn->begin_transaction();
        
        try {
            // Usar función almacenada para crear el pedido
            $pago_confirmado = ($metodo_pago === 'efectivo') ? 1 : 0;
            $stmt_pedido = $conn->prepare("CALL sp_create_order(?, ?, ?, ?, ?, ?, ?, ?, @p_order_id, @p_success, @p_message)");
            $stmt_pedido->bind_param('iiiddisi', $usuario_id, $sucursal_id, $direccion_id, $total, $descuento, $es_cumpleanero, $metodo_pago, $pago_confirmado);
            
            if (!$stmt_pedido->execute()) {
                throw new Exception('Error al crear el pedido: ' . $stmt_pedido->error);
            }
            
            // Obtener los valores de salida
            $result_order = $conn->query("SELECT @p_order_id as order_id, @p_success as success, @p_message as message");
            $output_order = $result_order->fetch_assoc();
            
            if (!$output_order['success']) {
                throw new Exception($output_order['message']);
            }
            
            $id_pedido = $output_order['order_id'];
            $stmt_pedido->close();
            // Cerrar resultados adicionales de procedimientos almacenados
            while ($conn->more_results()) {
                $conn->next_result();
                if ($result = $conn->store_result()) {
                    $result->free();
                }
            }
            
            // Insertar productos del pedido
            $sizeColumnsAvailable = pedidosProductosHasSizeColumns($conn);
            if ($sizeColumnsAvailable) {
                $sql_prod_pedido = "INSERT INTO pedidos_productos (id_pedido, id_producto, cantidad_producto, precio_u, tamano, precio_base, recargo_tamano) VALUES (?, ?, ?, ?, ?, ?, ?)";
            } else {
                $sql_prod_pedido = "INSERT INTO pedidos_productos (id_pedido, id_producto, cantidad_producto, precio_u) VALUES (?, ?, ?, ?)";
            }
            $stmt_prod_pedido = $conn->prepare($sql_prod_pedido);
            
            foreach ($productos_calculados as $producto_calc) {
                if ($sizeColumnsAvailable) {
                    $stmt_prod_pedido->bind_param(
                        'iiidsdd',
                        $id_pedido,
                        $producto_calc['id_producto'],
                        $producto_calc['cantidad'],
                        $producto_calc['precio_final'],
                        $producto_calc['tamano'],
                        $producto_calc['precio_base'],
                        $producto_calc['recargo']
                    );
                } else {
                    $stmt_prod_pedido->bind_param(
                        'iiid',
                        $id_pedido,
                        $producto_calc['id_producto'],
                        $producto_calc['cantidad'],
                        $producto_calc['precio_final']
                    );
                }
                if (!$stmt_prod_pedido->execute()) {
                    throw new Exception('Error al agregar producto al pedido: ' . $stmt_prod_pedido->error);
                }
            }
            
            $stmt_prod_pedido->close();
            
            // Confirmar transacción
            $conn->commit();
            
            echo json_encode([
                'success' => true,
                'message' => 'Pedido creado exitosamente.',
                'orderId' => 'ORD-' . str_pad($id_pedido, 3, '0', STR_PAD_LEFT),
                'id_pedido' => $id_pedido
            ]);
            
        } catch (Exception $e) {
            // Revertir transacción en caso de error
            $conn->rollback();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;
    case 'PUT':
        // Admin, vendedor y repartidor pueden modificar pedidos
        // Los repartidores solo pueden actualizar el estado de pedidos asignados a ellos
        $current_user = requireAuth(['admin', 'vendedor', 'repartidor']);
        $is_repartidor = (strtolower($current_user['rol_nombre']) === 'repartidor');
        
        $data = json_decode(file_get_contents('php://input'), true);
        $id_pedido = $data['id_pedido'] ?? '';
        $estado = $data['estado'] ?? '';
        $repartidor_id = $data['repartidor_id'] ?? null;
        $pago_confirmado = $data['pago_confirmado'] ?? null;
        
        // Si es repartidor, obtener su ID de repartidor desde la tabla repartidores
        $current_repartidor_id = null;
        if ($is_repartidor) {
            // Buscar repartidor por nombre o email del usuario (búsqueda flexible, case-insensitive)
            // Primero intentar búsqueda exacta
            $sql_find_repartidor = "SELECT id_repartidor FROM repartidores 
                                    WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(?)) 
                                       OR LOWER(TRIM(correo_electronico)) = LOWER(TRIM(?)) 
                                    LIMIT 1";
            $stmt_find = $conn->prepare($sql_find_repartidor);
            $user_nombre = trim($current_user['nombre']);
            $user_email = trim($current_user['correo_electronico']);
            $stmt_find->bind_param('ss', $user_nombre, $user_email);
            $stmt_find->execute();
            $result_find = $stmt_find->get_result();
            if ($result_find->num_rows > 0) {
                $repartidor_data = $result_find->fetch_assoc();
                $current_repartidor_id = $repartidor_data['id_repartidor'];
            }
            $stmt_find->close();
            
            // Si no se encontró con búsqueda exacta, intentar búsqueda parcial por nombre
            if (!$current_repartidor_id && !empty($user_nombre)) {
                $sql_find_repartidor_partial = "SELECT id_repartidor FROM repartidores 
                                                 WHERE LOWER(TRIM(nombre)) LIKE LOWER(TRIM(?)) 
                                                    OR LOWER(TRIM(correo_electronico)) LIKE LOWER(TRIM(?))
                                                 LIMIT 1";
                $stmt_find_partial = $conn->prepare($sql_find_repartidor_partial);
                $nombre_like = '%' . $user_nombre . '%';
                $email_like = '%' . $user_email . '%';
                $stmt_find_partial->bind_param('ss', $nombre_like, $email_like);
                $stmt_find_partial->execute();
                $result_find_partial = $stmt_find_partial->get_result();
                if ($result_find_partial->num_rows > 0) {
                    $repartidor_data = $result_find_partial->fetch_assoc();
                    $current_repartidor_id = $repartidor_data['id_repartidor'];
                }
                $stmt_find_partial->close();
            }
            
            // Si aún no se encontró, crear automáticamente el registro de repartidor
            if (!$current_repartidor_id) {
                // Crear registro de repartidor automáticamente basado en el usuario
                $sql_create_repartidor = "INSERT INTO repartidores (nombre, correo_electronico, estado, fecha_inicio_trabajo) 
                                          VALUES (?, ?, 'disponible', CURDATE())";
                $stmt_create = $conn->prepare($sql_create_repartidor);
                $stmt_create->bind_param('ss', $user_nombre, $user_email);
                
                if ($stmt_create->execute()) {
                    $current_repartidor_id = $conn->insert_id;
                } else {
                    // Si falla la creación, intentar obtener el último registro con el mismo nombre/email
                    // (por si acaso se creó en otro proceso)
                    $sql_find_last = "SELECT id_repartidor FROM repartidores 
                                      WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(?)) 
                                         OR LOWER(TRIM(correo_electronico)) = LOWER(TRIM(?)) 
                                      ORDER BY id_repartidor DESC LIMIT 1";
                    $stmt_find_last = $conn->prepare($sql_find_last);
                    $stmt_find_last->bind_param('ss', $user_nombre, $user_email);
                    $stmt_find_last->execute();
                    $result_find_last = $stmt_find_last->get_result();
                    if ($result_find_last->num_rows > 0) {
                        $repartidor_data = $result_find_last->fetch_assoc();
                        $current_repartidor_id = $repartidor_data['id_repartidor'];
                    }
                    $stmt_find_last->close();
                }
                $stmt_create->close();
            }
            
            if (!$current_repartidor_id) {
                http_response_code(403);
                echo json_encode([
                    'success' => false, 
                    'message' => 'No se pudo encontrar o crear tu registro como repartidor. Contacta al administrador.',
                    'debug' => [
                        'user_nombre' => $user_nombre,
                        'user_email' => $user_email
                    ]
                ]);
                exit;
            }
        }

        // Validar ID de pedido
        if (empty($id_pedido) || !is_numeric($id_pedido)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ID de pedido es requerido y debe ser numérico.']);
            exit;
        }
        
        $id_pedido = (int)$id_pedido;

        // Obtener información actual del pedido
        $sql_current_order = "SELECT repartidor_id, estado FROM pedidos WHERE id_pedido = ?";
        $stmt_current_order = $conn->prepare($sql_current_order);
        if (!$stmt_current_order) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error al preparar la consulta de pedido actual: ' . $conn->error]);
            exit;
        }
        $stmt_current_order->bind_param('i', $id_pedido);
        $stmt_current_order->execute();
        $result_current_order = $stmt_current_order->get_result();
        if ($result_current_order->num_rows === 0) {
            $stmt_current_order->close();
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Pedido no encontrado.']);
            exit;
        }
        $current_order = $result_current_order->fetch_assoc();
        $stmt_current_order->close();
        
        $previous_repartidor_id = $current_order['repartidor_id'] ?? null;
        $previous_estado = $current_order['estado'] ?? null;
        
        // Prevenir modificaciones de pedidos entregados (completed)
        if ($previous_estado === 'completed') {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'No se pueden modificar pedidos que ya han sido entregados.']);
            exit;
        }

        $updates = [];
        $params = [];
        $types = '';

        // Validar estado si se proporciona
        if (!empty($estado)) {
            if (!isValidState($estado, $valid_states)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Estado no válido. Estados permitidos: ' . implode(', ', $valid_states)]);
                exit;
            }
            
            // Validar transición de estado (no permitir cambios desde completed o cancelled)
            if ($previous_estado === 'completed') {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'No se pueden modificar pedidos que ya han sido entregados.']);
                exit;
            }
            
            if ($previous_estado === 'cancelled' && $estado !== 'cancelled') {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'No se puede cambiar el estado de un pedido cancelado.']);
                exit;
            }
            
            $updates[] = "estado = ?";
            $params[] = $estado;
            $types .= 's';
        }

        // Validar repartidor si se asigna
        if ($repartidor_id !== null) {
            if (!is_numeric($repartidor_id)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'ID de repartidor debe ser numérico.']);
                exit;
            }
            
            $repartidor_id = (int)$repartidor_id;
            
            // Verificar que el repartidor existe y está disponible
            $sql_check_delivery = "SELECT id_repartidor, estado FROM repartidores WHERE id_repartidor = ?";
            $stmt_check = $conn->prepare($sql_check_delivery);
            $stmt_check->bind_param('i', $repartidor_id);
            $stmt_check->execute();
            $result_check = $stmt_check->get_result();
            
            if ($result_check->num_rows === 0) {
                $stmt_check->close();
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Repartidor no encontrado.']);
                exit;
            }
            
            $delivery = $result_check->fetch_assoc();
            if ($delivery['estado'] !== 'disponible') {
                $stmt_check->close();
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'El repartidor no está disponible.']);
                exit;
            }
            
            $stmt_check->close();
            
            $updates[] = "repartidor_id = ?";
            $params[] = $repartidor_id;
            $types .= 'i';
        }

        if ($pago_confirmado !== null) {
            $updates[] = "pago_confirmado = ?";
            $params[] = $pago_confirmado ? 1 : 0;
            $types .= 'i';
        }

        // Si es repartidor y está cambiando el estado, verificar/auto-asignar
        if ($is_repartidor && !empty($estado)) {
            // Verificar si el pedido ya tiene un repartidor asignado
            $sql_check_pedido = "SELECT repartidor_id FROM pedidos WHERE id_pedido = ?";
            $stmt_check_pedido = $conn->prepare($sql_check_pedido);
            $stmt_check_pedido->bind_param('i', $id_pedido);
            $stmt_check_pedido->execute();
            $result_check_pedido = $stmt_check_pedido->get_result();
            
            if ($result_check_pedido->num_rows === 0) {
                $stmt_check_pedido->close();
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Pedido no encontrado.']);
                exit;
            }
            
            $pedido_data = $result_check_pedido->fetch_assoc();
            $stmt_check_pedido->close();
            
            // Si no tiene repartidor asignado, auto-asignarse
            if (!$pedido_data['repartidor_id']) {
                $updates[] = "repartidor_id = ?";
                $params[] = $current_repartidor_id;
                $types .= 'i';
            } else if ($pedido_data['repartidor_id'] != $current_repartidor_id) {
                // Si el pedido está asignado a otro repartidor, no permitir cambios
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Este pedido está asignado a otro repartidor.']);
                exit;
            }
        }

        if (empty($updates)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'No hay campos para actualizar.']);
            exit;
        }
        
        // Si hay estado o repartidor para actualizar, usar función almacenada
        if (!empty($estado) || $repartidor_id !== null) {
            // Usar función almacenada para actualizar estado del pedido
            // El trigger manejará automáticamente el estado del repartidor
            $stmt = $conn->prepare("CALL sp_update_order_status(?, ?, ?, @p_success, @p_message)");
            $estado_actualizar = !empty($estado) ? $estado : $previous_estado;
            $stmt->bind_param('isi', $id_pedido, $estado_actualizar, $repartidor_id);
            
            if (!$stmt->execute()) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Error al actualizar el pedido: ' . $stmt->error]);
                $stmt->close();
                exit;
            }
            
            // Obtener los valores de salida
            $result = $conn->query("SELECT @p_success as success, @p_message as message");
            $output = $result->fetch_assoc();
            
            // Si también hay que actualizar pago_confirmado, hacerlo por separado
            if ($pago_confirmado !== null) {
                $sql_pago = "UPDATE pedidos SET pago_confirmado = ? WHERE id_pedido = ?";
                $stmt_pago = $conn->prepare($sql_pago);
                $stmt_pago->bind_param('ii', $pago_confirmado, $id_pedido);
                $stmt_pago->execute();
                $stmt_pago->close();
            }
            
            // Cerrar resultados adicionales de procedimientos almacenados
            while ($conn->more_results()) {
                $conn->next_result();
                if ($result = $conn->store_result()) {
                    $result->free();
                }
            }
            
            if ($output['success']) {
                // Si el estado cambió a "completed", crear notificación para el usuario
                if ($estado === 'completed' && $previous_estado !== 'completed') {
                    // Obtener el usuario del pedido
                    $sql_user = "SELECT usuario_id FROM pedidos WHERE id_pedido = ?";
                    $stmt_user = $conn->prepare($sql_user);
                    $stmt_user->bind_param('i', $id_pedido);
                    $stmt_user->execute();
                    $result_user = $stmt_user->get_result();
                    
                    if ($result_user && $result_user->num_rows > 0) {
                        $order_user = $result_user->fetch_assoc();
                        $user_id = $order_user['usuario_id'];
                        
                        // Crear notificación
                        require_once 'create_notification.php';
                        createNotification(
                            $conn,
                            $user_id,
                            $id_pedido,
                            'pedido_entregado',
                            '¡Pedido Entregado!',
                            '¿Cómo te fue con tu pedido?'
                        );
                    }
                    $stmt_user->close();
                }
                
                echo json_encode(['success' => true, 'message' => $output['message']]);
            } else {
                echo json_encode(['success' => false, 'message' => $output['message']]);
            }
            $stmt->close();
        } else if ($pago_confirmado !== null) {
            // Solo actualizar pago_confirmado
            $sql_pago = "UPDATE pedidos SET pago_confirmado = ? WHERE id_pedido = ?";
            $stmt_pago = $conn->prepare($sql_pago);
            $stmt_pago->bind_param('ii', $pago_confirmado, $id_pedido);
            
            if ($stmt_pago->execute()) {
                if ($stmt_pago->affected_rows > 0) {
                    echo json_encode(['success' => true, 'message' => 'Pedido actualizado exitosamente.']);
                } else {
                    echo json_encode(['success' => false, 'message' => 'Pedido no encontrado o sin cambios.']);
                }
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Error al actualizar el pedido: ' . $stmt_pago->error]);
            }
            $stmt_pago->close();
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'No hay campos para actualizar.']);
        }
        break;
    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
        break;
}

$conn->close();
?>