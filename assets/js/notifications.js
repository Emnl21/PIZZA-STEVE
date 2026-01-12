// ===============================
// 🔔 SISTEMA DE NOTIFICACIONES
// ===============================

(function () {
    if (window.notificationSystemInitialized) {
        return;
    }
    window.notificationSystemInitialized = true;

    // Determinar la ruta base de la aplicación a partir de la ruta del script
    const scriptEl = document.currentScript;
    const scriptSrc = scriptEl ? scriptEl.src : '';
    const baseMatch = scriptSrc.match(/^(.*\/)assets\/js\/notifications\.js/i);
    const APP_BASE_URL = baseMatch ? baseMatch[1] : (window.location.origin + '/');
    const NOTIFICATIONS_API_URL = `${APP_BASE_URL}api/notifications.php`;

    function isUserLoggedIn() {
        try {
            const stored = localStorage.getItem('usuario');
            if (!stored) return false;
            const user = JSON.parse(stored);
            return Boolean(user && (user.id_usuario || user.id));
        } catch (_) {
            return false;
        }
    }

    let notificationCheckInterval = null;

    async function loadNotifications() {
        if (!isUserLoggedIn()) {
            return;
        }
        try {
            const response = await fetch(`${NOTIFICATIONS_API_URL}?only_unread=1`, {
                credentials: 'include'
            });

            if (!response.ok) return;

            const notifications = await response.json();

            if (Array.isArray(notifications) && notifications.length > 0) {
                notifications.forEach(notification => {
                    showNotification(notification);
                });
            }
        } catch (error) {
            console.error('Error al cargar notificaciones:', error);
        }
    }

    function showNotification(notification) {
        if (!isUserLoggedIn()) {
            return;
        }
        const container = document.getElementById('notificationContainer');
        if (!container) return;

        const notificationEl = document.createElement('div');
        notificationEl.className = 'notification alert alert-info alert-dismissible fade show';
        notificationEl.setAttribute('data-notification-id', notification.id_notificacion);
        notificationEl.setAttribute('role', 'alert');

        let icon = 'bi-bell-fill';
        let alertClass = 'alert-info';

        if (notification.tipo === 'pedido_entregado') {
            icon = 'bi-check-circle-fill';
            alertClass = 'alert-success';
        } else if (notification.tipo === 'pedido_preparando') {
            icon = 'bi-hourglass-split';
            alertClass = 'alert-warning';
        } else if (notification.tipo === 'pedido_listo') {
            icon = 'bi-check-circle';
            alertClass = 'alert-success';
        }

        notificationEl.className = `notification alert ${alertClass} alert-dismissible fade show`;

        notificationEl.innerHTML = `
            <i class="bi ${icon} me-2"></i>
            <strong>${notification.titulo || 'Notificación'}</strong>
            ${notification.mensaje ? `<br>${notification.mensaje}` : ''}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close" data-notification-id="${notification.id_notificacion}"></button>
        `;

        container.appendChild(notificationEl);

        const closeBtn = notificationEl.querySelector('.btn-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function () {
                markNotificationAsRead(notification.id_notificacion);
            });
        }

        setTimeout(() => {
            if (notificationEl.parentNode) {
                notificationEl.classList.remove('show');
                setTimeout(() => {
                    if (notificationEl.parentNode) {
                        notificationEl.remove();
                    }
                }, 300);
            }
            markNotificationAsRead(notification.id_notificacion);
        }, 10000);
    }

    async function markNotificationAsRead(notificationId) {
        try {
            await fetch(NOTIFICATIONS_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    notification_id: notificationId
                })
            });
        } catch (error) {
            console.error('Error al marcar notificación como leída:', error);
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        loadNotifications();
        notificationCheckInterval = setInterval(loadNotifications, 30000);
    });

    window.addEventListener('beforeunload', function () {
        if (notificationCheckInterval) {
            clearInterval(notificationCheckInterval);
        }
    });

    window.notificationSystem = window.notificationSystem || {};
    window.notificationSystem.showNotification = showNotification;
})();
