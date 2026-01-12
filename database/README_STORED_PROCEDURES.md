# Funciones Almacenadas y Triggers - Pizza Steve

Este documento explica cómo usar las funciones almacenadas y triggers implementados en la base de datos.

## Instalación

Para instalar todas las funciones almacenadas y triggers, ejecuta el siguiente script SQL:

```bash
mysql -u tu_usuario -p pizzasteve_db < database/stored_procedures_and_triggers.sql
```

O desde MySQL:

```sql
SOURCE database/stored_procedures_and_triggers.sql;
```

## Funciones Almacenadas - Usuarios

### sp_get_user_by_id
Obtiene un usuario por su ID.

**Parámetros:**
- `p_user_id` (INT): ID del usuario
- `p_rol_filter` (VARCHAR): Filtro de rol ('vendedor' para filtrar solo clientes)

**Ejemplo de uso en PHP:**
```php
$stmt = $conn->prepare("CALL sp_get_user_by_id(?, ?)");
$stmt->bind_param('is', $user_id, $rol_filter);
$stmt->execute();
$result = $stmt->get_result();
$user = $result->fetch_assoc();
```

### sp_get_all_users
Obtiene todos los usuarios con filtro opcional por rol.

**Parámetros:**
- `p_rol_filter` (VARCHAR): Filtro de rol ('vendedor' para filtrar solo clientes)

### sp_create_user
Crea un nuevo usuario con validaciones automáticas.

**Parámetros:**
- `p_nombre` (VARCHAR): Nombre del usuario
- `p_contrasena` (VARCHAR): Contraseña hasheada
- `p_correo_electronico` (VARCHAR): Email
- `p_telefono` (VARCHAR): Teléfono
- `p_direccion` (VARCHAR): Dirección
- `p_fecha_cumpleaños` (DATE): Fecha de cumpleaños
- `p_ci` (VARCHAR): Cédula de identidad
- `p_rol_id` (INT): ID del rol

**Valores de salida:**
- `p_user_id` (INT): ID del usuario creado
- `p_success` (BOOLEAN): Indica si la operación fue exitosa
- `p_message` (VARCHAR): Mensaje de resultado

**Ejemplo de uso en PHP:**
```php
$stmt = $conn->prepare("CALL sp_create_user(?, ?, ?, ?, ?, ?, ?, ?, @p_user_id, @p_success, @p_message)");
$stmt->bind_param('sssssssi', $nombre, $password, $email, $telefono, $direccion, $fecha_cumpleaños, $ci, $rol_id);
$stmt->execute();

$result = $conn->query("SELECT @p_user_id as user_id, @p_success as success, @p_message as message");
$output = $result->fetch_assoc();
```

### sp_update_user
Actualiza un usuario existente.

**Parámetros:**
- `p_user_id` (INT): ID del usuario
- `p_nombre` (VARCHAR): Nombre
- `p_correo_electronico` (VARCHAR): Email
- `p_telefono` (VARCHAR): Teléfono
- `p_direccion` (VARCHAR): Dirección
- `p_fecha_cumpleaños` (DATE): Fecha de cumpleaños
- `p_ci` (VARCHAR): Cédula de identidad
- `p_rol_id` (INT): ID del rol
- `p_contrasena` (VARCHAR): Nueva contraseña (opcional, NULL para no cambiar)
- `p_activa` (INT): Estado activo (opcional, NULL para no cambiar)

**Valores de salida:**
- `p_success` (BOOLEAN): Indica si la operación fue exitosa
- `p_message` (VARCHAR): Mensaje de resultado

### sp_deactivate_user
Desactiva un usuario (soft delete).

**Parámetros:**
- `p_user_id` (INT): ID del usuario

**Valores de salida:**
- `p_success` (BOOLEAN): Indica si la operación fue exitosa
- `p_message` (VARCHAR): Mensaje de resultado

## Funciones Almacenadas - Pedidos

### sp_get_order_by_id
Obtiene un pedido con todos sus detalles.

**Parámetros:**
- `p_order_id` (INT): ID del pedido

### sp_create_order
Crea un nuevo pedido.

**Parámetros:**
- `p_usuario_id` (INT): ID del usuario
- `p_sucursal_id` (INT): ID de la sucursal
- `p_direccion_id` (INT): ID de la dirección
- `p_total` (DECIMAL): Total del pedido
- `p_descuento` (DECIMAL): Descuento aplicado al pedido
- `p_es_cumpleanero` (TINYINT): Indica si se aplicó descuento de cumpleañero
- `p_metodo_pago` (VARCHAR): Método de pago
- `p_pago_confirmado` (TINYINT): Si el pago está confirmado

**Valores de salida:**
- `p_order_id` (INT): ID del pedido creado
- `p_success` (BOOLEAN): Indica si la operación fue exitosa
- `p_message` (VARCHAR): Mensaje de resultado

### sp_update_order_status
Actualiza el estado de un pedido.

**Parámetros:**
- `p_order_id` (INT): ID del pedido
- `p_estado` (VARCHAR): Nuevo estado
- `p_repartidor_id` (INT): ID del repartidor (opcional)

**Valores de salida:**
- `p_success` (BOOLEAN): Indica si la operación fue exitosa
- `p_message` (VARCHAR): Mensaje de resultado

## Funciones Almacenadas - Productos

### sp_get_active_products
Obtiene todos los productos activos.

### sp_get_product_by_id
Obtiene un producto por su ID.

**Parámetros:**
- `p_product_id` (INT): ID del producto

### sp_create_product
Crea un nuevo producto.

