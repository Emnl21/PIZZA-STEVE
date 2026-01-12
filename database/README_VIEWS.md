# Vistas de Base de Datos - PizzaSteve

Este documento describe las vistas creadas en la base de datos para mejorar el rendimiento y simplificar las consultas.

## Instalación

Para crear todas las vistas, ejecuta el siguiente script SQL:

```bash
mysql -u usuario -p pizzasteve_db < database/create_views.sql
```

O desde phpMyAdmin, importa el archivo `database/create_views.sql`.

## Lista de Vistas

### 1. `v_pedidos_completos`
Vista que incluye información completa de pedidos con datos de usuario, sucursal, dirección y repartidor.

**Uso:** Consultas de pedidos que requieren información completa sin hacer múltiples JOINs.

**Campos principales:**
- Información del pedido (id, fecha, estado, total, etc.)
- Datos del usuario (nombre, email, teléfono)
- Datos de la sucursal (nombre, dirección, teléfono, coordenadas)
- Datos de la dirección de entrega
- Datos del repartidor
- Campos calculados (fecha, hora, día de la semana, mes, año)

### 2. `v_productos_completos`
Vista que incluye información completa de productos con datos de sucursal y estado de stock.

**Uso:** Listados de productos que requieren información de sucursal y estado de stock.

**Campos principales:**
- Información del producto (id, nombre, descripción, precio, categoría)
- Datos de la sucursal
- Estado de stock calculado (Sin Stock, Stock Bajo, Disponible)

### 3. `v_pedidos_productos_detalle`
Vista que muestra los productos de cada pedido con información completa.

**Uso:** Consultas de detalles de pedidos con productos.

**Campos principales:**
- Información del pedido
- Información del producto
- Cantidad, precio unitario, tamaño
- Subtotal por producto

### 4. `v_ventas_por_dia`
Vista que agrupa ventas por día para reportes.

**Uso:** Reportes diarios y análisis de tendencias.

**Campos principales:**
- Fecha
- Total de pedidos
- Total de clientes únicos
- Total de ventas
- Ticket promedio
- Desglose por método de pago
- Pedidos de cumpleaños

### 5. `v_productos_mas_vendidos`
Vista que muestra estadísticas de productos vendidos.

**Uso:** Reportes de productos más vendidos.

**Campos principales:**
- Información del producto
- Cantidad vendida
- Veces pedido
- Total vendido
- Precio promedio, mínimo y máximo

### 6. `v_usuarios_completos`
Vista que incluye información completa de usuarios con datos de rol y sucursal.

**Uso:** Listados de usuarios que requieren información de rol y sucursal.

**Campos principales:**
- Información del usuario
- Nombre del rol
- Información de la sucursal
- Estado del usuario

### 7. `v_promociones_activas`
Vista que muestra solo promociones activas y vigentes.

**Uso:** Mostrar promociones disponibles para clientes.

**Campos principales:**
- Información de la promoción
- Estado de la promoción (Vigente, Próxima, Vencida)
- Días restantes

### 8. `v_ventas_por_sucursal`
Vista que agrupa ventas por sucursal.

**Uso:** Reportes por sucursal y comparativas.

**Campos principales:**
- Información de la sucursal
- Total de pedidos
- Total de clientes
- Total de ventas
- Ticket promedio
- Fechas de primera y última venta

### 9. `v_pedidos_por_hora`
Vista que agrupa pedidos por hora del día.

**Uso:** Análisis de horarios de mayor afluencia.

**Campos principales:**
- Hora del día
- Cantidad de pedidos
- Cantidad de clientes
- Total de ventas
- Ticket promedio
- Período del día (Mañana, Tarde, Noche, Madrugada)

### 10. `v_categorias_vendidas`
Vista que agrupa ventas por categoría.

**Uso:** Reportes por categoría de producto.

**Campos principales:**
- Categoría
- Productos únicos
- Cantidad vendida
- Total vendido
- Precio promedio

### 11. `v_metodos_pago`
Vista que agrupa ventas por método de pago.

**Uso:** Análisis de métodos de pago utilizados.

**Campos principales:**
- Método de pago
- Cantidad de pedidos
- Total de ventas
- Ticket promedio
- Ventas confirmadas vs pendientes

### 12. `v_stock_por_sucursal`
Vista que muestra el stock disponible por sucursal.

**Uso:** Gestión de inventario y alertas de stock.

**Campos principales:**
- Información del producto
- Sucursal
- Stock disponible
- Nivel de stock (Sin Stock, Stock Bajo, Stock Medio, Stock Adecuado)

### 13. `v_ventas_mensuales`
Vista que agrupa ventas por mes y año.

**Uso:** Reportes mensuales y análisis de tendencias.

**Campos principales:**
- Año y mes
- Total de pedidos
- Total de clientes
- Total de ventas
- Ticket promedio
- Ventas netas (después de descuentos)

### 14. `v_clientes_frecuentes`
Vista que muestra estadísticas de clientes.

**Uso:** Análisis de clientes y programas de fidelización.

**Campos principales:**
- Información del cliente
- Total de pedidos
- Total gastado
- Ticket promedio
- Fechas de primer y último pedido
- Días desde último pedido
- Pedidos de cumpleaños

## Ventajas de Usar Vistas

1. **Simplificación de Consultas:** Las consultas complejas con múltiples JOINs se simplifican a un simple SELECT FROM vista.

2. **Mejor Rendimiento:** Las vistas pueden ser optimizadas por el motor de base de datos.

3. **Mantenibilidad:** Si cambia la estructura de las tablas, solo necesitas actualizar la vista, no todas las consultas.

4. **Seguridad:** Puedes controlar qué datos se exponen a través de las vistas.

5. **Consistencia:** Garantiza que todas las consultas usen la misma lógica de negocio.

## Uso en el Código PHP

Las vistas se usan en los siguientes archivos:

- `api/reports.php` - Reportes y análisis
- `api/orders.php` - Consultas de pedidos
- `api/promotions.php` - Promociones activas

## Actualización de Vistas

Si necesitas actualizar una vista, usa:

```sql
CREATE OR REPLACE VIEW nombre_vista AS
SELECT ...
```

O elimina y recrea:

```sql
DROP VIEW IF EXISTS nombre_vista;
CREATE VIEW nombre_vista AS
SELECT ...
```

## Notas Importantes

- Las vistas son de solo lectura por defecto. No se pueden hacer INSERT, UPDATE o DELETE directamente en las vistas.
- Algunas vistas pueden tener un impacto en el rendimiento si se usan con grandes volúmenes de datos. Considera agregar índices en las tablas base.
- Las vistas se actualizan automáticamente cuando cambian los datos en las tablas base.

