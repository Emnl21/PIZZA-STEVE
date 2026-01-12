# Problemas e Incoherencias Encontradas en el Proyecto

## 🔴 CRÍTICOS - Deben corregirse inmediatamente

### 1. **Inconsistencia en Estados de Pedidos**

**Problema:** Los estados de pedidos se usan de manera inconsistente en diferentes partes del sistema.

- **Admin Panel:** `'pending'`, `'en_preparacion'`, `'listo_entrega'`, `'en_camino'`, `'completed'`, `'cancelado'`
- **Usuario Panel:** `'pendiente'`, `'preparando'`, `'en_camino'`, `'entregado'`, `'cancelado'`
- **Delivery Panel:** Solo busca `'pending'` y `'completed'`
- **Base de Datos:** Campo `varchar(50)` sin restricciones, acepta cualquier valor
- **Datos de Ejemplo:** Usa `'completed'` y `'pending'`

**Impacto:** Los pedidos pueden tener estados que no se reconocen en diferentes partes del sistema, causando errores de visualización y lógica.

**Solución Recomendada:**
- Estandarizar los estados a un conjunto único (recomendado: inglés en minúsculas)
- Agregar validación en la API para aceptar solo estados válidos
- Actualizar todas las referencias en el código

**Estados Propuestos:**
```php
'pending', 'preparing', 'ready_for_delivery', 'out_for_delivery', 'completed', 'cancelled'
```

---

### 2. **Lógica Incorrecta en `changeOrderStatus()`**

**Archivo:** `views/admin/js/main.js` (línea 590)

**Problema:** La función cambia al siguiente estado en el array sin validar si el cambio es lógico.

```javascript
const statuses = ['pending', 'en_preparacion', 'listo_entrega', 'en_camino', 'completed', 'cancelado'];
const currentIndex = statuses.indexOf(currentStatus);
const nextStatus = statuses[currentIndex + 1] || statuses[0]; // ❌ PROBLEMA: De 'cancelado' vuelve a 'pending'
```

**Impacto:** 
- Un pedido cancelado puede volver a 'pending'
- No se puede saltar estados (ej: de 'pending' a 'completed')
- No se puede volver a un estado anterior
- No valida que el cambio sea permitido

**Solución Recomendada:**
- Crear una función que valide transiciones de estado permitidas
- Permitir seleccionar el estado destino desde un dropdown
- Validar en la API que la transición sea válida

---

### 3. **Falta Validación de Estados en la API**

**Archivo:** `api/orders.php` (línea 173)

**Problema:** La API acepta cualquier valor para el campo `estado` sin validación.

```php
if (!empty($estado)) {
    $updates[] = "estado = ?";
    $params[] = $estado; // ❌ No valida que sea un estado válido
    $types .= 's';
}
```

**Impacto:** Se pueden insertar estados inválidos en la base de datos, causando errores en otras partes del sistema.

**Solución Recomendada:**
```php
$validStates = ['pending', 'preparing', 'ready_for_delivery', 'out_for_delivery', 'completed', 'cancelled'];
if (!empty($estado) && in_array($estado, $validStates)) {
    // ...
} else {
    echo json_encode(['success' => false, 'message' => 'Estado no válido.']);
    exit;
}
```

---

### 4. **Problema con ID de Pedido en `orders.php`**

**Archivo:** `api/orders.php` (línea 22)

**Problema:** No valida que el ID sea numérico después de remover el prefijo.

```php
$pedido_id = str_replace('ORD-', '', $id); // ❌ No valida que sea numérico
$stmt->bind_param('i', $pedido_id);
```

**Impacto:** Si se envía un ID inválido (ej: `'ORD-ABC'`), la consulta puede fallar o causar errores.

**Solución Recomendada:**
```php
$pedido_id = str_replace('ORD-', '', $id);
if (!is_numeric($pedido_id)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'ID de pedido inválido.']);
    exit;
}
$pedido_id = (int)$pedido_id;
```

---

### 5. **Filtro de Pedidos Frágil**

**Archivo:** `views/admin/js/main.js` (línea 476)

**Problema:** El filtro busca en el texto HTML del badge, no en el valor real del estado.

```javascript
document.getElementById('orderStatusFilter')?.addEventListener('change', function(e) {
    const filterValue = e.target.value;
    const rows = tableBody.querySelectorAll('tr');
    rows.forEach(row => {
        if (!filterValue) {
            row.style.display = '';
        } else {
            const status = row.querySelector('.badge')?.textContent.toLowerCase(); // ❌ Busca en el HTML
            row.style.display = status && status.includes(filterValue) ? '' : 'none';
        }
    });
});
```

**Impacto:** El filtro puede no funcionar correctamente si el texto del badge cambia o si hay espacios adicionales.

**Solución Recomendada:** Guardar el estado real como atributo `data-status` en cada fila y filtrar por ese atributo.

---

## 🟡 IMPORTANTES - Deben corregirse pronto

### 6. **Falta Validación de Repartidor al Asignar**

**Archivo:** `api/orders.php` (línea 179)

**Problema:** No se valida que el repartidor exista y esté disponible antes de asignarlo.

```php
if ($repartidor_id !== null) {
    $updates[] = "repartidor_id = ?";
    $params[] = $repartidor_id; // ❌ No valida que el repartidor exista
    $types .= 'i';
}
```

**Solución Recomendada:** Validar que el repartidor existe y está disponible antes de asignarlo.

---

### 7. **Delivery Panel Solo Muestra Pedidos 'pending'**

**Archivo:** `views/delivery/js/main.js` (línea 78)

