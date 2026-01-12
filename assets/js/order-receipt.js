// ===============================
// 📄 PÁGINA DE RECIBO Y QR
// ===============================

const SIZE_LABELS = { small: 'Pequeña', medium: 'Mediana', large: 'Familiar' };

document.addEventListener('DOMContentLoaded', function() {
    // Obtener el ID del pedido de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('orderId');
    
    if (!orderId) {
        if (typeof notifyUser === 'function') {
            notifyUser('Error', 'No se proporcionó un ID de pedido válido', 'error');
        } else {
            alert('Error: No se proporcionó un ID de pedido válido');
        }
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return;
    }
    
    // Cargar información del pedido
    loadOrderDetails(orderId);
    
    // Configurar el input de archivo
    setupFileInput();
});

// Función para cargar los detalles del pedido
async function loadOrderDetails(orderId) {
    try {
        // Limpiar el ID del pedido (remover prefijo ORD- si existe)
        const cleanOrderId = orderId.replace('ORD-', '');
        
        const response = await fetch(`api/orders.php?id=${cleanOrderId}`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const order = await response.json();
        
        if (!order || !order.id_pedido) {
            throw new Error('Pedido no encontrado');
        }
        
        // Mostrar información del pedido
        displayOrderInfo(order);
        
        // Generar QR solo si el método de pago es QR
        const paymentMethod = order.paymentType || order.metodo_pago || '';
        const qrSection = document.getElementById('qr-section');
        if (qrSection) {
            if (paymentMethod.toLowerCase() === 'qr') {
                try {
                    generateQR(order);
                    qrSection.style.display = 'block';
                } catch (error) {
                    console.error('Error al generar QR:', error);
                    qrSection.style.display = 'block';
                    const qrContainer = document.getElementById('qrcode-container');
                    if (qrContainer) {
                        qrContainer.innerHTML = `
                            <div style="padding: 2rem; background: white; border-radius: 8px;">
                                <p style="color: #6c757d; margin-bottom: 0.5rem; font-weight: 500;">Error al generar QR</p>
                                <p style="color: #495057; font-size: 0.875rem;"><small>ID: ${order.id || `ORD-${String(order.id_pedido).padStart(3, '0')}`}</small></p>
                            </div>
                        `;
                    }
                }
            } else {
                qrSection.style.display = 'none';
            }
        }
        
        // Mostrar productos
        displayProducts(order.products || []);
        
    } catch (error) {
        console.error('Error al cargar detalles del pedido:', error);
        // Solo mostrar notificación si la función existe
        if (typeof notifyUser === 'function') {
            notifyUser('Error', 'No se pudo cargar la información del pedido: ' + error.message, 'error');
        } else {
            alert('Error: No se pudo cargar la información del pedido. ' + error.message);
        }
        // No redirigir automáticamente, dejar que el usuario decida
        console.log('Error capturado, la página permanecerá visible para depuración');
    }
}

// Función para mostrar la información del pedido
function displayOrderInfo(order) {
    try {
        // Número de pedido
        const orderNumberEl = document.getElementById('orderNumber');
        if (orderNumberEl) {
            const orderNumber = order.id || `ORD-${String(order.id_pedido).padStart(3, '0')}`;
            orderNumberEl.textContent = orderNumber;
        }
        
        // Fecha y hora
        const dateTimeEl = document.getElementById('orderDateTime');
        if (dateTimeEl) {
            let dateTime = '-';
            if (order.fecha_pedido) {
                try {
                    const fecha = new Date(order.fecha_pedido);
                    dateTime = fecha.toLocaleString('es-BO', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                } catch (e) {
                    dateTime = order.fecha_pedido;
                }
            }
            dateTimeEl.textContent = dateTime;
        }
        
        // Método de pago
        const paymentMethodEl = document.getElementById('paymentMethod');
        if (paymentMethodEl) {
            const paymentMethods = {
                'efectivo': 'Efectivo',
                'qr': 'Código QR'
            };
            paymentMethodEl.textContent = paymentMethods[order.paymentType || order.metodo_pago] || order.paymentType || order.metodo_pago || '-';
        }
        
        // Estado
        const orderStatusEl = document.getElementById('orderStatus');
        if (orderStatusEl) {
            const statusMap = {
                'pending': 'Pendiente',
                'preparing': 'En Preparación',
                'ready_for_delivery': 'Listo para Entrega',
                'out_for_delivery': 'En Camino',
                'completed': 'Completado',
                'cancelled': 'Cancelado'
            };
            const status = order.status || order.estado || 'pending';
            orderStatusEl.textContent = statusMap[status] || status;
        }
    } catch (error) {
        console.error('Error al mostrar información del pedido:', error);
    }
}

// Función para generar el código QR usando API externa
function generateQR(order) {
    try {
        const qrContainer = document.getElementById('qrcode-container');
        
        if (!qrContainer) {
            console.error('No se encontró el contenedor del QR');
            return;
        }
        
        // Crear objeto con información del pedido para el QR
        const qrData = {
            orderId: order.id || `ORD-${String(order.id_pedido).padStart(3, '0')}`,
            id_pedido: order.id_pedido,
            fecha: order.fecha_pedido,
            total: order.price || order.total,
            estado: order.status || order.estado,
            metodo_pago: order.paymentType || order.metodo_pago
        };
        
        // Convertir a JSON string
        const qrDataString = JSON.stringify(qrData);
        
        // Usar API de qrserver.com para generar el QR
        const encodedData = encodeURIComponent(qrDataString);
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodedData}`;
        
        qrContainer.innerHTML = `
            <img src="${qrUrl}" alt="QR Code" style="max-width: 200px; height: auto; display: block; margin: 0 auto;" 
                 onerror="this.parentElement.innerHTML='<div style=\\'padding: 2rem; background: white; border-radius: 8px;\\'><p style=\\'color: #212529; margin-bottom: 0.5rem; font-weight: 500;\\'>Error al cargar QR</p><p style=\\'color: #495057; font-size: 0.875rem;\\'><small>ID: ${qrData.orderId}</small></p></div>'">
        `;
        console.log('QR generado usando API (qrserver.com)');
    } catch (error) {
        console.error('Error crítico al generar QR:', error);
        const qrContainer = document.getElementById('qrcode-container');
        if (qrContainer) {
            qrContainer.innerHTML = `
                <div style="padding: 2rem; background: white; border-radius: 8px;">
                    <p style="color: #212529; margin-bottom: 0.5rem; font-weight: 500;">Error al generar QR</p>
                    <p style="color: #495057; font-size: 0.875rem;"><small>Por favor, recarga la página</small></p>
                </div>
            `;
        }
    }
}

// Función para mostrar los productos en la tabla
function displayProducts(products) {
    try {
        const tbody = document.getElementById('productsTableBody');
        const totalAmountEl = document.getElementById('totalAmount');
        
        if (!tbody) {
            console.error('No se encontró el tbody de productos');
            return;
        }
        
        let total = 0;
        
        if (!products || products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay productos en este pedido</td></tr>';
            if (totalAmountEl) {
                totalAmountEl.textContent = 'Bs. 0.00';
            }
            return;
        }
        
        tbody.innerHTML = products.map(product => {
            const cantidad = product.cantidad_producto || product.cantidad || 1;
            const precioUnitario = parseFloat(product.precio_u ?? product.precio ?? 0) || 0;
            const subtotal = cantidad * precioUnitario;
            total += subtotal;

            const rawSize = (product.tamano || product.size || 'medium').toString().toLowerCase();
            const sizeLabel = SIZE_LABELS[rawSize] || SIZE_LABELS.medium;

            const precioBaseRaw = parseFloat(product.precio_base ?? product.precioBase ?? precioUnitario);
            const precioBase = Number.isFinite(precioBaseRaw) ? precioBaseRaw : precioUnitario;

            const recargoRaw = parseFloat(product.recargo_tamano ?? product.recargo ?? (precioUnitario - precioBase));
            const recargo = Number.isFinite(recargoRaw) ? recargoRaw : 0;

            const baseTexto = `Base: Bs. ${precioBase.toFixed(2)}`;
            const diferenciaTexto = recargo > 0 ? `Dif. tamaño: Bs. ${recargo.toFixed(2)}` : 'Sin recargo por tamaño';
            
            return `
                <tr>
                    <td>
                        ${product.nombre || 'Producto'}
                        <div class="text-muted small">${baseTexto} • ${diferenciaTexto}</div>
                    </td>
                    <td>${sizeLabel}</td>
                    <td>${cantidad}</td>
                    <td>Bs. ${precioUnitario.toFixed(2)}</td>
                    <td>Bs. ${subtotal.toFixed(2)}</td>
                </tr>
            `;
        }).join('');
        
        if (totalAmountEl) {
            totalAmountEl.textContent = `Bs. ${total.toFixed(2)}`;
        }
    } catch (error) {
        console.error('Error al mostrar productos:', error);
    }
}

// Función para configurar el input de archivo
function setupFileInput() {
    const fileInput = document.getElementById('receiptFile');
    const uploadBtn = document.getElementById('uploadBtn');
    
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            displayFilePreview(file);
            uploadBtn.disabled = false;
        } else {
            hideFilePreview();
            uploadBtn.disabled = true;
        }
    });
}

// Función para mostrar la vista previa del archivo
function displayFilePreview(file) {
    const preview = document.getElementById('filePreview');
    const fileName = document.getElementById('fileName');
    const previewContent = document.getElementById('filePreviewContent');
    
    fileName.textContent = file.name;
    
    // Si es una imagen, mostrarla
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewContent.innerHTML = `<img src="${e.target.result}" alt="Vista previa" class="img-fluid">`;
        };
        reader.readAsDataURL(file);
    } else {
        previewContent.innerHTML = `<p class="text-muted"><i class="bi bi-file-earmark"></i> ${file.name} (${(file.size / 1024).toFixed(2)} KB)</p>`;
    }
    
    preview.style.display = 'block';
}

// Función para ocultar la vista previa
function hideFilePreview() {
    const preview = document.getElementById('filePreview');
    preview.style.display = 'none';
    document.getElementById('fileName').textContent = '';
    document.getElementById('filePreviewContent').innerHTML = '';
}

// Función para eliminar el archivo seleccionado
function removeFile() {
    document.getElementById('receiptFile').value = '';
    hideFilePreview();
    document.getElementById('uploadBtn').disabled = true;
    document.getElementById('uploadStatus').innerHTML = '';
}

// Función para subir el comprobante
async function uploadReceipt() {
    const fileInput = document.getElementById('receiptFile');
    const file = fileInput.files[0];
    const uploadStatus = document.getElementById('uploadStatus');
    const uploadBtn = document.getElementById('uploadBtn');
    
    if (!file) {
        if (typeof notifyUser === 'function') {
            notifyUser('Error', 'Por favor selecciona un archivo', 'warning');
        } else {
            alert('Por favor selecciona un archivo');
        }
        return;
    }
    
    // Obtener el ID del pedido
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('orderId');
    const cleanOrderId = orderId ? orderId.replace('ORD-', '') : null;
    
    if (!cleanOrderId) {
        if (typeof notifyUser === 'function') {
            notifyUser('Error', 'No se pudo identificar el pedido', 'error');
        } else {
            alert('No se pudo identificar el pedido');
        }
        return;
    }
    
    // Crear FormData para enviar el archivo
    const formData = new FormData();
    formData.append('receipt', file);
    formData.append('orderId', cleanOrderId);
    
    // Deshabilitar botón durante la subida
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Subiendo...';
    uploadStatus.innerHTML = '<div class="alert alert-info">Subiendo comprobante...</div>';
    
    try {
        const response = await fetch('api/upload_receipt.php', {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        
        // Verificar el tipo de contenido de la respuesta
        const contentType = response.headers.get('content-type');
        let result;
        
        if (contentType && contentType.includes('application/json')) {
            // Intentar parsear como JSON
            try {
                result = await response.json();
            } catch (jsonError) {
                // Si falla el parseo JSON, leer como texto para ver el error
                const textResponse = await response.text();
                console.error('Error al parsear JSON. Respuesta del servidor:', textResponse);
                throw new Error('El servidor devolvió una respuesta inválida. Verifica la consola para más detalles.');
            }
        } else {
            // Si no es JSON, leer como texto
            const textResponse = await response.text();
            console.error('El servidor no devolvió JSON. Respuesta:', textResponse);
            throw new Error('El servidor devolvió una respuesta inesperada. Verifica la consola para más detalles.');
        }
        
        if (response.ok && result.success) {
            uploadStatus.innerHTML = '<div class="alert alert-success"><i class="bi bi-check-circle"></i> Comprobante enviado</div>';
            if (typeof notifyUser === 'function') {
                notifyUser('Éxito', 'El comprobante ha sido subido correctamente', 'success');
            }
            
            // Mostrar widget de valoración después de subir el comprobante
            if (result.order_id) {
                // Guardar el ID del pedido para el widget de valoración
                localStorage.setItem('pending_rating_order', result.order_id);
                
                // Redirigir al menú inicial donde se mostrará el widget
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            } else {
                // Redirigir al menú inicial
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
            }
        } else {
            uploadStatus.innerHTML = `<div class="alert alert-danger"><i class="bi bi-exclamation-triangle"></i> ${result.message || 'Error al subir el comprobante'}</div>`;
            if (typeof notifyUser === 'function') {
                notifyUser('Error', result.message || 'Error al subir el comprobante', 'error');
            } else {
                alert(result.message || 'Error al subir el comprobante');
            }
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="bi bi-check-circle"></i> Subir Comprobante';
        }
    } catch (error) {
        console.error('Error al subir comprobante:', error);
        uploadStatus.innerHTML = `<div class="alert alert-danger"><i class="bi bi-exclamation-triangle"></i> Error: ${error.message}</div>`;
        if (typeof notifyUser === 'function') {
            notifyUser('Error', 'Error al subir el comprobante: ' + error.message, 'error');
        } else {
            alert('Error al subir el comprobante: ' + error.message);
        }
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="bi bi-check-circle"></i> Subir Comprobante';
    }
}

// Función para ir a mis pedidos
function goToMyOrders() {
    window.location.href = 'views/usuario/index.html?section=orders';
}

// Función para volver al menú
function goToMenu() {
    window.location.href = 'index.html#menu';
}

