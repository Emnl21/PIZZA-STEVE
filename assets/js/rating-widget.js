// ===============================
// ⭐ WIDGET DE VALORACIÓN
// ===============================

let currentOrderId = null;

// Función para mostrar el widget de valoración
function showRatingWidget(orderId) {
    if (!orderId) return;
    
    currentOrderId = orderId;
    const widget = document.getElementById('ratingWidget');
    if (!widget) return;
    
    // Resetear el widget
    const commentDiv = widget.querySelector('.rating-comment');
    const commentTextarea = document.getElementById('ratingComment');
    const submitBtn = document.getElementById('submitRating');
    
    if (commentDiv) commentDiv.style.display = 'none';
    if (commentTextarea) commentTextarea.value = '';
    
    // Remover selección previa
    widget.querySelectorAll('.rating-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // Mostrar el widget
    widget.style.display = 'block';
    
    // Agregar event listeners
    setupRatingWidgetListeners();
}

// Función para configurar los event listeners del widget
function setupRatingWidgetListeners() {
    const widget = document.getElementById('ratingWidget');
    if (!widget) return;
    
    // Botón de cerrar
    const closeBtn = widget.querySelector('.rating-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            hideRatingWidget();
        });
    }
    
    // Botones de valoración
    const ratingButtons = widget.querySelectorAll('.rating-btn');
    ratingButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remover selección de otros botones
            ratingButtons.forEach(b => b.classList.remove('selected'));
            // Agregar selección al botón clickeado
            this.classList.add('selected');
            
            // Mostrar campo de comentario
            const commentDiv = widget.querySelector('.rating-comment');
            if (commentDiv) {
                commentDiv.style.display = 'block';
            }
        });
    });
    
    // Botón de enviar
    const submitBtn = document.getElementById('submitRating');
    if (submitBtn) {
        submitBtn.addEventListener('click', function() {
            submitRating();
        });
    }
}

// Función para ocultar el widget
function hideRatingWidget() {
    const widget = document.getElementById('ratingWidget');
    if (widget) {
        widget.style.display = 'none';
    }
    currentOrderId = null;
    // Limpiar el localStorage
    localStorage.removeItem('pending_rating_order');
}

// Función para enviar la valoración
async function submitRating() {
    if (!currentOrderId) return;
    
    const widget = document.getElementById('ratingWidget');
    const selectedBtn = widget.querySelector('.rating-btn.selected');
    
    if (!selectedBtn) {
        if (typeof notifyUser === 'function') {
            notifyUser('Aviso', 'Por favor selecciona una opción de valoración', 'warning');
        } else {
            alert('Por favor selecciona una opción de valoración');
        }
        return;
    }
    
    const satisfaccion = selectedBtn.getAttribute('data-rating');
    const comentario = document.getElementById('ratingComment')?.value || '';
    
    const submitBtn = document.getElementById('submitRating');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Enviando...';
    }
    
    try {
        const response = await fetch('api/ratings.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                order_id: parseInt(currentOrderId),
                satisfaccion: satisfaccion,
                comentario: comentario
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            if (typeof notifyUser === 'function') {
                notifyUser('¡Gracias!', 'Tu valoración ha sido registrada. ¡Apreciamos tu feedback!', 'success');
            } else {
                alert('¡Gracias! Tu valoración ha sido registrada.');
            }
            
            hideRatingWidget();
        } else {
            throw new Error(result.message || 'Error al enviar la valoración');
        }
    } catch (error) {
        console.error('Error al enviar valoración:', error);
        if (typeof notifyUser === 'function') {
            notifyUser('Error', 'No se pudo enviar la valoración. Por favor, intenta de nuevo.', 'error');
        } else {
            alert('Error al enviar la valoración. Por favor, intenta de nuevo.');
        }
        
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Enviar Valoración';
        }
    }
}

// Verificar si hay un pedido pendiente de valoración al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    // Esperar un poco para que la página cargue completamente
    setTimeout(() => {
        const pendingOrder = localStorage.getItem('pending_rating_order');
        if (pendingOrder) {
            // Mostrar el widget después de un pequeño delay
            setTimeout(() => {
                showRatingWidget(pendingOrder);
            }, 1000);
        }
    }, 500);
});

