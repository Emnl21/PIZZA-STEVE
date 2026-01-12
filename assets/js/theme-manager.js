// ===============================
// 🎨 GESTOR CENTRALIZADO DE TEMA
// ===============================
// Este archivo asegura que todos los paneles compartan el mismo estado de tema

(function() {
    'use strict';
    
    const THEME_KEY = 'theme';
    
    /**
     * Aplica el tema de manera consistente a todos los elementos del DOM
     * @param {string} theme - 'light' o 'dark'
     */
    function applyTheme(theme) {
        if (!theme || (theme !== 'light' && theme !== 'dark')) {
            // Si el tema no es válido, intentar obtenerlo del localStorage
            theme = localStorage.getItem(THEME_KEY) || 'light';
        }
        
        // Aplicar a document.documentElement (para Tailwind, Bootstrap 5.3 y otros)
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.setAttribute('data-bs-theme', theme);
        
        // Aplicar clase dark a document.documentElement (para Tailwind dark mode)
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        
        // Aplicar también a document.body (para algunos paneles que lo usan)
        if (theme === 'dark') {
            document.body.classList.add('dark');
        } else {
            document.body.classList.remove('dark');
        }

        // Mantener data attribute también en body para componentes que lo consultan
        document.body.setAttribute('data-theme', theme);
        document.body.setAttribute('data-bs-theme', theme);
        
        // Guardar en localStorage
        try {
            localStorage.setItem(THEME_KEY, theme);
        } catch (e) {
            console.warn('No se pudo guardar el tema en localStorage:', e);
        }
        
        // Disparar evento personalizado para que otros scripts puedan reaccionar
        window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
    }
    
    /**
     * Obtiene el tema actual
     * @returns {string} 'light' o 'dark'
     */
    function getCurrentTheme() {
        const saved = localStorage.getItem(THEME_KEY);
        if (saved === 'light' || saved === 'dark') {
            return saved;
        }
        // Si no hay tema guardado, usar el atributo del DOM
        const domTheme = document.documentElement.getAttribute('data-theme');
        if (domTheme === 'light' || domTheme === 'dark') {
            return domTheme;
        }
        // Por defecto, light
        return 'light';
    }
    
    /**
     * Alterna entre light y dark
     * @returns {string} El nuevo tema aplicado
     */
    function toggleTheme() {
        const current = getCurrentTheme();
        const next = current === 'light' ? 'dark' : 'light';
        applyTheme(next);
        return next;
    }
    
    /**
     * Inicializa el tema al cargar la página
     */
    function initTheme() {
        const savedTheme = getCurrentTheme();
        applyTheme(savedTheme);
    }
    
    // Inicializar tema cuando el script se carga
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTheme);
    } else {
        initTheme();
    }
    
    // Escuchar cambios en otras pestañas/ventanas
    window.addEventListener('storage', function(e) {
        if (e.key === THEME_KEY) {
            applyTheme(e.newValue || 'light');
        }
    });
    
    // Exponer funciones globalmente
    window.ThemeManager = {
        apply: applyTheme,
        get: getCurrentTheme,
        toggle: toggleTheme,
        init: initTheme
    };
    
    // También exponer funciones directamente para compatibilidad
    window.applyTheme = applyTheme;
    window.getCurrentTheme = getCurrentTheme;
    window.toggleTheme = toggleTheme;
})();

