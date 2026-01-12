# 🔐 Crear Usuario Administrador

Este documento explica cómo crear un usuario administrador para acceder al panel de administración.

## 📋 Credenciales del Administrador

Una vez creado el usuario, las credenciales serán:

- **Email/Usuario:** `admin@pizzasteve.com`
- **Contraseña:** `Admin123!`
- **Nombre:** Administrador
- **Rol:** Admin

---

## 🚀 Método 1: Usando el Script PHP (Recomendado)

### Paso 1: Abrir el script en el navegador

Abre en tu navegador:
```
http://localhost/PizzaSteve/api/create_admin.php
```

### Paso 2: Crear el usuario

**Opción A: Desde el navegador (GET)**
- Solo verifica si el usuario existe
- Si no existe, muestra instrucciones

**Opción B: Desde la consola del navegador (POST)**
1. Abre la consola del navegador (F12)
2. Ejecuta este código:

```javascript
fetch('api/create_admin.php', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'}
})
.then(r => r.json())
.then(data => {
  console.log(data);
  if (data.success) {
    alert('Usuario creado exitosamente!\n\nEmail: ' + data.credentials.email + '\nContraseña: ' + data.credentials.password);
  }
});
```

**Opción C: Usando curl (línea de comandos)**
```bash
curl -X POST http://localhost/PizzaSteve/api/create_admin.php
```

---

## 🗄️ Método 2: Usando SQL Directo

### Paso 1: Abrir phpMyAdmin

1. Ve a `http://localhost/phpmyadmin`
2. Selecciona la base de datos `pizzasteve_db`

### Paso 2: Ejecutar el script SQL

1. Ve a la pestaña "SQL"
2. Copia y pega el contenido del archivo `database/create_admin_user.sql`
3. Haz clic en "Continuar" o presiona Ctrl+Enter

### Paso 3: Verificar

Ejecuta esta consulta para verificar:
```sql
SELECT u.id_usuario, u.nombre, u.correo_electronico, r.nombre as rol, u.activa
FROM usuarios u
JOIN roles r ON u.rol_id = r.id_rol
WHERE u.correo_electronico = 'admin@pizzasteve.com';
```

---

## ✅ Verificación

Después de crear el usuario, verifica que puedes iniciar sesión:

1. Ve a la página principal: `http://localhost/PizzaSteve/`
2. Haz clic en "Iniciar Sesión"
3. Ingresa:
   - **Email:** `admin@pizzasteve.com`
   - **Contraseña:** `Admin123!`
4. Deberías ser redirigido al panel de administración

---

## 🔒 Seguridad

⚠️ **IMPORTANTE:**
- El script `api/create_admin.php` solo funciona en **desarrollo**
- En producción, este script será bloqueado automáticamente
- **Elimina o protege** estos archivos antes de subir a producción:
  - `api/create_admin.php`
  - `api/check_user.php`
  - `api/fix_password.php`
  - `database/create_admin_user.sql`

---

## 🆘 Solución de Problemas

### Error: "Este script solo está disponible en desarrollo"
- Verifica que `APP_ENV` en `.env` no esté configurado como `production`
- O elimina/renombra el archivo `.env` temporalmente

### Error: "Usuario o contraseña incorrectos"
- Verifica que el usuario se creó correctamente ejecutando la consulta SQL de verificación
- Asegúrate de usar el email exacto: `admin@pizzasteve.com`
- La contraseña es: `Admin123!` (con mayúscula, minúsculas, números y símbolo)

### Error: "Rol Admin no existe"
- El script debería crear el rol automáticamente
- Si falla, ejecuta manualmente:
```sql
INSERT INTO roles (id_rol, nombre, descripcion) VALUES (2, 'Admin', 'Administrador del sistema');
```

---

## 📝 Notas Adicionales

- El usuario se crea con el **rol_id = 2** (Admin)
- El usuario está **activo** por defecto (`activa = 1`)
- La contraseña está **hasheada** de forma segura
- Puedes cambiar la contraseña desde el panel de administración una vez que inicies sesión

