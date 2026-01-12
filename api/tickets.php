<?php
// api/tickets.php
require_once '../config/environment.php';
require_once '../config/database.php';
require_once '../config/security.php';
require_once '../config/security_headers.php';
require_once 'auth_middleware.php';

setSecurityHeaders();
header('Content-Type: application/json');

// Verificar autenticación - Solo vendedores y admins pueden gestionar tickets
$current_user = requireAuth(['admin', 'vendedor']);

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

// Estados válidos de tickets
$valid_states = ['pendiente', 'entregado', 'cancelado'];

/**
 * Decodifica el contenido de notas_vendedor para extraer datos manuales del cliente
 * @param string|null $raw
 * @return array Array con claves [cliente_manual, comentarios]
 */
function decode_manual_ticket_data($raw) {
    if (empty($raw)) {
        return [null, null];
    }

    $decoded = json_decode($raw, true);
    if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
        $cliente_manual = $decoded['cliente_manual'] ?? null;
        // Compatibilidad si se guardó directamente el objeto del cliente
        if (!$cliente_manual && isset($decoded['nombre'])) {
            $cliente_manual = $decoded;
        }
        $comentarios = $decoded['comentarios'] ?? ($decoded['notas'] ?? null);
        return [$cliente_manual, $comentarios];
    }

    // Si no es JSON válido, considerarlo como texto plano
    return [null, is_string($raw) ? $raw : null];
}