**Parámetros:**
- `p_nombre` (VARCHAR): Nombre del producto
- `p_descripcion` (VARCHAR): Descripción
- `p_precio` (DECIMAL): Precio
- `p_categoria` (VARCHAR): Categoría
- `p_stock_disponible` (INT): Stock disponible
- `p_sucursal_id` (INT): ID de la sucursal

**Valores de salida:**
- `p_product_id` (INT): ID del producto creado
- `p_success` (BOOLEAN): Indica si la operación fue exitosa
- `p_message` (VARCHAR): Mensaje de resultado

### sp_update_product
Actualiza un producto existente.

**Parámetros:**
- `p_product_id` (INT): ID del producto
- `p_nombre` (VARCHAR): Nombre
- `p_descripcion` (VARCHAR): Descripción
- `p_precio` (DECIMAL): Precio
- `p_categoria` (VARCHAR): Categoría
- `p_stock_disponible` (INT): Stock disponible
- `p_sucursal_id` (INT): ID de la sucursal

**Valores de salida:**
- `p_success` (BOOLEAN): Indica si la operación fue exitosa
- `p_message` (VARCHAR): Mensaje de resultado

## Triggers

### trg_update_last_login
Actualiza automáticamente el último inicio de sesión cuando se desactiva un usuario.

### trg_validate_user_insert
Valida los datos antes de insertar un usuario:
- Verifica que el email no esté vacío
- Verifica que el nombre no esté vacío
- Valida el formato del C.I.
- Establece fecha_creacion automáticamente
- Establece activa = 1 por defecto

### trg_validate_user_update
Valida los datos antes de actualizar un usuario:
- Verifica que el email no esté vacío
- Verifica que el nombre no esté vacío
- Valida el formato del C.I.

### trg_update_delivery_status_on_assign
Actualiza automáticamente el estado del repartidor cuando se asigna un pedido:
- Marca al repartidor como 'ocupado' cuando se asigna un pedido con estado 'out_for_delivery'
- Marca al repartidor como 'disponible' cuando el pedido se completa o cancela

### trg_validate_order_insert
Valida los datos antes de insertar un pedido:
- Verifica que el total sea mayor a 0
- Valida que el estado sea válido
- Establece fecha_pedido automáticamente si no se proporciona

### trg_update_stock_on_order_product
Actualiza automáticamente el stock cuando se agrega un producto a un pedido:
- Reduce el stock disponible cuando se crea un pedido_producto

### trg_restore_stock_on_cancel
Restaura el stock cuando se cancela un pedido:
- Aumenta el stock disponible cuando un pedido se cancela

## Funciones Auxiliares

### fn_validate_email
Valida el formato de un email.

**Parámetros:**
- `p_email` (VARCHAR): Email a validar

**Retorna:**
- BOOLEAN: TRUE si el email es válido, FALSE en caso contrario

### fn_calculate_order_total
Calcula el total de un pedido sumando todos sus productos.

**Parámetros:**
- `p_order_id` (INT): ID del pedido

**Retorna:**
- DECIMAL(10,2): Total del pedido

## Notas Importantes

1. **Cerrar resultados de procedimientos almacenados**: Cuando uses procedimientos almacenados en PHP, siempre cierra los resultados adicionales:

```php
while ($conn->more_results()) {
    $conn->next_result();
    if ($result = $conn->store_result()) {
        $result->free();
    }
}
```

2. **Variables de salida**: Para obtener valores de salida de procedimientos almacenados, usa variables de sesión:

```php
$stmt->execute();
$result = $conn->query("SELECT @p_success as success, @p_message as message");
$output = $result->fetch_assoc();
```

3. **Transacciones**: Los procedimientos almacenados manejan transacciones automáticamente, por lo que no necesitas iniciar transacciones en PHP.

4. **Validaciones**: Las validaciones se realizan tanto en PHP (para feedback inmediato) como en los triggers (para seguridad a nivel de base de datos).

## Ventajas de usar Funciones Almacenadas

1. **Rendimiento**: Las consultas se optimizan en el servidor de base de datos
2. **Seguridad**: Reduce el riesgo de inyección SQL
3. **Consistencia**: La lógica de negocio está centralizada
4. **Mantenibilidad**: Cambios en la lógica solo requieren actualizar el procedimiento
5. **Transacciones**: Manejo automático de transacciones y rollbacks

## Desinstalación

Para eliminar todas las funciones y triggers:

```sql
DROP PROCEDURE IF EXISTS sp_get_user_by_id;
DROP PROCEDURE IF EXISTS sp_get_all_users;
DROP PROCEDURE IF EXISTS sp_create_user;
DROP PROCEDURE IF EXISTS sp_update_user;
DROP PROCEDURE IF EXISTS sp_deactivate_user;
DROP PROCEDURE IF EXISTS sp_get_order_by_id;
DROP PROCEDURE IF EXISTS sp_create_order;
DROP PROCEDURE IF EXISTS sp_update_order_status;
DROP PROCEDURE IF EXISTS sp_get_active_products;
DROP PROCEDURE IF EXISTS sp_get_product_by_id;
DROP PROCEDURE IF EXISTS sp_create_product;
DROP PROCEDURE IF EXISTS sp_update_product;
DROP TRIGGER IF EXISTS trg_update_last_login;
DROP TRIGGER IF EXISTS trg_validate_user_insert;
DROP TRIGGER IF EXISTS trg_validate_user_update;
DROP TRIGGER IF EXISTS trg_update_delivery_status_on_assign;
DROP TRIGGER IF EXISTS trg_validate_order_insert;
DROP TRIGGER IF EXISTS trg_update_stock_on_order_product;
DROP TRIGGER IF EXISTS trg_restore_stock_on_cancel;
DROP FUNCTION IF EXISTS fn_validate_email;
DROP FUNCTION IF EXISTS fn_calculate_order_total;
```

