// form-validation.js
// Funciones de validación de formularios

/**
 * Valida que un nombre solo contenga letras, espacios y acentos
 * @param {string} name - Nombre a validar
 * @returns {boolean}
 */
function isValidName(name) {
    if (!name || name.trim().length === 0) return false;
    // Permitir letras (incluyendo acentos), espacios y guiones/apóstrofes
    const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/;
    return nameRegex.test(name.trim()) && name.trim().length >= 2;
}

/**
 * Valida formato de email
 * @param {string} email - Email a validar
 * @returns {boolean}
 */
function isValidEmail(email) {
    if (!email || email.trim().length === 0) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
}

/**
 * Valida formato de teléfono (solo números, opcionalmente con +, espacios, guiones, paréntesis)
 * @param {string} phone - Teléfono a validar
 * @returns {boolean}
 */
function isValidPhone(phone) {
    if (!phone || phone.trim().length === 0) return true; // Opcional
    // Permitir números, espacios, guiones, paréntesis y +
    const phoneRegex = /^[0-9 ()+\-]+$/;
    const digitsOnly = phone.replace(/\D/g, '');
    return phoneRegex.test(phone.trim()) && digitsOnly.length >= 7 && digitsOnly.length <= 15;
}

/**
 * Valida dirección (texto con algunos caracteres especiales permitidos)
 * @param {string} address - Dirección a validar
 * @returns {boolean}
 */
function isValidAddress(address) {
    if (!address || address.trim().length === 0) return true; // Opcional
    // Permitir letras, números, espacios y caracteres comunes de direcciones
    const addressRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s\.,#\-]+$/;
    return addressRegex.test(address.trim()) && address.trim().length >= 5;
}

/**
 * Valida que un precio sea un número positivo
 * @param {number|string} price - Precio a validar
 * @returns {boolean}
 */
function isValidPrice(price) {
    const numPrice = parseFloat(price);
    return !isNaN(numPrice) && numPrice > 0;
}

/**
 * Valida que un stock sea un número entero no negativo
 * @param {number|string} stock - Stock a validar
 * @returns {boolean}
 */
function isValidStock(stock) {
    const numStock = parseInt(stock);
    return !isNaN(numStock) && numStock >= 0 && Number.isInteger(numStock);
}

/**
 * Valida que un porcentaje esté entre 0 y 100
 * @param {number|string} percentage - Porcentaje a validar
 * @returns {boolean}
 */
function isValidPercentage(percentage) {
    const numPercentage = parseFloat(percentage);
    return !isNaN(numPercentage) && numPercentage >= 0 && numPercentage <= 100;
}

/**
 * Valida que una contraseña tenga al menos 6 caracteres
 * @param {string} password - Contraseña a validar
 * @returns {boolean}
 */
function isValidPassword(password) {
    return password && password.length >= 6;
}

/**
 * Valida que una descripción tenga contenido válido
 * @param {string} description - Descripción a validar
 * @returns {boolean}
 */
function isValidDescription(description) {
    if (!description || description.trim().length === 0) return true; // Opcional
    return description.trim().length >= 3;
}

/**
 * Valida que un nombre de producto solo contenga letras, espacios y acentos (sin números)
 * @param {string} productName - Nombre del producto a validar
 * @returns {boolean}
 */
function isValidProductName(productName) {
    if (!productName || productName.trim().length === 0) return false;
    // Permitir letras (incluyendo acentos), espacios, guiones y apóstrofes, pero NO números
    const productNameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/;
    return productNameRegex.test(productName.trim()) && productName.trim().length >= 2;
}

/**
 * Valida un campo de nombre de producto en tiempo real
 * @param {HTMLElement} input - Campo de entrada
 */
function validateProductNameField(input) {
    const value = input.value.trim();
    if (value.length === 0) {
        if (input.hasAttribute('required')) {
            showFieldError(input, 'Este campo es requerido');
        } else {
            hideFieldError(input);
        }
        return false;
    }
    
    if (!isValidProductName(value)) {
        showFieldError(input, 'El nombre del producto solo puede contener letras, espacios y acentos. No se permiten números ni caracteres especiales.');
        return false;
    }
    
    hideFieldError(input);
    return true;
}

/**
 * Muestra mensaje de error en un campo
 * @param {HTMLElement} input - Campo de entrada
 * @param {string} message - Mensaje de error
 */
function showFieldError(input, message) {
    // Remover error previo
    hideFieldError(input);
    
    input.classList.add('is-invalid');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'invalid-feedback';
    errorDiv.textContent = message;
    input.parentElement.appendChild(errorDiv);
}

/**
 * Oculta mensaje de error de un campo
 * @param {HTMLElement} input - Campo de entrada
 */
