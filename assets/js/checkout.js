// ===============================
// 💳 PÁGINA DE CHECKOUT
// ===============================

document.addEventListener('DOMContentLoaded', function() {
    // Cargar el resumen del carrito
    loadOrderSummary();
    
    // Establecer fecha solo para hoy (mínimo y máximo)
    const today = new Date().toISOString().split('T')[0];
    const fechaEntregaInput = document.getElementById('fechaEntrega');
    fechaEntregaInput.setAttribute('min', today);
    fechaEntregaInput.setAttribute('max', today);
    fechaEntregaInput.value = today;
    
    // Cargar información del usuario si está logueado
    loadUserInfo();
    
    // Mostrar/ocultar opciones de pago según el método seleccionado
    document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
        radio.addEventListener('change', handlePaymentMethodChange);
    });
    // Ajustar visibilidad inicial según el valor preseleccionado
    handlePaymentMethodChange();
    
    // Calcular cambio cuando se ingresa monto en efectivo
    const montoEfectivoInput = document.getElementById('montoEfectivo');
    if (montoEfectivoInput) {
        montoEfectivoInput.addEventListener('input', calculateChange);
        montoEfectivoInput.addEventListener('change', calculateChange);
    }
    
    // Calcular cambio cuando cambia el total del pedido
    // Esto se ejecutará cuando se actualice el resumen del pedido
    const originalLoadOrderSummary = loadOrderSummary;
    loadOrderSummary = function() {
        originalLoadOrderSummary();
        // Si el método de pago es efectivo, recalcular cambio
        const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked');
        if (paymentMethod && paymentMethod.value === 'efectivo') {
            calculateChange();
        }
    };
});

// Función para cargar el resumen del pedido
function loadOrderSummary() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const orderSummary = document.getElementById('orderSummary');
    
    if (cart.length === 0) {
        orderSummary.innerHTML = '<p class="text-center text-muted">Tu carrito está vacío</p>';
        document.getElementById('totalAmount').textContent = 'Bs. 0.00';
        return;
    }
    
    let total = 0;
    
    // Validar y limpiar items con precios inválidos
    const validCart = cart.filter(item => {
        const price = Number(item.price) || 0;
        const quantity = Number(item.quantity) || 0;
        return !isNaN(price) && price > 0 && !isNaN(quantity) && quantity > 0;
    });
    
    if (validCart.length === 0) {
        orderSummary.innerHTML = '<p class="text-center text-muted">Tu carrito está vacío o contiene productos inválidos</p>';
        document.getElementById('totalAmount').textContent = 'Bs. 0.00';
        localStorage.removeItem('cart');
        return;
    }
    
    orderSummary.innerHTML = validCart.map(item => {
        const price = Number(item.price) || 0;
        const quantity = Number(item.quantity) || 0;
        const subtotal = price * quantity;
        total += subtotal;
        
        return `
            <div class="d-flex justify-content-between align-items-center mb-2">
                <div>
                    <strong>${item.name || 'Producto'}</strong>
                    <br>
                    <small class="text-muted">Cantidad: ${quantity}</small>
                </div>
                <span>Bs. ${subtotal.toFixed(2)}</span>
            </div>
        `;
    }).join('');
    
    document.getElementById('totalAmount').textContent = `Bs. ${total.toFixed(2)}`;
}

// Función para cargar información del usuario
function loadUserInfo() {
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    if (usuario) {
        const nombreCompleto = usuario.nombre || '';
        // Intentar dividir nombre completo en nombre y apellidos
        const partes = nombreCompleto.trim().split(/\s+/);
        if (partes.length >= 2) {
            document.getElementById('nombre').value = partes[0];
            document.getElementById('apellidos').value = partes.slice(1).join(' ');
        } else {
            document.getElementById('nombre').value = nombreCompleto;
        }
        // Cargar C.I. si está disponible
        if (usuario.ci) {
            document.getElementById('ci').value = usuario.ci;
        }
    }
}

// Función para manejar el cambio de método de pago
function handlePaymentMethodChange(event) {
    const selectedInput = event?.target || document.querySelector('input[name="paymentMethod"]:checked');
    const paymentMethod = selectedInput ? selectedInput.value : null;
    const efectivoOptions = document.getElementById('efectivoOptions');
    const qrPreview = document.getElementById('qrPaymentPreview');
    
    if (efectivoOptions) {
        if (paymentMethod === 'efectivo') {
            efectivoOptions.style.display = 'block';
            // Calcular cambio si ya hay un monto ingresado
            calculateChange();
        } else {
            efectivoOptions.style.display = 'none';
        }
    }
    
    if (qrPreview) {
        qrPreview.style.display = paymentMethod === 'qr' ? 'block' : 'none';
    }
}

