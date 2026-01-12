    // Variable para el intervalo de verificación de sesión
    let sessionCheckInterval = null;
    let salesChart = null;
    let topProductsChart = null;
    let allUsersData = [];
    let userStatusFilter = 'active';

    function escapeText(value) {
        if (value === null || value === undefined) return '';
        if (typeof escapeHtml === 'function') {
            return escapeHtml(value);
        }
        const map = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'};
        return String(value).replace(/[&<>"']/g, m => map[m]);
    }

    function notifyAdmin(message, type = 'info', title = 'Panel de administrador') {
        if (typeof window.notify === 'function') {
            window.notify(title, message, type);
            return;
        }

        if (window.notificationSystem && typeof window.notificationSystem.showNotification === 'function') {
            window.notificationSystem.showNotification(title, message, type);
            return;
        }

        console[type === 'error' ? 'error' : 'log'](`${title}: ${message}`);
    }

    function isVendorRoleName(roleName) {
        return (roleName || '').toLowerCase() === 'vendedor';
    }

    function getSelectedRoleName(selectEl) {
        if (!selectEl) return '';
        const option = selectEl.options[selectEl.selectedIndex];
        return option?.dataset?.roleName || '';
    }

    function toggleBranchField(selectEl, wrapperId) {
        const wrapper = document.getElementById(wrapperId);
        if (!wrapper) return;
        const branchSelect = wrapper.querySelector('select');
        const isVendor = isVendorRoleName(getSelectedRoleName(selectEl));
        if (isVendor) {
            wrapper.classList.remove('d-none');
            if (branchSelect) {
                branchSelect.required = true;
            }
        } else {
            wrapper.classList.add('d-none');
            if (branchSelect) {
                branchSelect.required = false;
                branchSelect.classList.remove('is-invalid');
                branchSelect.value = '';
            }
        }
    }

    function splitFullName(fullName) {
        if (!fullName) {
            return { firstName: '', lastName: '' };
        }
        const parts = fullName.trim().split(/\s+/);
        if (parts.length === 1) {
            return { firstName: parts[0], lastName: '' };
        }
        const firstName = parts.shift();
        const lastName = parts.join(' ');
        return { firstName, lastName };
    }

    // Helper para hacer peticiones API con autenticación
    const apiFetch = async (url, options = {}) => {
        const defaultOptions = {
            credentials: 'include', // Siempre incluir cookies de sesión
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };
        
        return fetch(url, { ...defaultOptions, ...options });
    };
    
    // =================================================================
    // PAGINATION SYSTEM
    // =================================================================
    const paginationState = {}; // Almacenar estado de paginación por tabla
    
    /**
     * Inicializa o actualiza la paginación para una tabla
     * @param {string} tableId - ID del tbody de la tabla
     * @param {Array} data - Array completo de datos
     * @param {Function} renderFunction - Función que renderiza una fila (recibe item, index)
     * @param {number} itemsPerPage - Items por página (default: 6)
     */
    function initPagination(tableId, data, renderFunction, itemsPerPage = 6) {
        if (!data || !Array.isArray(data)) {
            data = [];
        }
        
        const totalItems = data.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        
        // Inicializar estado si no existe
        if (!paginationState[tableId]) {
            paginationState[tableId] = {
                currentPage: 1,
                itemsPerPage: itemsPerPage,
                data: data,
                renderFunction: renderFunction
            };
        } else {
            // Actualizar datos y resetear página si los datos cambiaron
            paginationState[tableId].data = data;
            paginationState[tableId].renderFunction = renderFunction;
            paginationState[tableId].itemsPerPage = itemsPerPage;
        }
        
        renderTablePage(tableId);
        renderPaginationControls(tableId, totalPages);
    }
    
    /**
     * Renderiza la página actual de la tabla
     */
    function renderTablePage(tableId) {
        const state = paginationState[tableId];
        if (!state) return;
        
        const tableBody = document.getElementById(tableId);
        if (!tableBody) return;
        
        const { currentPage, itemsPerPage, data, renderFunction } = state;
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const pageData = data.slice(startIndex, endIndex);
        
        tableBody.innerHTML = '';
        
        if (pageData.length === 0) {
            const colCount = tableBody.closest('table')?.querySelectorAll('thead th').length || 1;
            tableBody.innerHTML = `<tr><td colspan="${colCount}" class="text-center">No hay datos para mostrar</td></tr>`;
            return;
        }
        
        pageData.forEach((item, index) => {
            const row = renderFunction(item, startIndex + index);
            if (row) {
                tableBody.appendChild(row);
            }
        });
    }
    
    /**
     * Renderiza los controles de paginación
     */
    function renderPaginationControls(tableId, totalPages) {
        const state = paginationState[tableId];
        if (!state) return;
        
        const { currentPage } = state;
        const paginationId = `${tableId}Pagination`;
        
        // Buscar o crear contenedor de paginación
        let paginationContainer = document.getElementById(paginationId);
        const tableBody = document.getElementById(tableId);
        
        if (!tableBody) return;
        
        // Si no existe, crear después de la tabla
        if (!paginationContainer) {
            const table = tableBody.closest('table');
            if (table) {
                paginationContainer = document.createElement('div');
                paginationContainer.id = paginationId;
                paginationContainer.className = 'd-flex justify-content-center mt-3';
                table.parentNode.insertBefore(paginationContainer, table.nextSibling);
            } else {
                return;
            }
        }
        
        // Si solo hay una página o menos, ocultar paginación
        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }
        
        // Generar HTML de paginación Bootstrap
        let paginationHTML = '<nav aria-label="Navegación de páginas"><ul class="pagination pagination-sm mb-0">';
        
        // Botón Anterior
        paginationHTML += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage - 1}" aria-label="Anterior">
                <span aria-hidden="true">&laquo;</span>
            </a>
        </li>`;
        
        // Números de página
        const maxVisiblePages = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage < maxVisiblePages - 1) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        if (startPage > 1) {
            paginationHTML += `<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>`;
            if (startPage > 2) {
                paginationHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `<li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" data-page="${i}">${i}</a>
            </li>`;
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
            paginationHTML += `<li class="page-item"><a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a></li>`;
        }
        
        // Botón Siguiente
        paginationHTML += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage + 1}" aria-label="Siguiente">
                <span aria-hidden="true">&raquo;</span>
            </a>
        </li>`;
        
        paginationHTML += '</ul></nav>';
        paginationContainer.innerHTML = paginationHTML;
        
        // Agregar event listeners
        paginationContainer.querySelectorAll('.page-link[data-page]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(link.dataset.page);
                if (page >= 1 && page <= totalPages && page !== currentPage) {
                    state.currentPage = page;
                    renderTablePage(tableId);
                    renderPaginationControls(tableId, totalPages);
                    // Scroll suave hacia la tabla
                    tableBody.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }
    
    // Verificar sesión en el servidor
    async function checkSession() {
        try {
            const response = await apiFetch('../../api/session_check.php', {
                method: 'GET'
            });
            
            const data = await response.json();
            
            if (data.success && data.authenticated) {
                return true;
            } else {
                // Sesión inválida o usuario desactivado
                return false;
            }
        } catch (error) {
            console.error('Error al verificar sesión:', error);
            return false;
        }
    }
    
    // Iniciar monitoreo periódico de sesión
    function startSessionMonitoring() {
        // Verificar cada 30 segundos
        sessionCheckInterval = setInterval(async () => {
            const isValid = await checkSession();
            if (!isValid) {
                // Detener el intervalo
                if (sessionCheckInterval) {
                    clearInterval(sessionCheckInterval);
                }
                
                // Mostrar mensaje y redirigir
                notifyAdmin('Su sesión ha expirado o su cuenta ha sido desactivada. Será redirigido al login.', 'warning');
                window.location.href = '../../Index.html';
            }
        }, 30000); // 30 segundos
        
        // También verificar cuando la ventana vuelve a tener foco
        window.addEventListener('focus', async () => {
            const isValid = await checkSession();
            if (!isValid) {
                if (sessionCheckInterval) {
                    clearInterval(sessionCheckInterval);
                }
                notifyAdmin('Su sesión ha expirado o su cuenta ha sido desactivada. Será redirigido al login.', 'warning');
                window.location.href = '../../Index.html';
            }
        });
    }
    
    // Detener monitoreo de sesión (al hacer logout, etc.)
    function stopSessionMonitoring() {
        if (sessionCheckInterval) {
            clearInterval(sessionCheckInterval);
            sessionCheckInterval = null;
        }
    }
    
    // Función para cerrar sesión
    window.logout = async function() {
        const confirmed = window.confirm('¿Deseas cerrar sesión?');
        if (!confirmed) return;
        
        stopSessionMonitoring();
        
        try {
            // Llamar al endpoint de logout si existe, o simplemente redirigir
            await apiFetch('../../api/logout.php', { 
                method: 'POST'
            });
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        }
        
        // Limpiar localStorage si existe
        localStorage.removeItem('usuario');
        
        // Redirigir al login
        window.location.href = '../../Index.html';
    };

    // Bootstrap modal ya no se usa para logout; se mantiene confirm nativo.

document.addEventListener('DOMContentLoaded', function() {
        const userFilterGroup = document.getElementById('userStatusFilters');
        if (userFilterGroup) {
            userFilterGroup.addEventListener('click', (event) => {
                const button = event.target.closest('button[data-filter]');
                if (!button) return;
                const newFilter = button.dataset.filter;
                if (!newFilter || newFilter === userStatusFilter) return;
                userStatusFilter = newFilter;
                renderUsersTable();
            });
        }

        const addUserRoleSelect = document.getElementById('userRole');
        if (addUserRoleSelect) {
            addUserRoleSelect.addEventListener('change', () => toggleBranchField(addUserRoleSelect, 'userBranchWrapper'));
        }
        const editUserRoleSelect = document.getElementById('editUserRole');
        if (editUserRoleSelect) {
            editUserRoleSelect.addEventListener('change', () => toggleBranchField(editUserRoleSelect, 'editUserBranchWrapper'));
        }

        // Verificar sesión antes de cargar cualquier cosa
        checkSession().then(isValid => {
            if (!isValid) {
                // Sesión inválida, redirigir al login
                notifyAdmin('Su sesión ha expirado o su cuenta ha sido desactivada. Será redirigido al login.', 'warning');
                window.location.href = '../../Index.html';
                return;
            }
            
            // Inicializar verificación periódica de sesión (cada 30 segundos)
            startSessionMonitoring();
            
            initializeAdminPanel();
        }).catch(error => {
            console.error('Error verificando sesión:', error);
            notifyAdmin('Error al verificar la sesión. Será redirigido al login.', 'error');
            window.location.href = '../../Index.html';
        });
    });
    
    function initializeAdminPanel() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const navLinks = document.querySelectorAll('.sidebar .nav-link');
    const sections = document.querySelectorAll('.content section');
    const sectionTitle = document.getElementById('section-title');

    // --- Sidebar Toggle --- //
        if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });
        }

    // --- Navigation Logic --- //
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            if(this.getAttribute('href').startsWith('#')) {
                e.preventDefault();
            } else {
                return;
            }

            const targetId = this.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);
            if (!targetSection) return;

            sections.forEach(section => {
                if (section.id !== targetId) {
                    section.classList.add('d-none');
                    section.classList.remove('fade-in');
                }
            });

            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');

            const linkText = this.querySelector('.sidebar-text').textContent;
                if (sectionTitle) sectionTitle.textContent = linkText;
            
            targetSection.classList.remove('d-none');
            targetSection.classList.add('fade-in');

            switch (targetId) {
                    case 'dashboard': loadDashboard(); break;
                case 'products': loadProducts(); break;
                    case 'stock': loadStock(); break;
                case 'orders': loadOrders(); break;
                    case 'users': loadUsers(); break;
                    case 'branches': loadBranches(); break;
                    case 'delivery': loadDelivery(); break;
                    case 'promotions': loadPromotions(); break;
                    case 'backups': loadBackups(); break;
                    case 'reports': loadReports(); break;
                    case 'logs': loadLogs(); break;
            }
        });
    });

        // Load initial section
        const hash = window.location.hash.substring(1) || 'dashboard';
        const hashSection = document.getElementById(hash);
        if (hashSection) {
            sections.forEach(section => {
                if (section.id !== hash) {
                    section.classList.add('d-none');
                } else {
                    section.classList.remove('d-none');
                }
            });
            
            navLinks.forEach(link => {
                if (link.getAttribute('href') === `#${hash}`) {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            });
            
            if (sectionTitle) {
                const activeLink = document.querySelector(`.nav-link[href="#${hash}"]`);
                if (activeLink) {
                    sectionTitle.textContent = activeLink.querySelector('.sidebar-text').textContent;
                }
            }
            
            // Load data for initial section
            switch(hash) {
                case 'dashboard': loadDashboard(); break;
                case 'products': loadProducts(); break;
                case 'stock': loadStock(); break;
                case 'users': loadUsers(); break;
                case 'orders': loadOrders(); break;
                case 'branches': loadBranches(); break;
                case 'delivery': loadDelivery(); break;
                case 'promotions': loadPromotions(); break;
                case 'backups': loadBackups(); break;
                case 'reports': loadReports(); break;
                case 'logs': loadLogs(); break;
            }
        }
    }

    // --- API and Data Handling --- //
    async function handleResponse(response) {
        // Si la respuesta es un error 401 o 403, verificar si es por sesión inválida
        if (response.status === 401 || response.status === 403) {
            try {
                const data = await response.clone().json();
                if (data.redirect === true) {
                    // Sesión inválida, redirigir al login
                    stopSessionMonitoring();
                    notifyAdmin(data.message || 'Su sesión ha expirado. Será redirigido al login.', 'warning');
                    window.location.href = '../../Index.html';
                    throw new Error('Sesión inválida');
                }
            } catch (e) {
                // No es JSON, continuar normalmente
            }
        }
        
        if (!response.ok) {
            const text = await response.text();
            let errorMessage = 'Error en la petición';
            try {
                const errorData = JSON.parse(text);
                errorMessage = errorData.message || errorData.error || errorMessage;
            } catch (e) {
                errorMessage = text || `Error ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        return response.json();
    }

    function showMessage(message, type = 'success') {
        // Crear notificación toast mejorada
        const toastContainer = document.getElementById('toastContainer') || createToastContainer();
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white ${type === 'success' ? 'bg-success' : 'bg-danger'} border-0`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        toastContainer.appendChild(toast);
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        
        // Remover toast del DOM después de que se oculte
        toast.addEventListener('hidden.bs.toast', function() {
            toast.remove();
        });
    }
    
    function createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container position-fixed top-0 end-0 p-3';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
        return container;
    }

    // --- Dashboard Section --- //
    async function loadDashboard() {
        try {
            const response = await apiFetch('../../api/stats.php');
            const result = await handleResponse(response);
            
            if (result.success && result.data) {
                const stats = result.data;
                
                // Update stats cards con validación
                const salesToday = parseFloat(stats.sales_today || 0);
                const pendingOrders = parseInt(stats.pending_orders || 0);
                const totalRevenue = parseFloat(stats.total_revenue || 0);
                const activeUsers = parseInt(stats.active_users || 0);
                
                document.getElementById('stat-sales-today').textContent = `Bs. ${salesToday.toFixed(2)}`;
                document.getElementById('stat-pending-orders').textContent = pendingOrders;
                document.getElementById('stat-total-revenue').textContent = `Bs. ${totalRevenue.toFixed(2)}`;
                document.getElementById('stat-active-users').textContent = activeUsers;
                
                // Load sales chart
                loadSalesChart(stats.sales_by_day || []);
                
                // Load top products chart
                loadTopProductsChart(stats.top_products || []);
            } else {
                console.error('Error loading dashboard:', result.message || 'Error desconocido');
                showMessage('Error al cargar las estadísticas del dashboard', 'error');
            }
        } catch (error) {
            console.error('Error loading dashboard:', error);
            showMessage('Error al cargar el dashboard. Verifique la conexión con el servidor.', 'error');
        }
    }

    function loadSalesChart(salesData) {
        const ctx = document.getElementById('salesChart');
        if (!ctx) return;
        
        if (salesChart) salesChart.destroy();
        
        // Validar y procesar datos
        if (!salesData || !Array.isArray(salesData) || salesData.length === 0) {
            // Si no hay datos, mostrar gráfico vacío con etiquetas de días de la semana
            const daysOfWeek = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
        salesChart = new Chart(ctx, {
            type: 'line',
            data: {
                    labels: daysOfWeek,
                datasets: [{
                        label: 'Ventas',
                        data: [0, 0, 0, 0, 0, 0, 0],
                        backgroundColor: 'rgba(217, 43, 43, 0.1)',
                        borderColor: '#D92B2B',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return 'Bs. ' + value.toFixed(2);
                                }
                            }
                        }
                    }
                }
            });
            return;
        }
        
        const labels = salesData.map(item => {
            try {
                const date = new Date(item.date);
                if (isNaN(date.getTime())) {
                    return item.date; // Si la fecha es inválida, mostrar el valor original
                }
                return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
            } catch (e) {
                return item.date || 'Fecha inválida';
            }
        });
        const data = salesData.map(item => {
            const total = parseFloat(item.total || 0);
            return isNaN(total) ? 0 : total;
        });
        
        salesChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Ventas',
                    data: data,
                    backgroundColor: 'rgba(217, 43, 43, 0.1)',
                    borderColor: '#D92B2B',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return 'Bs. ' + value.toFixed(2);
                            }
                        }
                    }
                }
            }
        });
    }

    function loadTopProductsChart(products) {
        const ctx = document.getElementById('topProductsChart');
        if (!ctx) return;
        
        if (topProductsChart) topProductsChart.destroy();
        
        if (!products || !Array.isArray(products) || products.length === 0) {
            // Mostrar mensaje si no hay datos
            ctx.parentElement.innerHTML = '<p class="text-center text-muted">No hay datos de productos vendidos</p>';
            return;
        }
        
        const labels = products.map(item => item.nombre || 'Producto sin nombre');
        const data = products.map(item => parseInt(item.cantidad || 0));
        
        topProductsChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        'rgba(217, 43, 43, 0.8)',
                        'rgba(242, 169, 0, 0.8)',
                        'rgba(45, 42, 38, 0.8)',
                        'rgba(108, 117, 125, 0.8)',
                        'rgba(40, 167, 69, 0.8)'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    // --- Products Section --- //
    async function loadProducts() {
        try {
            await loadBranchesForSelect('productBranch');
            await loadBranchesForSelect('editProductBranch');
            
            const response = await apiFetch('../../api/products.php');
            const data = await handleResponse(response);
            const tableBody = document.getElementById('productsTableBody');
            tableBody.innerHTML = '';
            
            if (!data || !Array.isArray(data) || data.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="7" class="text-center">No hay productos registrados</td></tr>';
                return;
            }
            
            data.forEach(item => {
                if (!item.id_producto) return; // Saltar items inválidos
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${item.id_producto}</td>
                    <td>${item.nombre || '-'}</td>
                    <td>${item.descripcion || '-'}</td>
                    <td>${item.categoria || 'Pizza'}</td>
                    <td>Bs. ${parseFloat(item.precio || 0).toFixed(2)}</td>
                    <td>${item.stock_disponible || 0}</td>
                    <td>
                        <button class="btn btn-sm btn-primary edit-product" data-id="${item.id_producto}" title="Editar">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-danger delete-product" data-id="${item.id_producto}" title="Eliminar">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
            
            document.querySelectorAll('.edit-product').forEach(btn => {
                btn.addEventListener('click', () => editProduct(btn.dataset.id));
            });
            
            document.querySelectorAll('.delete-product').forEach(btn => {
                btn.addEventListener('click', () => deleteProduct(btn.dataset.id));
            });
        } catch (error) {
            console.error('Error loading products:', error);
            const tableBody = document.getElementById('productsTableBody');
            if (tableBody) {
                tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error al cargar productos: ${error.message}</td></tr>`;
            }
            showMessage('Error al cargar los productos: ' + error.message, 'error');
        }
    }

    document.getElementById('addProductForm')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        try {
            const nameInput = document.getElementById('productName');
            const priceInput = document.getElementById('productPrice');
            const stockInput = document.getElementById('productStock');
            
            // Validar nombre del producto (sin números)
            if (!nameInput.value.trim()) {
                if (typeof showFieldError === 'function') {
                    showFieldError(nameInput, 'El nombre del producto es requerido');
                } else {
                    showMessage('El nombre del producto es requerido', 'error');
                }
                return;
            }
            
            // Validar que el nombre no contenga números
            if (typeof validateProductNameField === 'function') {
                if (!validateProductNameField(nameInput)) {
                    return;
                }
            } else if (typeof isValidProductName === 'function') {
                if (!isValidProductName(nameInput.value)) {
                    if (typeof showFieldError === 'function') {
                        showFieldError(nameInput, 'El nombre solo puede contener letras, espacios y acentos. No se permiten números.');
                    } else {
                        showMessage('El nombre del producto solo puede contener letras, espacios y acentos. No se permiten números.', 'error');
                    }
                    return;
                }
            } else {
                // Validación básica si las funciones no están disponibles
                const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/;
                if (!nameRegex.test(nameInput.value.trim()) || nameInput.value.trim().length < 2) {
                    if (typeof showFieldError === 'function') {
                        showFieldError(nameInput, 'El nombre solo puede contener letras, espacios y acentos. Mínimo 2 caracteres.');
                    } else {
                        showMessage('El nombre del producto solo puede contener letras, espacios y acentos. Mínimo 2 caracteres.', 'error');
                    }
                    return;
                }
            }
            
            if (typeof validatePriceField === 'function' && !validatePriceField(priceInput)) return;
            if (typeof validateStockField === 'function' && !validateStockField(stockInput)) return;
            
            const price = parseFloat(priceInput.value);
            const stock = parseInt(stockInput.value) || 0;
            
            if (price <= 0) {
                if (typeof showFieldError === 'function') {
                    showFieldError(priceInput, 'El precio debe ser mayor a 0');
                } else {
                    showMessage('El precio debe ser mayor a 0', 'error');
                }
                return;
            }
            
            if (stock < 0) {
                if (typeof showFieldError === 'function') {
                    showFieldError(stockInput, 'El stock no puede ser negativo');
                } else {
                    showMessage('El stock no puede ser negativo', 'error');
                }
                return;
            }
            
            const formData = {
                name: nameInput.value.trim(),
                description: document.getElementById('productDescription').value.trim(),
                price: price,
                categoria: document.getElementById('productCategory').value,
                stock_disponible: stock,
                sucursal_id: document.getElementById('productBranch').value || null
            };
            
            const response = await apiFetch('../../api/products.php', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            
            const data = await handleResponse(response);
            showMessage(data.message, data.success ? 'success' : 'error');
            
            if (data.success) {
                loadProducts();
                this.reset();
                const tab = new bootstrap.Tab(document.querySelector('a[href="#view-products"]'));
                tab.show();
            }
        } catch (error) {
            console.error('Error adding product:', error);
            showMessage('Error al agregar el producto: ' + error.message, 'error');
        }
    });

    async function editProduct(id) {
        try {
            const response = await apiFetch(`../../api/products.php?id=${id}`);
            const product = await handleResponse(response);
            
            document.getElementById('editProductId').value = product.id_producto;
            document.getElementById('editProductName').value = product.nombre;
            document.getElementById('editProductDescription').value = product.descripcion || '';
            document.getElementById('editProductCategory').value = product.categoria || 'Pizza';
            document.getElementById('editProductPrice').value = product.precio;
            document.getElementById('editProductStock').value = product.stock_disponible || 0;
            document.getElementById('editProductBranch').value = product.sucursal_id || '';
            
            const modal = new bootstrap.Modal(document.getElementById('editProductModal'));
            modal.show();
        } catch (error) {
            console.error('Error loading product:', error);
            showMessage('Error al cargar el producto', 'error');
        }
    }

    document.getElementById('editProductForm')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        try {
            const nameInput = document.getElementById('editProductName');
            
            // Validar nombre del producto (sin números)
            if (!nameInput.value.trim()) {
                if (typeof showFieldError === 'function') {
                    showFieldError(nameInput, 'El nombre del producto es requerido');
                } else {
                    showMessage('El nombre del producto es requerido', 'error');
                }
                return;
            }
            
            // Validar que el nombre no contenga números
            if (typeof validateProductNameField === 'function') {
                if (!validateProductNameField(nameInput)) {
                    return;
                }
            } else if (typeof isValidProductName === 'function') {
                if (!isValidProductName(nameInput.value)) {
                    if (typeof showFieldError === 'function') {
                        showFieldError(nameInput, 'El nombre solo puede contener letras, espacios y acentos. No se permiten números.');
                    } else {
                        showMessage('El nombre del producto solo puede contener letras, espacios y acentos. No se permiten números.', 'error');
                    }
                    return;
                }
            } else {
                // Validación básica si las funciones no están disponibles
                const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/;
                if (!nameRegex.test(nameInput.value.trim()) || nameInput.value.trim().length < 2) {
                    if (typeof showFieldError === 'function') {
                        showFieldError(nameInput, 'El nombre solo puede contener letras, espacios y acentos. Mínimo 2 caracteres.');
                    } else {
                        showMessage('El nombre del producto solo puede contener letras, espacios y acentos. Mínimo 2 caracteres.', 'error');
                    }
                    return;
                }
            }
            
            const formData = {
                id: document.getElementById('editProductId').value,
                name: nameInput.value.trim(),
                description: document.getElementById('editProductDescription').value.trim(),
                price: parseFloat(document.getElementById('editProductPrice').value),
                categoria: document.getElementById('editProductCategory').value,
                stock_disponible: parseInt(document.getElementById('editProductStock').value) || 0,
                sucursal_id: document.getElementById('editProductBranch').value || null
            };
            
            const response = await apiFetch('../../api/products.php', {
                method: 'PUT',
                body: JSON.stringify(formData)
            });
            
            const data = await handleResponse(response);
            showMessage(data.message, data.success ? 'success' : 'error');
            
            if (data.success) {
                loadProducts();
                const modal = bootstrap.Modal.getInstance(document.getElementById('editProductModal'));
                modal.hide();
            }
        } catch (error) {
            console.error('Error updating product:', error);
            showMessage('Error al actualizar el producto', 'error');
        }
    });

    async function deleteProduct(id) {
        if (!confirm('¿Estás seguro de que quieres desactivar este producto?')) return;
        
        try {
            const response = await apiFetch(`../../api/products.php?id=${id}`, { method: 'DELETE' });
            const data = await handleResponse(response);
            showMessage(data.message, data.success ? 'success' : 'error');
                if (data.success) loadProducts();
        } catch (error) {
            console.error('Error deleting product:', error);
            showMessage('Error al eliminar el producto', 'error');
        }
    }

    // --- Stock Section --- //
    async function loadStock() {
        try {
            const response = await apiFetch('../../api/products.php');
            const data = await handleResponse(response);
            const tableBody = document.getElementById('stockTableBody');
            tableBody.innerHTML = '';
            
            if (data.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="4" class="text-center">No hay productos</td></tr>';
                return;
            }
            
            data.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${item.nombre}</td>
                    <td><strong>${item.stock_disponible || 0}</strong></td>
                    <td>
                        <input type="number" class="form-control form-control-sm stock-quantity" 
                               data-id="${item.id_producto}" value="0" min="0" style="width: 100px;">
                    </td>
                    <td>
                        <button class="btn btn-sm btn-success update-stock" data-id="${item.id_producto}">
                            <i class="bi bi-plus-circle"></i> Agregar
                        </button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
            
            document.querySelectorAll('.update-stock').forEach(btn => {
                btn.addEventListener('click', () => {
                    const productId = btn.dataset.id;
                    const input = document.querySelector(`.stock-quantity[data-id="${productId}"]`);
                    const quantity = parseInt(input.value);
                    if (quantity > 0) {
                        updateStock(productId, quantity);
                    } else {
                        showMessage('Ingrese una cantidad mayor a 0', 'error');
                    }
                });
            });
            
            // Search functionality
            document.getElementById('stockSearch')?.addEventListener('input', function(e) {
                const searchTerm = e.target.value.toLowerCase();
                const rows = tableBody.querySelectorAll('tr');
                rows.forEach(row => {
                    const text = row.textContent.toLowerCase();
                    row.style.display = text.includes(searchTerm) ? '' : 'none';
                });
            });
        } catch (error) {
            console.error('Error loading stock:', error);
        }
    }

    async function updateStock(productId, quantity) {
        try {
            if (quantity <= 0) {
                showMessage('La cantidad debe ser mayor a 0', 'error');
                return;
            }
            
            const response = await apiFetch('../../api/stock.php', {
                method: 'PUT',
                body: JSON.stringify({
                    id_producto: parseInt(productId),
                    cantidad: parseInt(quantity),
                    operacion: 'agregar'
                })
            });
            
            const data = await handleResponse(response);
            showMessage(data.message, data.success ? 'success' : 'error');
            if (data.success) {
                loadStock();
                loadProducts(); // Refresh products table too
                // Limpiar el input
                document.querySelector(`.stock-quantity[data-id="${productId}"]`).value = 0;
            }
        } catch (error) {
            console.error('Error updating stock:', error);
            showMessage('Error al actualizar el stock: ' + error.message, 'error');
        }
    }

    // --- Orders Section --- //
    async function loadOrders() {
        try {
            await loadDeliveryForSelect();
            
            const response = await apiFetch('../../api/orders.php');
            const data = await handleResponse(response);
            
            if (!data || !Array.isArray(data)) {
                const tableBody = document.getElementById('ordersTableBody');
                if (tableBody) {
                    tableBody.innerHTML = '<tr><td colspan="8" class="text-center">No hay pedidos</td></tr>';
                }
                return;
            }
            
            // Función para renderizar una fila
            const renderRow = (item) => {
                const statusBadge = getStatusBadge(item.status);
                const paymentBadge = item.pago_confirmado 
                    ? '<span class="badge bg-success">Confirmado</span>' 
                    : '<span class="badge bg-warning">Pendiente</span>';
                
                const row = document.createElement('tr');
                row.setAttribute('data-status', item.status);
                row.innerHTML = `
                    <td>${item.id}</td>
                    <td>${item.customerName}</td>
                    <td>${item.fecha_pedido || '-'}</td>
                    <td>Bs. ${parseFloat(item.price).toFixed(2)}</td>
                    <td>${statusBadge}</td>
                    <td>${paymentBadge}</td>
                    <td>${item.repartidorNombre || '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-primary view-order" data-id="${item.id}" title="Ver Detalles">
                            <i class="bi bi-eye"></i>
                        </button>
                        ${item.status === 'completed' ? '' : `
                        <button class="btn btn-sm btn-success change-status" data-id="${item.id_pedido}" data-status="${item.status}" title="Cambiar Estado">
                            <i class="bi bi-arrow-repeat"></i>
                        </button>
                        `}
                    </td>
                `;
                
                // Agregar event listeners
                row.querySelector('.view-order')?.addEventListener('click', () => viewOrderDetails(item.id));
                row.querySelector('.change-status')?.addEventListener('click', () => {
                    const orderId = 'ORD-' + String(item.id_pedido).padStart(3, '0');
                    viewOrderDetails(orderId);
                });
                
                return row;
            };
            
            // Inicializar paginación
            initPagination('ordersTableBody', data, renderRow, 6);
            
            // Filter functionality - aplicar filtro a los datos antes de paginar
            const filterElement = document.getElementById('orderStatusFilter');
            if (filterElement && !filterElement.hasAttribute('data-listener-added')) {
                filterElement.setAttribute('data-listener-added', 'true');
                filterElement.addEventListener('change', function(e) {
                    const filterValue = e.target.value;
                    const filteredData = filterValue ? data.filter(item => item.status === filterValue) : data;
                    initPagination('ordersTableBody', filteredData, renderRow, 6);
                });
            }
        } catch (error) {
            console.error('Error loading orders:', error);
        }
    }

    // Estados válidos estandarizados
    const validOrderStates = ['pending', 'preparing', 'ready_for_delivery', 'out_for_delivery', 'completed', 'cancelled'];
    
    // Transiciones de estado permitidas
    const allowedStateTransitions = {
        'pending': ['preparing', 'cancelled'],
        'preparing': ['ready_for_delivery', 'cancelled'],
        'ready_for_delivery': ['out_for_delivery', 'cancelled'],
        'out_for_delivery': ['completed', 'cancelled'],
        'completed': [], // No se puede cambiar desde completado
        'cancelled': [] // No se puede cambiar desde cancelado
    };
    
    // Función para validar si una transición de estado es permitida
    function isValidStateTransition(currentStatus, newStatus) {
        // Si el estado actual no tiene transiciones definidas, no permitir cambios
        if (!allowedStateTransitions[currentStatus]) {
            return false;
        }
        // Permitir si el nuevo estado está en la lista de transiciones permitidas
        return allowedStateTransitions[currentStatus].includes(newStatus);
    }
    
    // Función para obtener estados disponibles según el estado actual
    function getAvailableStates(currentStatus) {
        if (!currentStatus || !allowedStateTransitions[currentStatus]) {
            return validOrderStates;
        }
        // Incluir el estado actual y los estados permitidos
        return [currentStatus, ...allowedStateTransitions[currentStatus]];
    }
    
    function getStatusBadge(status) {
        const statusMap = {
            'pending': '<span class="badge bg-warning">Pendiente</span>',
            'preparing': '<span class="badge bg-info">En Preparación</span>',
            'ready_for_delivery': '<span class="badge bg-primary">Listo para Entrega</span>',
            'out_for_delivery': '<span class="badge bg-secondary">En Camino</span>',
            'completed': '<span class="badge bg-success">Completado</span>',
            'cancelled': '<span class="badge bg-danger">Cancelado</span>'
        };
        return statusMap[status] || `<span class="badge bg-secondary">${status}</span>`;
    }
    
    function getStatusLabel(status) {
        const statusLabels = {
            'pending': 'Pendiente',
            'preparing': 'En Preparación',
            'ready_for_delivery': 'Listo para Entrega',
            'out_for_delivery': 'En Camino',
            'completed': 'Completado',
            'cancelled': 'Cancelado'
        };
        return statusLabels[status] || status;
    }

    async function viewOrderDetails(orderId) {
        try {
            const response = await apiFetch(`../../api/orders.php?id=${orderId}`);
            const order = await handleResponse(response);
            
            if (!order) {
                showMessage('Pedido no encontrado', 'error');
                return;
            }
            
            const modalContent = document.getElementById('orderDetailsContent');
            let productsHtml = '';
            if (order.products && Array.isArray(order.products) && order.products.length > 0) {
                productsHtml = '<table class="table table-sm"><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio Unit.</th><th>Subtotal</th></tr></thead><tbody>';
                order.products.forEach(product => {
                    const cantidad = parseInt(product.cantidad_producto) || 0;
                    const precio = parseFloat(product.precio_u) || 0;
                    const subtotal = precio * cantidad;
                    productsHtml += `<tr><td>${product.nombre || 'Producto desconocido'}</td><td>${cantidad}</td><td>Bs. ${precio.toFixed(2)}</td><td>Bs. ${subtotal.toFixed(2)}</td></tr>`;
                });
                productsHtml += '</tbody></table>';
            } else {
                productsHtml = '<p class="text-muted">No hay productos registrados para este pedido.</p>';
            }
            
            // Separar comprobantes de pago y fotos de entrega
            const paymentReceipts = order.receipts ? order.receipts.filter(r => !r.tipo_comprobante || r.tipo_comprobante === 'pago') : [];
            const deliveryPhotos = order.receipts ? order.receipts.filter(r => r.tipo_comprobante === 'entrega') : [];
            
            // Generar HTML para comprobantes de pago
            let receiptsHtml = '';
            if (paymentReceipts.length > 0) {
                receiptsHtml = '<div class="row mt-3">';
                paymentReceipts.forEach((receipt, index) => {
                    const receiptUrl = `../../${receipt.ruta_archivo}`;
                    const isImage = receipt.tipo_archivo && receipt.tipo_archivo.startsWith('image/');
                    const fileSize = receipt.tamano_archivo ? (receipt.tamano_archivo / 1024).toFixed(2) + ' KB' : 'N/A';
                    const uploadDate = receipt.fecha_subida ? new Date(receipt.fecha_subida).toLocaleString('es-BO') : 'N/A';
                    
                    receiptsHtml += `
                        <div class="col-md-6 mb-3">
                            <div class="card">
                                <div class="card-header">
                                    <h6 class="mb-0">Comprobante de Pago ${index + 1}</h6>
                                    <small class="text-muted">Subido: ${uploadDate}</small>
                                </div>
                                <div class="card-body text-center">
                                    ${isImage ? `
                                        <img src="${receiptUrl}" alt="Comprobante" class="img-fluid mb-2" style="max-height: 300px; cursor: pointer;" 
                                             onclick="window.open('${receiptUrl}', '_blank')">
                                    ` : `
                                        <div class="p-4">
                                            <i class="bi bi-file-earmark-pdf" style="font-size: 3rem; color: #dc3545;"></i>
                                            <p class="mt-2">Archivo PDF</p>
                                            <a href="${receiptUrl}" target="_blank" class="btn btn-sm btn-primary">
                                                <i class="bi bi-download"></i> Ver/Descargar
                                            </a>
                                        </div>
                                    `}
                                    <div class="mt-2">
                                        <small class="text-muted">Tamaño: ${fileSize}</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                });
                receiptsHtml += '</div>';
            } else {
                receiptsHtml = '<p class="text-muted mt-3">No hay comprobantes de pago subidos para este pedido.</p>';
            }
            
            // Generar HTML para fotos de entrega
            let deliveryPhotosHtml = '';
            if (deliveryPhotos.length > 0) {
                deliveryPhotosHtml = '<div class="row mt-3">';
                deliveryPhotos.forEach((photo, index) => {
                    const photoUrl = `../../${photo.ruta_archivo}`;
                    const fileSize = photo.tamano_archivo ? (photo.tamano_archivo / 1024).toFixed(2) + ' KB' : 'N/A';
                    const uploadDate = photo.fecha_subida ? new Date(photo.fecha_subida).toLocaleString('es-BO') : 'N/A';
                    
                    deliveryPhotosHtml += `
                        <div class="col-md-6 mb-3">
                            <div class="card border-success">
                                <div class="card-header bg-success text-white">
                                    <h6 class="mb-0"><i class="bi bi-camera"></i> Foto de Entrega ${index + 1}</h6>
                                    <small>Subida: ${uploadDate}</small>
                                </div>
                                <div class="card-body text-center">
                                    <img src="${photoUrl}" alt="Foto de entrega" class="img-fluid mb-2" style="max-height: 300px; cursor: pointer;" 
                                         onclick="window.open('${photoUrl}', '_blank')">
                                    <div class="mt-2">
                                        <small class="text-muted">Tamaño: ${fileSize}</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                });
                deliveryPhotosHtml += '</div>';
            } else {
                deliveryPhotosHtml = '<p class="text-muted mt-3">No hay fotos de entrega registradas para este pedido.</p>';
            }
            
            modalContent.innerHTML = `
                <div class="row">
                    <div class="col-md-6">
                        <h6>Información del Cliente</h6>
                        <p><strong>Nombre:</strong> ${order.customerName}</p>
                        <p><strong>Email:</strong> ${order.customerEmail || '-'}</p>
                        <p><strong>Teléfono:</strong> ${order.customerPhone || '-'}</p>
                        <p><strong>Dirección:</strong> ${order.address}</p>
                    </div>
                    <div class="col-md-6">
                        <h6>Información del Pedido</h6>
                        <p><strong>ID:</strong> ${order.id}</p>
                        <p><strong>Fecha:</strong> ${order.fecha_pedido}</p>
                        <p><strong>Estado:</strong> ${getStatusBadge(order.status)}</p>
                        <p><strong>Método de Pago:</strong> ${order.paymentType}</p>
                        <p><strong>Pago Confirmado:</strong> ${order.pago_confirmado ? 'Sí' : 'No'}</p>
                        <p><strong>Repartidor:</strong> ${order.repartidorNombre || 'No asignado'}</p>
                        <p><strong>Total:</strong> Bs. ${parseFloat(order.price).toFixed(2)}</p>
                    </div>
                </div>
                <div class="mt-3">
                    <h6>Productos</h6>
                    ${productsHtml || '<p>No hay productos en este pedido</p>'}
                </div>
                <div class="mt-3">
                    <h6><i class="bi bi-receipt"></i> Comprobantes de Pago</h6>
                    ${receiptsHtml}
                </div>
                <div class="mt-3">
                    <h6><i class="bi bi-camera"></i> Fotos de Entrega</h6>
                    ${deliveryPhotosHtml}
                </div>
                ${order.status === 'completed' ? `
                <div class="alert alert-info mt-3">
                    <i class="bi bi-info-circle"></i> Este pedido ya ha sido entregado y no puede ser modificado.
                </div>
                ` : `
                <div class="mt-3">
                    <h6>Cambiar Estado</h6>
                    <select class="form-select mb-2" id="changeOrderStatus">
                        ${getAvailableStates(order.status).map(state => 
                            `<option value="${state}" ${state === order.status ? 'selected' : ''}>${getStatusLabel(state)}</option>`
                        ).join('')}
                    </select>
                    <button class="btn btn-primary mb-3" onclick="changeOrderStatusFromModal(${order.id_pedido})">Cambiar Estado</button>
                </div>
                <div class="mt-3">
                    <label class="form-label">Asignar Repartidor</label>
                    <select class="form-select" id="assignDelivery">
                        <option value="">Seleccionar repartidor...</option>
                    </select>
                    <button class="btn btn-primary mt-2" onclick="assignDeliveryToOrder(${order.id_pedido})">Asignar</button>
                </div>
                <div class="mt-3">
                    <label class="form-label">Confirmar Pago</label>
                    <button class="btn btn-success" onclick="confirmPayment(${order.id_pedido}, ${order.pago_confirmado ? 'false' : 'true'})">
                        ${order.pago_confirmado ? 'Marcar como No Pagado' : 'Confirmar Pago'}
                    </button>
                </div>
                `}
            `;
            
            // Load delivery options
            await loadDeliveryForSelect('assignDelivery');
            
            const modal = new bootstrap.Modal(document.getElementById('orderDetailsModal'));
            modal.show();
        } catch (error) {
            console.error('Error loading order details:', error);
            showMessage('Error al cargar los detalles del pedido', 'error');
        }
    }

    window.assignDeliveryToOrder = async function(orderId) {
        const deliveryId = document.getElementById('assignDelivery').value;
        if (!deliveryId) {
            showMessage('Seleccione un repartidor', 'error');
            return;
        }
        
        try {
            const response = await apiFetch('../../api/orders.php', {
                method: 'PUT',
                body: JSON.stringify({
                    id_pedido: orderId,
                    repartidor_id: parseInt(deliveryId)
                })
            });
            
            const data = await handleResponse(response);
            showMessage(data.message, data.success ? 'success' : 'error');
            if (data.success) {
                loadOrders();
                viewOrderDetails('ORD-' + String(orderId).padStart(3, '0'));
            }
        } catch (error) {
            console.error('Error assigning delivery:', error);
            showMessage('Error al asignar repartidor', 'error');
        }
    };
    
    window.changeOrderStatusFromModal = async function(orderId) {
        const newStatus = document.getElementById('changeOrderStatus').value;
        const currentStatus = document.querySelector('[data-order-id="' + orderId + '"]')?.getAttribute('data-status') || 
                              document.getElementById('changeOrderStatus').querySelector('option[selected]')?.value;
        
        // Validar transición de estado
        if (currentStatus && !isValidStateTransition(currentStatus, newStatus) && currentStatus !== newStatus) {
            showMessage('No se puede cambiar de "' + getStatusLabel(currentStatus) + '" a "' + getStatusLabel(newStatus) + '". Transición no permitida.', 'error');
            return;
        }
        
        if (!confirm(`¿Cambiar estado del pedido de "${getStatusLabel(currentStatus)}" a "${getStatusLabel(newStatus)}"?`)) return;
        
        try {
            const response = await apiFetch('../../api/orders.php', {
                method: 'PUT',
                body: JSON.stringify({
                    id_pedido: parseInt(orderId),
                    estado: newStatus
                })
            });
            
            const data = await handleResponse(response);
            showMessage(data.message, data.success ? 'success' : 'error');
            
            if (data.success) {
                loadOrders();
                viewOrderDetails('ORD-' + String(orderId).padStart(3, '0'));
            }
        } catch (error) {
            console.error('Error changing order status:', error);
            showMessage('Error al cambiar el estado del pedido', 'error');
        }
    };
    
    window.confirmPayment = async function(orderId, confirm) {
        if (!confirm(confirm ? '¿Confirmar pago de este pedido?' : '¿Marcar este pedido como no pagado?')) return;
        
        try {
            const response = await apiFetch('../../api/orders.php', {
                method: 'PUT',
                body: JSON.stringify({
                    id_pedido: parseInt(orderId),
                    pago_confirmado: confirm
                })
            });
            
            const data = await handleResponse(response);
            showMessage(data.message, data.success ? 'success' : 'error');
            
            if (data.success) {
                loadOrders();
                viewOrderDetails('ORD-' + String(orderId).padStart(3, '0'));
            }
        } catch (error) {
            console.error('Error confirming payment:', error);
            showMessage('Error al confirmar el pago', 'error');
        }
    };

    function showChangeStatusModal(orderId, currentStatus) {
        // Abrir modal de detalles del pedido que ya tiene el selector de estado
        viewOrderDetails('ORD-' + String(orderId).padStart(3, '0'));
    }

    // --- Users Section --- //
    async function loadUsers() {
        try {
            await loadRolesForSelect('userRole');
            await loadRolesForSelect('editUserRole');
            await loadBranchesForSelect('userBranch', { placeholderText: 'Selecciona una sucursal...' });
            await loadBranchesForSelect('editUserBranch', { placeholderText: 'Selecciona una sucursal...' });
            toggleBranchField(document.getElementById('userRole'), 'userBranchWrapper');
            toggleBranchField(document.getElementById('editUserRole'), 'editUserBranchWrapper');
            
            const response = await apiFetch('../../api/users.php');
            const data = await handleResponse(response);
            
            if (!data || !Array.isArray(data)) {
                allUsersData = [];
            } else {
                allUsersData = data.map(user => ({
                    ...user,
                    activa: user && user.activa !== undefined ? parseInt(user.activa, 10) : 0,
                    sucursal_id: user && user.sucursal_id !== undefined && user.sucursal_id !== null
                        ? parseInt(user.sucursal_id, 10)
                        : null,
                    sucursal_nombre: user?.sucursal_nombre ?? null
                })).sort((a, b) => {
                    // Ordenar por ID de usuario (ascendente)
                    const idA = parseInt(a.id_usuario) || 0;
                    const idB = parseInt(b.id_usuario) || 0;
                    return idA - idB;
                });
            }
            
            renderUsersTable();
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }

    function getFilteredUsers() {
        if (!Array.isArray(allUsersData)) return [];
        switch (userStatusFilter) {
            case 'inactive':
                return allUsersData.filter(user => (user.activa ?? 0) === 0);
            case 'all':
                return [...allUsersData];
            case 'active':
            default:
                return allUsersData.filter(user => (user.activa ?? 0) === 1);
        }
    }

    function updateUserFilterButtons() {
        const filtersContainer = document.getElementById('userStatusFilters');
        if (!filtersContainer) return;
        filtersContainer.querySelectorAll('button[data-filter]').forEach(button => {
            if (button.dataset.filter === userStatusFilter) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }

    function renderUsersTable() {
        updateUserFilterButtons();
        
        const filtered = getFilteredUsers();
        const tableBody = document.getElementById('usersTableBody');
        
        if (!tableBody) return;
        
        if (filtered.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No hay usuarios para este filtro</td></tr>';
            const paginationContainer = document.getElementById('usersTableBodyPagination');
            if (paginationContainer) paginationContainer.innerHTML = '';
        } else {
            tableBody.innerHTML = '';
            const renderRow = (item) => {
                const isActive = (item.activa ?? 0) === 1;
                const statusBadge = isActive 
                    ? '<span class="badge bg-success">Activo</span>' 
                    : '<span class="badge bg-danger">Inactivo</span>';
                const branchDisplay = item.sucursal_nombre 
                    ? item.sucursal_nombre
                    : (item.sucursal_id ? `Sucursal #${item.sucursal_id}` : 'Sin asignar');
                const branchLabel = escapeText(branchDisplay);
                
                const row = document.createElement('tr');
                let actionsHtml = `
                    <button class="btn btn-sm btn-primary edit-user" data-id="${item.id_usuario}" title="Editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-warning reset-password" data-id="${item.id_usuario}" title="Restablecer Contraseña">
                        <i class="bi bi-key"></i>
                    </button>
                    <button class="btn btn-sm btn-danger delete-user" data-id="${item.id_usuario}" title="Desactivar">
                        <i class="bi bi-person-dash"></i>
                    </button>
                `;
                
                if (!isActive) {
                    actionsHtml = `
                        <button class="btn btn-sm btn-success activate-user" data-id="${item.id_usuario}" title="Activar">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>
                        <button class="btn btn-sm btn-secondary edit-user" data-id="${item.id_usuario}" title="Editar">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-warning reset-password" data-id="${item.id_usuario}" title="Restablecer Contraseña">
                            <i class="bi bi-key"></i>
                        </button>
                    `;
                }
                
                row.innerHTML = `
                    <td>${item.id_usuario}</td>
                    <td>${escapeText(item.nombre || '')}</td>
                    <td>${escapeText(item.correo_electronico || '')}</td>
                    <td>${escapeText(item.telefono || '-')}</td>
                    <td>${escapeText(item.rol_nombre || '')}</td>
                    <td>${branchLabel}</td>
                    <td>${statusBadge}</td>
                    <td class="d-flex gap-2 flex-wrap">
                        ${actionsHtml}
                    </td>
                `;
                
                row.querySelector('.edit-user')?.addEventListener('click', () => editUser(item.id_usuario));
                row.querySelector('.delete-user')?.addEventListener('click', () => deleteUser(item.id_usuario));
                row.querySelector('.activate-user')?.addEventListener('click', () => activateUser(item.id_usuario));
                row.querySelector('.reset-password')?.addEventListener('click', () => resetUserPassword(item.id_usuario));
                
                return row;
            };
            
            if (paginationState['usersTableBody']) {
                paginationState['usersTableBody'].currentPage = 1;
            }
            initPagination('usersTableBody', filtered, renderRow, 6);
        }
        
        const summary = document.getElementById('usersStatusSummary');
        if (summary) {
            let label = 'activos';
            if (userStatusFilter === 'inactive') label = 'inactivos';
            else if (userStatusFilter === 'all') label = 'en total';
            summary.textContent = `Mostrando ${filtered.length} usuario(s) ${label}`;
        }
    }

    async function loadRolesForSelect(selectId) {
        try {
            const response = await apiFetch('../../api/roles.php');
            const roles = await handleResponse(response);
            const select = document.getElementById(selectId);
            if (!select) return;
            
            const currentValue = select.value;
            select.innerHTML = '<option value="">Seleccionar rol...</option>';
            
            if (roles && Array.isArray(roles)) {
                roles.forEach(role => {
                    if (role && role.id_rol && role.nombre) {
                        const option = document.createElement('option');
                        option.value = role.id_rol;
                        option.textContent = role.nombre;
                    option.dataset.roleName = (role.nombre || '').toLowerCase();
                        select.appendChild(option);
                    }
                });
            }
            
            if (currentValue) select.value = currentValue;
        } catch (error) {
            console.error('Error loading roles:', error);
            showMessage('Error al cargar los roles', 'error');
        }
    }

    document.getElementById('addUserForm')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        try {
            const firstNameInput = document.getElementById('userFirstName');
            const lastNameInput = document.getElementById('userLastName');
            const emailInput = document.getElementById('userEmail');
            const phoneInput = document.getElementById('userPhone');
            const addressInput = document.getElementById('userAddress');
            const passwordInput = document.getElementById('userPassword');
            const userRoleSelect = document.getElementById('userRole');
            const rolId = userRoleSelect ? userRoleSelect.value : '';
            
            // Validación frontend
            if (!rolId) {
                showMessage('Debe seleccionar un rol', 'error');
                return;
            }
            
            // Validar todos los campos (verificar que las funciones existan)
            if (typeof validateNameField === 'function' && !validateNameField(firstNameInput)) return;
            if (lastNameInput.value.trim() && typeof validateNameField === 'function' && !validateNameField(lastNameInput)) return;
            if (typeof validateEmailField === 'function' && !validateEmailField(emailInput)) return;
            if (phoneInput.value.trim() && typeof validatePhoneField === 'function' && !validatePhoneField(phoneInput)) return;
            if (addressInput.value.trim() && typeof validateAddressField === 'function' && !validateAddressField(addressInput)) return;
            if (typeof validatePasswordField === 'function' && !validatePasswordField(passwordInput)) return;
            
            const email = emailInput.value.trim();
            
            const ciInput = document.getElementById('userCI');
            const ciValue = ciInput ? ciInput.value.trim() : '';
            
            // Validar C.I. si se proporciona
            if (ciValue) {
                const ciRegex = /^[0-9]{5,15}$/;
                if (!ciRegex.test(ciValue)) {
                    showMessage('El C.I. debe contener solo números (5-15 dígitos)', 'error');
                    if (ciInput) {
                        ciInput.classList.add('is-invalid');
                    }
                    return;
                }
                if (ciInput) {
                    ciInput.classList.remove('is-invalid');
                }
            }
            
            const userBranchSelect = document.getElementById('userBranch');
            const isVendor = isVendorRoleName(getSelectedRoleName(userRoleSelect));
            let sucursalId = null;
            if (isVendor) {
                if (!userBranchSelect || !userBranchSelect.value) {
                    if (userBranchSelect) {
                        userBranchSelect.classList.add('is-invalid');
                    }
                    showMessage('Debe seleccionar una sucursal para asignar al vendedor.', 'error');
                    return;
                }
                sucursalId = parseInt(userBranchSelect.value, 10);
                userBranchSelect.classList.remove('is-invalid');
            } else if (userBranchSelect) {
                userBranchSelect.classList.remove('is-invalid');
            }

            const nombreCompleto = [firstNameInput.value.trim(), lastNameInput.value.trim()].filter(Boolean).join(' ');
            const formData = {
                nombre: nombreCompleto,
                correo_electronico: email,
                contrasena: document.getElementById('userPassword').value,
                telefono: document.getElementById('userPhone').value.trim() || '',
                direccion: document.getElementById('userAddress').value.trim() || '',
                fecha_cumpleaños: document.getElementById('userBirthday').value || null,
                ci: ciValue || '',
                rol_id: parseInt(rolId),
                sucursal_id: sucursalId
            };
            
            if (!formData.nombre || !formData.correo_electronico || !formData.contrasena) {
                showMessage('Nombre, email y contraseña son requeridos', 'error');
                return;
            }
            
            const response = await apiFetch('../../api/users.php', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            
            const data = await handleResponse(response);
            showMessage(data.message, data.success ? 'success' : 'error');
            
            if (data.success) {
                loadUsers();
                this.reset();
                toggleBranchField(document.getElementById('userRole'), 'userBranchWrapper');
                const tab = new bootstrap.Tab(document.querySelector('a[href="#view-users"]'));
                tab.show();
            }
        } catch (error) {
            console.error('Error adding user:', error);
            showMessage('Error al agregar el usuario: ' + error.message, 'error');
        }
    });

    async function editUser(id) {
        try {
            await loadRolesForSelect('editUserRole');
            await loadBranchesForSelect('editUserBranch', { placeholderText: 'Selecciona una sucursal...' });
            
            const response = await apiFetch(`../../api/users.php?id=${id}`);
            const user = await handleResponse(response);
            
            if (!user) {
                showMessage('Usuario no encontrado', 'error');
                return;
            }
            
            document.getElementById('editUserId').value = user.id_usuario;
            const splitName = splitFullName(user.nombre || '');
            document.getElementById('editUserFirstName').value = splitName.firstName;
            document.getElementById('editUserLastName').value = splitName.lastName;
            document.getElementById('editUserEmail').value = user.correo_electronico || '';
            document.getElementById('editUserPhone').value = user.telefono || '';
            document.getElementById('editUserAddress').value = user.direccion || '';
            document.getElementById('editUserBirthday').value = user.fecha_cumpleaños || '';
            document.getElementById('editUserRole').value = user.rol_id || '';
            const editUserCI = document.getElementById('editUserCI');
            if (editUserCI) {
                editUserCI.value = user.ci || '';
            }
            document.getElementById('editUserPassword').value = '';
            const editBranchSelect = document.getElementById('editUserBranch');
            if (editBranchSelect) {
                editBranchSelect.value = user.sucursal_id ?? '';
            }
            toggleBranchField(document.getElementById('editUserRole'), 'editUserBranchWrapper');
            
            const modal = new bootstrap.Modal(document.getElementById('editUserModal'));
            modal.show();
        } catch (error) {
            console.error('Error loading user:', error);
            showMessage('Error al cargar el usuario: ' + error.message, 'error');
        }
    }

    document.getElementById('editUserForm')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        try {
            const firstNameInput = document.getElementById('editUserFirstName');
            const lastNameInput = document.getElementById('editUserLastName');
            const emailInput = document.getElementById('editUserEmail');
            const phoneInput = document.getElementById('editUserPhone');
            const addressInput = document.getElementById('editUserAddress');
            const passwordInput = document.getElementById('editUserPassword');
            
            // Validar todos los campos (verificar que las funciones existan)
            if (typeof validateNameField === 'function' && !validateNameField(firstNameInput)) return;
            if (lastNameInput.value.trim() && typeof validateNameField === 'function' && !validateNameField(lastNameInput)) return;
            if (typeof validateEmailField === 'function' && !validateEmailField(emailInput)) return;
            if (phoneInput.value.trim() && typeof validatePhoneField === 'function' && !validatePhoneField(phoneInput)) return;
            if (addressInput.value.trim() && typeof validateAddressField === 'function' && !validateAddressField(addressInput)) return;
            if (passwordInput.value && typeof validatePasswordField === 'function' && !validatePasswordField(passwordInput)) return;
            
            const email = emailInput.value.trim();
            
            const editUserCI = document.getElementById('editUserCI');
            const ciValue = editUserCI ? editUserCI.value.trim() : '';
            
            // Validar C.I. si se proporciona
            if (ciValue) {
                const ciRegex = /^[0-9]{5,15}$/;
                if (!ciRegex.test(ciValue)) {
                    showMessage('El C.I. debe contener solo números (5-15 dígitos)', 'error');
                    if (editUserCI) {
                        editUserCI.classList.add('is-invalid');
                    }
                    return;
                }
                if (editUserCI) {
                    editUserCI.classList.remove('is-invalid');
                }
            }
            
            const editUserRoleSelect = document.getElementById('editUserRole');
            const editBranchSelect = document.getElementById('editUserBranch');
            const isVendor = isVendorRoleName(getSelectedRoleName(editUserRoleSelect));
            let editSucursalId = null;
            if (isVendor) {
                if (!editBranchSelect || !editBranchSelect.value) {
                    if (editBranchSelect) {
                        editBranchSelect.classList.add('is-invalid');
                    }
                    showMessage('Debe seleccionar una sucursal para los vendedores.', 'error');
                    return;
                }
                editSucursalId = parseInt(editBranchSelect.value, 10);
                editBranchSelect.classList.remove('is-invalid');
            } else if (editBranchSelect) {
                editBranchSelect.classList.remove('is-invalid');
            }

            const nombreCompleto = [firstNameInput.value.trim(), lastNameInput.value.trim()].filter(Boolean).join(' ');
            const userId = parseInt(document.getElementById('editUserId').value);
            if (!userId || isNaN(userId)) {
                showMessage('ID de usuario inválido', 'error');
                return;
            }
            
            const formData = {
                id: userId,
                nombre: nombreCompleto,
                correo_electronico: email,
                telefono: document.getElementById('editUserPhone').value.trim() || '',
                direccion: document.getElementById('editUserAddress').value.trim() || '',
                fecha_cumpleaños: document.getElementById('editUserBirthday').value || null,
                ci: ciValue || '',
                rol_id: parseInt(document.getElementById('editUserRole').value),
                contrasena: document.getElementById('editUserPassword').value || '',
                sucursal_id: editSucursalId
            };
            
            if (!formData.nombre || !formData.correo_electronico || !formData.rol_id) {
                showMessage('Nombre, email y rol son requeridos', 'error');
                return;
            }
            
            const response = await apiFetch('../../api/users.php', {
                method: 'PUT',
                body: JSON.stringify(formData)
            });
            
            const data = await handleResponse(response);
            showMessage(data.message, data.success ? 'success' : 'error');
            
            if (data.success) {
                loadUsers();
                const modal = bootstrap.Modal.getInstance(document.getElementById('editUserModal'));
                modal.hide();
            }
        } catch (error) {
            console.error('Error updating user:', error);
            showMessage('Error al actualizar el usuario: ' + error.message, 'error');
        }
    });

    async function activateUser(id) {
        try {
            const response = await apiFetch(`../../api/users.php?id=${id}`);
            const user = await handleResponse(response);
            
            if (!user) {
                showMessage('Usuario no encontrado', 'error');
                return;
            }
            
            const payload = {
                id: user.id_usuario,
                nombre: user.nombre || '',
                correo_electronico: user.correo_electronico || '',
                telefono: user.telefono || '',
                direccion: user.direccion || '',
                fecha_cumpleaños: user.fecha_cumpleaños ?? null,
                rol_id: user.rol_id !== undefined ? parseInt(user.rol_id, 10) || user.rol_id : user.rol_id,
                contrasena: '',
                activa: 1,
                sucursal_id: user.sucursal_id ?? null
            };
            
            const updateResponse = await apiFetch('../../api/users.php', {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            
            const result = await handleResponse(updateResponse);
            showMessage(result.message || 'Usuario activado exitosamente.', result.success ? 'success' : 'error');
            
            if (result.success) {
                await loadUsers();
            }
        } catch (error) {
            console.error('Error activating user:', error);
            showMessage('Error al activar el usuario: ' + error.message, 'error');
        }
    }

    async function deleteUser(id) {
        // Obtener información del usuario antes de eliminar
        try {
            const userResponse = await apiFetch(`../../api/users.php?id=${id}`);
            const user = await handleResponse(userResponse);
            
            if (!user) {
                showMessage('Usuario no encontrado', 'error');
                return;
            }
            
            // Verificar si es el usuario actual
            const sessionResponse = await apiFetch('../../api/session_check.php');
            const sessionData = await sessionResponse.json();
            
            if (sessionData.success && sessionData.user && sessionData.user.id == id) {
                showMessage('No puede desactivar su propia cuenta. Otro administrador debe hacerlo.', 'error');
                return;
            }
            
            const confirmMessage = `¿Estás seguro de que quieres desactivar al usuario "${user.nombre}"?${sessionData.user && sessionData.user.id == id ? '\n\nADVERTENCIA: No puede desactivar su propia cuenta.' : ''}`;
            
            if (!confirm(confirmMessage)) return;
            
            const response = await apiFetch(`../../api/users.php?id=${id}`, { method: 'DELETE' });
            const data = await handleResponse(response);
            showMessage(data.message, data.success ? 'success' : 'error');
            
            if (data.success) {
                userStatusFilter = 'inactive';
                await loadUsers();
                
                // Si se desactivó el usuario actual, mostrar advertencia
                if (sessionData.user && sessionData.user.id == id) {
                    setTimeout(() => {
                        notifyAdmin('Su cuenta ha sido desactivada. Será redirigido al login.', 'warning');
                        window.location.href = '../../Index.html';
                    }, 1000);
                }
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            if (error.message && error.message.includes('No puede desactivar')) {
                showMessage(error.message, 'error');
            } else {
                showMessage('Error al eliminar el usuario: ' + error.message, 'error');
            }
        }
    }

    async function resetUserPassword(id) {
        try {
            const userResponse = await apiFetch(`../../api/users.php?id=${id}`);
            const user = await handleResponse(userResponse);
            
            if (!user) {
                showMessage('Usuario no encontrado', 'error');
                return;
            }
            
            const confirmMessage = `¿Estás seguro de que quieres restablecer la contraseña del usuario "${user.nombre}"?\n\nLa nueva contraseña será su C.I. y se le pedirá cambiarla al iniciar sesión.`;
            
            if (!confirm(confirmMessage)) return;
            
            const response = await apiFetch('../../api/reset_password.php', {
                method: 'POST',
                body: JSON.stringify({ usuario_id: id })
            });
            
            const data = await handleResponse(response);
            showMessage(data.message, data.success ? 'success' : 'error');
            
            if (data.success) {
                await loadUsers();
            }
        } catch (error) {
            console.error('Error resetting password:', error);
            showMessage('Error al restablecer la contraseña: ' + error.message, 'error');
        }
    }

    // --- Branches Section --- //
    async function loadBranches() {
        try {
            const response = await apiFetch('../../api/branches.php');
            const data = await handleResponse(response);
            
            if (!data || !Array.isArray(data)) {
                const tableBody = document.getElementById('branchesTableBody');
                if (tableBody) {
                    tableBody.innerHTML = '<tr><td colspan="7" class="text-center">No hay sucursales registradas</td></tr>';
                }
                return;
            }
            
            // Función para renderizar una fila
            const renderRow = (item) => {
                const isActive = item.activa == 1 || item.activa === true || item.activa === '1';
                const statusBadge = isActive 
                    ? '<span class="badge bg-success">Activa</span>' 
                    : '<span class="badge bg-danger">Inactiva</span>';
                
                const horario = item.horario_apertura && item.horario_cierre 
                    ? `${item.horario_apertura} - ${item.horario_cierre}`
                    : '-';
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${item.id_sucursal}</td>
                    <td>${item.nombre}</td>
                    <td>${item.direccion}</td>
                    <td>${item.telefono || '-'}</td>
                    <td>${horario}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn btn-sm btn-primary edit-branch" data-id="${item.id_sucursal}" title="Editar">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-danger delete-branch" data-id="${item.id_sucursal}" title="Eliminar">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                `;
                
                // Agregar event listeners
                row.querySelector('.edit-branch')?.addEventListener('click', () => editBranch(item.id_sucursal));
                row.querySelector('.delete-branch')?.addEventListener('click', () => deleteBranch(item.id_sucursal));
                
                return row;
            };
            
            // Inicializar paginación
            initPagination('branchesTableBody', data, renderRow, 6);
        } catch (error) {
            console.error('Error loading branches:', error);
        }
    }

    async function loadBranchesForSelect(selectId, options = {}) {
        const placeholderText = options.placeholderText || 'Todas las sucursales';
        try {
            const response = await apiFetch('../../api/branches.php');
            const branches = await handleResponse(response);
            const select = document.getElementById(selectId);
            if (!select) return;
            
            const currentValue = select.value;
            select.innerHTML = `<option value="">${placeholderText}</option>`;
            branches.forEach(branch => {
                // Convertir activa a boolean correctamente
                const isActive = branch.activa == 1 || branch.activa === true || branch.activa === '1';
                if (isActive) {
                    const option = document.createElement('option');
                    option.value = branch.id_sucursal;
                    option.textContent = branch.nombre;
                    select.appendChild(option);
                }
            });
            if (currentValue) select.value = currentValue;
        } catch (error) {
            console.error('Error loading branches for select:', error);
        }
    }

    document.getElementById('addBranchForm')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        try {
            const nameInput = document.getElementById('branchName');
            const addressInput = document.getElementById('branchAddress');
            const phoneInput = document.getElementById('branchPhone');
            
            // Validar campos (verificar que las funciones existan)
            if (typeof validateNameField === 'function' && !validateNameField(nameInput)) return;
            if (typeof validateAddressField === 'function' && !validateAddressField(addressInput)) return;
            if (phoneInput.value.trim() && typeof validatePhoneField === 'function' && !validatePhoneField(phoneInput)) return;
            
            const nombre = nameInput.value.trim();
            const direccion = addressInput.value.trim();
            
            const horarioApertura = document.getElementById('branchOpen').value;
            const horarioCierre = document.getElementById('branchClose').value;
            
            // Validar que si se proporciona un horario, se proporcionen ambos
            if ((horarioApertura && !horarioCierre) || (!horarioApertura && horarioCierre)) {
                showMessage('Debe proporcionar ambos horarios o ninguno', 'error');
                return;
            }
            
            const formData = {
                nombre: nombre,
                direccion: direccion,
                telefono: document.getElementById('branchPhone').value.trim() || '',
                horario_apertura: horarioApertura || null,
                horario_cierre: horarioCierre || null,
                activa: document.getElementById('branchActive').checked ? 1 : 0
            };
            
            const response = await apiFetch('../../api/branches.php', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            
            const data = await handleResponse(response);
            showMessage(data.message, data.success ? 'success' : 'error');
            
            if (data.success) {
                loadBranches();
                this.reset();
                const tab = new bootstrap.Tab(document.querySelector('a[href="#view-branches"]'));
                tab.show();
            }
        } catch (error) {
            console.error('Error adding branch:', error);
            showMessage('Error al agregar la sucursal: ' + error.message, 'error');
        }
    });

    async function ensureBranchTemplate() {
        const container = document.getElementById('editBranchContainer');
        try {
            const html = await fetch('./forms/edit-branch.html').then(r => r.text());
            // Eliminar cualquier instancia previa para evitar IDs duplicados
            document.querySelectorAll('#editBranchCard').forEach(el => el.remove());

            // Si el contenedor no existe, o está dentro de un ancestro oculto (p.ej. modal hidden),
            // inyectamos la plantilla directamente en el body para garantizar que no quede dentro
            // de un contenedor con display:none que provoque bounding rects de tamaño 0.
            let target = container;
            if (container) {
                try {
                    let node = container;
                    let hiddenAncestor = false;
                    while (node) {
                        const cs = getComputedStyle(node);
                        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') {
                            hiddenAncestor = true;
                            break;
                        }
                        node = node.parentElement;
                    }
                    if (hiddenAncestor) target = document.body;
                } catch (err) {
                    console.warn('Error comprobando ancestros del contenedor, inyectando en body', err);
                    target = document.body;
                }
            } else {
                target = document.body;
            }

            // Insertar la plantilla al final del target seleccionado
            target.insertAdjacentHTML('beforeend', html);
        } catch (e) {
            console.error('No se pudo cargar plantilla de sucursal', e);
        }
    }

    // Elimina elementos duplicados por ID para prevenir advertencias y estados inconsistentes
    function escapeSelector(id) {
        try {
            if (window.CSS && CSS.escape) return CSS.escape(id);
        } catch (e) {}
        // Fallback: escape common selector metacharacters
        return id.replace(/([ #.:?+*>~^$\[\](){}\\\/])/g, "\\$1");
    }
    function dedupeEditBranchIds() {
        const ids = [
            'editBranchCard','editBranchForm','editBranchId','editBranchName',
            'editBranchAddress','editBranchPhone','editBranchOpen','editBranchClose',
            'editBranchActive','cancelEditBranch','cancelEditBranchSecondary'
        ];
        ids.forEach(id => {
            const nodes = document.querySelectorAll('#' + escapeSelector(id));
            if (nodes.length > 1) {
                // dejar el primer y eliminar el resto
                Array.from(nodes).slice(1).forEach(n => n.remove());
                const remaining = document.querySelectorAll('#' + escapeSelector(id)).length;
                console.warn(`Limpiado elementos duplicados para id #${id} (quedaron ${remaining})`);
            }
        });
    }

    // Generic dedupe helper for arbitrary ID lists
    function dedupeIds(ids) {
        ids.forEach(id => {
            const nodes = document.querySelectorAll('#' + escapeSelector(id));
            if (nodes.length > 1) {
                Array.from(nodes).slice(1).forEach(n => n.remove());
                const remaining = document.querySelectorAll('#' + escapeSelector(id)).length;
                console.warn(`Limpiado elementos duplicados para id #${id} (quedaron ${remaining})`);
            }
        });
    }

    async function showEditBranchCard() {
        await ensureBranchTemplate();
        dedupeEditBranchIds();
        const card = document.getElementById('editBranchCard');
        if (!card) return;
        card.classList.remove('d-none');
        card.style.display = 'block';
        // Asegurar visibilidad aunque falle el CSS
        card.style.position = 'fixed';
        card.style.top = '80px';
        card.style.right = '20px';
        card.style.width = '420px';
        card.style.maxWidth = '90vw';
        card.style.maxHeight = '80vh';
        card.style.overflow = 'auto';
        card.style.zIndex = '2000';
        console.log('🔎 showEditBranchCard: card appended, id exists:', !!card, 'classes:', card.className);
        try {
            const cs = getComputedStyle(card);
            console.log('🔎 showEditBranchCard: computed display:', cs.display, 'visibility:', cs.visibility, 'opacity:', cs.opacity);
            console.log('🔎 showEditBranchCard: bounding rect:', card.getBoundingClientRect());
        } catch (e) {
            console.warn('🔎 showEditBranchCard: error reading styles', e);
        }
        // Log ancestor computed styles to detect hidden parents
        (function logAncestors(el){
            try {
                let node = el.parentElement;
                while (node) {
                    const cs = getComputedStyle(node);
                    console.log('🔍 ancestor:', node.tagName.toLowerCase(), node.id ? ('#'+node.id) : '', node.className || '', 'display=', cs.display, 'visibility=', cs.visibility, 'opacity=', cs.opacity);
                    node = node.parentElement;
                }
            } catch(err) { console.warn('🔍 error logging ancestors', err); }
        })(card);
    }

    function hideEditBranchCard() {
        const card = document.getElementById('editBranchCard');
        if (!card) return;
        card.classList.add('d-none');
        card.style.display = 'none';
        const form = document.getElementById('editBranchForm');
        if (form) form.reset();
    }

    async function editBranch(id) {
        try {
            console.log('🟦 editBranch inicio, id:', id);
            showEditBranchCard();

            const response = await apiFetch(`../../api/branches.php?id=${id}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const branch = await handleResponse(response);
            
            if (!branch) {
                showMessage('Sucursal no encontrada', 'error');
                hideEditBranchCard();
                return;
            }
            
            document.getElementById('editBranchId').value = branch.id_sucursal;
            document.getElementById('editBranchName').value = branch.nombre;
            document.getElementById('editBranchAddress').value = branch.direccion;
            document.getElementById('editBranchPhone').value = branch.telefono || '';
            
            const formatTime = (timeStr) => {
                if (!timeStr) return '';
                if (timeStr.includes(':') && timeStr.split(':').length === 3) {
                    return timeStr.substring(0, 5);
                }
                return timeStr;
            };
            
            document.getElementById('editBranchOpen').value = formatTime(branch.horario_apertura);
            document.getElementById('editBranchClose').value = formatTime(branch.horario_cierre);
            
            const isActive = branch.activa == 1 || branch.activa === true || branch.activa === '1';
            document.getElementById('editBranchActive').checked = isActive;
            console.log('🟦 editBranch formulario llenado');
            (function(){
                const card = document.getElementById('editBranchCard');
                console.log('🔎 editBranch: card present after fill:', !!card);
                if (card) {
                    try {
                        const cs = getComputedStyle(card);
                        console.log('🔎 editBranch: computed display:', cs.display, 'visibility:', cs.visibility, 'opacity:', cs.opacity);
                        console.log('🔎 editBranch: bounding rect:', card.getBoundingClientRect());
                    } catch(e) { console.warn('🔎 editBranch: cannot read styles', e); }
                }
            })();
        } catch (error) {
            console.error('Error loading branch:', error);
            showMessage('Error al cargar la sucursal', 'error');
            hideEditBranchCard();
        }
    }
    
    document.getElementById('editBranchForm')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        try {
            const nameInput = document.getElementById('editBranchName');
            const addressInput = document.getElementById('editBranchAddress');
            const phoneInput = document.getElementById('editBranchPhone');
            
            // Validar campos (verificar que las funciones existan)
            if (typeof validateNameField === 'function' && !validateNameField(nameInput)) return;
            if (typeof validateAddressField === 'function' && !validateAddressField(addressInput)) return;
            if (phoneInput.value.trim() && typeof validatePhoneField === 'function' && !validatePhoneField(phoneInput)) return;
            
            const nombre = nameInput.value.trim();
            const direccion = addressInput.value.trim();
            
            const horarioApertura = document.getElementById('editBranchOpen').value.trim();
            const horarioCierre = document.getElementById('editBranchClose').value.trim();
            
            // Validar que si se proporciona un horario, se proporcionen ambos
            if ((horarioApertura && !horarioCierre) || (!horarioApertura && horarioCierre)) {
                showMessage('Debe proporcionar ambos horarios o ninguno', 'error');
                return;
            }
            
            // Validar formato de horarios si se proporcionan
            if (horarioApertura && horarioCierre) {
                const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
                if (!timeRegex.test(horarioApertura) || !timeRegex.test(horarioCierre)) {
                    showMessage('Los horarios deben tener el formato HH:MM (ejemplo: 09:00)', 'error');
                    return;
                }
            }
            
            const formData = {
                id: document.getElementById('editBranchId').value,
                nombre: nombre,
                direccion: direccion,
                telefono: document.getElementById('editBranchPhone').value.trim() || '',
                horario_apertura: horarioApertura || null,
                horario_cierre: horarioCierre || null,
                activa: document.getElementById('editBranchActive').checked ? 1 : 0
            };
            
            const response = await apiFetch('../../api/branches.php', {
                method: 'PUT',
                body: JSON.stringify(formData)
            });
            
            const data = await handleResponse(response);
            showMessage(data.message, data.success ? 'success' : 'error');
            
            if (data.success) {
                loadBranches();
                const modal = bootstrap.Modal.getInstance(document.getElementById('editBranchModal'));
                modal.hide();
            }
        } catch (error) {
            console.error('Error updating branch:', error);
            showMessage('Error al actualizar la sucursal: ' + error.message, 'error');
        }
    });

    async function deleteBranch(id) {
        if (!confirm('¿Estás seguro de que quieres desactivar esta sucursal?')) return;
        
        try {
            const response = await apiFetch(`../../api/branches.php?id=${id}`, { method: 'DELETE' });
            const data = await handleResponse(response);
            showMessage(data.message, data.success ? 'success' : 'error');
            if (data.success) loadBranches();
        } catch (error) {
            console.error('Error deleting branch:', error);
            showMessage('Error al eliminar la sucursal', 'error');
        }
    }

    // --- Delivery Section --- //
    async function loadDelivery() {
        const tableBody = document.getElementById('deliveryTableBody');
        
        try {
            const response = await apiFetch('../../api/delivery.php');
            
            // Verificar que la respuesta existe
            if (!response) {
                console.error('No response received from server');
                if (tableBody) {
                    tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">No se recibió respuesta del servidor</td></tr>';
                }
                showMessage('No se recibió respuesta del servidor', 'error');
                return;
            }
            
            // Leer el texto de la respuesta primero
            let responseText;
            try {
                responseText = await response.text();
            } catch (textError) {
                console.error('Error reading response text:', textError);
                if (tableBody) {
                    tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error al leer la respuesta del servidor</td></tr>';
                }
                showMessage('Error al leer la respuesta del servidor', 'error');
                return;
            }
            
            // Verificar si la respuesta está vacía
            if (!responseText || responseText.trim() === '') {
                console.error('Empty response from server. Status:', response.status, 'StatusText:', response.statusText);
                if (tableBody) {
                    tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Respuesta vacía del servidor (Status: ' + response.status + ')</td></tr>';
                }
                showMessage('El servidor no devolvió datos', 'error');
                return;
            }
            
            console.log('Response received:', responseText.substring(0, 200)); // Log primeros 200 caracteres
            
            // Verificar el status de la respuesta
            if (!response.ok) {
                console.error('Error response:', response.status, responseText);
                let errorMessage = 'Error al cargar los repartidores';
                try {
                    const errorData = JSON.parse(responseText);
                    errorMessage = errorData.message || errorMessage;
                } catch (e) {
                    // Si no es JSON, usar el texto directamente
                    errorMessage = responseText || errorMessage;
                }
                const tableBody = document.getElementById('deliveryTableBody');
                tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error al cargar los repartidores</td></tr>';
                showMessage(errorMessage, 'error');
                return;
            }
            
            // Parsear JSON
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error('Error parsing JSON:', parseError);
                console.error('Response text:', responseText);
                const tableBody = document.getElementById('deliveryTableBody');
                tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error al procesar la respuesta del servidor</td></tr>';
                showMessage('Error al procesar la respuesta del servidor. Verifique la consola para más detalles.', 'error');
                return;
            }
            
            // Asegurar que data es un array
            if (!Array.isArray(data)) {
                console.error('Expected array but got:', typeof data, data);
                const tableBody = document.getElementById('deliveryTableBody');
                tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error: formato de respuesta inválido</td></tr>';
                return;
            }
            
            const tableBody = document.getElementById('deliveryTableBody');
            tableBody.innerHTML = '';
            
            if (!data || !Array.isArray(data) || data.length === 0) {
                const tableBody = document.getElementById('deliveryTableBody');
                if (tableBody) {
                    tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No hay repartidores registrados</td></tr>';
                }
                return;
            }
            
            // Función para renderizar una fila
            const renderRow = (item) => {
                const statusBadge = item.estado === 'disponible' 
                    ? '<span class="badge bg-success">Disponible</span>' 
                    : '<span class="badge bg-warning">Ocupado</span>';
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${item.id_repartidor}</td>
                    <td>${item.nombre}</td>
                    <td>${item.telefono || '-'}</td>
                    <td>${item.correo_electronico || '-'}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn btn-sm btn-primary edit-delivery" data-id="${item.id_repartidor}" title="Editar">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-danger delete-delivery" data-id="${item.id_repartidor}" title="Eliminar">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                `;
                
                // Agregar event listeners
                row.querySelector('.edit-delivery')?.addEventListener('click', () => editDelivery(item.id_repartidor));
                row.querySelector('.delete-delivery')?.addEventListener('click', () => deleteDelivery(item.id_repartidor));
                
                return row;
            };
            
            // Inicializar paginación
            initPagination('deliveryTableBody', data, renderRow, 6);
        } catch (error) {
            console.error('Error loading delivery:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            
            const tableBody = document.getElementById('deliveryTableBody');
            if (tableBody) {
                tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error al cargar los repartidores: ' + (error.message || 'Error desconocido') + '</td></tr>';
            }
            
            showMessage('Error al cargar los repartidores: ' + (error.message || 'Error desconocido'), 'error');
        }
    }

    async function loadDeliveryForSelect(selectId = 'assignDelivery') {
        try {
            const response = await apiFetch('../../api/delivery.php');
            const deliveries = await handleResponse(response);
            const select = document.getElementById(selectId);
            if (!select) return;
            
            const currentValue = select.value;
            select.innerHTML = '<option value="">Seleccionar repartidor...</option>';
            deliveries.forEach(delivery => {
                if (delivery.estado === 'disponible') {
                    const option = document.createElement('option');
                    option.value = delivery.id_repartidor;
                    option.textContent = delivery.nombre;
                    select.appendChild(option);
                }
            });
            if (currentValue) select.value = currentValue;
        } catch (error) {
            console.error('Error loading delivery for select:', error);
        }
    }

    document.getElementById('addDeliveryForm')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        try {
            const nameInput = document.getElementById('deliveryName');
            const emailInput = document.getElementById('deliveryEmail');
            const phoneInput = document.getElementById('deliveryPhone');
            
            // Validar campos (verificar que las funciones existan)
            if (typeof validateNameField === 'function' && !validateNameField(nameInput)) return;
            if (emailInput.value.trim() && typeof validateEmailField === 'function' && !validateEmailField(emailInput)) return;
            if (phoneInput.value.trim() && typeof validatePhoneField === 'function' && !validatePhoneField(phoneInput)) return;
            
            const nombre = nameInput.value.trim();
            const email = emailInput.value.trim();
            
            const formData = {
                nombre: nombre,
                telefono: document.getElementById('deliveryPhone').value.trim() || '',
                correo_electronico: email || '',
                estado: document.getElementById('deliveryStatus').value,
                fecha_inicio_trabajo: new Date().toISOString().split('T')[0]
            };
            
            const response = await apiFetch('../../api/delivery.php', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            
            const data = await handleResponse(response);
            showMessage(data.message, data.success ? 'success' : 'error');
            
            if (data.success) {
                // Resetear el formulario primero
                this.reset();
                // Recargar la lista de repartidores
                await loadDelivery();
                // Cambiar a la pestaña de visualización
                const viewTab = document.querySelector('a[href="#view-delivery"]');
                if (viewTab) {
                    const tab = new bootstrap.Tab(viewTab);
                    tab.show();
                }
            }
        } catch (error) {
            console.error('Error adding delivery:', error);
            showMessage('Error al agregar el repartidor: ' + error.message, 'error');
        }
    });

    async function ensureDeliveryTemplate() {
        const container = document.getElementById('editDeliveryContainer');
        try {
            const html = await fetch('./forms/edit-delivery.html').then(r => r.text());
            // Eliminar cualquier instancia previa para evitar IDs duplicados
            document.querySelectorAll('#editDeliveryCard').forEach(el => el.remove());

            // Si el contenedor está dentro de un ancestro oculto, inyectar en body
            let target = container;
            if (container) {
                try {
                    let node = container;
                    let hiddenAncestor = false;
                    while (node) {
                        const cs = getComputedStyle(node);
                        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') {
                            hiddenAncestor = true;
                            break;
                        }
                        node = node.parentElement;
                    }
                    if (hiddenAncestor) target = document.body;
                } catch (err) { target = document.body; }
            } else {
                target = document.body;
            }

            target.insertAdjacentHTML('beforeend', html);
        } catch (e) {
            console.error('No se pudo cargar plantilla de repartidor', e);
        }
    }

    async function showEditDeliveryCard() {
        await ensureDeliveryTemplate();
        // eliminar duplicados si existen
        dedupeIds(['editDeliveryCard','editDeliveryForm','editDeliveryId','editDeliveryName','editDeliveryPhone','editDeliveryEmail','editDeliveryStatus','cancelEditDelivery','cancelEditDeliverySecondary']);
        const card = document.getElementById('editDeliveryCard');
        if (!card) return;
        card.classList.remove('d-none');
        card.style.display = 'block';
        try {
            const cs = getComputedStyle(card);
            console.log('🔎 showEditDeliveryCard: computed display:', cs.display, 'visibility:', cs.visibility, 'opacity:', cs.opacity);
            console.log('🔎 showEditDeliveryCard: bounding rect:', card.getBoundingClientRect());
        } catch(e) { console.warn('🔎 showEditDeliveryCard: cannot read styles', e); }
    }

    function hideEditDeliveryCard() {
        const card = document.getElementById('editDeliveryCard');
        if (!card) return;
        card.classList.add('d-none');
        card.style.display = 'none';
        const form = document.getElementById('editDeliveryForm');
        if (form) form.reset();
    }

    async function editDelivery(id) {
        try {
            console.log('🟪 editDelivery inicio, id:', id);
            showEditDeliveryCard();

            const response = await apiFetch(`../../api/delivery.php?id=${id}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const delivery = await handleResponse(response);
            
            if (!delivery) {
                showMessage('Repartidor no encontrado', 'error');
                hideEditDeliveryCard();
                return;
            }
            
            document.getElementById('editDeliveryId').value = delivery.id_repartidor;
            document.getElementById('editDeliveryName').value = delivery.nombre;
            document.getElementById('editDeliveryPhone').value = delivery.telefono || '';
            document.getElementById('editDeliveryEmail').value = delivery.correo_electronico || '';
            document.getElementById('editDeliveryStatus').value = delivery.estado || 'disponible';
            console.log('🟪 editDelivery formulario llenado');
        } catch (error) {
            console.error('Error loading delivery:', error);
            showMessage('Error al cargar el repartidor', 'error');
            hideEditDeliveryCard();
        }
    }
    
    document.getElementById('editDeliveryForm')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        try {
            const nameInput = document.getElementById('editDeliveryName');
            const emailInput = document.getElementById('editDeliveryEmail');
            const phoneInput = document.getElementById('editDeliveryPhone');
            
            // Validar campos (verificar que las funciones existan)
            if (typeof validateNameField === 'function' && !validateNameField(nameInput)) return;
            if (emailInput.value.trim() && typeof validateEmailField === 'function' && !validateEmailField(emailInput)) return;
            if (phoneInput.value.trim() && typeof validatePhoneField === 'function' && !validatePhoneField(phoneInput)) return;
            
            const nombre = nameInput.value.trim();
            const email = emailInput.value.trim();
            
            const formData = {
                id: document.getElementById('editDeliveryId').value,
                nombre: nombre,
                telefono: document.getElementById('editDeliveryPhone').value.trim() || '',
                correo_electronico: email || '',
                estado: document.getElementById('editDeliveryStatus').value
            };
            
            const response = await apiFetch('../../api/delivery.php', {
                method: 'PUT',
                body: JSON.stringify(formData)
            });
            
            const data = await handleResponse(response);
            showMessage(data.message, data.success ? 'success' : 'error');
            
            if (data.success) {
                loadDelivery();
                const modal = bootstrap.Modal.getInstance(document.getElementById('editDeliveryModal'));
                modal.hide();
            }
        } catch (error) {
            console.error('Error updating delivery:', error);
            showMessage('Error al actualizar el repartidor: ' + error.message, 'error');
        }
    });

    async function deleteDelivery(id) {
        if (!confirm('¿Estás seguro de que quieres eliminar este repartidor?')) return;
        
        try {
            const response = await apiFetch(`../../api/delivery.php?id=${id}`, { method: 'DELETE' });
            const data = await handleResponse(response);
            showMessage(data.message, data.success ? 'success' : 'error');
            if (data.success) loadDelivery();
        } catch (error) {
            console.error('Error deleting delivery:', error);
            showMessage('Error al eliminar el repartidor', 'error');
        }
    }

    // --- Promotions Section --- //
    // Función para manejar clicks en la tabla de promociones (delegación de eventos)
    function handlePromotionTableClick(e) {
        console.log('🟢 handlePromotionTableClick ejecutado, target:', e.target);
        const target = e.target.closest('.edit-promotion, .delete-promotion');
        if (!target) {
            console.log('🟡 No es un botón de editar/eliminar');
            return;
        }
        
        console.log('🟢 Botón encontrado:', target.className);
        e.preventDefault();
        e.stopPropagation();
        
        const id = target.getAttribute('data-id') || target.closest('[data-id]')?.getAttribute('data-id');
        if (!id) {
            console.error('❌ No se encontró el ID de la promoción');
            return;
        }
        
        console.log('🟢 ID obtenido:', id);
        
        if (target.classList.contains('edit-promotion')) {
            console.log('🔵 Delegación: Botón editar clickeado, ID:', id);
            editPromotion(id);
        } else if (target.classList.contains('delete-promotion')) {
            console.log('🔴 Delegación: Botón eliminar clickeado, ID:', id);
            deletePromotion(id);
        }
    }

    // Delegación global única para todos los botones de edición/eliminación
    document.addEventListener('click', (event) => {
        const btn = event.target.closest('.edit-product, .delete-product, .edit-user, .delete-user, .edit-branch, .delete-branch, .edit-delivery, .delete-delivery, .edit-promotion, .delete-promotion');
        if (!btn) return;

        event.preventDefault();
        event.stopPropagation();

        const id = btn.getAttribute('data-id') || btn.closest('[data-id]')?.getAttribute('data-id');
        if (!id) {
            console.error('No se encontró data-id en el botón');
            return;
        }

        console.log('🟢 Delegación global detectó clic en:', btn.className, 'id:', id);

        const classList = btn.classList;
        try {
            if (classList.contains('edit-product')) {
                console.log('🔵 Editar producto ID', id);
                editProduct(id);
            } else if (classList.contains('delete-product')) {
                console.log('🔴 Eliminar producto ID', id);
                deleteProduct(id);
            } else if (classList.contains('edit-user')) {
                console.log('🔵 Editar usuario ID', id);
                editUser(id);
            } else if (classList.contains('delete-user')) {
                console.log('🔴 Eliminar usuario ID', id);
                deleteUser(id);
            } else if (classList.contains('edit-branch')) {
                console.log('🔵 Editar sucursal ID', id);
                editBranch(id);
            } else if (classList.contains('delete-branch')) {
                console.log('🔴 Eliminar sucursal ID', id);
                deleteBranch(id);
            } else if (classList.contains('edit-delivery')) {
                console.log('🔵 Editar repartidor ID', id);
                editDelivery(id);
            } else if (classList.contains('delete-delivery')) {
                console.log('🔴 Eliminar repartidor ID', id);
                deleteDelivery(id);
            } else if (classList.contains('edit-promotion')) {
                console.log('🔵 Editar promoción ID', id);
                editPromotion(id);
            } else if (classList.contains('delete-promotion')) {
                console.log('🔴 Eliminar promoción ID', id);
                deletePromotion(id);
            }
        } catch (err) {
            console.error('Error ejecutando acción global de edición/eliminación', err);
        }
    });

    async function loadPromotions() {
        try {
            await loadBranchesForSelect('promotionBranch');
            
            const response = await apiFetch('../../api/promotions.php');
            const data = await handleResponse(response);
            
            if (!data || !Array.isArray(data)) {
                const tableBody = document.getElementById('promotionsTableBody');
                if (tableBody) {
                    tableBody.innerHTML = '<tr><td colspan="8" class="text-center">No hay promociones registradas</td></tr>';
                }
                return;
            }
            
            // Función para renderizar una fila
            const renderRow = (item) => {
                const isActive = item.activa == 1 || item.activa === true || item.activa === '1';
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const fechaFin = new Date(item.fecha_fin);
                fechaFin.setHours(0, 0, 0, 0);
                const isExpired = fechaFin < today;
                const shouldBeActive = isActive && !isExpired;
                
                const statusBadge = shouldBeActive 
                    ? '<span class="badge bg-success">Activa</span>' 
                    : '<span class="badge bg-danger">Inactiva</span>';
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${item.id_promocion}</td>
                    <td>${item.descripcion}</td>
                    <td>${parseFloat(item.porcentaje_descuento).toFixed(2)}%</td>
                    <td>${item.fecha_inicio}</td>
                    <td>${item.fecha_fin}</td>
                    <td>${item.sucursal_nombre || 'Todas'}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn btn-sm btn-primary edit-promotion" data-id="${item.id_promocion}" title="Editar">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-danger delete-promotion" data-id="${item.id_promocion}" title="Eliminar">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                `;
                
                // Agregar event listeners
                const editBtn = row.querySelector('.edit-promotion');
                const deleteBtn = row.querySelector('.delete-promotion');
                
                if (editBtn) {
                    editBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('🔵 Botón editar clickeado, ID:', item.id_promocion);
                        editPromotion(item.id_promocion);
                    });
                }
                
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        deletePromotion(item.id_promocion);
                    });
                }
                
                return row;
            };
            
            // Inicializar paginación
            initPagination('promotionsTableBody', data, renderRow, 6);
            
            // Agregar delegación de eventos como respaldo
            const tableBody = document.getElementById('promotionsTableBody');
            if (tableBody) {
                // Remover listeners previos si existen
                tableBody.removeEventListener('click', handlePromotionTableClick);
                // Agregar nuevo listener con delegación
                tableBody.addEventListener('click', handlePromotionTableClick);
            }
        } catch (error) {
            console.error('Error loading promotions:', error);
        }
    }

    document.getElementById('addPromotionForm')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        try {
            const discountInput = document.getElementById('promotionDiscount');
            const fechaInicio = document.getElementById('promotionStart').value;
            const fechaFin = document.getElementById('promotionEnd').value;
            
            // Validación frontend
            if (typeof validatePercentageField === 'function' && !validatePercentageField(discountInput)) return;
            
            if (fechaInicio && fechaFin) {
                const inicio = new Date(fechaInicio);
                const fin = new Date(fechaFin);
                if (inicio > fin) {
                    const endInput = document.getElementById('promotionEnd');
                    showFieldError(endInput, 'La fecha de fin debe ser posterior a la fecha de inicio');
                    return;
                }
            }
            
            const descuento = parseFloat(discountInput.value);
            
            const formData = {
                descripcion: document.getElementById('promotionDescription').value.trim(),
                porcentaje_descuento: descuento,
                fecha_inicio: fechaInicio,
                fecha_fin: fechaFin,
                sucursal_id: document.getElementById('promotionBranch').value || null,
                activa: document.getElementById('promotionActive').checked ? 1 : 0
            };
            
            if (!formData.descripcion || !formData.fecha_inicio || !formData.fecha_fin) {
                showMessage('Descripción, fecha de inicio y fecha de fin son requeridos', 'error');
                return;
            }
            
            const response = await apiFetch('../../api/promotions.php', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            
            const data = await handleResponse(response);
            showMessage(data.message, data.success ? 'success' : 'error');
            
            if (data.success) {
                loadPromotions();
                this.reset();
                const tab = new bootstrap.Tab(document.querySelector('a[href="#view-promotions"]'));
                tab.show();
            }
        } catch (error) {
            console.error('Error adding promotion:', error);
            showMessage('Error al agregar la promoción: ' + error.message, 'error');
        }
    });

    async function ensurePromotionTemplate() {
        const container = document.getElementById('editPromotionContainer');
        try {
            const html = await fetch('./forms/edit-promotion.html').then(r => r.text());
            // Eliminar cualquier instancia previa para evitar IDs duplicados
            document.querySelectorAll('#editPromotionCard').forEach(el => el.remove());

            let target = container;
            if (container) {
                try {
                    let node = container;
                    let hiddenAncestor = false;
                    while (node) {
                        const cs = getComputedStyle(node);
                        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') {
                            hiddenAncestor = true;
                            break;
                        }
                        node = node.parentElement;
                    }
                    if (hiddenAncestor) target = document.body;
                } catch (err) { target = document.body; }
            } else {
                target = document.body;
            }

            target.insertAdjacentHTML('beforeend', html);
        } catch (e) {
            console.error('No se pudo cargar plantilla de promoción', e);
        }
    }

    async function showEditPromotionCard() {
        await ensurePromotionTemplate();
        // dedupe promotion-related IDs
        dedupeIds(['editPromotionCard','editPromotionForm','editPromotionId','editPromotionDescription','editPromotionDiscount','editPromotionStart','editPromotionEnd','editPromotionBranch','editPromotionActive','cancelEditPromotion','cancelEditPromotionSecondary']);
        const card = document.getElementById('editPromotionCard');
        if (!card) return;
        console.log('📄 Mostrando tarjeta de edición');
        card.classList.remove('d-none');
        card.style.display = 'block';
        try {
            const cs = getComputedStyle(card);
            console.log('🔎 showEditPromotionCard: computed display:', cs.display, 'visibility:', cs.visibility, 'opacity:', cs.opacity);
            console.log('🔎 showEditPromotionCard: bounding rect:', card.getBoundingClientRect());
        } catch(e) { console.warn('🔎 showEditPromotionCard: cannot read styles', e); }
    }

    function hideEditPromotionCard() {
        const card = document.getElementById('editPromotionCard');
        if (!card) return;
        console.log('📄 Ocultando tarjeta de edición');
        card.classList.add('d-none');
        card.style.display = 'none';
        const form = document.getElementById('editPromotionForm');
        if (form) form.reset();
    }

    async function editPromotion(id) {
        console.log('=== INICIANDO editPromotion con ID:', id, '===');
        try {
            // Asegurar que la plantilla esté inyectada y visible antes de buscar el formulario
            await showEditPromotionCard();
            const form = document.getElementById('editPromotionForm');
            if (!form) {
                alert('No se encontró el formulario de edición tras inyectar la plantilla. Recarga la página.');
                return;
            }

            // Cargar sucursales
            await loadBranchesForSelect('editPromotionBranch');

            // Obtener promoción
            const response = await apiFetch(`../../api/promotions.php?id=${id}`);
            if (response.status === 404) {
                const errorData = await response.json().catch(() => ({}));
                showMessage(errorData.message || 'Promoción no encontrada', 'error');
                return;
            }
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            const promotion = await response.json();
            if (!promotion || !promotion.id_promocion) {
                showMessage('Promoción no encontrada o datos inválidos', 'error');
                return;
            }

            // Llenar formulario
            document.getElementById('editPromotionId').value = promotion.id_promocion || '';
            document.getElementById('editPromotionDescription').value = promotion.descripcion || '';
            document.getElementById('editPromotionDiscount').value = promotion.porcentaje_descuento || 0;
            document.getElementById('editPromotionStart').value = promotion.fecha_inicio || '';
            document.getElementById('editPromotionEnd').value = promotion.fecha_fin || '';
            document.getElementById('editPromotionBranch').value = promotion.sucursal_id || '';
            document.getElementById('editPromotionActive').checked = promotion.activa == 1 || promotion.activa === true || promotion.activa === '1';

            console.log('✅ Formulario llenado correctamente');
            console.log('=== editPromotion COMPLETADO ===');
        } catch (error) {
            console.error('❌ Error general en editPromotion:', error);
            showMessage(error.message || 'Error al cargar la promoción', 'error');
        }
    }
    
    document.getElementById('editPromotionForm')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        try {
            const discountInput = document.getElementById('editPromotionDiscount');
            const fechaInicio = document.getElementById('editPromotionStart').value;
            const fechaFin = document.getElementById('editPromotionEnd').value;
            
            // Validación frontend
            if (typeof validatePercentageField === 'function' && !validatePercentageField(discountInput)) return;
            
            if (fechaInicio && fechaFin) {
                const inicio = new Date(fechaInicio);
                const fin = new Date(fechaFin);
                if (inicio > fin) {
                    const endInput = document.getElementById('editPromotionEnd');
                    showFieldError(endInput, 'La fecha de fin debe ser posterior a la fecha de inicio');
                    return;
                }
            }
            
            const descuento = parseFloat(discountInput.value);
            
            const formData = {
                id: document.getElementById('editPromotionId').value,
                descripcion: document.getElementById('editPromotionDescription').value.trim(),
                porcentaje_descuento: descuento,
                fecha_inicio: fechaInicio,
                fecha_fin: fechaFin,
                sucursal_id: document.getElementById('editPromotionBranch').value || null,
                activa: document.getElementById('editPromotionActive').checked ? 1 : 0
            };
            
            if (!formData.descripcion || !formData.fecha_inicio || !formData.fecha_fin) {
                showMessage('Descripción, fecha de inicio y fecha de fin son requeridos', 'error');
                return;
            }
            
            const response = await apiFetch('../../api/promotions.php', {
                method: 'PUT',
                body: JSON.stringify(formData)
            });
            
            const data = await handleResponse(response);
            showMessage(data.message, data.success ? 'success' : 'error');
            
            if (data.success) {
                await loadPromotions();
                hideEditPromotionCard();
                // Verificación: obtener el recurso actualizado y loguearlo para facilitar debug
                try {
                    const verifyResp = await apiFetch(`../../api/promotions.php?id=${formData.id}`);
                    if (verifyResp.ok) {
                        const updatedPromotion = await verifyResp.json();
                        console.log('🔁 Promotion after update (verify GET):', updatedPromotion);
                    } else {
                        console.warn('🔁 verify GET returned status', verifyResp.status);
                    }
                } catch (err) {
                    console.warn('🔁 error fetching updated promotion:', err);
                }
            }
        } catch (error) {
            console.error('Error updating promotion:', error);
            showMessage('Error al actualizar la promoción: ' + error.message, 'error');
        }
    });

    // Botones cancelar (tarjeta edición)
    document.getElementById('cancelEditPromotion')?.addEventListener('click', hideEditPromotionCard);
    document.getElementById('cancelEditPromotionSecondary')?.addEventListener('click', hideEditPromotionCard);
    document.getElementById('cancelEditBranch')?.addEventListener('click', hideEditBranchCard);
    document.getElementById('cancelEditBranchSecondary')?.addEventListener('click', hideEditBranchCard);
    document.getElementById('cancelEditDelivery')?.addEventListener('click', hideEditDeliveryCard);
    document.getElementById('cancelEditDeliverySecondary')?.addEventListener('click', hideEditDeliveryCard);

    async function deletePromotion(id) {
        if (!confirm('¿Estás seguro de que quieres desactivar esta promoción?')) return;
        
        try {
            const response = await apiFetch(`../../api/promotions.php?id=${id}`, { method: 'DELETE' });
            const data = await handleResponse(response);
            showMessage(data.message, data.success ? 'success' : 'error');
            if (data.success) loadPromotions();
        } catch (error) {
            console.error('Error deleting promotion:', error);
            showMessage('Error al eliminar la promoción', 'error');
        }
    }

    // --- Backups Management --- //
    async function loadBackups() {
        const loadingEl = document.getElementById('backupsLoading');
        const listEl = document.getElementById('backupsList');
        const emptyEl = document.getElementById('backupsEmpty');
        const tableBody = document.getElementById('backupsTableBody');
        
        if (loadingEl) loadingEl.style.display = 'block';
        if (listEl) listEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'none';
        
        try {
            const response = await apiFetch('../../api/backup.php');
            const data = await handleResponse(response);
            
            if (loadingEl) loadingEl.style.display = 'none';
            
            if (data.success && data.backups && data.backups.length > 0) {
                if (listEl) listEl.style.display = 'block';
                if (tableBody) {
                    tableBody.innerHTML = data.backups.map(backup => `
                        <tr>
                            <td>
                                <i class="bi bi-file-earmark-zip"></i>
                                ${escapeText(backup.filename)}
                            </td>
                            <td>${escapeText(backup.size_formatted)}</td>
                            <td>${escapeText(backup.date)}</td>
                            <td>
                                <button class="btn btn-sm btn-primary" onclick="downloadBackup('${escapeText(backup.filename)}')" title="Descargar">
                                    <i class="bi bi-download"></i>
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="deleteBackup('${escapeText(backup.filename)}')" title="Eliminar">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('');
                }
            } else {
                if (emptyEl) emptyEl.style.display = 'block';
            }
        } catch (error) {
            console.error('Error loading backups:', error);
            if (loadingEl) loadingEl.style.display = 'none';
            if (emptyEl) emptyEl.style.display = 'block';
            showMessage('Error al cargar los backups', 'error');
        }
    }

    async function createBackup() {
        const btnCreate = document.getElementById('btnCreateBackup');
        if (btnCreate) {
            btnCreate.disabled = true;
            btnCreate.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creando...';
        }
        
        try {
            const response = await apiFetch('../../api/backup.php', {
                method: 'POST',
                body: JSON.stringify({ manual: true })
            });
            
            const data = await handleResponse(response);
            
            if (data.success) {
                showMessage(`Backup creado exitosamente: ${data.filename} (${data.size_formatted})`, 'success');
                await loadBackups();
            } else {
                showMessage(data.message || 'Error al crear el backup', 'error');
            }
        } catch (error) {
            console.error('Error creating backup:', error);
            showMessage('Error al crear el backup: ' + (error.message || 'Error desconocido'), 'error');
        } finally {
            if (btnCreate) {
                btnCreate.disabled = false;
                btnCreate.innerHTML = '<i class="bi bi-database-add"></i> Crear Backup';
            }
        }
    }

    // Función para mostrar el modal de confirmación con código de seguridad
    function deleteBackup(filename) {
        // Guardar el nombre del archivo a eliminar
        document.getElementById('backupToDelete').value = filename;
        
        // Limpiar el campo de código
        document.getElementById('backupDeleteCode').value = '';
        
        // Mostrar el modal
        const modal = new bootstrap.Modal(document.getElementById('deleteBackupModal'));
        modal.show();
        
        // Enfocar el campo de código cuando se muestre el modal
        document.getElementById('deleteBackupModal').addEventListener('shown.bs.modal', function() {
            document.getElementById('backupDeleteCode').focus();
        }, { once: true });
    }
    
    // Función que realmente elimina el backup después de validar el código
    async function confirmDeleteBackup() {
        const filename = document.getElementById('backupToDelete').value;
        const code = document.getElementById('backupDeleteCode').value.trim();
        
        if (!code) {
            showMessage('Por favor ingrese el código de seguridad', 'error');
            document.getElementById('backupDeleteCode').focus();
            return;
        }
        
        if (!filename) {
            showMessage('Error: No se especificó el archivo a eliminar', 'error');
            return;
        }
        
        try {
            const response = await apiFetch(`../../api/backup.php?filename=${encodeURIComponent(filename)}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    security_code: code
                })
            });
            
            const data = await handleResponse(response);
            
            if (data.success) {
                // Cerrar el modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('deleteBackupModal'));
                if (modal) {
                    modal.hide();
                }
                
                showMessage('Backup eliminado exitosamente', 'success');
                await loadBackups();
            } else {
                showMessage(data.message || 'Error al eliminar el backup', 'error');
                // Limpiar el campo de código en caso de error
                document.getElementById('backupDeleteCode').value = '';
                document.getElementById('backupDeleteCode').focus();
            }
        } catch (error) {
            console.error('Error deleting backup:', error);
            showMessage('Error al eliminar el backup: ' + (error.message || 'Error desconocido'), 'error');
            // Limpiar el campo de código en caso de error
            document.getElementById('backupDeleteCode').value = '';
            document.getElementById('backupDeleteCode').focus();
        }
    }

    function downloadBackup(filename) {
        // Descargar el backup directamente desde el servidor
        window.location.href = `../../api/backup.php?download=${encodeURIComponent(filename)}`;
    }

    // Event listeners para backups
    document.addEventListener('DOMContentLoaded', function() {
        const btnCreateBackup = document.getElementById('btnCreateBackup');
        if (btnCreateBackup) {
            btnCreateBackup.addEventListener('click', createBackup);
        }
        
        // Event listener para confirmar eliminación de backup
        const btnConfirmDeleteBackup = document.getElementById('confirmDeleteBackup');
        if (btnConfirmDeleteBackup) {
            btnConfirmDeleteBackup.addEventListener('click', confirmDeleteBackup);
        }
        
        // Permitir eliminar con Enter en el campo de código
        const backupDeleteCode = document.getElementById('backupDeleteCode');
        if (backupDeleteCode) {
            backupDeleteCode.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    confirmDeleteBackup();
                }
            });
        }
        
        // Event listener para cambiar período de reportes
        const reportPeriodSelect = document.getElementById('reportPeriod');
        if (reportPeriodSelect) {
            reportPeriodSelect.addEventListener('change', function() {
                loadReports();
            });
        }
    });

    // --- Reports Section --- //
    let reportCharts = {};
    
    // Función auxiliar para formatear moneda BOB
    function formatCurrencyBOB(amount) {
        if (typeof amount !== 'number') {
            amount = parseFloat(amount) || 0;
        }
        return 'Bs. ' + amount.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    
    async function loadReports() {
        const loadingEl = document.getElementById('reportsLoading');
        const contentEl = document.getElementById('reportsContent');
        const period = document.getElementById('reportPeriod')?.value || 'month';
        
        if (loadingEl) loadingEl.style.display = 'block';
        if (contentEl) contentEl.style.display = 'none';
        
        try {
            const response = await apiFetch(`../../api/reports.php?period=${period}`);
            const data = await handleResponse(response);
            
            if (loadingEl) loadingEl.style.display = 'none';
            if (contentEl) contentEl.style.display = 'block';
            
            // El API puede devolver success: true o directamente los datos
            if (data && (data.success !== false)) {
                // Actualizar resumen general
                if (data.summary) {
                    updateReportsSummary(data.summary);
                }
                
                // Renderizar gráficos (solo si existen los datos)
                if (data.topProducts) {
                    renderTopProductsChart(data.topProducts);
                    renderTopProductsTable(data.topProducts);
                }
                if (data.ordersByHour) {
                    renderOrdersByHourChart(data.ordersByHour);
                }
                if (data.salesByDay) {
                    renderSalesByDayChart(data.salesByDay);
                }
                if (data.salesByBranch) {
                    renderSalesByBranchChart(data.salesByBranch);
                }
                if (data.paymentMethods) {
                    renderPaymentMethodsChart(data.paymentMethods);
                }
                if (data.categories) {
                    renderCategoriesChart(data.categories);
                }
            } else {
                showMessage(data?.message || 'Error al cargar los reportes', 'error');
            }
        } catch (error) {
            console.error('Error loading reports:', error);
            if (loadingEl) loadingEl.style.display = 'none';
            showMessage('Error al cargar los reportes: ' + (error.message || 'Error desconocido'), 'error');
        }
    }
    
    function updateReportsSummary(summary) {
        if (!summary) return;
        
        const totalSalesEl = document.getElementById('totalSales');
        const totalOrdersEl = document.getElementById('totalOrders');
        const averageTicketEl = document.getElementById('averageTicket');
        const totalProductsEl = document.getElementById('totalProducts');
        
        if (totalSalesEl) totalSalesEl.textContent = formatCurrencyBOB(summary.total_sales || 0);
        if (totalOrdersEl) totalOrdersEl.textContent = (summary.total_orders || 0).toLocaleString();
        if (averageTicketEl) averageTicketEl.textContent = formatCurrencyBOB(summary.average_ticket || 0);
        if (totalProductsEl) totalProductsEl.textContent = (summary.total_products || 0).toLocaleString();
    }
    
    function renderTopProductsChart(data) {
        const canvas = document.getElementById('topProductsChart');
        if (!canvas || !data || data.length === 0) return;
        
        // Obtener el contexto 2D del canvas
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Destruir gráfico anterior si existe
        if (reportCharts.topProducts) {
            reportCharts.topProducts.destroy();
            reportCharts.topProducts = null;
        }
        
        // Verificar si hay un gráfico existente en el canvas usando Chart.getChart()
        const existingChart = Chart.getChart(canvas);
        if (existingChart) {
            existingChart.destroy();
        }
        
        const top10 = data.slice(0, 10);
        
        reportCharts.topProducts = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: top10.map(p => p.nombre),
                datasets: [{
                    label: 'Cantidad Vendida',
                    data: top10.map(p => p.cantidad),
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
    
    function renderOrdersByHourChart(data) {
        const canvas = document.getElementById('ordersByHourChart');
        if (!canvas || !data || data.length === 0) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        if (reportCharts.ordersByHour) {
            reportCharts.ordersByHour.destroy();
            reportCharts.ordersByHour = null;
        }
        
        const existingChart = Chart.getChart(canvas);
        if (existingChart) {
            existingChart.destroy();
        }
        
        // Crear array de 24 horas
        const hours = Array.from({ length: 24 }, (_, i) => i);
        const hourData = hours.map(hour => {
            const found = data.find(d => parseInt(d.hora) === hour);
            return found ? found.cantidad : 0;
        });
        
        reportCharts.ordersByHour = new Chart(ctx, {
            type: 'line',
            data: {
                labels: hours.map(h => `${h}:00`),
                datasets: [{
                    label: 'Pedidos',
                    data: hourData,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
    
    function renderSalesByDayChart(data) {
        const canvas = document.getElementById('salesByDayChart');
        if (!canvas || !data || data.length === 0) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        if (reportCharts.salesByDay) {
            reportCharts.salesByDay.destroy();
            reportCharts.salesByDay = null;
        }
        
        const existingChart = Chart.getChart(canvas);
        if (existingChart) {
            existingChart.destroy();
        }
        
        reportCharts.salesByDay = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.fecha),
                datasets: [{
                    label: 'Ventas (Bs.)',
                    data: data.map(d => parseFloat(d.total)),
                    backgroundColor: 'rgba(153, 102, 255, 0.6)',
                    borderColor: 'rgba(153, 102, 255, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return 'Bs. ' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }
    
    function renderSalesByBranchChart(data) {
        const canvas = document.getElementById('salesByBranchChart');
        if (!canvas || !data || data.length === 0) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        if (reportCharts.salesByBranch) {
            reportCharts.salesByBranch.destroy();
            reportCharts.salesByBranch = null;
        }
        
        const existingChart = Chart.getChart(canvas);
        if (existingChart) {
            existingChart.destroy();
        }
        
        reportCharts.salesByBranch = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.map(d => d.sucursal || 'Sin Sucursal'),
                datasets: [{
                    data: data.map(d => parseFloat(d.total)),
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.6)',
                        'rgba(54, 162, 235, 0.6)',
                        'rgba(255, 206, 86, 0.6)',
                        'rgba(75, 192, 192, 0.6)',
                        'rgba(153, 102, 255, 0.6)',
                        'rgba(255, 159, 64, 0.6)'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
    
    function renderPaymentMethodsChart(data) {
        const canvas = document.getElementById('paymentMethodsChart');
        if (!canvas || !data || data.length === 0) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        if (reportCharts.paymentMethods) {
            reportCharts.paymentMethods.destroy();
            reportCharts.paymentMethods = null;
        }
        
        const existingChart = Chart.getChart(canvas);
        if (existingChart) {
            existingChart.destroy();
        }
        
        reportCharts.paymentMethods = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: data.map(d => {
                    const method = d.metodo_pago || 'desconocido';
                    return method.charAt(0).toUpperCase() + method.slice(1);
                }),
                datasets: [{
                    data: data.map(d => parseFloat(d.total)),
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.6)',
                        'rgba(54, 162, 235, 0.6)',
                        'rgba(255, 206, 86, 0.6)',
                        'rgba(75, 192, 192, 0.6)'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
    
    function renderCategoriesChart(data) {
        const canvas = document.getElementById('categoriesChart');
        if (!canvas || !data || data.length === 0) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        if (reportCharts.categories) {
            reportCharts.categories.destroy();
            reportCharts.categories = null;
        }
        
        const existingChart = Chart.getChart(canvas);
        if (existingChart) {
            existingChart.destroy();
        }
        
        reportCharts.categories = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.categoria),
                datasets: [{
                    label: 'Cantidad Vendida',
                    data: data.map(d => d.cantidad),
                    backgroundColor: 'rgba(255, 159, 64, 0.6)',
                    borderColor: 'rgba(255, 159, 64, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
    
    function renderTopProductsTable(data) {
        const tbody = document.getElementById('topProductsTable');
        if (!tbody || !data || data.length === 0) return;
        
        const top10 = data.slice(0, 10);
        const total = top10.reduce((sum, p) => sum + parseInt(p.cantidad), 0);
        
        tbody.innerHTML = top10.map((product, index) => {
            const percentage = total > 0 ? ((parseInt(product.cantidad) / total) * 100).toFixed(2) : 0;
            return `
                <tr>
                    <td>${index + 1}</td>
                    <td>${escapeText(product.nombre)}</td>
                    <td>${parseInt(product.cantidad).toLocaleString()}</td>
                    <td>${formatCurrencyBOB(parseFloat(product.total))}</td>
                    <td>
                        <div class="progress" style="height: 20px;">
                            <div class="progress-bar" role="progressbar" style="width: ${percentage}%">
                                ${percentage}%
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // =================================================================
    // LOGS SECTION
    // =================================================================
    async function loadLogs() {
        const loadingEl = document.getElementById('logsLoading');
        const contentEl = document.getElementById('logsContent');
        const emptyEl = document.getElementById('logsEmpty');
        const levelFilter = document.getElementById('logLevelFilter')?.value || '';
        
        if (loadingEl) loadingEl.style.display = 'block';
        if (contentEl) contentEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'none';
        
        try {
            let url = '../../api/logs.php?limit=100';
            if (levelFilter) {
                url += `&level=${encodeURIComponent(levelFilter)}`;
            }
            
            const response = await apiFetch(url);
            const data = await handleResponse(response);
            
            if (loadingEl) loadingEl.style.display = 'none';
            
            if (data.success && data.logs && data.logs.length > 0) {
                if (contentEl) contentEl.style.display = 'block';
                renderLogsTable(data.logs);
            } else {
                if (emptyEl) emptyEl.style.display = 'block';
                if (contentEl) contentEl.style.display = 'none';
            }
        } catch (error) {
            console.error('Error loading logs:', error);
            if (loadingEl) loadingEl.style.display = 'none';
            showMessage('Error al cargar los logs: ' + (error.message || 'Error desconocido'), 'error');
        }
    }
    
    function renderLogsTable(logs) {
        const tbody = document.getElementById('logsTableBody');
        if (!tbody) return;
        
        const levelColors = {
            'info': 'primary',
            'warning': 'warning',
            'error': 'danger',
            'success': 'success'
        };
        
        const levelIcons = {
            'info': 'bi-info-circle',
            'warning': 'bi-exclamation-triangle',
            'error': 'bi-x-circle',
            'success': 'bi-check-circle'
        };
        
        tbody.innerHTML = logs.map(log => {
            const fecha = new Date(log.fecha_hora);
            const fechaStr = fecha.toLocaleString('es-ES', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            
            const levelColor = levelColors[log.nivel] || 'secondary';
            const levelIcon = levelIcons[log.nivel] || 'bi-circle';
            
            return `
                <tr>
                    <td>${escapeText(fechaStr)}</td>
                    <td>
                        <span class="badge bg-${levelColor}">
                            <i class="bi ${levelIcon}"></i> ${escapeText(log.nivel.toUpperCase())}
                        </span>
                    </td>
                    <td>${escapeText(log.usuario_nombre || 'Sistema')}</td>
                    <td>${escapeText(log.accion)}</td>
                    <td>
                        <small class="text-muted">${escapeText(log.detalles || '-')}</small>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    // Event listeners para logs
    document.addEventListener('DOMContentLoaded', function() {
        const refreshLogsBtn = document.getElementById('btnRefreshLogs');
        const logLevelFilter = document.getElementById('logLevelFilter');
        
        if (refreshLogsBtn) {
            refreshLogsBtn.addEventListener('click', () => {
                loadLogs();
            });
        }
        
        if (logLevelFilter) {
            logLevelFilter.addEventListener('change', () => {
                loadLogs();
            });
        }
    });