function hideFieldError(input) {
    input.classList.remove('is-invalid');
    const errorDiv = input.parentElement.querySelector('.invalid-feedback');
    if (errorDiv) {
        errorDiv.remove();
    }
}

/**
 * Valida un campo de nombre en tiempo real
 * @param {HTMLElement} input - Campo de entrada
 */
function validateNameField(input) {
    const value = input.value.trim();
    if (value.length === 0) {
        if (input.hasAttribute('required')) {
            showFieldError(input, 'Este campo es requerido');
        } else {
            hideFieldError(input);
        }
        return false;
    }
    
    if (!isValidName(value)) {
        showFieldError(input, 'El nombre solo puede contener letras, espacios y acentos. Mínimo 2 caracteres.');
        return false;
    }
    
    hideFieldError(input);
    return true;
}

/**
 * Valida un campo de email en tiempo real
 * @param {HTMLElement} input - Campo de entrada
 */
function validateEmailField(input) {
    const value = input.value.trim();
    if (value.length === 0) {
        if (input.hasAttribute('required')) {
            showFieldError(input, 'Este campo es requerido');
        } else {
            hideFieldError(input);
        }
        return false;
    }
    
    if (!isValidEmail(value)) {
        showFieldError(input, 'Ingrese un email válido (ejemplo: usuario@dominio.com)');
        return false;
    }
    
    hideFieldError(input);
    return true;
}

/**
 * Valida un campo de teléfono en tiempo real
 * @param {HTMLElement} input - Campo de entrada
 */
function validatePhoneField(input) {
    const value = input.value.trim();
    if (value.length === 0) {
        hideFieldError(input);
        return true; // Opcional
    }
    
    if (!isValidPhone(value)) {
        showFieldError(input, 'Ingrese un teléfono válido (7-15 dígitos)');
        return false;
    }
    
    hideFieldError(input);
    return true;
}

/**
 * Valida un campo de dirección en tiempo real
 * @param {HTMLElement} input - Campo de entrada
 */
function validateAddressField(input) {
    const value = input.value.trim();
    if (value.length === 0) {
        hideFieldError(input);
        return true; // Opcional
    }
    
    if (!isValidAddress(value)) {
        showFieldError(input, 'La dirección debe tener al menos 5 caracteres y solo contener letras, números y caracteres comunes');
        return false;
    }
    
    hideFieldError(input);
    return true;
}

/**
 * Valida un campo de precio en tiempo real
 * @param {HTMLElement} input - Campo de entrada
 */
function validatePriceField(input) {
    const value = input.value.trim();
    if (value.length === 0) {
        if (input.hasAttribute('required')) {
            showFieldError(input, 'Este campo es requerido');
        } else {
            hideFieldError(input);
        }
        return false;
    }
    
    if (!isValidPrice(value)) {
        showFieldError(input, 'El precio debe ser un número mayor a 0');
        return false;
    }
    
    hideFieldError(input);
    return true;
}

/**
 * Valida un campo de stock en tiempo real
 * @param {HTMLElement} input - Campo de entrada
 */
function validateStockField(input) {
    const value = input.value.trim();
    if (value.length === 0) {
        if (input.hasAttribute('required')) {
            showFieldError(input, 'Este campo es requerido');
        } else {
            hideFieldError(input);
        }
        return false;
    }
    
    if (!isValidStock(value)) {
        showFieldError(input, 'El stock debe ser un número entero mayor o igual a 0');
        return false;
    }
    
    hideFieldError(input);
    return true;
}

/**
 * Valida un campo de porcentaje en tiempo real
 * @param {HTMLElement} input - Campo de entrada
 */
function validatePercentageField(input) {
    const value = input.value.trim();
    if (value.length === 0) {
        if (input.hasAttribute('required')) {
            showFieldError(input, 'Este campo es requerido');
        } else {
            hideFieldError(input);
        }
        return false;
    }
    
    if (!isValidPercentage(value)) {
        showFieldError(input, 'El porcentaje debe estar entre 0 y 100');
        return false;
    }
    
    hideFieldError(input);
    return true;
}

/**
 * Valida un campo de contraseña en tiempo real
 * @param {HTMLElement} input - Campo de entrada
 */
function validatePasswordField(input) {
    const value = input.value;
    if (value.length === 0) {
        if (input.hasAttribute('required')) {
            showFieldError(input, 'Este campo es requerido');
        } else {
            hideFieldError(input);
        }
        return false;
    }
    
    if (!isValidPassword(value)) {
        showFieldError(input, 'La contraseña debe tener al menos 6 caracteres');
        return false;
    }
    
    hideFieldError(input);
    return true;
}

/**
 * Formatea un campo de teléfono mientras el usuario escribe
 * @param {HTMLElement} input - Campo de entrada
 */
function formatPhoneField(input) {
    let value = input.value.replace(/\D/g, ''); // Solo números
    if (value.length > 15) {
        value = value.substring(0, 15);
    }
    input.value = value;
}