// Función para calcular y mostrar el cambio
function calculateChange() {
    const montoEfectivo = parseFloat(document.getElementById('montoEfectivo').value) || 0;
    const totalAmount = parseFloat(document.getElementById('totalAmount').textContent.replace('Bs. ', '').replace(',', '')) || 0;
    const cambioInfo = document.getElementById('cambioInfo');
    const cambioAmount = document.getElementById('cambioAmount');
    
    if (montoEfectivo > 0 && montoEfectivo >= totalAmount) {
        const cambio = montoEfectivo - totalAmount;
        cambioAmount.textContent = `Bs. ${cambio.toFixed(2)}`;
        cambioInfo.style.display = 'block';
    } else if (montoEfectivo > 0 && montoEfectivo < totalAmount) {
        const faltante = totalAmount - montoEfectivo;
        cambioAmount.textContent = `Faltan Bs. ${faltante.toFixed(2)}`;
        cambioInfo.className = 'mt-2 alert alert-warning mb-0';
        cambioInfo.style.display = 'block';
    } else {
        cambioInfo.style.display = 'none';
    }
}

// Función para validar el formulario
function validateForm() {
    const nombre = document.getElementById('nombre').value.trim();
    const apellidos = document.getElementById('apellidos').value.trim();
    const ci = document.getElementById('ci').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const direccion = document.getElementById('direccion').value.trim();
    const fechaEntrega = document.getElementById('fechaEntrega').value;
    const horaEntrega = document.getElementById('horaEntrega').value;
    
    if (!nombre || !apellidos || !ci || !telefono || !direccion || !fechaEntrega || !horaEntrega) {
        notify('Checkout', 'Por favor, completa todos los campos obligatorios', 'warning');
        return false;
    }
    
    // Validar C.I. (solo números, mínimo 5 dígitos)
    const ciRegex = /^[0-9]{5,15}$/;
    if (!ciRegex.test(ci)) {
        notify('Checkout', 'El C.I. debe contener solo números (5-15 dígitos)', 'warning');
        return false;
    }
    
    // Validar teléfono (solo números y mínimo 7 dígitos)
    const phoneRegex = /^[0-9]{7,15}$/;
    if (!phoneRegex.test(telefono)) {
        notify('Checkout', 'Por favor, ingresa un número de teléfono válido', 'warning');
        return false;
    }
    
    // Validar fecha (solo puede ser hoy)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let selectedDate = null;
    if (fechaEntrega) {
        const [year, month, day] = fechaEntrega.split('-').map(Number);
        selectedDate = new Date(year, month - 1, day);
        selectedDate.setHours(0, 0, 0, 0);
    }

    if (!selectedDate || Number.isNaN(selectedDate.getTime())) {
        notify('Checkout', 'Selecciona una fecha de entrega válida.', 'warning');
        return false;
    }

    // Verificar que la fecha sea exactamente hoy
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    if (selectedDate < todayStart || selectedDate > todayEnd) {
        notify('Checkout', 'La fecha de entrega solo puede ser para hoy', 'warning');
        return false;
    }
    
    return true;
}

