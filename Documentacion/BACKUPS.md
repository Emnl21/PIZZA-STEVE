# Sistema de Backups Automáticos

## Descripción

El sistema de PizzaSteve incluye un sistema completo de backups automáticos para la base de datos. Los backups se pueden ejecutar manualmente desde el panel de administración o automáticamente mediante cron jobs.

## Características

- ✅ Backups automáticos programados (cron)
- ✅ Backups manuales desde el panel de administración
- ✅ Soporte para MySQL/MariaDB y PostgreSQL
- ✅ Rotación automática de backups (mantiene los últimos 30)
- ✅ Compresión y optimización
- ✅ Listado y gestión de backups desde la interfaz
- ✅ Eliminación de backups antiguos automáticamente

## Configuración de Backups Automáticos

### Linux/Unix (cron)

1. Abre el crontab del usuario:
```bash
crontab -e
```

2. Agrega una de las siguientes líneas según tu necesidad:

**Backup diario a las 2:00 AM:**
```bash
0 2 * * * /usr/bin/php /ruta/completa/al/proyecto/scripts/backup_cron.php >> /ruta/completa/al/proyecto/logs/backup_cron.log 2>&1
```

**Backup cada 6 horas:**
```bash
0 */6 * * * /usr/bin/php /ruta/completa/al/proyecto/scripts/backup_cron.php >> /ruta/completa/al/proyecto/logs/backup_cron.log 2>&1
```

**Backup cada 12 horas:**
```bash
0 */12 * * * /usr/bin/php /ruta/completa/al/proyecto/scripts/backup_cron.php >> /ruta/completa/al/proyecto/logs/backup_cron.log 2>&1
```

3. Reemplaza `/ruta/completa/al/proyecto` con la ruta real de tu proyecto.

4. Asegúrate de que el directorio `logs/` existe y tiene permisos de escritura:
```bash
mkdir -p /ruta/completa/al/proyecto/logs
chmod 755 /ruta/completa/al/proyecto/logs
```

### Windows (Task Scheduler)

1. Abre el "Programador de tareas" (Task Scheduler)
2. Crea una nueva tarea básica
3. Configura:
   - **Nombre:** PizzaSteve Backup Diario
   - **Desencadenador:** Diario a las 2:00 AM
   - **Acción:** Iniciar un programa
   - **Programa:** `C:\ruta\a\php.exe`
   - **Argumentos:** `C:\ruta\completa\al\proyecto\scripts\backup_cron.php`
   - **Iniciar en:** `C:\ruta\completa\al\proyecto`

### Verificar que funciona

Después de configurar el cron, puedes verificar que funciona ejecutando manualmente:

```bash
php scripts/backup_cron.php
```

Revisa el archivo `logs/backup_cron.log` para ver los resultados.

## Uso desde el Panel de Administración

1. Inicia sesión como administrador
2. Ve a la sección "Backups" en el panel de administración
3. Puedes:
   - Ver lista de backups disponibles
   - Crear un backup manual
   - Descargar un backup
   - Eliminar un backup

## Estructura de Archivos

```
backups/
├── pizzasteve_backup_2024-01-15_020000.sql
├── pizzasteve_backup_2024-01-15_080000.sql
└── pizzasteve_backup_2024-01-15_140000.sql
```

Los backups se nombran con el formato: `pizzasteve_backup_YYYY-MM-DD_HHMMSS.sql`

## Rotación de Backups

El sistema mantiene automáticamente los últimos **30 backups**. Los backups más antiguos se eliminan automáticamente cuando se crea un nuevo backup.

Para cambiar este número, edita la variable `$max_backups` en:
- `api/backup.php` (línea ~20)
- `scripts/backup_cron.php` (línea ~20)

## Restaurar un Backup

### MySQL/MariaDB

```bash
mysql -u usuario -p nombre_base_datos < backups/pizzasteve_backup_2024-01-15_020000.sql
```

### PostgreSQL

```bash
pg_restore --host=localhost --port=5432 --username=usuario --dbname=nombre_base_datos backups/pizzasteve_backup_2024-01-15_020000.dump
```

## Requisitos

- **MySQL:** `mysqldump` debe estar instalado y en el PATH
- **PostgreSQL:** `pg_dump` debe estar instalado y en el PATH
- **PHP:** Versión 7.4 o superior
- **Permisos:** El usuario PHP debe tener permisos de escritura en el directorio `backups/`

## Solución de Problemas

### Error: "mysqldump: command not found"

**Solución:** Instala MySQL client tools o agrega la ruta de mysqldump al PATH:
```bash
export PATH=$PATH:/usr/local/mysql/bin
```

### Error: "Permission denied" al crear backup

**Solución:** Asegúrate de que el directorio `backups/` tiene permisos de escritura:
```bash
chmod 755 backups/
chown www-data:www-data backups/  # Ajusta según tu servidor
```

### Error: "pg_dump: connection to server failed"

**Solución:** Verifica que las credenciales en `.env` son correctas y que PostgreSQL permite conexiones desde el servidor.

### Los backups no se crean automáticamente

**Solución:**
1. Verifica que el cron job está configurado correctamente: `crontab -l`
2. Revisa los logs: `tail -f logs/backup_cron.log`
3. Verifica permisos del script: `chmod +x scripts/backup_cron.php`
4. Prueba ejecutando manualmente: `php scripts/backup_cron.php`

## Seguridad

- Los backups contienen información sensible. Asegúrate de que el directorio `backups/` NO sea accesible públicamente.
- Considera encriptar los backups si contienen información muy sensible.
- Los backups se excluyen automáticamente de Git (ver `.gitignore`).

## Recomendaciones

1. **Frecuencia:** Para producción, se recomienda backups diarios. Para desarrollo, semanales pueden ser suficientes.
2. **Almacenamiento:** Considera copiar los backups a un servidor remoto o servicio de almacenamiento en la nube.
3. **Pruebas:** Prueba restaurar un backup periódicamente para asegurarte de que funcionan correctamente.
4. **Monitoreo:** Revisa los logs regularmente para detectar problemas.

## API Endpoints

### GET /api/backup.php
Lista todos los backups disponibles.

**Respuesta:**
```json
{
  "success": true,
  "backups": [
    {
      "filename": "pizzasteve_backup_2024-01-15_020000.sql",
      "size": 1048576,
      "size_formatted": "1.00 MB",
      "date": "2024-01-15 02:00:00",
      "timestamp": 1705284000
    }
  ],
  "total": 1,
  "max_backups": 30
}
```

### POST /api/backup.php
Crea un nuevo backup manualmente.

**Respuesta:**
```json
{
  "success": true,
  "message": "Backup creado exitosamente.",
  "filename": "pizzasteve_backup_2024-01-15_143000.sql",
  "size": 1048576,
  "size_formatted": "1.00 MB",
  "date": "2024-01-15 14:30:00",
  "type": "mysql"
}
```

### DELETE /api/backup.php?filename=pizzasteve_backup_2024-01-15_020000.sql
Elimina un backup específico.

**Respuesta:**
```json
{
  "success": true,
  "message": "Backup eliminado exitosamente."
}
```