**Problema:** El panel de delivery solo filtra por `'pending'`, pero el admin puede cambiar el estado a otros valores.

```javascript
const pendingOrders = allOrders.filter(order => order.status === 'pending');
```

**Impacto:** Si un pedido está en `'listo_entrega'` o `'en_camino'`, no aparecerá en el panel de delivery.

**Solución Recomendada:** Mostrar también pedidos con estados `'listo_entrega'` y `'en_camino'`.

---

### 8. **Falta Validación de Método de Pago**

**Problema:** No hay validación de los valores permitidos para `metodo_pago`.

**Valores encontrados:**
- Datos de ejemplo: `'efectivo'`, `'qr'`
- Código de usuario: menciona `'tarjeta'`
- Delivery panel: espera `'efectivo'`, `'transferencia'`, `'qr'`

**Solución Recomendada:** Estandarizar los métodos de pago y agregar validación en la API.

---

### 9. **Problema con Campo `fecha_cumpleaños`**

**Archivo:** `api/users.php`

**Problema:** El campo tiene un carácter especial (ñ) que puede causar problemas en algunas configuraciones.

**Solución Recomendada:** Usar `fecha_nacimiento` o `birth_date` para evitar problemas de codificación.

---

### 10. **Falta Manejo de Errores en Consultas de Productos**

**Archivo:** `api/orders.php` (línea 64)

**Problema:** Si un pedido no tiene productos, la consulta puede devolver un array vacío, pero no se maneja explícitamente.

**Solución Recomendada:** Agregar validación y mensajes claros cuando no hay productos.

---

## 🟢 MEJORAS - Recomendadas pero no críticas

### 11. **Inconsistencia en Nombres de Campos**

**Problema:** Se mezclan `snake_case` (BD) con `camelCase` (API responses).

**Ejemplos:**
- BD: `fecha_pedido`, `metodo_pago`
- API: `fecha_pedido`, `paymentType`
- Frontend: `fecha_pedido`, `paymentType`

**Solución Recomendada:** Estandarizar a un formato (recomendado: `snake_case` en BD, `camelCase` en API/Frontend con mapeo).

---

### 12. **Falta Validación de Sucursal en Productos**

**Archivo:** `api/products.php`

**Problema:** No se valida que la sucursal exista antes de asignarla a un producto.

**Solución Recomendada:** Validar que la sucursal existe y está activa.

---

### 13. **Problema con Sucursal NULL en Consultas**

**Archivo:** `api/products.php`, `api/promotions.php`

**Problema:** Cuando `sucursal_id` es NULL, las consultas pueden no funcionar correctamente en algunos casos.

**Solución Recomendada:** Asegurar que las consultas manejen correctamente los valores NULL.

---

### 14. **Falta Validación de Fechas en Promociones**

**Archivo:** `api/promotions.php`

**Problema:** No se valida que `fecha_inicio` sea anterior a `fecha_fin`.

**Solución Recomendada:** Agregar validación de fechas.

---

### 15. **Problema con Edición de Sucursales/Repartidores/Promociones**

**Archivo:** `views/admin/js/main.js`

**Problema:** Se usan `prompt()` para editar, lo cual no es una buena práctica de UX.

**Solución Recomendada:** Crear modales similares a los de productos y usuarios.

---

## 📋 Resumen de Acciones Recomendadas

### Prioridad ALTA (Hacer primero):
1. ✅ Estandarizar estados de pedidos en todo el sistema
2. ✅ Agregar validación de estados en la API
3. ✅ Corregir lógica de `changeOrderStatus()`
4. ✅ Validar ID de pedido en `orders.php`
5. ✅ Corregir filtro de pedidos

### Prioridad MEDIA (Hacer después):
6. ✅ Validar repartidor al asignar
7. ✅ Actualizar delivery panel para mostrar más estados
8. ✅ Estandarizar métodos de pago
9. ✅ Renombrar `fecha_cumpleaños` a `fecha_nacimiento`
10. ✅ Mejorar manejo de errores

### Prioridad BAJA (Mejoras):
11. ✅ Estandarizar nombres de campos
12. ✅ Validar sucursales en productos
13. ✅ Validar fechas en promociones
14. ✅ Crear modales para edición
15. ✅ Mejorar manejo de valores NULL

---

## 🔧 Archivos que Necesitan Modificarse

### APIs:
- `api/orders.php` - Validación de estados, validación de IDs, validación de repartidores
- `api/users.php` - Renombrar campo fecha_cumpleaños
- `api/products.php` - Validar sucursales
- `api/promotions.php` - Validar fechas, validar sucursales

### Frontend:
- `views/admin/js/main.js` - Corregir changeOrderStatus, mejorar filtro, crear modales
- `views/delivery/js/main.js` - Actualizar filtro de estados
- `views/usuario/js/main.js` - Actualizar estados si es necesario

### Base de Datos:
- Considerar agregar ENUM para estados de pedidos
- Considerar agregar ENUM para métodos de pago
- Renombrar campo fecha_cumpleaños

---

## 💡 Notas Adicionales

1. **Estados de Pedidos:** Se recomienda crear una tabla de estados con transiciones permitidas para mayor control.

2. **Validaciones:** Todas las validaciones deben hacerse tanto en el frontend (UX) como en el backend (seguridad).

3. **Mensajes de Error:** Los mensajes de error deben ser claros y ayudar al usuario a entender qué salió mal.

4. **Testing:** Después de corregir estos problemas, se recomienda hacer pruebas exhaustivas de todas las funcionalidades.

5. **Documentación:** Actualizar la documentación con los estados y flujos correctos del sistema.