/**
 * Inicializa validaciones para todos los formularios
 */
function initializeFormValidations() {
    // Validación de nombres
    document.querySelectorAll('#userName, #editUserName, #deliveryName, #editDeliveryName, #branchName, #editBranchName').forEach(input => {
        input.addEventListener('blur', () => validateNameField(input));
        input.addEventListener('input', () => {
            if (input.classList.contains('is-invalid')) {
                validateNameField(input);
            }
        });
    });
    
    // Validación de nombres de productos (sin números)
    document.querySelectorAll('#productName, #editProductName').forEach(input => {
        input.addEventListener('blur', () => validateProductNameField(input));
        input.addEventListener('input', (e) => {
            // Prevenir que se escriban números
            const value = e.target.value;
            const cleanedValue = value.replace(/[0-9]/g, '');
            if (value !== cleanedValue) {
                e.target.value = cleanedValue;
            }
            if (input.classList.contains('is-invalid')) {
                validateProductNameField(input);
            }
        });
    });
    
    // Validación de emails
    document.querySelectorAll('#userEmail, #editUserEmail, #deliveryEmail, #editDeliveryEmail').forEach(input => {
        input.addEventListener('blur', () => validateEmailField(input));
        input.addEventListener('input', () => {
            if (input.classList.contains('is-invalid')) {
                validateEmailField(input);
            }
        });
    });
    
    // Validación de teléfonos
    document.querySelectorAll('#userPhone, #editUserPhone, #deliveryPhone, #editDeliveryPhone, #branchPhone, #editBranchPhone').forEach(input => {
        input.addEventListener('input', () => formatPhoneField(input));
        input.addEventListener('blur', () => validatePhoneField(input));
    });
    
    // Validación de direcciones
    document.querySelectorAll('#userAddress, #editUserAddress, #branchAddress, #editBranchAddress').forEach(input => {
        input.addEventListener('blur', () => validateAddressField(input));
        input.addEventListener('input', () => {
            if (input.classList.contains('is-invalid')) {
                validateAddressField(input);
            }
        });
    });
    
    // Validación de precios
    document.querySelectorAll('#productPrice, #editProductPrice').forEach(input => {
        input.addEventListener('blur', () => validatePriceField(input));
        input.addEventListener('input', () => {
            if (input.classList.contains('is-invalid')) {
                validatePriceField(input);
            }
        });
    });
    
    // Validación de stock
    document.querySelectorAll('#productStock, #editProductStock').forEach(input => {
        input.addEventListener('blur', () => validateStockField(input));
        input.addEventListener('input', () => {
            if (input.classList.contains('is-invalid')) {
                validateStockField(input);
            }
        });
    });
    
    // Validación de porcentajes
    document.querySelectorAll('#promotionDiscount, #editPromotionDiscount').forEach(input => {
        input.addEventListener('blur', () => validatePercentageField(input));
        input.addEventListener('input', () => {
            if (input.classList.contains('is-invalid')) {
                validatePercentageField(input);
            }
        });
    });
    
    // Validación de contraseñas
    document.querySelectorAll('#userPassword, #editUserPassword').forEach(input => {
        input.addEventListener('blur', () => validatePasswordField(input));
        input.addEventListener('input', () => {
            if (input.classList.contains('is-invalid')) {
                validatePasswordField(input);
            }
        });
    });
    
    // Validación de fechas (fecha inicio < fecha fin)
    const promotionStart = document.getElementById('promotionStart');
    const promotionEnd = document.getElementById('promotionEnd');
    const editPromotionStart = document.getElementById('editPromotionStart');
    const editPromotionEnd = document.getElementById('editPromotionEnd');
    
    if (promotionStart && promotionEnd) {
        [promotionStart, promotionEnd].forEach(input => {
            input.addEventListener('change', () => {
                const start = new Date(promotionStart.value);
                const end = new Date(promotionEnd.value);
                if (promotionStart.value && promotionEnd.value && start > end) {
                    showFieldError(promotionEnd, 'La fecha de fin debe ser posterior a la fecha de inicio');
                } else {
                    hideFieldError(promotionEnd);
                }
            });
        });
    }
    
    if (editPromotionStart && editPromotionEnd) {
        [editPromotionStart, editPromotionEnd].forEach(input => {
            input.addEventListener('change', () => {
                const start = new Date(editPromotionStart.value);
                const end = new Date(editPromotionEnd.value);
                if (editPromotionStart.value && editPromotionEnd.value && start > end) {
                    showFieldError(editPromotionEnd, 'La fecha de fin debe ser posterior a la fecha de inicio');
                } else {
                    hideFieldError(editPromotionEnd);
                }
            });
        });
    }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFormValidations);
} else {
    initializeFormValidations();
}

