// ===============================
// 🧑‍💼 PANEL DEL CLIENTE
// ===============================

document.addEventListener('DOMContentLoaded', function() {
    // Verificar si el usuario está logueado
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    if (!usuario) {
        window.location.href = '../../index.html';
        return;
    }
    
    // Cargar información del usuario
    loadUserInfo();
    
    // Configurar navegación
    setupNavigation();
    
    // Configurar eventos
    setupEvents();
    
    // Cargar sección inicial
    loadSection('profile');
});

// Función para cargar información del usuario
function loadUserInfo() {
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    
    document.getElementById('userName').textContent = usuario.nombre || 'Usuario';
    document.getElementById('userEmail').textContent = usuario.email || 'usuario@ejemplo.com';
    
    // Cargar datos en el formulario de perfil
    document.getElementById('profileName').value = usuario.nombre || '';
    document.getElementById('profileEmail').value = usuario.email || '';
    document.getElementById('profilePhone').value = usuario.telefono || '';
}

// Función para configurar la navegación
function setupNavigation() {
    document.querySelectorAll('[data-section]').forEach(button => {
        button.addEventListener('click', function() {
            const section = this.getAttribute('data-section');
            loadSection(section);
            
            // Actualizar botón activo
            document.querySelectorAll('[data-section]').forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

// Función para configurar eventos
function setupEvents() {
    // Formulario de perfil
    document.getElementById('profileForm').addEventListener('submit', function(e) {
        e.preventDefault();
        updateProfile();
    });
    
    // Formulario de dirección
    document.getElementById('addAddressForm').addEventListener('submit', function(e) {
        e.preventDefault();
    });
    
    // Formulario de pago
    document.getElementById('addPaymentForm').addEventListener('submit', function(e) {
        e.preventDefault();
    });
    
    // Cerrar sesión
    document.getElementById('logoutBtn').addEventListener('click', function(e) {
        e.preventDefault();
        logout();
    });
    
}

// Función para cargar secciones
function loadSection(section) {
    // Ocultar todas las secciones
    document.querySelectorAll('.content-section').forEach(sec => sec.style.display = 'none');
    
    // Mostrar sección seleccionada
    document.getElementById(section + 'Section').style.display = 'block';
    
    // Cargar datos específicos de la sección
    switch(section) {
        case 'profile':
            // Ya está cargado
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

// Función para actualizar perfil
async function updateProfile() {
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    const updatedData = {
        id_usuario: usuario.id_usuario,
        nombre: document.getElementById('profileName').value,
        email: document.getElementById('profileEmail').value,
        telefono: document.getElementById('profilePhone').value,
        fecha_nacimiento: document.getElementById('profileBirthdate').value,
        direccion: document.getElementById('profileAddress').value
    };
    
    try {
        const response = await fetch('../../api/users.php', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Actualizar localStorage
            usuario.nombre = updatedData.nombre;
            usuario.email = updatedData.email;
            usuario.telefono = updatedData.telefono;
            localStorage.setItem('usuario', JSON.stringify(usuario));
            
            // Actualizar interfaz
            document.getElementById('userName').textContent = updatedData.nombre;
            document.getElementById('userEmail').textContent = updatedData.email;
            
            notify('Mi Perfil', 'Perfil actualizado exitosamente', 'success');
        } else {
            notify('Mi Perfil', 'Error al actualizar perfil: ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        notify('Mi Perfil', 'Error al actualizar perfil', 'error');
    }
}

// Función para cargar pedidos
async function loadOrders() {
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    const ordersList = document.getElementById('ordersList');
    
    try {
        const response = await fetch(`../../api/orders.php?user_id=${usuario.id_usuario}`);
        const orders = await response.json();
        
        if (orders.length === 0) {
            ordersList.innerHTML = `
                <div class="text-center">
                    <i class="bi bi-inbox display-4 text-muted"></i>
                    <p class="text-muted">No tienes pedidos aún</p>
                    <a href="../../index.html#menu" class="btn btn-primary">Hacer mi primer pedido</a>
                </div>
            `;
            return;
        }
        
        ordersList.innerHTML = orders.map(order => `
            <div class="card mb-3">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <div>
                        <strong>Pedido #${order.id_pedido}</strong>
                        <span class="badge bg-${getStatusColor(order.estado)} ms-2">${order.estado}</span>
                    </div>
                    <small class="text-muted">${formatDate(order.fecha_pedido)}</small>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-8">
                            <p><strong>Productos:</strong></p>
                            <ul class="list-unstyled">
                                ${order.productos.map(product => `
                                    <li class="mb-1">
                                        ${product.nombre} - Bs. ${product.precio} x ${product.cantidad}
                                    </li>
                                `).join('')}
                            </ul>
                            <p><strong>Total:</strong> Bs. ${order.total}</p>
                        </div>
                        <div class="col-md-4">
                            <p><strong>Dirección:</strong><br>${order.direccion_entrega}</p>
                            <p><strong>Método de Pago:</strong><br>${order.metodo_pago}</p>
                        </div>
                    </div>
                    <div class="mt-3">
                        <button class="btn btn-outline-primary btn-sm" onclick="reorder(${order.id_pedido})">
                            <i class="bi bi-arrow-repeat"></i> Reordenar
                        </button>
                        <button class="btn btn-outline-secondary btn-sm" onclick="trackOrder(${order.id_pedido})">
                            <i class="bi bi-geo-alt"></i> Seguir Pedido
                        </button>
                        ${order.estado === 'Entregado' ? `
                            <button class="btn btn-outline-warning btn-sm" onclick="rateOrder(${order.id_pedido})">
                                <i class="bi bi-star"></i> Calificar
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error:', error);
        ordersList.innerHTML = `
            <div class="text-center">
                <i class="bi bi-exclamation-triangle display-4 text-danger"></i>
                <p class="text-danger">Error al cargar pedidos</p>
            </div>
        `;
    }
}

// Función para cargar direcciones
async function loadAddresses() {
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    const addressesList = document.getElementById('addressesList');
    
    try {
        const response = await fetch(`../../api/addresses.php?user_id=${usuario.id_usuario}`);
        const addresses = await response.json();
        
        if (addresses.length === 0) {
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
                            <h6>${address.alias}</h6>
                            <p class="mb-1">${address.calle_numero}</p>
                            <p class="mb-1">${address.colonia}, C.P. ${address.codigo_postal}</p>
                            ${address.referencias ? `<p class="text-muted small mb-0">Ref: ${address.referencias}</p>` : ''}
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
        console.error('Error:', error);
        addressesList.innerHTML = `
            <div class="text-center">
                <i class="bi bi-exclamation-triangle display-4 text-danger"></i>
                <p class="text-danger">Error al cargar direcciones</p>
            </div>
        `;
    }
}

// Función para cargar métodos de pago
async function loadPaymentMethods() {
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    const paymentMethodsList = document.getElementById('paymentMethodsList');
    
    try {
        const response = await fetch(`../../api/payment_methods.php?user_id=${usuario.id_usuario}`);
        const methods = await response.json();
        
        if (methods.length === 0) {
            paymentMethodsList.innerHTML = `
                <div class="text-center">
                    <i class="bi bi-credit-card display-4 text-muted"></i>
                    <p class="text-muted">No tienes métodos de pago guardados</p>
                    <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#addPaymentModal">
                        Agregar Método
                    </button>
                </div>
            `;
            return;
        }
        
        paymentMethodsList.innerHTML = methods.map(method => `
            <div class="card mb-3">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6>${method.alias}</h6>
                            <p class="mb-1 d-flex align-items-center gap-1">
                                <i class="bi bi-${getPaymentIcon(method.tipo)}"></i>
                                <span>${getPaymentTypeName(method.tipo)}</span>
                            </p>
                        </div>
                        <div>
                            <button class="btn btn-outline-danger btn-sm" onclick="deletePaymentMethod(${method.id_metodo_pago})">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error:', error);
        paymentMethodsList.innerHTML = `
            <div class="text-center">
                <i class="bi bi-exclamation-triangle display-4 text-danger"></i>
                <p class="text-danger">Error al cargar métodos de pago</p>
            </div>
        `;
    }
}

// Función para cargar favoritos
async function loadFavorites() {
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    const favoritesList = document.getElementById('favoritesList');
    
    try {
        const response = await fetch(`../../api/favorites.php?user_id=${usuario.id_usuario}`);
        const favorites = await response.json();
        
        if (favorites.length === 0) {
            favoritesList.innerHTML = `
                <div class="text-center">
                    <i class="bi bi-heart display-4 text-muted"></i>
                    <p class="text-muted">No tienes productos favoritos</p>
                    <a href="../../index.html#menu" class="btn btn-primary">Explorar Menú</a>
                </div>
            `;
            return;
        }
        
        favoritesList.innerHTML = `
            <div class="row">
                ${favorites.map(product => `
                    <div class="col-md-4 mb-3">
                        <div class="card h-100">
                            <img src="${product.imagen || 'https://via.placeholder.com/200x150'}" class="card-img-top" alt="${product.nombre}">
                            <div class="card-body">
                                <h6 class="card-title">${product.nombre}</h6>
                                <p class="card-text">Bs. ${product.precio}</p>
                                <div class="d-flex justify-content-between">
                                    <button class="btn btn-primary btn-sm" onclick="addToCart(${product.id_producto})">
                                        <i class="bi bi-cart"></i>
                                    </button>
                                    <button class="btn btn-outline-danger btn-sm" onclick="removeFavorite(${product.id_producto})">
                                        <i class="bi bi-heart-fill"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
    } catch (error) {
        console.error('Error:', error);
        favoritesList.innerHTML = `
            <div class="text-center">
                <i class="bi bi-exclamation-triangle display-4 text-danger"></i>
                <p class="text-danger">Error al cargar favoritos</p>
            </div>
        `;
    }
}

// Funciones auxiliares
function getStatusColor(status) {
    const colors = {
        'Pendiente': 'warning',
        'Preparando': 'info',
        'En Camino': 'primary',
        'Entregado': 'success',
        'Cancelado': 'danger'
    };
    return colors[status] || 'secondary';
}

function getPaymentIcon(type) {
    const icons = {
        'efectivo': 'cash-coin',
        'qr': 'qr-code'
    };
    return icons[type] || 'question-circle';
}

function getPaymentTypeName(type) {
    const names = {
        'efectivo': 'Efectivo',
        'qr': 'Código QR'
    };
    return names[type] || 'No disponible';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Funciones de acción
function reorder(orderId) {
    // Implementar reordenar
    notify('Mi Cuenta', 'Función de reordenar en desarrollo', 'info');
}

function trackOrder(orderId) {
    // Implementar seguimiento
    notify('Mi Cuenta', `Seguimiento del pedido #${orderId} en desarrollo`, 'info');
}

function rateOrder(orderId) {
    // Implementar calificación
    notify('Mi Cuenta', `Calificar pedido #${orderId} en desarrollo`, 'info');
}

function deleteAddress(addressId) {
    if (confirm('¿Estás seguro de eliminar esta dirección?')) {
        // Implementar eliminación
        notify('Mi Cuenta', 'Eliminar dirección en desarrollo', 'warning');
    }
}

function deletePaymentMethod(methodId) {
    if (confirm('¿Estás seguro de eliminar este método de pago?')) {
        // Implementar eliminación
        notify('Mi Cuenta', 'Eliminar método de pago en desarrollo', 'warning');
    }
}

function addToCart(productId) {
    // Implementar agregar al carrito
    notify('Mi Cuenta', `Agregar producto ${productId} al carrito en desarrollo`, 'info');
}

function removeFavorite(productId) {
    if (confirm('¿Estás seguro de eliminar de favoritos?')) {
        // Implementar eliminación
        notify('Mi Cuenta', 'Eliminar favorito en desarrollo', 'warning');
    }
}

function addAddress() {
    const form = document.getElementById('addAddressForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    // Implementar agregar dirección
    notify('Mi Cuenta', 'Agregar dirección en desarrollo', 'info');
}

function addPaymentMethod() {
    const form = document.getElementById('addPaymentForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    // Implementar agregar método de pago
    notify('Mi Cuenta', 'Agregar método de pago en desarrollo', 'info');
}

// Función para cerrar sesión
function logout() {
    if (confirm('¿Estás seguro de cerrar sesión?')) {
        localStorage.removeItem('usuario');
        window.location.href = '../../index.html';
    }
}