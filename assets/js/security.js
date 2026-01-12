// assets/js/security.js
// Funciones de seguridad del lado del cliente

/**
 * Escapa HTML para prevenir XSS
 * @param {string} text Texto a escapar
 * @returns {string} Texto escapado
 */
function escapeHtml(text) {
    if (text === null || text === undefined) {
        return '';
    }
    
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Crea un elemento HTML de forma segura
 * @param {string} tag Nombre del tag
 * @param {string} text Contenido de texto (será escapado)
 * @param {Object} attributes Atributos del elemento
 * @returns {HTMLElement} Elemento creado
 */
function createSafeElement(tag, text, attributes = {}) {
    const element = document.createElement(tag);
    
    // Usar textContent en lugar de innerHTML para prevenir XSS
    if (text !== null && text !== undefined) {
        element.textContent = text;
    }
    
    // Agregar atributos de forma segura
    for (const [key, value] of Object.entries(attributes)) {
        if (key === 'innerHTML' || key === 'outerHTML') {
            console.warn('No usar innerHTML/outerHTML con datos del usuario. Use textContent o createSafeElement.');
            continue;
        }
        element.setAttribute(key, escapeHtml(String(value)));
    }
    
    return element;
}

/**
 * Inserta texto de forma segura en un elemento
 * @param {HTMLElement} element Elemento donde insertar
 * @param {string} text Texto a insertar (será escapado)
 */
function setSafeText(element, text) {
    if (element) {
        element.textContent = text !== null && text !== undefined ? String(text) : '';
    }
}

/**
 * Inserta HTML de forma segura (solo si confías en el contenido)
 * @param {HTMLElement} element Elemento donde insertar
 * @param {string} html HTML a insertar
 * @param {boolean} trusted Si es true, permite HTML (solo para contenido confiable)
 */
function setSafeHTML(element, html, trusted = false) {
    if (!element) return;
    
    if (trusted) {
        element.innerHTML = html;
    } else {
        // Por defecto, escapar y usar textContent
        element.textContent = html;
        console.warn('Se intentó insertar HTML sin marca de confianza. Se escapó automáticamente.');
    }
}

