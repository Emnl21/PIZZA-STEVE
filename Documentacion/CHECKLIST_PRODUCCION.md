# ✅ CHECKLIST FINAL PARA PRODUCCIÓN

## 🔴 CRÍTICO - Hacer ANTES de subir a producción

### 1. Configuración de Entorno
- [ ] **Crear archivo `.env`** en la raíz del proyecto
  ```bash
  cp .env.example .env
  ```
  Editar `.env` con credenciales REALES de producción:
  ```
  DB_HOST=tu_servidor_db
  DB_USER=tu_usuario_db
  DB_PASSWORD=tu_contraseña_segura
  DB_NAME=pizzasteve_db
  APP_ENV=production
  ```

- [ ] **Verificar que `.env` esté en `.gitignore`** (ya está incluido)

### 2. Directorio de Logs
- [ ] **Crear directorio `logs/`** con permisos de escritura
  ```bash
  mkdir logs
  chmod 755 logs
  ```

### 3. Base de Datos
- [ ] **Hashear TODAS las contraseñas** en la base de datos
  ```sql
  -- Verificar contraseñas en texto plano
  SELECT id_usuario, nombre, 
         CASE 
           WHEN contrasena LIKE '$2y$%' OR contrasena LIKE '$2a$%' THEN 'HASHEADO'
           ELSE 'TEXTO PLANO - NECESITA HASH'
         END as estado
  FROM usuarios;
  
  -- Hashear contraseñas en texto plano (usar password_hash en PHP para nuevas)
  -- IMPORTANTE: Esto es solo para migración. Nuevas contraseñas deben usar password_hash()
  ```

- [ ] **Crear usuario de BD con permisos limitados** (no usar root en producción)
  ```sql
  CREATE USER 'pizzasteve_user'@'localhost' IDENTIFIED BY 'contraseña_segura';
  GRANT SELECT, INSERT, UPDATE, DELETE ON pizzasteve_db.* TO 'pizzasteve_user'@'localhost';
  FLUSH PRIVILEGES;
  ```

### 4. Configuración del Servidor
- [ ] **Configurar SSL/HTTPS** (obligatorio para producción)
- [ ] **Actualizar `RewriteBase` en `.htaccess`** según tu configuración
  - Actualmente: `RewriteBase /PizzaSteve/`
  - Si está en raíz: `RewriteBase /`
  - Si está en subdirectorio: ajustar según corresponda

- [ ] **Configurar PHP.ini** en el servidor:
  ```ini
  display_errors = Off
  error_reporting = E_ALL
  log_errors = On
  error_log = /ruta/a/tu/proyecto/logs/php-errors.log
  ```

### 5. Permisos de Archivos
- [ ] **Configurar permisos correctos:**
  ```bash
  # Archivos: 644
  find . -type f -exec chmod 644 {} \;
  
  # Directorios: 755
  find . -type d -exec chmod 755 {} \;
  
  # Directorio logs: 755 (escribible)
  chmod 755 logs/
  
  # .env: 600 (solo lectura para el propietario)
  chmod 600 .env
  ```

### 6. Archivos Obsoletos
- [ ] **Eliminar o renombrar `database/database.php`** (archivo antiguo con credenciales hardcodeadas)
  - Este archivo ya no se usa, pero contiene credenciales
  - Opción 1: Eliminarlo
  - Opción 2: Renombrarlo a `database.php.old` y agregarlo a `.gitignore`

---

## 🟡 IMPORTANTE - Verificar antes de producción

### 7. Testing
- [ ] **Probar login** con diferentes usuarios y roles
- [ ] **Probar rate limiting** (intentar login 6 veces seguidas)
- [ ] **Probar todas las funcionalidades CRUD** (crear, leer, actualizar, eliminar)
- [ ] **Verificar que los errores NO se muestren** en producción
- [ ] **Verificar que los logs se generen** correctamente
- [ ] **Probar con HTTPS** habilitado

### 8. Seguridad Adicional
- [ ] **Implementar CSRF tokens** en formularios (las funciones están disponibles pero no se usan aún)
- [ ] **Configurar firewall** del servidor
- [ ] **Configurar backups automáticos** de la base de datos
- [ ] **Revisar logs de seguridad** periódicamente

### 9. Monitoreo
- [ ] **Configurar sistema de monitoreo** (opcional pero recomendado)
- [ ] **Configurar alertas** para errores críticos
- [ ] **Revisar logs** regularmente

---

## 📝 Configuración Adicional Recomendada

### 10. Optimización
- [ ] **Habilitar compresión GZIP** (ya configurado en `.htaccess`)
- [ ] **Configurar cache de navegador** (ya configurado en `.htaccess`)
- [ ] **Optimizar imágenes** antes de subir

### 11. Documentación
- [ ] **Documentar credenciales** de forma segura (usar gestor de contraseñas)
- [ ] **Documentar configuración** del servidor
- [ ] **Crear manual de usuario** si es necesario

---

## ⚠️ PROBLEMAS ENCONTRADOS QUE DEBEN RESOLVERSE

### 🔴 Archivo Obsoleto con Credenciales
**Archivo:** `database/database.php`
- **Problema:** Contiene credenciales hardcodeadas y parece ser un archivo antiguo
- **Solución:** Eliminar o renombrar (no se usa en el código actual)

### 🟡 Directorio de Logs Faltante
- **Problema:** El directorio `logs/` no existe
- **Solución:** Crear antes de producción

### 🟡 Archivo .env Faltante
- **Problema:** El archivo `.env` no existe (solo existe `.env.example`)
- **Solución:** Crear y configurar antes de producción

---

## ✅ ESTADO ACTUAL DEL PROYECTO

### ✅ Implementado Correctamente:
- ✅ Errores ocultos en producción
- ✅ Headers de seguridad
- ✅ Rate limiting en login
- ✅ Sesiones seguras
- ✅ Escape HTML (XSS protection)
- ✅ Credenciales en variables de entorno
- ✅ Eliminado fallback de contraseña
- ✅ Validaciones de formularios
- ✅ Protección de archivos sensibles en `.htaccess`

### ⚠️ Pendiente de Configuración:
- ⚠️ Crear archivo `.env` con credenciales reales
- ⚠️ Crear directorio `logs/`
- ⚠️ Hashear contraseñas en BD
- ⚠️ Configurar SSL/HTTPS
- ⚠️ Eliminar/renombrar `database/database.php`
- ⚠️ Ajustar `RewriteBase` en `.htaccess`
- ⚠️ Configurar permisos de archivos

### 📋 Opcional (Mejoras Futuras):
- 📋 Implementar CSRF tokens en formularios
- 📋 Sistema de logging de seguridad
- 📋 Auditoría de cambios
- 📋 Monitoreo y alertas

---

## 🚀 CONCLUSIÓN

**El código está listo para producción** después de completar el checklist crítico:

1. ✅ **Código:** Todas las mejoras de seguridad están implementadas
2. ⚠️ **Configuración:** Falta crear `.env`, `logs/`, y ajustar configuración del servidor
3. ⚠️ **Base de datos:** Falta hashear contraseñas y crear usuario limitado
4. ⚠️ **Servidor:** Falta configurar SSL/HTTPS y ajustar `.htaccess`

**Tiempo estimado para completar el checklist:** 30-60 minutos

---

## 📞 Soporte

Si encuentras problemas durante la implementación:
1. Revisa los logs en `logs/php-errors.log`
2. Verifica que el archivo `.env` esté configurado correctamente
3. Verifica permisos de archivos y directorios
4. Verifica que PHP tenga las extensiones necesarias habilitadas

