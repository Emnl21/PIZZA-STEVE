/**
 * Sistema de Animación de Carga
 * Muestra una animación elegante mientras se cargan los datos
 */

class LoadingAnimation {
    constructor(options = {}) {
        this.options = {
            container: options.container || document.body,
            text: options.text || 'Cargando...',
            subtext: options.subtext || 'Por favor espera',
            variant: options.variant || 'default', // 'default' o 'minimal'
            showDots: options.showDots !== false,
            useGif: options.useGif || false, // Si es true, usa GIF en lugar de spinner CSS
            gifPath: options.gifPath || 'assets/images/loading.gif', // Ruta del GIF
            gifSize: options.gifSize || 'normal', // 'small', 'normal', 'large'
            ...options
        };
        this.overlay = null;
        this.isVisible = false;
    }

    /**
     * Crear el elemento de carga
     */
    create() {
        if (this.overlay) {
            return this.overlay;
        }

        this.overlay = document.createElement('div');
        this.overlay.className = `loading-overlay ${this.options.variant === 'minimal' ? 'minimal' : ''}`;
        this.overlay.id = 'loadingOverlay';
        this.overlay.setAttribute('aria-live', 'polite');
        this.overlay.setAttribute('aria-label', 'Cargando contenido');

        const container = document.createElement('div');
        container.className = 'loading-container';

        // Spinner o GIF principal
        let spinner;
        if (this.options.useGif && this.options.gifPath) {
            // Usar GIF
            spinner = document.createElement('img');
            spinner.className = `loading-gif ${this.options.gifSize}`;
            spinner.src = this.options.gifPath;
            spinner.alt = 'Cargando...';
            spinner.setAttribute('aria-hidden', 'true');
            // Fallback si el GIF no carga
            spinner.onerror = () => {
                // Si el GIF falla, crear spinner CSS como fallback
                const fallbackSpinner = document.createElement('div');
                fallbackSpinner.className = 'loading-spinner';
                fallbackSpinner.setAttribute('aria-hidden', 'true');
                if (spinner.parentNode) {
                    spinner.parentNode.replaceChild(fallbackSpinner, spinner);
                }
            };
        } else {
            // Usar spinner CSS
            spinner = document.createElement('div');
            spinner.className = 'loading-spinner';
            spinner.setAttribute('aria-hidden', 'true');
        }

        // Texto de carga
        const text = document.createElement('div');
        text.className = 'loading-text';
        text.textContent = this.options.text;

        // Subtexto opcional
        if (this.options.subtext) {
            const subtext = document.createElement('div');
            subtext.className = 'loading-subtext';
            subtext.textContent = this.options.subtext;
            container.appendChild(subtext);
        }

        // Dots opcionales
        if (this.options.showDots) {
            const dots = document.createElement('div');
            dots.className = 'loading-dots';
            for (let i = 0; i < 3; i++) {
                const dot = document.createElement('div');
                dot.className = 'loading-dot';
                dots.appendChild(dot);
            }
            container.appendChild(dots);
        }

        container.appendChild(spinner);
        container.appendChild(text);
        this.overlay.appendChild(container);

        return this.overlay;
    }

    /**
     * Mostrar la animación de carga
     */
    show(customText = null) {
        if (!this.overlay) {
            this.create();
        }

        if (customText) {
            const textEl = this.overlay.querySelector('.loading-text');
            if (textEl) {
                textEl.textContent = customText;
            }
        }

        this.options.container.appendChild(this.overlay);
        this.overlay.classList.remove('hidden');
        this.isVisible = true;

        // Prevenir scroll del body
        document.body.style.overflow = 'hidden';
    }

    /**
     * Ocultar la animación de carga
     */
    hide() {
        if (!this.overlay) {
            return;
        }

        this.overlay.classList.add('hidden');
        this.isVisible = false;

        // Restaurar scroll del body
        document.body.style.overflow = '';

        // Remover del DOM después de la animación
        setTimeout(() => {
            if (this.overlay && this.overlay.parentNode) {
                this.overlay.parentNode.removeChild(this.overlay);
            }
        }, 300);
    }

    /**
     * Actualizar el texto de carga
     */
    updateText(text, subtext = null) {
        if (!this.overlay) {
            return;
        }

        const textEl = this.overlay.querySelector('.loading-text');
        if (textEl) {
            textEl.textContent = text;
        }

        if (subtext) {
            let subtextEl = this.overlay.querySelector('.loading-subtext');
            if (!subtextEl) {
                subtextEl = document.createElement('div');
                subtextEl.className = 'loading-subtext';
                const container = this.overlay.querySelector('.loading-container');
                if (container) {
                    container.appendChild(subtextEl);
                }
            }
            subtextEl.textContent = subtext;
        }
    }

    /**
     * Verificar si está visible
     */
    isShowing() {
        return this.isVisible;
    }
}

// Crear instancia global
let globalLoading = null;

/**
 * Función helper para mostrar carga globalmente
 */
function showLoading(text = 'Cargando...', subtext = null) {
    if (!globalLoading) {
        globalLoading = new LoadingAnimation({
            text: text,
            subtext: subtext
        });
    }
    globalLoading.show(text);
    if (subtext) {
        globalLoading.updateText(text, subtext);
    }
}

/**
 * Función helper para ocultar carga globalmente
 */
function hideLoading() {
    if (globalLoading) {
        globalLoading.hide();
    }
}

/**
 * Función helper para cargar con promesa
 */
async function withLoading(promise, loadingText = 'Cargando...', subtext = null) {
    showLoading(loadingText, subtext);
    try {
        const result = await promise;
        hideLoading();
        return result;
    } catch (error) {
        hideLoading();
        throw error;
    }
}

// Exportar para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LoadingAnimation, showLoading, hideLoading, withLoading };
}