switch ($method) {
    case 'GET':
        if ($id) {
            // Obtener un ticket específico con todos sus detalles
            $ticket_id = (int)$id;
            
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
            $stmt->bind_param('i', $ticket_id);
            $stmt->execute();
            $result = $stmt->get_result();
            $ticket = $result->fetch_assoc();
            $stmt->close();
            
            if ($ticket) {
                list($manual_data, $manual_notes) = decode_manual_ticket_data($ticket['notas_vendedor'] ?? null);
                
                // Obtener productos del pedido
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
                    $products[] = [
                        'id_producto' => (int)$row['id_producto'],
                        'nombre' => $row['producto_nombre'],
                        'cantidad' => (int)$row['cantidad_producto'],
                        'precio_unitario' => (float)$row['precio_u'],
                        'subtotal' => (float)$row['subtotal']
                    ];
                }
                $stmt_products->close();
                
                // Calcular totales
                $subtotal = array_sum(array_column($products, 'subtotal'));
                $descuento = (float)$ticket['descuento'];
                $total = (float)$ticket['total'];
                
                // Formatear respuesta
                $response = [
                    'success' => true,
                    'ticket' => [
                        'id_ticket' => (int)$ticket['id_ticket'],
                        'numero_ticket' => $ticket['numero_ticket'],
                        'id_pedido' => (int)$ticket['id_pedido'],
                        'estado' => $ticket['estado_ticket'],
                        'notas' => $ticket['notas_vendedor'],
                        'fecha_creacion' => $ticket['fecha_creacion'],
                        'fecha_actualizacion' => $ticket['fecha_actualizacion'],
                        'cliente' => [
                            'nombre' => $ticket['cliente_nombre'],
                            'telefono' => $ticket['cliente_telefono'],
                            'email' => $ticket['cliente_email'],
                            'direccion' => $ticket['cliente_direccion']
                        ],
                        'sucursal' => [
                            'nombre' => $ticket['sucursal_nombre'],
                            'telefono' => $ticket['sucursal_telefono'],
                            'direccion' => $ticket['sucursal_direccion']
                        ],
                        'vendedor' => $ticket['vendedor_nombre'],
                        'productos' => $products,
                        'subtotal' => $subtotal,
                        'descuento' => $descuento,
                        'total' => $total,
                        'metodo_pago' => $ticket['metodo_pago'],
                        'es_cumpleanero' => (bool)$ticket['es_cumpleanero'],
                        'cliente_manual' => $manual_data,
                        'notas_text' => $manual_notes,
                        'notas' => $manual_notes
                    ]
                ];
                
                if ($manual_data && is_array($manual_data)) {
                    if (!empty($manual_data['nombre'])) {
                        $response['ticket']['cliente']['nombre'] = $manual_data['nombre'];
                    }
                    if (!empty($manual_data['telefono'])) {
                        $response['ticket']['cliente']['telefono'] = $manual_data['telefono'];
                    }
                    if (!empty($manual_data['direccion'])) {
                        $response['ticket']['cliente']['direccion'] = $manual_data['direccion'];
                    }
                    if (!empty($manual_data['ci']) || !empty($manual_data['ci_nit'])) {
                        $response['ticket']['cliente']['documento'] = $manual_data['ci'] ?? $manual_data['ci_nit'];
                    }
                    if (!empty($manual_data['metodo_pago'])) {
                        $response['ticket']['metodo_pago'] = $manual_data['metodo_pago'];
                    }
                }
                
                echo json_encode($response);
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Ticket no encontrado.']);
            }
        } else {
            // Listar todos los tickets con filtros opcionales
            $estado = $_GET['estado'] ?? null;
            $sucursal_id = $_GET['sucursal_id'] ?? null;
            $fecha_desde = $_GET['fecha_desde'] ?? null;
            $fecha_hasta = $_GET['fecha_hasta'] ?? null;
            $search = $_GET['search'] ?? null;
            
            // Construir query con filtros
            $where_conditions = [];
            $params = [];
            $types = '';
            
            if ($estado && in_array($estado, $valid_states)) {
                $where_conditions[] = "t.estado_ticket = ?";
                $params[] = $estado;
                $types .= 's';
            }
            
            if ($sucursal_id) {
                $where_conditions[] = "p.sucursal_id = ?";
                $params[] = (int)$sucursal_id;
                $types .= 'i';
            }
            
            if ($fecha_desde) {
                $where_conditions[] = "DATE(t.fecha_creacion) >= ?";
                $params[] = $fecha_desde;
                $types .= 's';
            }
            
            if ($fecha_hasta) {
                $where_conditions[] = "DATE(t.fecha_creacion) <= ?";
                $params[] = $fecha_hasta;
                $types .= 's';
            }
            
            if ($search) {
                $where_conditions[] = "(t.numero_ticket LIKE ? OR u.nombre LIKE ? OR u.telefono LIKE ?)";
                $search_param = "%$search%";
                $params[] = $search_param;
                $params[] = $search_param;
                $params[] = $search_param;
                $types .= 'sss';
            }
            
            $where_clause = '';
            if (!empty($where_conditions)) {
                $where_clause = 'WHERE ' . implode(' AND ', $where_conditions);
            }
            
            $sql = "
                SELECT 
                    t.id_ticket,
                    t.numero_ticket,
                    t.id_pedido,
                    t.estado_ticket,
                    t.fecha_creacion,
                    t.fecha_actualizacion,
                    t.notas_vendedor,
                    p.total,
                    p.metodo_pago,
                    u.nombre AS cliente_nombre,
                    u.telefono AS cliente_telefono,
                    s.nombre AS sucursal_nombre,
                    (SELECT COUNT(*) FROM pedidos_productos pp WHERE pp.id_pedido = p.id_pedido) AS items_count
                FROM tickets t
                JOIN pedidos p ON t.id_pedido = p.id_pedido
                JOIN usuarios u ON p.usuario_id = u.id_usuario
                JOIN sucursales s ON p.sucursal_id = s.id_sucursal
                $where_clause
                ORDER BY t.fecha_creacion DESC
            ";
            
            if (!empty($params)) {
                $stmt = $conn->prepare($sql);
                $stmt->bind_param($types, ...$params);
                $stmt->execute();
                $result = $stmt->get_result();
            } else {
                $result = $conn->query($sql);
            }
            
            $tickets = [];
            if ($result) {
                while ($row = $result->fetch_assoc()) {
                    list($manual_data, $manual_notes) = decode_manual_ticket_data($row['notas_vendedor'] ?? null);
                    $cliente_nombre = $row['cliente_nombre'];
                    if ($manual_data && is_array($manual_data) && !empty($manual_data['nombre'])) {
                        $cliente_nombre = $manual_data['nombre'];
                    }
                    
                    $tickets[] = [
                        'id_ticket' => (int)$row['id_ticket'],
                        'numero_ticket' => $row['numero_ticket'],
                        'id_pedido' => (int)$row['id_pedido'],
                        'estado' => $row['estado_ticket'],
                        'fecha_creacion' => $row['fecha_creacion'],
                        'fecha_actualizacion' => $row['fecha_actualizacion'],
                        'total' => (float)$row['total'],
                        'metodo_pago' => $row['metodo_pago'],
                        'cliente_nombre' => $cliente_nombre,
                        'cliente_telefono' => $row['cliente_telefono'],
                        'sucursal_nombre' => $row['sucursal_nombre'],
                        'items_count' => (int)$row['items_count'],
                        'cliente_manual' => $manual_data,
                        'notas_text' => $manual_notes,
                        'notas' => $manual_notes
                    ];
                }
            }
            
            if (isset($stmt)) {
                $stmt->close();
            }
            
            echo json_encode(['success' => true, 'tickets' => $tickets, 'total' => count($tickets)]);
        }
        break;
        
    case 'POST':
        // Crear nuevo ticket desde un pedido
        $data = json_decode(file_get_contents('php://input'), true);
        
        $id_pedido = $data['id_pedido'] ?? null;
        $notas = $data['notas'] ?? null;
        $cliente_manual = $data['cliente_manual'] ?? null;
        
        if (is_array($cliente_manual)) {
            $cliente_manual = [
                'nombre' => isset($cliente_manual['nombre']) ? trim($cliente_manual['nombre']) : null,
                'ci' => isset($cliente_manual['ci']) ? trim($cliente_manual['ci']) : (isset($cliente_manual['ci_nit']) ? trim($cliente_manual['ci_nit']) : null),
                'metodo_pago' => $cliente_manual['metodo_pago'] ?? null,
                'telefono' => isset($cliente_manual['telefono']) ? trim($cliente_manual['telefono']) : null,
                'notas' => isset($cliente_manual['notas']) ? trim($cliente_manual['notas']) : null
            ];
            // Remover campos vacíos
            $cliente_manual = array_filter($cliente_manual, function($value) {
                return $value !== null && $value !== '';
            });
            if (empty($cliente_manual)) {
                $cliente_manual = null;
            }
        } else {
            $cliente_manual = null;
        }
        
        if (!$id_pedido) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ID de pedido es requerido.']);
            exit;
        }
        
        // Verificar que el pedido existe
        $sql_check = "SELECT id_pedido, sucursal_id FROM pedidos WHERE id_pedido = ?";
        $stmt_check = $conn->prepare($sql_check);
        $stmt_check->bind_param('i', $id_pedido);
        $stmt_check->execute();
        $result_check = $stmt_check->get_result();
        
        if ($result_check->num_rows === 0) {
            $stmt_check->close();
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Pedido no encontrado.']);
            exit;
        }
        $stmt_check->close();
        
        // Verificar si ya existe un ticket para este pedido
        $sql_exists = "SELECT id_ticket, numero_ticket FROM tickets WHERE id_pedido = ?";
        $stmt_exists = $conn->prepare($sql_exists);
        $stmt_exists->bind_param('i', $id_pedido);
        $stmt_exists->execute();
        $result_exists = $stmt_exists->get_result();
        
        if ($result_exists->num_rows > 0) {
            // Si el ticket ya existe, actualizarlo con los datos del cliente manual
            $existing = $result_exists->fetch_assoc();
            $existing_ticket_id = (int)$existing['id_ticket'];
            $stmt_exists->close();
            
            // Preparar datos para actualizar
            $notas_data = null;
            if ($cliente_manual || $notas) {
                $notas_data = json_encode([
                    'cliente_manual' => $cliente_manual,
                    'comentarios' => $notas,
                    'notas' => $notas
                ], JSON_UNESCAPED_UNICODE);
            }
            
            // Actualizar el ticket existente
            if ($notas_data) {
                $sql_update = "UPDATE tickets SET notas_vendedor = ? WHERE id_ticket = ?";
                $stmt_update = $conn->prepare($sql_update);
                $stmt_update->bind_param('si', $notas_data, $existing_ticket_id);
                
                if ($stmt_update->execute()) {
                    $stmt_update->close();
                    echo json_encode([
                        'success' => true,
                        'message' => 'Ticket existente actualizado con datos del cliente.',
                        'id_ticket' => $existing_ticket_id,
                        'numero_ticket' => $existing['numero_ticket'],
                        'updated' => true
                    ]);
                    exit;
                } else {
                    $stmt_update->close();
                }
            } else {
                // Si no hay datos para actualizar, simplemente devolver el ticket existente
                echo json_encode([
                    'success' => true,
                    'message' => 'Ticket ya existe para este pedido.',
                    'id_ticket' => $existing_ticket_id,
                    'numero_ticket' => $existing['numero_ticket'],
                    'exists' => true
                ]);
                exit;
            }
        }
        $stmt_exists->close();
        
        // Crear el ticket
        $vendedor_id = $current_user['id_usuario'];
        
        // Generar número de ticket temporal (el trigger lo actualizará)
        $numero_temp = 'TKT-TEMP-' . time();
        
        $notas_payload = null;
        if ($cliente_manual || $notas) {
            $notas_payload = json_encode([
                'cliente_manual' => $cliente_manual,
                'comentarios' => $notas
            ], JSON_UNESCAPED_UNICODE);
        }
        
        $sql_insert = "
            INSERT INTO tickets (id_pedido, numero_ticket, vendedor_id, notas_vendedor)
            VALUES (?, ?, ?, ?)
        ";
        
        $stmt_insert = $conn->prepare($sql_insert);
        $stmt_insert->bind_param('isis', $id_pedido, $numero_temp, $vendedor_id, $notas_payload);
        
        if ($stmt_insert->execute()) {
            $id_ticket = $conn->insert_id;
            
            // Obtener el número de ticket generado
            $sql_get = "SELECT numero_ticket FROM tickets WHERE id_ticket = ?";
            $stmt_get = $conn->prepare($sql_get);
            $stmt_get->bind_param('i', $id_ticket);
            $stmt_get->execute();
            $result_get = $stmt_get->get_result();
            $ticket_data = $result_get->fetch_assoc();
            $stmt_get->close();
            
            // Actualizar el número de ticket con el formato correcto
            $numero_ticket = 'TKT-' . str_pad($id_ticket, 6, '0', STR_PAD_LEFT);
            $sql_update = "UPDATE tickets SET numero_ticket = ? WHERE id_ticket = ?";
            $stmt_update = $conn->prepare($sql_update);
            $stmt_update->bind_param('si', $numero_ticket, $id_ticket);
            $stmt_update->execute();
            $stmt_update->close();
            
            $stmt_insert->close();
            
            echo json_encode([
                'success' => true,
                'message' => 'Ticket creado exitosamente.',
                'id_ticket' => $id_ticket,
                'numero_ticket' => $numero_ticket
            ]);
        } else {
            $stmt_insert->close();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error al crear el ticket: ' . $conn->error]);
        }
        break;
        
    case 'PUT':
        // Actualizar estado del ticket
        $data = json_decode(file_get_contents('php://input'), true);
        
        $id_ticket = $data['id_ticket'] ?? null;
        $estado = $data['estado'] ?? null;
        $notas = $data['notas'] ?? null;
        
        if (!$id_ticket) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ID de ticket es requerido.']);
            exit;
        }
        
        if (!$estado || !in_array($estado, $valid_states)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Estado inválido. Valores permitidos: ' . implode(', ', $valid_states)]);
            exit;
        }
        
        // Verificar que el ticket existe
        $sql_check = "SELECT id_ticket FROM tickets WHERE id_ticket = ?";
        $stmt_check = $conn->prepare($sql_check);
        $stmt_check->bind_param('i', $id_ticket);
        $stmt_check->execute();
        $result_check = $stmt_check->get_result();
        
        if ($result_check->num_rows === 0) {
            $stmt_check->close();
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Ticket no encontrado.']);
            exit;
        }
        $stmt_check->close();
        
        // Actualizar el ticket
        if ($notas !== null) {
            $sql_update = "UPDATE tickets SET estado_ticket = ?, notas_vendedor = ? WHERE id_ticket = ?";
            $stmt_update = $conn->prepare($sql_update);
            $stmt_update->bind_param('ssi', $estado, $notas, $id_ticket);
        } else {
            $sql_update = "UPDATE tickets SET estado_ticket = ? WHERE id_ticket = ?";
            $stmt_update = $conn->prepare($sql_update);
            $stmt_update->bind_param('si', $estado, $id_ticket);
        }
        
        if ($stmt_update->execute()) {
            $stmt_update->close();
            echo json_encode([
                'success' => true,
                'message' => 'Ticket actualizado exitosamente.'
            ]);
        } else {
            $stmt_update->close();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error al actualizar el ticket: ' . $conn->error]);
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
        break;
}

$conn->close();
?>
