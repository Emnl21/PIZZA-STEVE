// Panel de Vendedor - Conexión con Base de Datos
// Reemplaza los datos simulados con conexiones reales a las APIs

(() => {
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
    const fmt = new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB" });
    // Función helper para formatear con Bs. explícitamente
    const formatBs = (amount) => `Bs. ${parseFloat(amount).toFixed(2)}`;

    // Sistema de notificaciones elegante
    function showNotification(title, message, type = 'info', duration = 5000) {
        const container = $("#notificationContainer");
        if (!container) {
            console.error('No se encontró el contenedor de notificaciones');
            if (typeof window.notify === 'function') {
                window.notify(title, message, type, duration);
                return;
            }
            createFallbackToast(title, message, type, duration);
            return;
        }

        console.log('Mostrando notificación:', { title, message, type, duration });

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;

        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        notification.innerHTML = `
            <div class="notification-icon">${icons[type] || icons.info}</div>
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close" aria-label="Cerrar">×</button>
        `;

        container.appendChild(notification);
        console.log('Notificación agregada al DOM');

        // Forzar reflow para asegurar que la animación funcione
        notification.offsetHeight;

        // Auto-remover después de la duración
        const timeout = setTimeout(() => {
            removeNotification(notification);
        }, duration);

        // Cerrar al hacer clic en el botón
        const closeBtn = notification.querySelector('.notification-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                clearTimeout(timeout);
                removeNotification(notification);
            });
        }

        return notification;
    }

    function removeNotification(notification) {
        notification.classList.add('fade-out');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }

    function createFallbackToast(title, message, type, duration) {
        let container = document.getElementById('fallbackNotificationContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'fallbackNotificationContainer';
            container.style.position = 'fixed';
            container.style.top = '20px';
            container.style.right = '20px';
            container.style.zIndex = '2000';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.gap = '12px';
            document.body.appendChild(container);
        }

        const typeMap = {
            success: '#22c55e',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        const toast = document.createElement('div');
        toast.style.background = '#0b1220';
        toast.style.border = `1px solid ${typeMap[type] || '#3b82f6'}`;
        toast.style.borderRadius = '12px';
        toast.style.padding = '16px 18px';
        toast.style.color = '#e2e8f0';
        toast.style.boxShadow = '0 10px 30px rgba(0,0,0,.4)';
        toast.style.minWidth = '280px';
        toast.innerHTML = `<strong style="display:block;margin-bottom:6px;">${title}</strong><span style="font-size:14px;line-height:1.4;">${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, duration);
    }

    // Función para confirmaciones elegantes
    function showConfirm(title, message) {
        return new Promise((resolve) => {
            const container = $("#notificationContainer");
            if (!container) {
                resolve(confirm(message));
                return;
            }

            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: fadeIn 0.2s ease-out;
            `;

            const modal = document.createElement('div');
            modal.style.cssText = `
                background: linear-gradient(180deg, #0b1220, #0b1220);
                border: 1px solid var(--line);
                border-radius: 16px;
                padding: 24px;
                max-width: 400px;
                width: 90%;
                box-shadow: 0 10px 30px rgba(0,0,0,.5);
                animation: slideUp 0.3s ease-out;
            `;

            modal.innerHTML = `
                <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: var(--txt);">${title}</h3>
                <p style="margin: 0 0 20px 0; color: var(--muted); font-size: 14px; line-height: 1.5;">${message}</p>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button class="btn btn-ghost" data-action="cancel" style="min-width: 80px;">Cancelar</button>
                    <button class="btn btn-primary" data-action="confirm" style="min-width: 80px;">Confirmar</button>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            const handleAction = (action) => {
                overlay.style.animation = 'fadeOut 0.2s ease-out';
                modal.style.animation = 'slideDown 0.3s ease-out';
                setTimeout(() => {
                    document.body.removeChild(overlay);
                }, 300);
                resolve(action === 'confirm');
            };

            modal.querySelector('[data-action="cancel"]').addEventListener('click', () => handleAction('cancel'));
            modal.querySelector('[data-action="confirm"]').addEventListener('click', () => handleAction('confirm'));

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    handleAction('cancel');
                }
            });
        });
    }

    // Agregar estilos de animación si no existen
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
            @keyframes slideUp {
                from {
                    transform: translateY(20px);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
            @keyframes slideDown {
                from {
                    transform: translateY(0);
                    opacity: 1;
                }
                to {
                    transform: translateY(20px);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Helper para hacer peticiones API con autenticación
    const apiFetch = async (url, options = {}) => {
        const defaultOptions = {
            credentials: 'include', // Incluir cookies de sesión
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

        const tableBody = $(`#${tableId}`);
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
        let paginationContainer = $(`#${paginationId}`);
        const tableBody = $(`#${tableId}`);

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

    // Manejo de respuestas
    async function handleResponse(response) {
        // Verificar el tipo de contenido
        const contentType = response.headers.get('content-type');
        const isJson = contentType && contentType.includes('application/json');
        
        if (!response.ok) {
            const text = await response.text();
            let errorMessage = 'Error en la petición';
            if (isJson) {
                try {
                    const errorData = JSON.parse(text);
                    errorMessage = errorData.message || errorData.error || errorMessage;
                } catch (e) {
                    errorMessage = text || `Error ${response.status}: ${response.statusText}`;
                }
            } else {
                // Si no es JSON, puede ser HTML (error de PHP)
                errorMessage = `Error ${response.status}: ${response.statusText}. El servidor devolvió una respuesta no válida.`;
                console.error('Respuesta no JSON recibida:', text.substring(0, 200));
            }
            throw new Error(errorMessage);
        }
        
        // Si no es JSON, intentar parsear como texto y luego como JSON
        if (!isJson) {
            const text = await response.text();
            // Intentar extraer JSON del texto si hay HTML mezclado
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[0]);
                } catch (e) {
                    console.error('Error al parsear JSON extraído:', e);
                    throw new Error('Respuesta del servidor no es JSON válido');
                }
            }
            throw new Error('El servidor no devolvió JSON válido');
        }
        
        return response.json();
    }

    // Estado global
    let state = {
        productos: [],
        promociones: [],
        ordenes: [],
        sucursal: null,
        usuario: null,
        stats: null
    };

    // Cargar datos iniciales
    async function init() {
        try {
            // Verificar sesión
            const sessionResponse = await apiFetch('../../api/session_check.php');
            const sessionData = await handleResponse(sessionResponse);

            if (!sessionData.success || !sessionData.authenticated) {
                window.location.href = '../../Index.html';
                return;
            }

            // Mapear datos del usuario al formato esperado
            state.usuario = {
                id_usuario: sessionData.user.id,
                nombre: sessionData.user.username,
                rol: sessionData.user.role,
                sucursal_id: sessionData.user.sucursal_id || null
            };

            // Cargar productos
            await loadProductos();

            // Cargar promociones
            await loadPromociones();

            // Cargar órdenes
            await loadOrdenes();

            // Cargar sucursal
            await loadSucursal();

            // Cargar estadísticas iniciales
            await loadVendorStats();

            // Renderizar
            renderProductos();
            renderOrdenes();
            renderKpis();
            renderResumen();

            // Actualizar información en configuración
            updateConfigInfo();

        } catch (error) {
            console.error('Error inicializando panel:', error);
            // Si es error 401, redirigir al login
            if (error.message && error.message.includes('401')) {
                window.location.href = '../../Index.html';
                return;
            }
            showNotification('Error', 'Error al cargar los datos. Por favor, recarga la página.', 'error', 7000);
        }
    }

    // Mapeo de nombres de productos a archivos de imágenes
    const imageMap = {
        'pizza margarita': 'margarita.png',
        'pizza pepperoni': 'pepperoni.png',
        'pizza hawaiana': 'hawaiana.png',
        'pizza 4 estaciones': '4_estaciones.jpg',
        'pizza champiñón': 'pizza-con-champinones.jpg',
        'pizza ranchera': 'ranchera.jpg',
        'pizza vegetariana': 'veggie.png',
        'pizza napolitana': 'napolitana.jpg',
        'pizza bbq chicken': 'BBQ_Chiken.webp',
        'pizza carnes': 'carnes.png',
        'pizza de quesos': 'pizza-cuatro-quesos.webp',
        'pizza mexicana': 'pizza_mexicana.jpg',
        'pizza de anchoas': 'pizza-de-anchoas.jpg',
        'pizza de salchicha': 'pizza_salchicha.jpg',
        'pizza de pimientos': 'Pizza_pimiento.jpg'
    };

    // Función para obtener la ruta de la imagen
    function getProductImage(nombre) {
        const nombreLower = nombre.toLowerCase().trim();
        // Buscar coincidencia exacta primero
        if (imageMap[nombreLower]) {
            return `assets/img/${imageMap[nombreLower]}`;
        }
        // Buscar coincidencia parcial
        for (const [key, file] of Object.entries(imageMap)) {
            if (nombreLower.includes(key) || key.includes(nombreLower)) {
                return `assets/img/${file}`;
            }
        }
        // Si no hay coincidencia, intentar con el nombre del producto
        const nombreSinEspacios = nombreLower.replace(/\s+/g, '_').replace(/[áéíóú]/g, (m) => {
            const map = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u' };
            return map[m] || m;
        });
        return `assets/img/${nombreSinEspacios}.png`;
    }

    // Cargar productos desde la API
    async function loadProductos() {
        try {
            const response = await apiFetch('../../api/products.php');
            const productos = await handleResponse(response);
            state.productos = productos.map(p => ({
                id: p.id_producto,
                nombre: p.nombre,
                precio: parseFloat(p.precio),
                desc: p.descripcion || '',
                categoria: p.categoria || '',
                img: getProductImage(p.nombre)
            }));
            console.log('Productos cargados:', state.productos.map(p => ({ nombre: p.nombre, categoria: p.categoria, img: p.img })));
        } catch (error) {
            console.error('Error cargando productos:', error);
            state.productos = [];
        }
    }

    // Cargar promociones desde la API
    async function loadPromociones() {
        try {
            const response = await apiFetch('../../api/promotions.php');
            const promociones = await handleResponse(response);
            // Asegurar que sea un array
            state.promociones = Array.isArray(promociones) ? promociones : [];
        } catch (error) {
            console.error('Error cargando promociones:', error);
            state.promociones = [];
            // No mostrar notificación para promociones ya que no es crítico para el funcionamiento
        }
    }

    // Cargar órdenes desde la API
    async function loadOrdenes() {
        try {
            console.log('Cargando órdenes...');
            const response = await apiFetch('../../api/orders.php');
            const ordenes = await handleResponse(response);
            console.log('Órdenes cargadas desde API:', ordenes.length);

            if (ordenes.length > 0) {
                console.log('Primeras 3 órdenes:', ordenes.slice(0, 3).map(o => ({
                    id: o.id || o.id_pedido,
                    fecha: o.fecha_pedido,
                    precio: o.price,
                    cliente: o.customerName
                })));
            }

            state.ordenes = Array.isArray(ordenes) ? ordenes : [];
            console.log('Estado actualizado, total órdenes en memoria:', state.ordenes.length);

            // Verificar fechas (se hará cuando se llame a getOrdenesHoy() más adelante)
            console.log('Órdenes cargadas, se verificarán fechas al renderizar');
        } catch (error) {
            console.error('Error cargando órdenes:', error);
            state.ordenes = [];
        }
    }

    // Cargar sucursal
    async function loadSucursal() {
        try {
            const desiredBranchId = state.usuario?.sucursal_id ?? null;
            if (desiredBranchId) {
                try {
                    const response = await apiFetch(`../../api/branches.php?id=${desiredBranchId}`);
                    const branch = await handleResponse(response);
                    if (branch && branch.id_sucursal) {
                        state.sucursal = branch;
                        const sucursalNameEl = $("#sucursalName");
                        if (sucursalNameEl) {
                            sucursalNameEl.textContent = branch.nombre;
                        }
                        return;
                    }
                } catch (error) {
                    console.warn('No se pudo cargar la sucursal asignada:', error.message);
                }
            }

            const response = await apiFetch('../../api/branches.php?activa=1');
            const sucursales = await handleResponse(response);
            const activa = sucursales && sucursales.length > 0 ? sucursales[0] : null;
            if (activa) {
                state.sucursal = activa;
                const sucursalNameEl = $("#sucursalName");
                if (sucursalNameEl) {
                    sucursalNameEl.textContent = activa.nombre;
                }
            }
        } catch (error) {
            console.warn('No se pudo cargar la sucursal (no crítico):', error.message);
            // Establecer una sucursal por defecto si no se puede cargar
            if (!state.sucursal) {
                state.sucursal = { id_sucursal: 1, nombre: 'Sucursal Central' };
                const sucursalNameEl = $("#sucursalName");
                if (sucursalNameEl) {
                    sucursalNameEl.textContent = 'Sucursal Central';
                }
            }
        }
    }

    async function loadVendorStats() {
        try {
            let url = '../../api/vendor_stats.php';
            const branchId = state.usuario?.sucursal_id;
            if (branchId) {
                url += `?sucursal_id=${branchId}`;
            }
            const response = await apiFetch(url);
            const payload = await handleResponse(response);
            if (payload && typeof payload === 'object' && 'success' in payload) {
                state.stats = payload.success ? (payload.data || null) : null;
            } else {
                state.stats = payload?.data ?? null;
            }
        } catch (error) {
            console.warn('No se pudieron cargar las estadísticas del vendedor:', error.message);
            state.stats = null;
        }
    }

    // Factores de tamaño (igual que en el panel de usuario)
    const SIZE_FACTORS = { small: 1.0, medium: 1.3, large: 1.6 };
    const SIZE_NAMES = { small: 'Pequeña', medium: 'Mediana', large: 'Familiar' };

    // Renderizar productos
    function renderProductos() {
        const productsEl = $("#products");
        if (!productsEl) return;

        productsEl.innerHTML = "";
        state.productos.forEach(p => {
            // Detectar si es pizza (verificar categoría o nombre que contenga "pizza")
            const categoriaLower = (p.categoria || '').toLowerCase();
            const nombreLower = (p.nombre || '').toLowerCase();
            const isPizza = categoriaLower === 'pizza' || nombreLower.includes('pizza');
            
            const card = document.createElement("div");
            card.className = "product";
            
            // Si es pizza, agregar selector de tamaño
            const sizeSelector = isPizza ? `
                <div style="margin: 8px 0;">
                    <label style="font-size: 13px; font-weight: 600; color: var(--txt, #e2e8f0); display: block; margin-bottom: 6px;">Tamaño:</label>
                    <select id="size-${p.id}" style="width: 100%; padding: 8px 10px; font-size: 14px; font-weight: 500; border: 1px solid var(--line, #1f2937); border-radius: 8px; background: var(--card, #0b1220); color: var(--txt, #e2e8f0); cursor: pointer;">
                        <option value="small">Pequeña</option>
                        <option value="medium" selected>Mediana</option>
                        <option value="large">Familiar</option>
                    </select>
                </div>
            ` : '';
            
            // Calcular precio según tamaño (solo para pizzas)
            const basePrice = parseFloat(p.precio) || 0;
            const displayPrice = isPizza ? (basePrice * SIZE_FACTORS.medium).toFixed(2) : basePrice.toFixed(2);
            
            card.innerHTML = `
                <img src="${p.img}" alt="${p.nombre}" loading="lazy" onerror="this.style.display='none'"/>
                <div style="flex:1">
                    <div class="name">${p.nombre}</div>
                    <div class="desc">${p.desc}</div>
                    ${sizeSelector}
                    <div class="price" id="price-${p.id}">${formatBs(displayPrice)}</div>
                    <div class="actions">
                        <button class="btn btn-ghost" data-add="${p.id}">Agregar</button>
                    </div>
                </div>
            `;
            productsEl.appendChild(card);
            
            // Si es pizza, agregar listener para actualizar precio al cambiar tamaño
            if (isPizza) {
                const sizeSelect = card.querySelector(`#size-${p.id}`);
                const priceEl = card.querySelector(`#price-${p.id}`);
                if (sizeSelect && priceEl) {
                    sizeSelect.addEventListener('change', () => {
                        const size = sizeSelect.value;
                        const factor = SIZE_FACTORS[size] || 1.0;
                        const newPrice = basePrice * factor;
                        priceEl.textContent = formatBs(newPrice.toFixed(2));
                    });
                }
            }
        });

        productsEl.querySelectorAll("[data-add]").forEach(btn => {
            btn.addEventListener("click", () => {
                const productId = btn.dataset.add;
                const p = state.productos.find(x => x.id == productId);
                if (!p) return;
                
                // Detectar si es pizza
                const categoriaLower = (p.categoria || '').toLowerCase();
                const nombreLower = (p.nombre || '').toLowerCase();
                const isPizza = categoriaLower === 'pizza' || nombreLower.includes('pizza');
                
                if (isPizza) {
                    // Para pizzas, obtener el tamaño seleccionado
                    const sizeSelect = document.getElementById(`size-${productId}`);
                    const size = sizeSelect ? sizeSelect.value : 'medium';
                    addToCart(productId, size);
                } else {
                    // Para otros productos, no hay tamaño
                    addToCart(productId, null);
                }
            });
        });
    }

    // Carrito
    const cart = [];
    let checkoutModalEl = null;
    let checkoutFormEl = null;
    let checkoutSummaryItemsEl = null;
    let checkoutSummaryTotalEl = null;

    function addToCart(id, size = null) {
        const p = state.productos.find(x => x.id == id);
        if (!p) return;
        
        // Verificar stock disponible
        if (p.stock_disponible !== undefined && p.stock_disponible !== null) {
            const stock = parseInt(p.stock_disponible, 10);
            if (stock <= 0) {
                showNotification('Producto Agotado', `${p.nombre} no está disponible en este momento.`, 'error');
                return;
            }
        }
        
        // Para pizzas, crear clave única por id+tamaño
        const key = size ? `${id}-${size}` : id.toString();
        const row = cart.find(x => {
            if (size) {
                return x.key === key;
            } else {
                return x.id == id && !x.size;
            }
        });
        
        if (row) {
            row.qty++;
        } else {
            const basePrice = parseFloat(p.precio) || 0;
            let finalPrice = basePrice;
            
            // Si es pizza y tiene tamaño, calcular precio según tamaño
            const categoriaLower = (p.categoria || '').toLowerCase();
            const nombreLower = (p.nombre || '').toLowerCase();
            const isPizza = categoriaLower === 'pizza' || nombreLower.includes('pizza');
            
            if (size && isPizza) {
                const factor = SIZE_FACTORS[size] || 1.0;
                finalPrice = basePrice * factor;
            }
            
            cart.push({
                id,
                key,
                size: size || null,
                qty: 1,
                basePrice,
                finalPrice
            });
        }
        renderCart();
    }

    function renderCart() {
        const cartList = $("#cartList");
        if (!cartList) return;

        cartList.innerHTML = "";
        let subtotal = 0;
        cart.forEach(item => {
            const p = state.productos.find(x => x.id == item.id);
            if (!p) return;
            
            // Usar precio final (con tamaño si aplica) o precio base
            const itemPrice = item.finalPrice !== undefined ? item.finalPrice : (parseFloat(p.precio) || 0);
            const line = itemPrice * item.qty;
            subtotal += line;
            
            // Mostrar tamaño si existe
            const sizeText = item.size ? ` (${SIZE_NAMES[item.size] || item.size})` : '';
            
            const li = document.createElement("div");
            li.className = "cart-item";
            li.innerHTML = `
                <div style="flex:1">
                    <div style="font-weight:600">${p.nombre}${sizeText}</div>
                    <div class="muted" style="font-size:12px">${formatBs(itemPrice)} × ${item.qty}</div>
                </div>
                <div class="qty">
                    <button aria-label="disminuir" data-dec="${item.key || item.id}">–</button>
                    <span>${item.qty}</span>
                    <button aria-label="aumentar" data-inc="${item.key || item.id}">+</button>
                </div>
                <div style="width:90px;text-align:right;font-weight:700">${formatBs(line)}</div>
                <button class="btn btn-ghost" data-del="${item.key || item.id}" aria-label="quitar">✕</button>
            `;
            cartList.appendChild(li);
        });

        // Event listeners
        cartList.querySelectorAll("[data-dec]").forEach(b => {
            b.addEventListener("click", () => {
                const key = b.dataset.dec;
                const it = cart.find(x => (x.key || x.id.toString()) === key);
                if (it) setQty(it.key || it.id, it.qty - 1);
            });
        });
        cartList.querySelectorAll("[data-inc]").forEach(b => {
            b.addEventListener("click", () => {
                const key = b.dataset.inc;
                const it = cart.find(x => (x.key || x.id.toString()) === key);
                if (it) setQty(it.key || it.id, it.qty + 1);
            });
        });
        cartList.querySelectorAll("[data-del]").forEach(b => {
            b.addEventListener("click", () => {
                const key = b.dataset.del;
                setQty(key, 0);
            });
        });

        // Calcular totales
        const chkCumple = $("#chkCumple");
        const isCumple = !!(chkCumple && chkCumple.checked);
        const desc = isCumple ? (subtotal * 0.20) : 0; // 20% descuento cumpleaños
        const total = Math.max(0, subtotal - desc);

        if ($("#cartSubtotal")) $("#cartSubtotal").textContent = formatBs(subtotal);
        if ($("#cartDesc")) $("#cartDesc").textContent = (isCumple ? "- " : "") + formatBs(desc);
        if ($("#cartTotal")) $("#cartTotal").textContent = formatBs(total);

        updateCheckoutSummary();
    }

    function getCartTotals() {
        let subtotal = 0;
        let totalItems = 0;
        cart.forEach(item => {
            const p = state.productos.find(x => x.id == item.id);
            if (!p) return;
            subtotal += p.precio * item.qty;
            totalItems += item.qty;
        });
        const chkCumple = $("#chkCumple");
        const isCumple = !!(chkCumple && chkCumple.checked);
        const discount = isCumple ? (subtotal * 0.20) : 0;
        const total = Math.max(0, subtotal - discount);
        return { subtotal, discount, total, items: totalItems };
    }

    function updateCheckoutSummary() {
        if (!checkoutSummaryItemsEl || !checkoutSummaryTotalEl) return;
        const totals = getCartTotals();
        checkoutSummaryItemsEl.textContent = totals.items || 0;
        checkoutSummaryTotalEl.textContent = formatBs(totals.total || 0);
    }

    function openCheckoutModal() {
        if (cart.length === 0) {
            showNotification('Carrito vacío', 'Agrega productos al carrito antes de registrar un pedido.', 'warning');
            return;
        }
        
        // Buscar elementos directamente cada vez (más confiable)
        // Intentar múltiples métodos de búsqueda
        let modal = document.getElementById('checkoutModal');
        let form = document.getElementById('checkoutForm');
        let summaryItems = document.getElementById('checkoutSummaryItems');
        let summaryTotal = document.getElementById('checkoutSummaryTotal');
        
        // Si no se encuentra con getElementById, intentar con querySelector
        if (!modal) {
            modal = document.querySelector('#checkoutModal');
        }
        if (!form) {
            form = document.querySelector('#checkoutForm');
        }
        if (!summaryItems) {
            summaryItems = document.querySelector('#checkoutSummaryItems');
        }
        if (!summaryTotal) {
            summaryTotal = document.querySelector('#checkoutSummaryTotal');
        }
        
        // Actualizar variables globales
        checkoutModalEl = modal;
        checkoutFormEl = form;
        checkoutSummaryItemsEl = summaryItems;
        checkoutSummaryTotalEl = summaryTotal;
        
        // Verificar que los elementos críticos existen
        if (!modal) {
            console.error('Modal checkoutModal no encontrado. Estado del DOM:', {
                bodyExists: !!document.body,
                documentReady: document.readyState,
                allCheckoutElements: Array.from(document.querySelectorAll('[id*="checkout"]')).map(el => el.id),
                allModals: Array.from(document.querySelectorAll('.modal-overlay')).map(el => el.id)
            });
            showNotification('Error', 'No se pudo abrir el formulario del cliente. El modal no está en la página. Recarga la página.', 'error');
            return;
        }
        
        if (!form) {
            console.error('Formulario checkoutForm no encontrado en el DOM');
            showNotification('Error', 'No se pudo abrir el formulario del cliente. El formulario no está en la página. Recarga la página.', 'error');
            return;
        }
        
        form.reset();
        
        // Actualizar resumen si los elementos existen
        if (summaryItems && summaryTotal) {
            const totals = getCartTotals();
            summaryItems.textContent = totals.items || 0;
            summaryTotal.textContent = formatBs(totals.total || 0);
        }
        
        modal.style.display = 'flex';
        const nameInput = document.getElementById('customerNameInput');
        if (nameInput) {
            setTimeout(() => nameInput.focus(), 50);
        }
    }

    function closeCheckoutModal() {
        if (checkoutModalEl) {
            checkoutModalEl.style.display = 'none';
        }
    }

    async function handleCheckoutSubmit(event) {
        event.preventDefault();
        if (!checkoutFormEl) return;
        const nameInput = $("#customerNameInput");
        const ciInput = $("#customerCiInput");
        const notesInput = $("#customerNotesInput");
        const paymentSelect = $("#paymentMethodSelect");

        const nombre = nameInput?.value.trim();
        const ci = ciInput?.value.trim();

        if (!nombre || !ci) {
            showNotification('Datos incompletos', 'Ingresa el nombre del cliente y su C.I./NIT.', 'warning');
            return;
        }

        const customerData = {
            nombre,
            ci,
            metodo_pago: paymentSelect?.value || 'efectivo',
            notas: notesInput?.value.trim() || null,
            timestamp: new Date().toISOString()
        };

        closeCheckoutModal();
        await checkout(customerData);
    }

    function setQty(key, qty) {
        // Buscar por key si existe, sino por id
        const idx = cart.findIndex(x => (x.key && x.key === key) || (x.id && x.id.toString() === key));
        if (idx === -1) return;
        cart[idx].qty = Math.max(0, qty);
        if (cart[idx].qty === 0) cart.splice(idx, 1);
        renderCart();
    }

    function clearCart() {
        console.log('Limpiando carrito, items antes:', cart.length);
        cart.length = 0;
        renderCart();
        console.log('Carrito limpiado, items después:', cart.length);
    }

    // Checkout - Crear pedido
    async function checkout(customerData) {
        if (cart.length === 0) {
            showNotification('Carrito vacío', 'Agrega productos al carrito antes de registrar un pedido.', 'warning');
            return;
        }

        if (!state.usuario || !state.sucursal) {
            showNotification('Error', 'No se pudo obtener información del usuario o sucursal. Por favor, recarga la página.', 'error');
            return;
        }

        if (!customerData || !customerData.nombre || !customerData.ci) {
            showNotification('Datos del cliente', 'Ingresa el nombre y el C.I./NIT del cliente para generar el ticket.', 'warning');
            return;
        }

        const sanitizedCustomer = {
            nombre: customerData.nombre.trim(),
            ci: customerData.ci.trim(),
            metodo_pago: (customerData.metodo_pago || 'efectivo').toLowerCase(),
            notas: customerData.notas?.trim() || null,
            timestamp: customerData.timestamp || new Date().toISOString()
        };

        try {
            // Preparar productos para el pedido
            const productos = cart.map(c => {
                const producto = state.productos.find(p => p.id == c.id);
                if (!producto) {
                    throw new Error(`Producto con ID ${c.id} no encontrado`);
                }
                
                // Usar precio final (con tamaño si aplica) o precio base
                const precioFinal = c.finalPrice !== undefined ? c.finalPrice : (parseFloat(producto.precio) || 0);
                
                const productoData = {
                    id_producto: parseInt(c.id),
                    cantidad: c.qty,
                    precio: precioFinal
                };
                
                // Si es pizza y tiene tamaño, agregar información de tamaño
                const categoriaLower = (producto.categoria || '').toLowerCase();
                const nombreLower = (producto.nombre || '').toLowerCase();
                const isPizza = categoriaLower === 'pizza' || nombreLower.includes('pizza');
                
                if (c.size && isPizza) {
                    productoData.size = c.size;
                    productoData.precio_base = parseFloat(producto.precio) || 0;
                    productoData.recargo_tamano = precioFinal - productoData.precio_base;
                }
                
                return productoData;
            });

            if (productos.length === 0) {
                showNotification('Error', 'No hay productos válidos en el carrito', 'error');
                return;
            }

            const totals = getCartTotals();
            const subtotal = totals.subtotal;
            const descuento = totals.discount;
            const total = totals.total;
            const isCumple = !!(descuento > 0);

            // Validar que tenemos los datos necesarios
            if (!state.usuario || !state.usuario.id_usuario) {
                showNotification('Error', 'No se pudo obtener información del usuario', 'error');
                return;
            }

            if (!state.sucursal || !state.sucursal.id_sucursal) {
                showNotification('Error', 'No se pudo obtener información de la sucursal', 'error');
                return;
            }

            // Datos del pedido
            const orderData = {
                usuario_id: state.usuario.id_usuario,
                sucursal_id: state.sucursal.id_sucursal,
                productos: productos,
                metodo_pago: sanitizedCustomer.metodo_pago || 'efectivo',
                total: total,
                descuento: descuento,
                es_cumpleanero: isCumple ? 1 : 0,
                direccion: 'Recoger en sucursal', // Por defecto para venta en mostrador
                lat: -16.507,
                lng: -68.127,
                cliente_manual: {
                    nombre: sanitizedCustomer.nombre,
                    ci: sanitizedCustomer.ci,
                    metodo_pago: sanitizedCustomer.metodo_pago,
                    notas: sanitizedCustomer.notas
                }
            };

            console.log('Enviando pedido:', orderData);

            // Crear pedido
            const response = await apiFetch('../../api/orders.php', {
                method: 'POST',
                body: JSON.stringify(orderData)
            });

            const result = await handleResponse(response);
            console.log('Respuesta del servidor:', result);


            if (result.success) {
                const orderId = result.orderId || (result.id_pedido ? 'ORD-' + String(result.id_pedido).padStart(3, '0') : '');
                const pedidoId = result.id_pedido;

                // Mostrar notificación ANTES de limpiar y recargar
                showNotification('Pedido registrado', `El pedido ${orderId} ha sido registrado exitosamente.`, 'success', 6000);

                // Crear ticket automáticamente
                if (pedidoId) {
                    try {
                        const ticketResponse = await apiFetch('../../api/tickets.php', {
                            method: 'POST',
                            body: JSON.stringify({
                                id_pedido: pedidoId,
                                notas: sanitizedCustomer.notas,
                                cliente_manual: {
                                    nombre: sanitizedCustomer.nombre,
                                    ci: sanitizedCustomer.ci,
                                    metodo_pago: sanitizedCustomer.metodo_pago,
                                    notas: sanitizedCustomer.notas,
                                    subtotal,
                                    descuento,
                                    total,
                                    items: productos.reduce((s, item) => s + item.cantidad, 0)
                                }
                            })
                        });

                        const ticketResult = await handleResponse(ticketResponse);

                        if (ticketResult.success) {
                            if (ticketResult.updated) {
                                console.log('Ticket existente actualizado:', ticketResult.numero_ticket);
                                showNotification('Ticket actualizado', `Ticket ${ticketResult.numero_ticket} actualizado con datos del cliente.`, 'success', 4000);
                            } else if (ticketResult.exists) {
                                console.log('Ticket ya existe:', ticketResult.numero_ticket);
                                showNotification('Ticket generado', `Ticket ${ticketResult.numero_ticket} ya existe para este pedido.`, 'success', 4000);
                            } else {
                                console.log('Ticket creado automáticamente:', ticketResult.numero_ticket);
                                showNotification('Ticket generado', `Ticket ${ticketResult.numero_ticket} creado.`, 'success', 4000);
                            }
                        }
                    } catch (ticketError) {
                        // Si el error es 409 (Conflict), significa que el ticket ya existe
                        // En este caso, simplemente lo ignoramos porque el ticket ya fue creado
                        if (ticketError.message && ticketError.message.includes('Ya existe un ticket')) {
                            console.log('Ticket ya existe para este pedido, no es necesario crearlo nuevamente.');
                            // No mostramos error porque el ticket ya existe y el pedido se creó correctamente
                        } else {
                            console.warn('No se pudo crear el ticket automáticamente:', ticketError);
                            // No mostramos error al usuario porque el pedido sí se creó
                        }
                    }
                }

                // Pequeño delay para asegurar que la notificación se muestre
                await new Promise(resolve => setTimeout(resolve, 300));

                clearCart();

                console.log('Recargando órdenes después de registrar venta...');
                // Recargar órdenes para obtener los datos actualizados
                await loadOrdenes();
                await loadVendorStats();

                // Recargar tickets si la función existe
                if (typeof window.loadTickets === 'function') {
                    await window.loadTickets();
                }

                console.log('Actualizando vistas después de cargar órdenes...');
                // Actualizar todas las vistas
                renderOrdenes();
                renderKpis();
                renderResumen(); // Actualizar también el resumen

                const ordenesHoyCount = getOrdenesHoy().length;
                const today = new Date().toISOString().slice(0, 10);

                console.log('Vistas actualizadas. Estado actual:', {
                    totalOrdenes: state.ordenes.length,
                    ordenesHoy: ordenesHoyCount,
                    fechaHoy: today
                });
            } else {
                showNotification('Error', result.message || 'Error al crear el pedido', 'error');
            }
        } catch (error) {
            console.error('Error en checkout:', error);
            showNotification('Error', error.message || 'Error al crear el pedido. Verifica la consola para más detalles.', 'error', 7000);
        }
    }

    // Renderizar órdenes
    function renderOrdenes() {
        const tbody = $("#tablaOrdenes");
        if (!tbody) return;

        const today = new Date().toISOString().slice(0, 10);
        console.log('Renderizando órdenes, fecha de hoy:', today);
        console.log('Total órdenes disponibles:', state.ordenes.length);

        const ordenesHoy = getOrdenesHoy();

        console.log('Total órdenes de hoy para mostrar:', ordenesHoy.length);

        if (ordenesHoy.length === 0) {
            tbody.innerHTML = "<tr><td colspan='6' class='text-center'>No hay órdenes hoy</td></tr>";
            if ($("#ordenesCount")) $("#ordenesCount").textContent = "0";
            // Limpiar paginación si existe
            const paginationContainer = $("#tablaOrdenesPagination");
            if (paginationContainer) paginationContainer.innerHTML = '';
            return;
        }

        // Función para renderizar una fila
        const renderRow = (o) => {
            const tr = document.createElement("tr");
            const statusClass = o.status || 'pending';
            const statusText = {
                'pending': 'Pendiente',
                'preparing': 'Preparando',
                'ready_for_delivery': 'Listo',
                'out_for_delivery': 'En camino',
                'completed': 'Completado',
                'cancelled': 'Cancelado'
            }[statusClass] || statusClass;

            // Formatear hora - fecha_pedido ahora es DATETIME, mostrar la hora real del pedido
            let horaStr = '-';
            if (o.fecha_pedido) {
                try {
                    const fecha = new Date(o.fecha_pedido);
                    if (!isNaN(fecha.getTime())) {
                        // Formatear hora en formato 12 horas (AM/PM)
                        horaStr = fecha.toLocaleTimeString('es-BO', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                        });
                    }
                } catch (e) {
                    console.error('Error formateando hora:', e, 'fecha_pedido:', o.fecha_pedido);
                    horaStr = '-';
                }
            }

            // Items - mostrar cantidad total de productos (suma de cantidades)
            const itemsCount = o.items_total || o.items_count || 0;

            tr.innerHTML = `
                <td>${o.id || 'ORD-' + String(o.id_pedido || '').padStart(3, '0')}</td>
                <td>${o.customerName || 'Cliente'}</td>
                <td>${itemsCount > 0 ? itemsCount : '-'}</td>
                <td>${formatBs(o.price || 0)}</td>
                <td><span class="status ${statusClass}">${statusText}</span></td>
                <td>${horaStr}</td>
            `;
            return tr;
        };

        // Inicializar paginación
        initPagination('tablaOrdenes', ordenesHoy, renderRow, 6);

        if ($("#ordenesCount")) $("#ordenesCount").textContent = String(ordenesHoy.length);
    }

    // Función helper para normalizar y comparar fechas
    function normalizeDate(fecha) {
        if (!fecha) return null;
        if (typeof fecha === 'string') {
            return fecha.split(' ')[0].split('T')[0];
        } else if (fecha instanceof Date) {
            return fecha.toISOString().split('T')[0];
        }
        return null;
    }

    // Función helper para obtener órdenes de hoy (con tolerancia de zona horaria)
    function getOrdenesHoy() {
        const today = new Date();
        const todayStr = today.toISOString().slice(0, 10);

        // También considerar ayer y mañana por posibles diferencias de zona horaria
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().slice(0, 10);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().slice(0, 10);

        console.log('Buscando órdenes para fechas:', { today: todayStr, yesterday: yesterdayStr, tomorrow: tomorrowStr });

        return state.ordenes.filter(o => {
            if (!o.fecha_pedido) return false;
            const fechaOrden = normalizeDate(o.fecha_pedido);
            if (!fechaOrden) return false;

            // Considerar órdenes de hoy, ayer o mañana (por zona horaria)
            const matches = fechaOrden === todayStr || fechaOrden === yesterdayStr || fechaOrden === tomorrowStr;

            if (matches) {
                console.log(`✓ Orden ${o.id || o.id_pedido} encontrada: fecha="${fechaOrden}" (hoy="${todayStr}")`);
            }

            return matches;
        });
    }

    // Renderizar KPIs
    function renderKpis() {
        const ventasHoyEl = $("#ventasHoy");
        const kpiOrdenesEl = $("#kpiOrdenes");
        const kpiTicketEl = $("#kpiTicket");
        const kpiClientesEl = $("#kpiClientes");
        const kpiVsAyerEl = $("#kpiVsAyer");
        const kpiEnCursoEl = $("#kpiEnCurso");
        const kpiNuevosEl = $("#kpiNuevos");

        if (state.stats) {
            const ventas = parseFloat(state.stats.ventas_hoy ?? 0);
            const ordenes = parseInt(state.stats.ordenes_hoy ?? 0, 10);
            const ticket = parseFloat(state.stats.ticket_promedio ?? 0);
            const clientes = parseInt(state.stats.clientes_hoy ?? 0, 10);
            const descuentos = parseFloat(state.stats.descuentos_hoy ?? 0);
            const enCurso = parseInt(state.stats.ordenes_en_curso ?? 0, 10);
            const ventasAyer = parseFloat(state.stats.ventas_ayer ?? 0);

            if (ventasHoyEl) ventasHoyEl.textContent = formatBs(ventas);
            if (kpiOrdenesEl) kpiOrdenesEl.textContent = String(ordenes);
            if (kpiTicketEl) kpiTicketEl.textContent = formatBs(ticket);
            if (kpiClientesEl) kpiClientesEl.textContent = String(clientes);
            if (kpiEnCursoEl) kpiEnCursoEl.textContent = `${enCurso} en curso`;
            if (kpiNuevosEl) kpiNuevosEl.textContent = `Desc ${formatBs(descuentos)}`;

            if (kpiVsAyerEl) {
                if (ventasAyer > 0) {
                    const diff = ventas - ventasAyer;
                    const perc = (diff / ventasAyer) * 100;
                    const sign = diff >= 0 ? '+' : '';
                    kpiVsAyerEl.textContent = `${sign}${perc.toFixed(1)}% vs ayer`;
                } else {
                    kpiVsAyerEl.textContent = '–';
                }
            }
            return;
        }

        const ordenesHoy = getOrdenesHoy();
        const ventas = ordenesHoy.reduce((s, o) => s + (parseFloat(o.price) || 0), 0);
        const ordenes = ordenesHoy.length;
        const ticket = ordenes > 0 ? ventas / ordenes : 0;
        const enCurso = ordenesHoy.filter(o => o.status === 'pending' || o.status === 'preparing').length;

        if (ventasHoyEl) ventasHoyEl.textContent = formatBs(ventas);
        if (kpiOrdenesEl) kpiOrdenesEl.textContent = String(ordenes);
        if (kpiTicketEl) kpiTicketEl.textContent = formatBs(ticket);
        if (kpiClientesEl) kpiClientesEl.textContent = String(ordenes);
        if (kpiEnCursoEl) kpiEnCursoEl.textContent = `${enCurso} en curso`;
        if (kpiVsAyerEl) kpiVsAyerEl.textContent = '–';
        if (kpiNuevosEl) kpiNuevosEl.textContent = `Desc ${formatBs(0)}`;
    }

    // Navegación entre secciones
    function setupNav() {
        const navLinks = $$("[data-nav]");
        console.log('Configurando navegación, encontrados', navLinks.length, 'enlaces');

        if (navLinks.length === 0) {
            console.error('No se encontraron enlaces de navegación');
            return;
        }

        navLinks.forEach(link => {
            link.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                const target = link.getAttribute("data-nav");
                console.log('Navegando a:', target);

                if (!target) {
                    console.error('No se encontró atributo data-nav');
                    return;
                }

                const section = $(target);

                if (!section) {
                    console.error('No se encontró la sección:', target);
                    return;
                }

                console.log('Sección encontrada:', section.id);

                // Ocultar todas las secciones
                const allSections = $$("[data-page]");
                console.log('Ocultando', allSections.length, 'secciones');
                allSections.forEach(s => {
                    s.hidden = true;
                });

                // Mostrar la sección seleccionada
                section.hidden = false;
                console.log('Mostrando sección:', section.id);

                // Actualizar navegación activa
                $$("[data-nav]").forEach(l => l.classList.remove("active"));
                link.classList.add("active");

                // Actualizar título de la página
                const titles = {
                    "#vender": "Vender",
                    "#ordenes": "Órdenes",
                    "#tickets": "Tickets",
                    "#clientes": "Clientes",
                    "#resumen": "Resumen",
                    "#reportes": "Reportes",
                    "#config": "Configuración"
                };
                const pageTitle = $("#pageTitle");
                if (pageTitle) {
                    pageTitle.textContent = titles[target] || "Panel";
                }

                // Cargar datos según la sección
                if (target === "#ordenes") {
                    renderOrdenes();
                } else if (target === "#tickets") {
                    // Cargar tickets cuando se accede a la sección
                    if (typeof window.loadTickets === 'function') {
                        window.loadTickets();
                    }
                } else if (target === "#clientes") {
                    renderClientes();
                } else if (target === "#resumen") {
                    renderResumen();
                } else if (target === "#reportes") {
                    loadReports();
                }
            });
        });

        console.log('Navegación configurada correctamente');
    }

    // Toggle sidebar
    function setupSidebar() {
        const btnSidebar = $("#btnSidebar");
        const sidebar = $(".sidebar");
        const main = $("#mainContent");

        if (btnSidebar && sidebar) {
            btnSidebar.addEventListener("click", () => {
                sidebar.classList.toggle("collapsed");
                const isExpanded = !sidebar.classList.contains("collapsed");
                btnSidebar.setAttribute("aria-expanded", isExpanded);
            });
        }
    }

    // Toggle tema - Usa ThemeManager centralizado
    function setupTheme() {
        const btnTheme = $("#btnTheme");
        if (btnTheme) {
            btnTheme.addEventListener("click", () => {
                // Usar ThemeManager si está disponible, si no, usar función local
                if (window.ThemeManager) {
                    window.ThemeManager.toggle();
                } else if (window.toggleTheme) {
                    window.toggleTheme();
                } else {
                    // Fallback local
                    const current = document.body.classList.contains("dark") ? "dark" : "light";
                    const next = current === "light" ? "dark" : "light";
                    if (next === "dark") {
                        document.body.classList.add("dark");
                        document.documentElement.classList.add("dark");
                        document.documentElement.setAttribute("data-theme", "dark");
                    } else {
                        document.body.classList.remove("dark");
                        document.documentElement.classList.remove("dark");
                        document.documentElement.setAttribute("data-theme", "light");
                    }
                    localStorage.setItem("theme", next);
                }
            });

            // El tema se carga automáticamente por theme-manager.js
            // Solo necesitamos asegurarnos de que se aplique también al body si es necesario
            if (window.ThemeManager || window.getCurrentTheme) {
                const currentTheme = window.getCurrentTheme ? window.getCurrentTheme() : window.ThemeManager.get();
                if (currentTheme === "dark") {
                    document.body.classList.add("dark");
                } else {
                    document.body.classList.remove("dark");
                }
            }
        }
    }

    // Búsqueda
    function setupSearch() {
        const searchInput = $("#searchInput");
        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                const query = e.target.value.toLowerCase().trim();
                if (query === "") {
                    renderProductos();
                    return;
                }

                // Filtrar productos
                const filtered = state.productos.filter(p =>
                    p.nombre.toLowerCase().includes(query) ||
                    (p.desc && p.desc.toLowerCase().includes(query))
                );

                const productsEl = $("#products");
                if (!productsEl) return;

                productsEl.innerHTML = "";
                filtered.forEach(p => {
                    const card = document.createElement("div");
                    card.className = "product";
                    card.innerHTML = `
                        <img src="${p.img}" alt="${p.nombre}" loading="lazy" onerror="this.style.display='none'"/>
                        <div style="flex:1">
                            <div class="name">${p.nombre}</div>
                            <div class="desc">${p.desc}</div>
                            <div class="price">${formatBs(p.precio)}</div>
                            <div class="actions">
                                <button class="btn btn-ghost" data-add="${p.id}">Agregar</button>
                            </div>
                        </div>
                    `;
                    productsEl.appendChild(card);
                });

                // Re-agregar event listeners a los botones
                productsEl.querySelectorAll("[data-add]").forEach(btn => {
                    btn.addEventListener("click", () => addToCart(btn.dataset.add));
                });
            });
        }
    }

    // Actualizar información en configuración
    function updateConfigInfo() {
        const inpSucursal = $("#inpSucursal");
        const inpUsuario = $("#inpUsuario");

        if (inpSucursal) {
            inpSucursal.value = state.sucursal ? (state.sucursal.nombre || 'No disponible') : 'Cargando...';
        }

        if (inpUsuario) {
            inpUsuario.value = state.usuario ? (state.usuario.nombre || 'No disponible') : 'Cargando...';
        }
    }

    // Reset datos (limpiar carrito)
    function setupReset() {
        const btnReset = $("#btnResetData");
        if (btnReset) {
            btnReset.addEventListener("click", async () => {
                const confirmed = await showConfirm("Limpiar carrito", "¿Está seguro de que desea limpiar el carrito? Esta acción no se puede deshacer.");
                if (confirmed) {
                    clearCart();
                    showNotification('Carrito limpiado', 'El carrito ha sido vaciado correctamente.', 'success');
                }
            });
        }
    }

    // Renderizar clientes
    async function renderClientes() {
        const tbody = $("#tablaClientes");
        if (!tbody) return;

        try {
            // Cargar usuarios/clientes desde la API
            const response = await apiFetch('../../api/users.php');
            const usuarios = await handleResponse(response);

            // Filtrar solo clientes (puedes ajustar según tu lógica de roles)
            const clientes = usuarios.filter(u => u.rol === 'cliente' || !u.rol || u.rol === '');

            if (clientes.length === 0) {
                tbody.innerHTML = "<tr><td colspan='4' class='text-center'>No hay clientes registrados</td></tr>";
                if ($("#clientesCount")) $("#clientesCount").textContent = "0";
                // Limpiar paginación si existe
                const paginationContainer = $("#tablaClientesPagination");
                if (paginationContainer) paginationContainer.innerHTML = '';
                return;
            }

            // Obtener todos los pedidos para calcular estadísticas
            let todasLasOrdenes = [];
            try {
                const ordersResponse = await apiFetch('../../api/orders.php');
                todasLasOrdenes = await handleResponse(ordersResponse);
                if (!Array.isArray(todasLasOrdenes)) {
                    todasLasOrdenes = [];
                }
            } catch (error) {
                console.error('Error cargando órdenes para estadísticas:', error);
            }

            // Función para renderizar una fila
            const renderRow = (cliente) => {
                // Filtrar órdenes de este cliente usando customerName como aproximación
                const nombreCliente = cliente.nombre || cliente.nombre_usuario || '';
                const ordenesCliente = todasLasOrdenes.filter(o =>
                    o.customerName && o.customerName.toLowerCase() === nombreCliente.toLowerCase()
                );

                const totalPedidos = ordenesCliente.length;
                const gastoTotal = ordenesCliente.reduce((sum, o) => sum + (parseFloat(o.price) || 0), 0);
                const ultimoPedido = ordenesCliente.length > 0
                    ? new Date(ordenesCliente.sort((a, b) =>
                        new Date(b.fecha_pedido) - new Date(a.fecha_pedido)
                    )[0].fecha_pedido).toLocaleDateString('es-BO')
                    : '-';

                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${nombreCliente || 'Sin nombre'}</td>
                    <td>${totalPedidos}</td>
                    <td>${formatBs(gastoTotal)}</td>
                    <td>${ultimoPedido}</td>
                `;
                return tr;
            };

            // Inicializar paginación
            initPagination('tablaClientes', clientes, renderRow, 6);

            if ($("#clientesCount")) $("#clientesCount").textContent = String(clientes.length);
        } catch (error) {
            console.error('Error renderizando clientes:', error);
            tbody.innerHTML = "<tr><td colspan='4' class='text-center text-danger'>Error al cargar clientes</td></tr>";
        }
    }

    // Renderizar resumen
    function renderResumen() {
        if (state.stats) {
            const topProductoEl = $("#topProducto");
            if (topProductoEl) {
                if (state.stats.top_producto && state.stats.top_producto.nombre) {
                    const cantidad = state.stats.top_producto.cantidad ?? 0;
                    topProductoEl.textContent = `${state.stats.top_producto.nombre} (${cantidad})`;
                } else {
                    topProductoEl.textContent = "–";
                }
            }

            const horasPicoEl = $("#horasPico");
            if (horasPicoEl) {
                horasPicoEl.textContent = state.stats.hora_pico || "–";
            }

            const kpiCumplesEl = $("#kpiCumples");
            if (kpiCumplesEl) {
                kpiCumplesEl.textContent = String(state.stats.cumpleaneros ?? 0);
            }

            const kpiEntregaEl = $("#kpiEntrega");
            if (kpiEntregaEl) {
                kpiEntregaEl.textContent = state.stats.ordenes_hoy > 0 ? "20 min" : "–";
            }
            return;
        }

        const ordenesHoy = getOrdenesHoy();
        console.log('Renderizando resumen, órdenes de hoy:', ordenesHoy.length);

        // Producto más vendido - Como no tenemos productos en el listado, mostramos mensaje informativo
        // En el futuro se podría hacer una consulta adicional para obtener esta información
        if ($("#topProducto")) {
            $("#topProducto").textContent = ordenesHoy.length > 0 ? "Ver detalles" : "–";
        }

        // Horas pico (simplificado)
        const horas = ordenesHoy.map(o => {
            if (o.fecha_pedido) {
                try {
                    const fecha = new Date(o.fecha_pedido);
                    if (!isNaN(fecha.getTime())) {
                        return fecha.getHours();
                    }
                } catch (e) {
                    console.error('Error parseando fecha:', o.fecha_pedido, e);
                }
            }
            return null;
        }).filter(h => h !== null);

        const horasFrecuencia = {};
        horas.forEach(h => {
            horasFrecuencia[h] = (horasFrecuencia[h] || 0) + 1;
        });

        const horaPico = Object.keys(horasFrecuencia).length > 0
            ? Object.keys(horasFrecuencia).reduce((a, b) =>
                horasFrecuencia[a] > horasFrecuencia[b] ? a : b
            )
            : null;

        if ($("#horasPico")) {
            $("#horasPico").textContent = horaPico ? `${String(horaPico).padStart(2, '0')}:00` : "–";
        }

        // Cumpleañeros - Como no tenemos descuento en el listado, mostramos 0 por ahora
        // En el futuro se podría agregar esta información a la API
        if ($("#kpiCumples")) {
            $("#kpiCumples").textContent = "0";
        }

        // Actualizar también el KPI de entrega promedio (simulado)
        if ($("#kpiEntrega")) {
            $("#kpiEntrega").textContent = ordenesHoy.length > 0 ? "20 min" : "–";
        }
    }

    // Configurar funcionalidades adicionales cuando el DOM esté listo
    function setupAll() {
        setupNav();
        setupSidebar();
        setupTheme();
        setupSearch();
        setupReset();

        // Event listeners para botones del carrito
        const btnVaciar = $("#btnVaciar");
        const btnCheckout = $("#btnCheckout");
        const chkCumple = $("#chkCumple");
        checkoutModalEl = $("#checkoutModal");
        checkoutFormEl = $("#checkoutForm");
        checkoutSummaryItemsEl = $("#checkoutSummaryItems");
        checkoutSummaryTotalEl = $("#checkoutSummaryTotal");
        const checkoutOverlayCloseBtn = $("#btnCancelCheckout");
        const checkoutFooterCancelBtn = $("#checkoutModalClose");
        updateCheckoutSummary();

        if (btnVaciar) {
            btnVaciar.addEventListener("click", () => {
                clearCart();
                showNotification('Carrito limpiado', 'El carrito ha sido vaciado correctamente.', 'success');
            });
        }

        if (btnCheckout) {
            btnCheckout.addEventListener("click", openCheckoutModal);
        }

        if (chkCumple) {
            chkCumple.addEventListener("change", renderCart);
        }

        if (checkoutFormEl) {
            checkoutFormEl.addEventListener("submit", handleCheckoutSubmit);
        }

        [checkoutOverlayCloseBtn, checkoutFooterCancelBtn].forEach(btn => {
            if (btn) {
                btn.addEventListener("click", closeCheckoutModal);
            }
        });

        if (checkoutModalEl) {
            checkoutModalEl.addEventListener("click", (e) => {
                if (e.target === checkoutModalEl) {
                    closeCheckoutModal();
                }
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeCheckoutModal();
            }
        });

        const btnLogout = $("#btnLogout");
        if (btnLogout) {
            btnLogout.addEventListener("click", async () => {
                let confirmed = true;
                if (typeof showConfirm === 'function') {
                    confirmed = await showConfirm('Cerrar sesión', '¿Deseas cerrar la sesión actual?');
                } else {
                    confirmed = window.confirm('¿Deseas cerrar la sesión actual?');
                }
                if (!confirmed) return;
                try {
                    await apiFetch('../../api/logout.php', { method: 'POST' });
                } catch (error) {
                    console.error('Error al cerrar sesión:', error);
                }
                try {
                    localStorage.removeItem('usuario');
                } catch (error) {
                    console.warn('No se pudo limpiar la sesión local:', error);
                }
                window.location.href = '../../Index.html';
            });
        }
    }

    // =================================================================
    // REPORTES SECTION
    // =================================================================
    async function loadReports() {
        const loadingEl = $("#reportsLoading");
        const contentEl = $("#reportsContent");
        const period = $("#reportPeriod")?.value || 'day';
        
        if (loadingEl) loadingEl.style.display = 'block';
        if (contentEl) contentEl.style.display = 'none';
        
        try {
            const response = await apiFetch(`../../api/vendor_reports.php?period=${period}`);
            const data = await handleResponse(response);
            
            if (loadingEl) loadingEl.style.display = 'none';
            if (contentEl) contentEl.style.display = 'block';
            
            if (data && data.success) {
                // Actualizar resumen
                const summary = data.summary || {};
                const periodLabels = {
                    'day': 'Hoy',
                    'week': 'Esta Semana',
                    'month': 'Este Mes'
                };
                
                const periodLabel = $("#reportPeriodLabel");
                if (periodLabel) periodLabel.textContent = periodLabels[period] || 'Hoy';
                
                const totalSales = $("#reportTotalSales");
                if (totalSales) totalSales.textContent = formatBs(summary.total_ventas || 0);
                
                const totalOrders = $("#reportTotalOrders");
                if (totalOrders) totalOrders.textContent = (summary.total_pedidos || 0).toString();
                
                const avgTicket = $("#reportAvgTicket");
                if (avgTicket) avgTicket.textContent = formatBs(summary.ticket_promedio || 0);
                
                const totalDiscounts = $("#reportTotalDiscounts");
                if (totalDiscounts) totalDiscounts.textContent = formatBs(summary.total_descuentos || 0);
                
                // Renderizar ventas por día
                renderSalesByDay(data.salesByDay || []);
                
                // Renderizar productos más vendidos
                renderTopProducts(data.topProducts || []);
                
                // Renderizar métodos de pago
                renderPaymentMethods(data.paymentMethods || []);
            } else {
                showNotification('Error', data.message || 'Error al cargar los reportes', 'error');
            }
        } catch (error) {
            console.error('Error loading reports:', error);
            if (loadingEl) loadingEl.style.display = 'none';
            showNotification('Error', 'Error al cargar los reportes: ' + (error.message || 'Error desconocido'), 'error');
        }
    }
    
    function renderSalesByDay(sales) {
        const tbody = $("#reportSalesByDay");
        if (!tbody) return;
        
        if (sales.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #999;">No hay datos disponibles</td></tr>';
            return;
        }
        
        tbody.innerHTML = sales.map(sale => {
            const fecha = new Date(sale.fecha + 'T00:00:00');
            const fechaStr = fecha.toLocaleDateString('es-ES', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            
            return `
                <tr>
                    <td>${fechaStr}</td>
                    <td>${sale.cantidad || 0}</td>
                    <td>${formatBs(sale.total || 0)}</td>
                </tr>
            `;
        }).join('');
    }
    
    function renderTopProducts(products) {
        const tbody = $("#reportTopProducts");
        if (!tbody) return;
        
        if (products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #999;">No hay datos disponibles</td></tr>';
            return;
        }
        
        tbody.innerHTML = products.map(product => {
            return `
                <tr>
                    <td>${product.nombre || 'Producto'}</td>
                    <td>${product.cantidad || 0}</td>
                    <td>${formatBs(product.total || 0)}</td>
                </tr>
            `;
        }).join('');
    }
    
    function renderPaymentMethods(methods) {
        const tbody = $("#reportPaymentMethods");
        if (!tbody) return;
        
        if (methods.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #999;">No hay datos disponibles</td></tr>';
            return;
        }
        
        tbody.innerHTML = methods.map(method => {
            const metodo = method.metodo || 'desconocido';
            const metodoCapitalized = metodo.charAt(0).toUpperCase() + metodo.slice(1);
            
            return `
                <tr>
                    <td>${metodoCapitalized}</td>
                    <td>${method.cantidad || 0}</td>
                    <td>${formatBs(method.total || 0)}</td>
                </tr>
            `;
        }).join('');
    }
    
    // Event listeners para reportes
    document.addEventListener('DOMContentLoaded', function() {
        const refreshBtn = $("#btnRefreshReports");
        const periodSelect = $("#reportPeriod");
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                loadReports();
            });
        }
        
        if (periodSelect) {
            periodSelect.addEventListener('change', () => {
                loadReports();
            });
        }
    });

    // Esperar a que el DOM esté completamente cargado
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setupAll();
            init();
        });
    } else {
        // DOM ya está listo
        setupAll();
        init();
    }
})();