// Función para confirmar el pedido
async function confirmOrder() {
    if (!validateForm()) {
        return;
    }
    
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    if (cart.length === 0) {
        notify('Checkout', 'Tu carrito está vacío', 'warning');
        return;
    }

    const usuarioStorage = localStorage.getItem('usuario');
    if (!usuarioStorage) {
        notify('Checkout', 'Debes iniciar sesión para confirmar tu pedido.', 'error');
        window.location.href = 'index.html#login';
        return;
    }

    let usuarioData;
    try {
        usuarioData = JSON.parse(usuarioStorage);
    } catch (err) {
        console.error('No se pudo leer la información de usuario almacenada:', err);
        notify('Checkout', 'Ocurrió un problema con tu sesión. Inicia sesión nuevamente.', 'error');
        localStorage.removeItem('usuario');
        window.location.href = 'index.html#login';
        return;
    }

    const userId = usuarioData?.id_usuario ?? usuarioData?.user_id ?? usuarioData?.id ?? null;
    
    if (!userId) {
        notify('Checkout', 'No pudimos identificar tu cuenta. Inicia sesión de nuevo.', 'error');
        window.location.href = 'index.html#login';
        return;
    }
    
    // Obtener datos del formulario
    const nombre = document.getElementById('nombre').value.trim();
    const apellidos = document.getElementById('apellidos').value.trim();
    const ci = document.getElementById('ci').value.trim();
    const customerName = `${nombre} ${apellidos}`.trim();
    const phone = document.getElementById('telefono').value.trim();
    const address = document.getElementById('direccion').value.trim();
    const postalCode = document.getElementById('codigoPostal').value.trim();
    const references = document.getElementById('referencias').value.trim();
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
    const deliveryDate = document.getElementById('fechaEntrega').value;
    const deliveryTime = document.getElementById('horaEntrega').value;
    const saveAddress = document.getElementById('guardarDireccion').checked;
    const cashAmount = document.getElementById('montoEfectivo').value.trim();
    // Calcular total validando precios
    const totalAmount = cart.reduce((sum, item) => {
        const price = Number(item.price) || 0;
        const quantity = Number(item.quantity) || 0;
        if (isNaN(price) || price <= 0 || isNaN(quantity) || quantity <= 0) {
            return sum;
        }
        return sum + (price * quantity);
    }, 0);

    if (paymentMethod === 'efectivo') {
        const efectivoNumber = parseFloat(cashAmount.replace(',', '.'));
        if (Number.isNaN(efectivoNumber)) {
            notify('Checkout', 'Ingresa un monto en efectivo válido.', 'warning');
            return;
        }
        if (efectivoNumber < totalAmount) {
            notify('Checkout', `El monto en efectivo debe ser al menos Bs. ${totalAmount.toFixed(2)}.`, 'warning');
            return;
        }
    }

    const orderProducts = cart.map(item => ({
        id_producto: item.id ?? item.productId ?? item.id_producto ?? null,
        cantidad: item.quantity ?? item.qty ?? 1,
        precio: item.price ?? 0,
        size: item.size ?? null,
        nombre: item.name ?? ''
    })).filter(producto => producto.id_producto);

    if (orderProducts.length === 0) {
        notify('Checkout', 'No se pudieron determinar los productos del pedido.', 'error');
        return;
    }

    // Obtener coordenadas si están disponibles
    const lat = currentLat || parseFloat(document.getElementById('latitud').value) || null;
    const lng = currentLng || parseFloat(document.getElementById('longitud').value) || null;
    
    const orderPayload = {
        usuario_id: userId,
        total: totalAmount,
        productos: orderProducts,
        metodo_pago: paymentMethod,
        direccion: address,
        referencias,
        telefono: phone,
        codigo_postal: postalCode,
        fecha_entrega: deliveryDate,
        hora_entrega: deliveryTime,
        guardar_direccion: saveAddress,
        monto_efectivo: paymentMethod === 'efectivo' ? parseFloat(cashAmount.replace(',', '.')) : null,
        customer_name: customerName,
        ci: ci
    };
    
    // Agregar coordenadas si están disponibles
    if (lat && lng) {
        orderPayload.lat = lat;
        orderPayload.lng = lng;
    }
    
    try {
        // Enviar pedido a la API
        const response = await fetch('api/orders.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(orderPayload)
        });

        let result;
        try {
            result = await response.json();
        } catch (parseError) {
            console.error('No se pudo interpretar la respuesta del servidor:', parseError);
            notify('Checkout', 'El servidor devolvió una respuesta inesperada.', 'error');
            return;
        }

        if (!response.ok) {
            const message = result?.message || `Error ${response.status}: ${response.statusText}`;
            if (response.status === 401 || response.status === 403) {
                notify('Checkout', message, 'error');
                window.location.href = 'index.html#login';
            } else {
                notify('Checkout', 'Error al procesar el pedido: ' + message, 'error');
            }
            return;
        }
        
        if (result.success) {
            // Si se marcó guardar dirección y hay coordenadas, guardar la dirección
            if (saveAddress && lat && lng) {
                try {
                    const addressResponse = await fetch('api/addresses.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        credentials: 'include',
                        body: JSON.stringify({
                            direccion: address,
                            lat: lat,
                            lng: lng,
                            es_principal: 0
                        })
                    });
                    
                    if (addressResponse.ok) {
                        console.log('Dirección guardada exitosamente');
                    }
                } catch (error) {
                    console.error('Error al guardar dirección:', error);
                    // No bloquear el pedido si falla guardar la dirección
                }
            }
            
            // Limpiar carrito
            localStorage.removeItem('cart');
            
            // Redirigir a la página de recibo con QR
            const orderId = result.orderId || (result.id_pedido ? 'ORD-' + String(result.id_pedido).padStart(3, '0') : '');
            window.location.href = `order-receipt.html?orderId=${orderId}`;
        } else {
            notify('Checkout', 'Error al procesar el pedido: ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        notify('Checkout', 'Error al procesar el pedido. Por favor, intenta nuevamente.', 'error');
    }
}

