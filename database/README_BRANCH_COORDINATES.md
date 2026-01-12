# Actualización de Coordenadas de Sucursales

Este documento explica cómo agregar coordenadas geográficas a las sucursales del sistema Pizza Steve.

## Archivos SQL

Se han creado dos scripts SQL para agregar las coordenadas:

1. **`add_branch_coordinates_simple.sql`** (Recomendado)
   - Versión simple y directa
   - Agrega columnas `latitud` y `longitud` a la tabla `sucursales`
   - Actualiza/crea las sucursales con sus coordenadas reales

2. **`add_branch_coordinates.sql`**
   - Versión más robusta con verificaciones
   - Verifica si las columnas ya existen antes de agregarlas

## Instrucciones de Instalación

### Opción 1: Usando MySQL Command Line

```bash
mysql -u tu_usuario -p pizzasteve_db < database/add_branch_coordinates_simple.sql
```

### Opción 2: Usando phpMyAdmin o MySQL Workbench

1. Abre phpMyAdmin o MySQL Workbench
2. Selecciona la base de datos `pizzasteve_db`
3. Abre el archivo `add_branch_coordinates_simple.sql`
4. Ejecuta el script completo

### Opción 3: Usando MySQL directamente

```sql
USE pizzasteve_db;
SOURCE database/add_branch_coordinates_simple.sql;
```

## Sucursales Configuradas

El script actualiza/crea las siguientes sucursales con sus coordenadas:

1. **Sopocachi**
   - Dirección: Calle Rosendo Gutiérrez, entre Av. 20 de Octubre y 6 de Agosto (Garage negro)
   - Teléfono: 78825417
   - Coordenadas: -16.5086876, -68.12715

2. **Miraflores**
   - Dirección: Calle EEUU, esquina, Capitan Hugo Estrada 1283, La Paz
   - Teléfono: 75881482
   - Coordenadas: -16.4984373, -68.1221947

3. **Los Pinos**
   - Dirección: Calle 28, Enrique Oblitas y José Aguirre #1020, La Paz
   - Teléfono: 75250788
   - Coordenadas: -16.5458865, -68.0639882

4. **Achumani**
   - Dirección: Calle 28, Fermín Eyzaguirre 495, La Paz
   - Teléfono: 75835659
   - Coordenadas: -16.528577, -68.07127

5. **Irpavi**
   - Dirección: Calle 16 de Irpavi, Edificio Buganvilla Nº 5, frente a la Plaza Litoral
   - Teléfono: 69787035
   - Coordenadas: -16.5323991, -68.0871563

6. **Megacenter**
   - Dirección: Av. Rafael Pabón 656, Patio de comidas Megacenter, Irpavi
   - Teléfono: 62530449
   - Coordenadas: -16.5323991, -68.0871563

## Funcionalidades Implementadas

### 1. Panel de Repartidor

- Las sucursales se cargan automáticamente desde la API
- Se muestran en el mapa con marcadores azules
- Cada marcador muestra información de la sucursal (nombre, dirección, teléfono, horarios)

### 2. Selección Automática de Sucursal

Cuando se crea un pedido:
- Si no se especifica una sucursal, el sistema calcula automáticamente la sucursal más cercana a la ubicación del usuario
- Utiliza la fórmula de Haversine para calcular distancias
- Si no hay coordenadas disponibles, se selecciona la primera sucursal activa

### 3. API de Sucursales

La API `api/branches.php` ahora incluye:
- Campos `latitud` y `longitud` en las respuestas
- Filtro opcional `?activa=1` para obtener solo sucursales activas
- Soporte para crear/actualizar sucursales con coordenadas

## Verificación

Después de ejecutar el script, puedes verificar que las coordenadas se agregaron correctamente:

```sql
SELECT id_sucursal, nombre, direccion, telefono, latitud, longitud, activa
FROM sucursales
WHERE activa = 1
ORDER BY nombre;
```

## Notas Importantes

- Las coordenadas están en formato decimal (latitud, longitud)
- La latitud debe estar entre -90 y 90
- La longitud debe estar entre -180 y 180
- Se crea un índice en las columnas de coordenadas para mejorar el rendimiento de las búsquedas geográficas

## Solución de Problemas

### Error: "Column already exists"
- Esto significa que las columnas ya fueron agregadas anteriormente
- Puedes continuar con la ejecución del script, las actualizaciones de datos se realizarán normalmente

### Error: "Table doesn't exist"
- Asegúrate de que la base de datos `pizzasteve_db` existe
- Verifica que estás conectado a la base de datos correcta

### Las sucursales no aparecen en el mapa
- Verifica que las sucursales tengan `activa = 1`
- Verifica que las coordenadas no sean NULL
- Revisa la consola del navegador para errores de JavaScript

