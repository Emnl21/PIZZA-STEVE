// Panel de Cliente - JavaScript Principal
document.addEventListener('DOMContentLoaded', function() {
    initializeClientPanel();
});

function initializeClientPanel() {
    // Verificar autenticación
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    if (!usuario) {
        window.location.href = '../../index.html';
        return;
    }

    // Configurar navegación
    setupNavigation();
    
    // Cargar información inicial
    loadUserInfo();
    
    // Inicializar event listeners
    setupEventListeners();
    
    // Verificar si hay un parámetro en la URL para mostrar una sección específica
    const urlParams = new URLSearchParams(window.location.search);
    const sectionParam = urlParams.get('section');
    if (sectionParam) {
        // Mostrar la sección solicitada
        const sectionButton = document.querySelector(`[data-section="${sectionParam}"]`);
        if (sectionButton) {
            sectionButton.click();
        }
    }
}

function notifyClientPanel(title, message, type = 'info', duration = 5000) {
    // Obtener o crear contenedor de notificaciones
    let container = document.getElementById('notificationContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notificationContainer';
        container.style.position = 'fixed';
        container.style.top = '20px';
        container.style.right = '20px';
        container.style.zIndex = '9999';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '10px';
        container.style.maxWidth = '400px';
        document.body.appendChild(container);
    }

    // Mapeo de tipos a clases Bootstrap
    const alertClass = {
        'success': 'alert-success',
        'error': 'alert-danger',
        'warning': 'alert-warning',
        'info': 'alert-info'
    }[type] || 'alert-info';

    // Iconos según el tipo
    const icons = {
        'success': 'bi-check-circle-fill',
        'error': 'bi-x-circle-fill',
        'warning': 'bi-exclamation-triangle-fill',
        'info': 'bi-info-circle-fill'
    }[type] || 'bi-info-circle-fill';

    // Crear elemento de notificación
    const alertEl = document.createElement('div');
    alertEl.className = `alert ${alertClass} alert-dismissible fade show shadow`;
    alertEl.setAttribute('role', 'alert');
    alertEl.style.marginBottom = '0';
    alertEl.innerHTML = `
        <i class="bi ${icons} me-2"></i>
        <strong>${title}</strong><br>
        <span>${message}</span>
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    container.appendChild(alertEl);

    // Forzar reflow para animación
    alertEl.offsetHeight;
    alertEl.classList.add('show');

    // Auto-remover después de la duración
    setTimeout(() => {
        if (alertEl.parentNode) {
            alertEl.classList.remove('show');
            setTimeout(() => {
                if (alertEl.parentNode) {
                    alertEl.remove();
                }
            }, 300);
        }
    }, duration);

    console[type === 'error' ? 'error' : 'log'](`${title}: ${message}`);
}

function setupNavigation() {
    const navLinks = document.querySelectorAll('[data-section]');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.getAttribute('data-section');
            showSection(section);
            
            // Actualizar estado activo
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

function showSection(section) {
    // Ocultar todas las secciones
    document.querySelectorAll('.content-section').forEach(sec => {
        sec.style.display = 'none';
    });
    
    // Mostrar sección seleccionada (los IDs tienen el sufijo "Section")
    const selectedSection = document.getElementById(section + 'Section');
    if (selectedSection) {
        selectedSection.style.display = 'block';
        
        // Cargar datos específicos de la sección
        switch(section) {
            case 'profile':
                loadProfileData();
                break;
            case 'orders':
                loadOrders();
                break;
            case 'addresses':
                loadAddresses();
                break;
            case 'payment':
                loadPaymentMethods();
                break;
            case 'favorites':
                loadFavorites();
                break;
        }
    }
}

function setupEventListeners() {
    // Formulario de actualización de perfil
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        // Validación en tiempo real
        const nameInput = document.getElementById('profileName');
        const emailInput = document.getElementById('profileEmail');
        const phoneInput = document.getElementById('profilePhone');
        const addressInput = document.getElementById('profileAddress');
        
        if (nameInput) {
            nameInput.addEventListener('blur', () => validateProfileName(nameInput));
            nameInput.addEventListener('input', () => {
                if (nameInput.classList.contains('is-invalid')) {
                    validateProfileName(nameInput);
                }
            });
        }
        
        if (emailInput) {
            emailInput.addEventListener('blur', function() {
                if (!this.value || !this.validity.valid) {
                    this.classList.add('is-invalid');
                } else {
                    this.classList.remove('is-invalid');
                }
            });
        }
        
        if (phoneInput) {
            phoneInput.addEventListener('blur', () => validateProfilePhone(phoneInput));
            phoneInput.addEventListener('input', function() {
                // Solo permitir números, espacios, guiones, paréntesis y +
                this.value = this.value.replace(/[^0-9 ()+\-]/g, '');
                if (this.classList.contains('is-invalid')) {
                    validateProfilePhone(phoneInput);
                }
            });
        }
        
        if (addressInput) {
            addressInput.addEventListener('blur', () => validateProfileAddress(addressInput));
            addressInput.addEventListener('input', () => {
                if (addressInput.classList.contains('is-invalid')) {
                    validateProfileAddress(addressInput);
                }
            });
        }
        
        profileForm.addEventListener('submit', handleProfileUpdate);
    }
    
    // Botones de acciones
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('reorder-btn')) {
            const orderId = e.target.getAttribute('data-order-id');
            reorderItems(orderId);
        }
        
        if (e.target.classList.contains('track-order-btn')) {
            const orderId = e.target.getAttribute('data-order-id');
            trackOrder(orderId);
        }
        
        if (e.target.classList.contains('rate-order-btn')) {
            const orderId = e.target.getAttribute('data-order-id');
            rateOrder(orderId);
        }
    });
}

// Función para cargar información del usuario
async function loadUserInfo() {
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    if (!usuario) {
        window.location.href = '../../index.html';
        return;
    }

    // Obtener el ID del usuario (puede estar en diferentes campos)
    const userId = usuario.id_usuario || usuario.user_id || usuario.id || usuario.usuario_id;
    
    // Primero mostrar datos del localStorage inmediatamente
    const userNameEl = document.getElementById('userName');
    const userEmailEl = document.getElementById('userEmail');
    
    if (userNameEl) {
        userNameEl.textContent = usuario.nombre || usuario.username || 'Usuario';
    }
    if (userEmailEl) {
        userEmailEl.textContent = usuario.correo_electronico || usuario.email || usuario.correo || 'usuario@ejemplo.com';
    }
    
    // Actualizar avatar con datos del localStorage
    const avatar = document.getElementById('userAvatar');
    if (avatar) {
        const nombreParaAvatar = usuario.nombre || usuario.username || 'Usuario';
        // Usar el nombre completo para generar el avatar
        avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreParaAvatar)}&background=D92B2B&color=fff&size=100`;
        avatar.onerror = function() {
            // Fallback si falla la carga del avatar - mostrar iniciales como texto
            this.style.display = 'none';
            const fallback = document.createElement('div');
            fallback.className = 'rounded-circle mb-2 d-inline-flex align-items-center justify-content-center';
            fallback.style.width = '100px';
            fallback.style.height = '100px';
            fallback.style.background = '#D92B2B';
            fallback.style.color = 'white';
            fallback.style.fontSize = '2rem';
            fallback.style.fontWeight = 'bold';
            fallback.textContent = nombreParaAvatar.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            if (this.parentNode) {
                this.parentNode.insertBefore(fallback, this);
            }
        };
    }

    // Intentar obtener datos actualizados del usuario desde el API
    if (userId) {
        try {
            const response = await fetch(`../../api/users.php?id=${userId}`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                const responseText = await response.text();
                let userData;
                
                try {
                    userData = JSON.parse(responseText);
                } catch (parseError) {
                    console.error('Error al parsear respuesta del API:', parseError, responseText);
                    // Si falla el parseo, usar datos del localStorage
                    return;
                }
                
                if (userData && userData.nombre) {
                    // Actualizar localStorage con datos actualizados
                    const updatedUsuario = {
                        ...usuario,
                        id_usuario: userData.id_usuario || userId,
                        nombre: userData.nombre || usuario.nombre,
                        correo_electronico: userData.correo_electronico || usuario.correo_electronico,
                        email: userData.correo_electronico || usuario.email,
                        telefono: userData.telefono || usuario.telefono,
                        direccion: userData.direccion || usuario.direccion
                    };
                    localStorage.setItem('usuario', JSON.stringify(updatedUsuario));
                    
                    // Actualizar UI con datos reales
                    if (userNameEl) {
                        userNameEl.textContent = updatedUsuario.nombre || 'Usuario';
                    }
                    if (userEmailEl) {
                        userEmailEl.textContent = updatedUsuario.correo_electronico || updatedUsuario.email || 'usuario@ejemplo.com';
                    }
                    
                    // Actualizar avatar si hay foto
                    if (avatar && userData.foto) {
                        avatar.src = userData.foto;
                    } else if (avatar) {
                        // Generar avatar con nombre completo
                        avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(updatedUsuario.nombre)}&background=D92B2B&color=fff&size=100`;
                    }
                }
            } else {
                console.warn('No se pudo obtener datos del usuario del API:', response.status);
            }
        } catch (error) {
            console.error('Error al cargar datos del usuario:', error);
            // Los datos del localStorage ya están mostrados, así que no hay problema
        }
    }
    
    // Cargar pedidos del usuario
    await loadOrders();
    
    // Iniciar verificación de actualizaciones de pedidos
    if (window.checkOrderUpdates && userId) {
        window.checkOrderUpdates(userId);
    }
}

// Función para cargar datos del perfil
async function loadProfileData() {
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    if (usuario) {
        // Intentar obtener datos actualizados
        try {
            const response = await fetch(`../../api/users.php?id=${usuario.id_usuario}`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                const userData = await response.json();
                const nombreCompleto = userData.nombre || usuario.nombre || '';
                // Dividir nombre completo en nombre y apellidos
                const partes = nombreCompleto.trim().split(/\s+/);
                if (partes.length >= 2) {
                    document.getElementById('profileName').value = partes[0];
                    document.getElementById('profileApellidos').value = partes.slice(1).join(' ');
                } else {
                    document.getElementById('profileName').value = nombreCompleto;
                    document.getElementById('profileApellidos').value = '';
                }
                document.getElementById('profileEmail').value = userData.correo_electronico || usuario.email || '';
                document.getElementById('profilePhone').value = userData.telefono || usuario.telefono || '';
                document.getElementById('profileAddress').value = userData.direccion || usuario.direccion || '';
                if (userData.fecha_cumpleaños || userData.fecha_nacimiento) {
                    document.getElementById('profileBirthdate').value = userData.fecha_cumpleaños || userData.fecha_nacimiento || '';
                }
                if (userData.ci) {
                    document.getElementById('profileCI').value = userData.ci;
                } else if (usuario.ci) {
                    document.getElementById('profileCI').value = usuario.ci;
                }
                return;
            }
        } catch (error) {
            console.error('Error al cargar datos del perfil:', error);
        }
        
        // Fallback a datos del localStorage
        const nombreCompleto = usuario.nombre || '';
        const partes = nombreCompleto.trim().split(/\s+/);
        if (partes.length >= 2) {
            document.getElementById('profileName').value = partes[0];
            document.getElementById('profileApellidos').value = partes.slice(1).join(' ');
        } else {
            document.getElementById('profileName').value = nombreCompleto;
            document.getElementById('profileApellidos').value = '';
        }
        document.getElementById('profileEmail').value = usuario.email || usuario.correo_electronico || '';
        document.getElementById('profilePhone').value = usuario.telefono || '';
        document.getElementById('profileAddress').value = usuario.direccion || '';
        if (usuario.fecha_cumpleaños || usuario.fecha_nacimiento) {
            document.getElementById('profileBirthdate').value = usuario.fecha_cumpleaños || usuario.fecha_nacimiento || '';
        }
        if (usuario.ci) {
            document.getElementById('profileCI').value = usuario.ci;
        }
    }
}

// Función para validar nombre
function validateProfileName(input) {
    const value = input.value.trim();
    // Usar regex Unicode para caracteres acentuados
    const nameRegex = /^[a-zA-Z\u00C0-\u017F\s'-]+$/;
    if (!value || value.length < 2 || !nameRegex.test(value)) {
        input.classList.add("is-invalid");
        return false;
    }
    input.classList.remove("is-invalid");
    return true;
}

// Función para validar teléfono
function validateProfilePhone(input) {
    const value = input.value.trim();
    const digitsOnly = value.replace(/\D/g, '');
    if (!value || digitsOnly.length < 7 || digitsOnly.length > 15) {
        input.classList.add("is-invalid");
        return false;
    }
    input.classList.remove("is-invalid");
    return true;
}

// Función para validar dirección
function validateProfileAddress(input) {
    const value = input.value.trim();
    if (value && value.length < 5) {
        input.classList.add("is-invalid");
        return false;
    }
    input.classList.remove("is-invalid");
    return true;
}

// Función para manejar actualización de perfil
async function handleProfileUpdate(e) {
    e.preventDefault();
    
    // Validar campos antes de enviar
    const nameInput = document.getElementById('profileName');
    const apellidosInput = document.getElementById('profileApellidos');
    const ciInput = document.getElementById('profileCI');
    const emailInput = document.getElementById('profileEmail');
    const phoneInput = document.getElementById('profilePhone');
    const addressInput = document.getElementById('profileAddress');
    
    let isValid = true;
    if (nameInput && !validateProfileName(nameInput)) isValid = false;
    if (apellidosInput && !validateProfileName(apellidosInput)) isValid = false;
    if (ciInput) {
        const ciValue = ciInput.value.trim();
        const ciRegex = /^[0-9]{5,15}$/;
        if (!ciValue || !ciRegex.test(ciValue)) {
            ciInput.classList.add("is-invalid");
            isValid = false;
        } else {
            ciInput.classList.remove("is-invalid");
        }
    }
    if (emailInput && (!emailInput.value || !emailInput.validity.valid)) {
        emailInput.classList.add("is-invalid");
        isValid = false;
    }
    if (phoneInput && !validateProfilePhone(phoneInput)) isValid = false;
    if (addressInput && !validateProfileAddress(addressInput)) isValid = false;
    
    if (!isValid) {
        notifyClientPanel(
            'Error de Validación',
            'Por favor corrija los errores en el formulario',
            'error'
        );
        return;
    }
    
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    const nombre = document.getElementById('profileName').value.trim();
    const apellidos = document.getElementById('profileApellidos').value.trim();
    const nombreCompleto = `${nombre} ${apellidos}`.trim();
    const ci = document.getElementById('profileCI').value.trim();
    
    const birthdateInput = document.getElementById('profileBirthdate');
    const fechaNacimiento = birthdateInput ? birthdateInput.value : null;
    
    const updatedData = {
        id: usuario.id_usuario,
        nombre: nombreCompleto,
        correo_electronico: emailInput.value.trim(),
        telefono: phoneInput.value.trim(),
        direccion: addressInput.value.trim(),
        ci: ci,
        fecha_cumpleaños: fechaNacimiento || null
    };
    
    try {
        const response = await fetch('../../api/users.php', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(updatedData)
        });
        
        // Verificar si la respuesta es OK antes de parsear JSON
        if (!response.ok) {
            let errorMessage = 'Error al actualizar el perfil';
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorMessage;
            } catch (e) {
                errorMessage = `Error ${response.status}: ${response.statusText}`;
            }
            notifyClientPanel(
                'Error al Actualizar',
                errorMessage,
                'error'
            );
            return;
        }
        
        const result = await response.json();
        
        if (result.success) {
            // Actualizar datos en localStorage
            localStorage.setItem('usuario', JSON.stringify({...usuario, ...updatedData}));
            
            // Mostrar notificación de éxito
            notifyClientPanel(
                'Perfil Actualizado',
                'Tu información ha sido actualizada exitosamente',
                'success'
            );
            
            // Recargar información
            loadUserInfo();
        } else {
            notifyClientPanel(
                'Error al Actualizar',
                result.message || 'No se pudo actualizar tu información',
                'error'
            );
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        notifyClientPanel(
            'Error',
            'Error al actualizar el perfil: ' + (error.message || 'Error desconocido'),
            'error'
        );
    }
}

// Función para cargar pedidos
async function loadOrders() {
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    if (!usuario) return;
    
    const ordersList = document.getElementById('ordersList');
    if (!ordersList) return;
    
    // Mostrar loading
    ordersList.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Cargando...</span></div></div>';
    
    try {
        const response = await fetch('../../api/orders.php', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const orders = await response.json();
        
        // La API ya filtra los pedidos del usuario si es cliente, pero por seguridad también filtramos aquí
        const userId = usuario.id_usuario || usuario.user_id || usuario.id;
        const userOrders = Array.isArray(orders) ? orders.filter(order => {
            // Verificar que el pedido pertenece al usuario actual
            return order.usuario_id === userId;
        }) : [];
        
        displayOrders(userOrders);
    } catch (error) {
        console.error('Error loading orders:', error);
        ordersList.innerHTML = '<p class="text-center text-muted">Error al cargar pedidos. Por favor, intenta nuevamente.</p>';
    }
}

// Función para mostrar pedidos
function displayOrders(orders) {
    const ordersList = document.getElementById('ordersList');
    
    if (!orders || orders.length === 0) {
        ordersList.innerHTML = '<p class="text-center text-muted">No tienes pedidos registrados</p>';
        return;
    }
    
    ordersList.innerHTML = orders.map(order => `
        <div class="card mb-3" style="border-left: 4px solid var(--brand-red); transition: all 0.3s ease;">
            <div class="card-header d-flex justify-content-between align-items-center" style="background: linear-gradient(135deg, var(--brand-red) 0%, var(--primary-dark) 100%); color: white;">
                <div>
                    <strong style="font-family: var(--font-headings);">Pedido ${order.id || 'ORD-' + String(order.id_pedido || '').padStart(3, '0')}</strong>
                    <span class="badge bg-${getStatusColor(order.status)} ms-2">${getStatusText(order.status)}</span>
                </div>
                <small class="text-white-50">${formatDate(order.fecha_pedido || order.fecha)}</small>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6">
                        <div class="mb-3">
                            <p class="mb-1">
                                <i class="bi bi-currency-exchange text-brand-red me-2"></i>
                                <strong>Total:</strong> <span class="h5 mb-0" style="color: var(--brand-red);">Bs. ${(order.price || order.total || 0).toFixed(2)}</span>
                            </p>
                        </div>
                        <div class="mb-3">
                            <p class="mb-1">
                                <i class="bi bi-credit-card text-brand-red me-2"></i>
                                <strong>Método de Pago:</strong> ${getPaymentIcon(order.paymentType || order.payment_method)} ${order.paymentType || order.payment_method || 'N/A'}
                            </p>
                        </div>
                        <div class="mb-3">
                            <p class="mb-1">
                                <i class="bi bi-geo-alt text-brand-red me-2"></i>
                                <strong>Dirección:</strong> ${order.address || 'No especificada'}
                            </p>
                        </div>
                        ${order.items_count ? `
                            <div class="mb-3">
                                <p class="mb-0">
                                    <i class="bi bi-box-seam text-brand-red me-2"></i>
                                    <strong>Items:</strong> ${order.items_count} producto(s)
                                </p>
                            </div>
                        ` : ''}
                    </div>
                    <div class="col-md-6">
                        <div class="d-grid gap-2">
                            <button class="btn btn-sm btn-outline-primary track-order-btn" data-order-id="${order.id || 'ORD-' + String(order.id_pedido || '').padStart(3, '0')}" style="border-color: var(--brand-red); color: var(--brand-red);">
                                <i class="bi bi-geo-alt"></i> Rastrear Pedido
                            </button>
                            <button class="btn btn-sm btn-outline-success reorder-btn" data-order-id="${order.id || 'ORD-' + String(order.id_pedido || '').padStart(3, '0')}">
                                <i class="bi bi-arrow-repeat"></i> Reordenar
                            </button>
                            ${order.status === 'completed' ? `
                                <button class="btn btn-sm btn-outline-warning rate-order-btn" data-order-id="${order.id || 'ORD-' + String(order.id_pedido || '').padStart(3, '0')}">
                                    <i class="bi bi-star"></i> Calificar
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Funciones auxiliares
function getStatusColor(status) {
    // Mapeo de estados estandarizados (solo usar estados en inglés)
    const colors = {
        'pending': 'warning',
        'preparing': 'info',
        'ready_for_delivery': 'primary',
        'out_for_delivery': 'primary',
        'completed': 'success',
        'cancelled': 'danger',
        // Compatibilidad con estados antiguos (deprecated)
        'pendiente': 'warning',
        'preparando': 'info',
        'en_camino': 'primary',
        'entregado': 'success',
        'cancelado': 'danger'
    };
    return colors[status] || 'secondary';
}

function getStatusText(status) {
    // Mapeo de estados estandarizados (solo usar estados en inglés)
    const texts = {
        'pending': 'Pendiente',
        'preparing': 'En Preparación',
        'ready_for_delivery': 'Listo para Entrega',
        'out_for_delivery': 'En Camino',
        'completed': 'Entregado',
        'cancelled': 'Cancelado',
        // Compatibilidad con estados antiguos (deprecated)
        'pendiente': 'Pendiente',
        'preparando': 'En Preparación',
        'en_camino': 'En Camino',
        'entregado': 'Entregado',
        'cancelado': 'Cancelado'
    };
    return texts[status] || status;
}

function getPaymentIcon(method) {
    const icons = {
        'efectivo': 'bi-cash-coin',
        'qr': 'bi-qr-code'
    };
    return icons[method] ? `<i class="bi ${icons[method]}"></i>` : '';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Funciones de acción
async function trackOrder(orderId) {
    // Extraer ID numérico del orderId (puede venir como "ORD-001" o como número)
    const numericId = orderId.toString().replace('ORD-', '').replace(/^0+/, '') || orderId;
    
    try {
        const response = await fetch(`../../api/orders.php?id=${numericId}`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}`);
        }
        
        const order = await response.json();
        
        if (order && order.status) {
            const statusText = getStatusText(order.status);
            const message = `Pedido #${orderId}: ${statusText}${order.repartidorNombre ? '. Repartidor: ' + order.repartidorNombre : ''}`;
            
            if (window.notificationSystem) {
                window.notificationSystem.showNotification(
                    'Estado del Pedido',
                    message,
                    'info'
                );
            }
        } else {
            if (window.notificationSystem) {
                window.notificationSystem.showNotification(
                    'Error',
                    'No se pudo obtener información del pedido',
                    'error'
                );
            }
        }
    } catch (error) {
        console.error('Error tracking order:', error);
        if (window.notificationSystem) {
            window.notificationSystem.showNotification(
                'Error',
                'Error al rastrear el pedido',
                'error'
            );
        }
    }
}

async function reorderItems(orderId) {
    // Extraer ID numérico del orderId
    const numericId = orderId.toString().replace('ORD-', '').replace(/^0+/, '') || orderId;
    
    try {
        const response = await fetch(`../../api/orders.php?id=${numericId}`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}`);
        }
        
        const order = await response.json();
        
        if (order && order.products && order.products.length > 0) {
            // Agregar productos al carrito
            const cart = JSON.parse(localStorage.getItem('cart')) || [];
            
            order.products.forEach(product => {
                const productId = product.id_producto;
                const quantity = product.cantidad_producto || product.cantidad || 1;
                const price = product.precio_u || product.precio || 0;
                const size = product.tamano || product.size || null;
                
                // Buscar el producto en el catálogo para obtener el nombre
                // Por ahora usar un ID genérico
                const key = size ? `${productId}-${size}` : productId.toString();
                
                const existingItem = cart.find(item => {
                    if (size) {
                        return item.key === key;
                    } else {
                        return item.id === productId && !item.size;
                    }
                });
                
                if (existingItem) {
                    existingItem.quantity += quantity;
                } else {
                    cart.push({
                        key,
                        id: productId,
                        name: product.nombre || `Producto ${productId}`,
                        size: size || null,
                        price: parseFloat(price),
                        quantity: quantity
                    });
                }
            });
            
            localStorage.setItem('cart', JSON.stringify(cart));
            
            // Actualizar contador del carrito si existe
            if (typeof updateCartCounter === 'function') {
                updateCartCounter();
            }
            
            if (window.notificationSystem) {
                window.notificationSystem.showNotification(
                    'Productos Agregados',
                    `Se agregaron ${order.products.length} producto(s) al carrito`,
                    'success'
                );
            }
            
            // Redirigir al menú para ver el carrito
            window.location.href = '../../index.html#menu';
        } else {
            if (window.notificationSystem) {
                window.notificationSystem.showNotification(
                    'Error',
                    'No se encontraron productos en este pedido',
                    'error'
                );
            }
        }
    } catch (error) {
        console.error('Error reordering:', error);
        if (window.notificationSystem) {
            window.notificationSystem.showNotification(
                'Error',
                'Error al reordenar los productos',
                'error'
            );
        }
    }
}

function rateOrder(orderId) {
    if (window.notificationSystem) {
        window.notificationSystem.showNotification(
            'Calificar Pedido',
            `Abriendo calificación para pedido #${orderId}`,
            'info'
        );
    }
    // Aquí iría la lógica de calificación
}