// Función para mostrar modal de confirmación
function showConfirmationModal(orderId) {
    document.getElementById('orderNumber').textContent = `Número de pedido: ${orderId}`;
    document.getElementById('deliveryTime').textContent = document.getElementById('horaEntrega').value;
    
    const modal = new bootstrap.Modal(document.getElementById('confirmationModal'));
    modal.show();
}

// Función para ir a mis pedidos
function goToMyOrders() {
    window.location.href = 'views/usuario/index.html?section=orders';
}

// Función para volver al menú
function goBack() {
    window.location.href = 'index.html#menu';
}

// Variables para almacenar coordenadas
let currentLat = null;
let currentLng = null;

// Función para obtener ubicación actual
function getCurrentLocation() {
    const btnUbicacion = document.getElementById('btnUbicacionActual');
    const locationStatus = document.getElementById('locationStatus');
    
    if (!navigator.geolocation) {
        notify('Checkout', 'Tu navegador no soporta geolocalización.', 'warning');
        return;
    }
    
    // Deshabilitar botón mientras se obtiene la ubicación
    btnUbicacion.disabled = true;
    btnUbicacion.innerHTML = '<i class="bi bi-hourglass-split"></i> Obteniendo ubicación...';
    locationStatus.textContent = 'Obteniendo tu ubicación actual...';
    locationStatus.className = 'text-muted';
    
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            currentLat = position.coords.latitude;
            currentLng = position.coords.longitude;
            
            // Guardar coordenadas en campos ocultos
            document.getElementById('latitud').value = currentLat;
            document.getElementById('longitud').value = currentLng;
            
            // Intentar obtener la dirección usando reverse geocoding
            try {
                const address = await reverseGeocode(currentLat, currentLng);
                if (address) {
                    document.getElementById('direccion').value = address;
                }
            } catch (error) {
                console.error('Error al obtener dirección:', error);
            }
            
            // Actualizar UI
            btnUbicacion.disabled = false;
            btnUbicacion.innerHTML = '<i class="bi bi-check-circle"></i> Ubicación obtenida';
            btnUbicacion.classList.remove('btn-outline-primary');
            btnUbicacion.classList.add('btn-success');
            locationStatus.textContent = `Ubicación obtenida: ${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}`;
            locationStatus.className = 'text-success';
            
            notify('Checkout', 'Ubicación obtenida exitosamente. El delivery tendrá tu ubicación real.', 'success');
        },
        (error) => {
            console.error('Error al obtener ubicación:', error);
            let errorMessage = 'No se pudo obtener tu ubicación. ';
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage += 'Por favor, permite el acceso a tu ubicación en la configuración del navegador.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage += 'La información de ubicación no está disponible.';
                    break;
                case error.TIMEOUT:
                    errorMessage += 'Tiempo de espera agotado. Intenta nuevamente.';
                    break;
                default:
                    errorMessage += 'Por favor, ingresa tu dirección manualmente.';
                    break;
            }
            
            btnUbicacion.disabled = false;
            btnUbicacion.innerHTML = '<i class="bi bi-geo-alt"></i> Usar mi ubicación';
            locationStatus.textContent = '';
            notify('Checkout', errorMessage, 'warning');
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// Función para hacer reverse geocoding (obtener dirección desde coordenadas)
async function reverseGeocode(lat, lng) {
    try {
        // Usar Nominatim (OpenStreetMap) para reverse geocoding gratuito
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'PizzaSteve/1.0'
                }
            }
        );
        
        if (!response.ok) {
            throw new Error('Error en reverse geocoding');
        }
        
        const data = await response.json();
        
        if (data && data.address) {
            const addr = data.address;
            // Construir dirección legible
            const parts = [];
            
            if (addr.road) parts.push(addr.road);
            if (addr.house_number) parts.push(addr.house_number);
            if (addr.suburb || addr.neighbourhood) parts.push(addr.suburb || addr.neighbourhood);
            if (addr.city || addr.town || addr.village) parts.push(addr.city || addr.town || addr.village);
            
            return parts.join(', ') || data.display_name;
        }
        
        return data.display_name || null;
    } catch (error) {
        console.error('Error en reverse geocoding:', error);
        return null;
    }
}