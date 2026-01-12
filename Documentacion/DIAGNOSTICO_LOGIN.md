# 🔍 Diagnóstico de Problemas de Login

Si estás teniendo problemas al iniciar sesión, sigue estos pasos para identificar el problema.

## 📋 Paso 1: Verificar el Usuario Admin

### Opción A: Script de Diagnóstico (Recomendado)

1. Abre en tu navegador:
   ```
   http://localhost/PizzaSteve/api/test_login.php
   ```

2. O con parámetros específicos:
   ```
   http://localhost/PizzaSteve/api/test_login.php?email=admin@pizzasteve.com&password=Admin123!
   ```

3. El script mostrará:
   - ✅ Si la conexión a la base de datos funciona
   - ✅ Si el usuario existe
   - ✅ Si el usuario está activo
   - ✅ Si la contraseña está hasheada correctamente
   - ✅ Si la contraseña es correcta
   - ✅ Estado de la sesión

### Opción B: Verificar Manualmente en phpMyAdmin

Ejecuta esta consulta SQL:
```sql
SELECT 
    u.id_usuario,
    u.nombre,
    u.correo_electronico,
    u.activa,
    r.nombre as rol,
    LENGTH(u.contrasena) as password_length
FROM usuarios u
JOIN roles r ON u.rol_id = r.id_rol
WHERE u.correo_electronico = 'admin@pizzasteve.com';
```

## 📋 Paso 2: Crear/Actualizar el Usuario Admin

Si el usuario no existe o la contraseña no está hasheada:

### Método Rápido (Navegador)

1. Abre la consola del navegador (F12)
2. Ejecuta:
```javascript
fetch('api/create_admin.php', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'}
})
.then(r => r.json())
.then(data => {
  console.log(data);
  if (data.success) {
    alert('✅ Usuario creado!\n\nEmail: ' + data.credentials.email + '\nContraseña: ' + data.credentials.password);
  }
});
```

## 📋 Paso 3: Verificar Errores en la Consola

1. Abre la consola del navegador (F12 → Console)
2. Intenta iniciar sesión
3. Revisa los mensajes de error que aparecen

### Errores Comunes:

#### Error: "Usuario o contraseña incorrectos"
- **Causa:** El usuario no existe o la contraseña es incorrecta
- **Solución:** Ejecuta `api/create_admin.php` para crear/actualizar el usuario

#### Error: "El servidor no devolvió JSON válido"
- **Causa:** El servidor está devolviendo HTML (error 404 o 500)
- **Solución:** 
  - Verifica que `api/login.php` existe
  - Revisa los logs de PHP en `logs/php-errors.log`
  - Verifica que el servidor web está funcionando

#### Error: "Demasiados intentos"
- **Causa:** Rate limiting activado
- **Solución:** Espera 5 minutos o elimina los archivos de rate limit en `C:\Windows\Temp\rate_limit_*.json`

#### Error: "Su cuenta ha sido desactivada"
- **Causa:** El usuario tiene `activa = 0` en la base de datos
- **Solución:** Ejecuta:
```sql
UPDATE usuarios SET activa = 1 WHERE correo_electronico = 'admin@pizzasteve.com';
```

## 📋 Paso 4: Verificar Redirección

Después de un login exitoso, deberías ser redirigido según tu rol:

- **Admin:** `views/admin/index.html`
- **Usuario:** `views/usuario/index.html`
- **Vendedor:** `views/vendedor/index.html`
- **Repartidor:** `views/delivery/index.html`

Si no hay redirección, verifica:
1. Que el rol del usuario esté correcto en la base de datos
2. Que los archivos de las vistas existan
3. La consola del navegador para errores de JavaScript

## 📋 Paso 5: Verificar Sesión

Después de iniciar sesión, verifica que la sesión se guardó:

1. Abre la consola del navegador (F12)
2. Ejecuta:
```javascript
fetch('api/session_check.php')
  .then(r => r.json())
  .then(data => console.log('Estado de sesión:', data));
```

Deberías ver:
```json
{
  "success": true,
  "authenticated": true,
  "user": {
    "id": 1,
    "username": "Administrador",
    "role": "Admin",
    "active": true
  }
}
```

## 🔧 Soluciones Rápidas

### Solución 1: Recrear Usuario Admin
```javascript
// En la consola del navegador
fetch('api/create_admin.php', {method: 'POST'})
  .then(r => r.json())
  .then(console.log);
```

### Solución 2: Verificar y Corregir Contraseña
```javascript
// En la consola del navegador
fetch('api/fix_password.php', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    email: 'admin@pizzasteve.com',
    password: 'Admin123!'
  })
})
.then(r => r.json())
.then(console.log);
```

### Solución 3: Limpiar Rate Limiting
Si estás bloqueado por rate limiting, elimina los archivos:
- Windows: `C:\Windows\Temp\rate_limit_*.json`
- Linux/Mac: `/tmp/rate_limit_*.json`

## 📞 Información para Reportar el Error

Si el problema persiste, proporciona esta información:

1. **Resultado del script de diagnóstico:**
   ```
   http://localhost/PizzaSteve/api/test_login.php
   ```

2. **Mensaje de error exacto** de la consola del navegador

3. **Respuesta del servidor** (en la pestaña Network de las DevTools)

4. **Estado del usuario en la base de datos** (resultado de la consulta SQL del Paso 1)