// Funciones para cargar otras secciones
async function loadAddresses() {
    const addressesList = document.getElementById('addressesList');
    if (!addressesList) return;
    
    addressesList.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Cargando...</span></div></div>';
    
    try {
        const response = await fetch('../../api/addresses.php', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const addresses = await response.json();
        
        if (!addresses || addresses.length === 0) {
            addressesList.innerHTML = `
                <div class="text-center">
                    <i class="bi bi-geo-alt display-4 text-muted"></i>
                    <p class="text-muted">No tienes direcciones guardadas</p>
                    <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#addAddressModal">
                        Agregar Dirección
                    </button>
                </div>
            `;
            return;
        }
        
        addressesList.innerHTML = addresses.map(address => `
            <div class="card mb-3">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6>${address.alias || 'Dirección'}</h6>
                            <p class="mb-1">${address.direccion || ''}</p>
                            ${address.es_principal ? '<span class="badge bg-primary">Principal</span>' : ''}
                        </div>
                        <div>
                            <button class="btn btn-outline-danger btn-sm" onclick="deleteAddress(${address.id_direccion})">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading addresses:', error);
        addressesList.innerHTML = '<p class="text-center text-muted">Error al cargar direcciones. Por favor, intenta nuevamente.</p>';
    }
}

async function deleteAddress(id) {
    if (!confirm('¿Estás seguro de que deseas eliminar esta dirección?')) {
        return;
    }
    
    try {
        const response = await fetch(`../../api/addresses.php?id=${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const result = await response.json();
        
        if (result.success) {
            notifyClientPanel('Dirección Eliminada', 'La dirección ha sido eliminada exitosamente', 'success');
            loadAddresses();
        } else {
            notifyClientPanel('Error', result.message || 'No se pudo eliminar la dirección', 'error');
        }
    } catch (error) {
        console.error('Error deleting address:', error);
        notifyClientPanel('Error', 'Error al eliminar la dirección', 'error');
    }
}

async function loadPaymentMethods() {
    const paymentMethodsList = document.getElementById('paymentMethodsList');
    if (!paymentMethodsList) return;
    
    paymentMethodsList.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Cargando...</span></div></div>';
    
    try {
        // Por ahora, mostrar métodos de pago disponibles
        // En el futuro se puede implementar un API para guardar métodos de pago del usuario
        paymentMethodsList.innerHTML = `
            <div class="text-center">
                <i class="bi bi-credit-card display-4 text-muted"></i>
                <p class="text-muted">Los métodos de pago se seleccionan al realizar el pedido</p>
                <p class="small text-muted">Métodos disponibles: Efectivo, Código QR</p>
            </div>
        `;
    } catch (error) {
        console.error('Error loading payment methods:', error);
        paymentMethodsList.innerHTML = '<p class="text-center text-muted">Error al cargar métodos de pago.</p>';
    }
}

async function addPaymentMethod() {
    const paymentType = document.getElementById('paymentType').value;
    const paymentAlias = document.getElementById('paymentAlias').value.trim();
    
    if (!paymentType) {
        notifyClientPanel('Error', 'Por favor selecciona un tipo de pago', 'error');
        return;
    }
    
    // Por ahora solo mostrar mensaje informativo
    // En el futuro se puede implementar un API para guardar métodos de pago
    notifyClientPanel('Información', 'Los métodos de pago se seleccionan al realizar el pedido. Los métodos disponibles son: Efectivo y Código QR.', 'info');
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('addPaymentModal'));
    if (modal) {
        modal.hide();
    }
    document.getElementById('addPaymentForm').reset();
}

async function loadFavorites() {
    const favoritesList = document.getElementById('favoritesList');
    if (!favoritesList) return;
    
    favoritesList.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Cargando...</span></div></div>';
    
    try {
        // Por ahora, mostrar mensaje informativo
        // En el futuro se puede implementar un API para favoritos
        favoritesList.innerHTML = `
            <div class="text-center">
                <i class="bi bi-heart display-4 text-muted"></i>
                <p class="text-muted">La funcionalidad de favoritos estará disponible pronto</p>
                <a href="../../index.html#menu" class="btn btn-primary">Explorar Menú</a>
            </div>
        `;
    } catch (error) {
        console.error('Error loading favorites:', error);
        favoritesList.innerHTML = '<p class="text-center text-muted">Error al cargar favoritos.</p>';
    }
}

// Función para cerrar sesión
async function logout() {
    const confirmed = window.confirm('¿Deseas cerrar sesión?');
    if (!confirmed) return;
    localStorage.removeItem('usuario');
    window.location.href = '../../index.html';
}

// Confirmación de logout del usuario final usa diálogo nativo.

// Función para validar formulario de dirección
function validateAddressForm() {
    const aliasInput = document.getElementById('addressAlias');
    const streetInput = document.getElementById('addressStreet');
    const coloniaInput = document.getElementById('addressColonia');
    const cpInput = document.getElementById('addressCP');
    
    let isValid = true;
    
    // Validar alias
    if (aliasInput) {
        const aliasValue = aliasInput.value.trim();
        const aliasRegex = /^[a-zA-Z\u00C0-\u017F0-9\s'-]+$/;
        if (!aliasValue || aliasValue.length < 2 || aliasValue.length > 50 || !aliasRegex.test(aliasValue)) {
            aliasInput.classList.add('is-invalid');
            isValid = false;
        } else {
            aliasInput.classList.remove('is-invalid');
        }
    }
    
    // Validar calle
    if (streetInput) {
        const streetValue = streetInput.value.trim();
        if (!streetValue || streetValue.length < 5) {
            streetInput.classList.add('is-invalid');
            isValid = false;
        } else {
            streetInput.classList.remove('is-invalid');
        }
    }
    
    // Validar colonia
    if (coloniaInput) {
        const coloniaValue = coloniaInput.value.trim();
        const coloniaRegex = /^[a-zA-Z\u00C0-\u017F0-9\s'-]+$/;
        if (!coloniaValue || coloniaValue.length < 2 || !coloniaRegex.test(coloniaValue)) {
            coloniaInput.classList.add('is-invalid');
            isValid = false;
        } else {
            coloniaInput.classList.remove('is-invalid');
        }
    }
    
    // Validar código postal
    if (cpInput) {
        const cpValue = cpInput.value.trim();
        const cpRegex = /^[0-9]+$/;
        if (!cpValue || cpValue.length < 4 || cpValue.length > 10 || !cpRegex.test(cpValue)) {
            cpInput.classList.add('is-invalid');
            isValid = false;
        } else {
            cpInput.classList.remove('is-invalid');
        }
    }
    
    return isValid;
}

// Función para agregar dirección
async function addAddress() {
    if (!validateAddressForm()) {
        notifyClientPanel('Error de Validación', 'Por favor corrija los errores en el formulario de dirección', 'error');
        return;
    }
    
    const alias = document.getElementById('addressAlias').value.trim();
    const street = document.getElementById('addressStreet').value.trim();
    const colonia = document.getElementById('addressColonia').value.trim();
    const codigoPostal = document.getElementById('addressCP').value.trim();
    const referencias = document.getElementById('addressReferencias').value.trim();
    
    // Construir dirección completa
    const direccionCompleta = `${street}, ${colonia}${codigoPostal ? ', CP: ' + codigoPostal : ''}${referencias ? '. Ref: ' + referencias : ''}`;
    
    const addressData = {
        direccion: direccionCompleta,
        alias: alias,
        es_principal: 0
    };
    
    try {
        const response = await fetch('../../api/addresses.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(addressData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            notifyClientPanel('Dirección Agregada', 'La dirección ha sido agregada exitosamente', 'success');
            
            // Cerrar modal y limpiar formulario
            const modal = bootstrap.Modal.getInstance(document.getElementById('addAddressModal'));
            if (modal) {
                modal.hide();
            }
            document.getElementById('addAddressForm').reset();
            
            // Recargar direcciones
            loadAddresses();
        } else {
            notifyClientPanel('Error', result.message || 'No se pudo agregar la dirección', 'error');
        }
    } catch (error) {
        console.error('Error adding address:', error);
        notifyClientPanel('Error', 'Error al agregar la dirección', 'error');
    }
}

// Agregar evento de logout si existe el botón
document.addEventListener('DOMContentLoaded', function() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (event) => {
            event.preventDefault();
            logout();
        });
    }
    
    // Agregar event listeners para botones de pedidos (delegación de eventos)
    document.addEventListener('click', function(e) {
        if (e.target.closest('.track-order-btn')) {
            const orderId = e.target.closest('.track-order-btn').dataset.orderId;
            trackOrder(orderId);
        } else if (e.target.closest('.reorder-btn')) {
            const orderId = e.target.closest('.reorder-btn').dataset.orderId;
            reorderItems(orderId);
        } else if (e.target.closest('.rate-order-btn')) {
            const orderId = e.target.closest('.rate-order-btn').dataset.orderId;
            rateOrder(orderId);
        }
    });
    
    // Validación en tiempo real para formulario de dirección
    const addressAlias = document.getElementById('addressAlias');
    const addressStreet = document.getElementById('addressStreet');
    const addressColonia = document.getElementById('addressColonia');
    const addressCP = document.getElementById('addressCP');
    
    if (addressAlias) {
        addressAlias.addEventListener('blur', function() {
            const value = this.value.trim();
            const regex = /^[a-zA-Z\u00C0-\u017F0-9\s'-]+$/;
            if (!value || value.length < 2 || value.length > 50 || !regex.test(value)) {
                this.classList.add('is-invalid');
            } else {
                this.classList.remove('is-invalid');
            }
        });
    }
    
    if (addressStreet) {
        addressStreet.addEventListener('blur', function() {
            const value = this.value.trim();
            if (!value || value.length < 5) {
                this.classList.add('is-invalid');
            } else {
                this.classList.remove('is-invalid');
            }
        });
    }
    
    if (addressColonia) {
        addressColonia.addEventListener('blur', function() {
            const value = this.value.trim();
            const regex = /^[a-zA-Z\u00C0-\u017F0-9\s'-]+$/;
            if (!value || value.length < 2 || !regex.test(value)) {
                this.classList.add('is-invalid');
            } else {
                this.classList.remove('is-invalid');
            }
        });
    }
    
    if (addressCP) {
        addressCP.addEventListener('blur', function() {
            const value = this.value.trim();
            const regex = /^[0-9]+$/;
            if (!value || value.length < 4 || value.length > 10 || !regex.test(value)) {
                this.classList.add('is-invalid');
            } else {
                this.classList.remove('is-invalid');
            }
        });
        
        addressCP.addEventListener('input', function() {
            // Solo permitir números
            this.value = this.value.replace(/[^0-9]/g, '');
        });
    }
});