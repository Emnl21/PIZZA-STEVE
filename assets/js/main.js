// ===============================
// 🌐 Navegación SPA + Login/Logout
// ===============================

function normalizeMessage(message) {
  if (message == null) return '';

  if (typeof message === 'object') {
    if (message.message) {
      return normalizeMessage(message.message);
    }
    try {
      return JSON.stringify(message, null, 2);
    } catch (_) {
      return String(message);
    }
  }

  return String(message);
}

function notifyUser(title, message, type = 'info', duration = 5000) {
  const safeMessage = normalizeMessage(message);

  if (typeof window.notify === 'function' && window.notify !== notifyUser) {
    window.notify(title, safeMessage, type, duration);
    return;
  }

  if (window.notificationSystem && typeof window.notificationSystem.showNotification === 'function') {
    window.notificationSystem.showNotification({
      titulo: title,
      mensaje: safeMessage,
      tipo: type,
      duracion: duration
    });
    return;
  }

  // Fallback minimal toast using Bootstrap alerts
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
    success: 'alert-success',
    error: 'alert-danger',
    warning: 'alert-warning',
    info: 'alert-info'
  };
  const alertClass = typeMap[type] || typeMap.info;

  const alertEl = document.createElement('div');
  alertEl.className = `alert ${alertClass} shadow-sm fade show`;
  alertEl.setAttribute('role', 'alert');
  alertEl.innerHTML = `<strong>${title}</strong><div>${safeMessage}</div>`;
  container.appendChild(alertEl);

  setTimeout(() => {
    alertEl.classList.remove('show');
    alertEl.classList.add('hide');
    setTimeout(() => {
      if (alertEl.parentNode) {
        alertEl.parentNode.removeChild(alertEl);
      }
    }, 300);
  }, duration);
}

document.addEventListener("DOMContentLoaded", () => {
  const navLinks = document.querySelectorAll(".nav-link");

  // Toggle de tema manual (persistente) - Usa ThemeManager centralizado
  // El tema se inicializa automáticamente por theme-manager.js
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const next = window.toggleTheme ? window.toggleTheme() : (window.ThemeManager ? window.ThemeManager.toggle() : 'light');
      themeBtn.innerHTML = next === 'light' ? '<i class="bi bi-sun"></i>' : '<i class="bi bi-moon"></i>';
    });
    
    // Actualizar icono según tema actual
    const updateIcon = () => {
      const current = window.getCurrentTheme ? window.getCurrentTheme() : (window.ThemeManager ? window.ThemeManager.get() : 'light');
      themeBtn.innerHTML = current === 'light' ? '<i class="bi bi-sun"></i>' : '<i class="bi bi-moon"></i>';
    };
    
    // Actualizar icono al cargar
    setTimeout(updateIcon, 100);
    
    // Escuchar cambios de tema
    window.addEventListener('themechange', updateIcon);
  }

  // --- Navegación SPA ---
  navLinks.forEach(link => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      const page = this.getAttribute("data-page");
      if (page) {
        mostrarSeccion(page);
      }
    });
  });

  // --- Botón "ORDENAR AHORA" ---
  const orderNowBtn = document.getElementById("orderNowBtn");
  if (orderNowBtn) {
    orderNowBtn.addEventListener("click", (e) => {
      e.preventDefault();
      mostrarSeccion("menu");
    });
  }

  // --- Formulario de Login ---
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    // Validación en tiempo real - Soporte para ambos formularios (pizza y normal)
    const emailInput = document.getElementById("pizzaEmail") || document.getElementById("email");
    const passwordInput = document.getElementById("pizzaPassword") || document.getElementById("password");
    
    // Toggle para mostrar/ocultar contraseña en login
    const togglePasswordBtn = document.getElementById("pizzaTogglePassword") || document.getElementById("togglePassword");
    const passwordIcon = document.getElementById("passwordIcon");
    if (togglePasswordBtn && passwordInput) {
      // El toggle de pizza ya maneja su propio icono, solo necesitamos el del formulario normal
      if (passwordIcon && !document.getElementById("pizzaTogglePassword")) {
        togglePasswordBtn.addEventListener("click", function(e) {
          e.preventDefault();
          const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
          passwordInput.setAttribute("type", type);
          
          // Cambiar icono
          if (type === "password") {
            passwordIcon.classList.remove("bi-eye-slash");
            passwordIcon.classList.add("bi-eye");
          } else {
            passwordIcon.classList.remove("bi-eye");
            passwordIcon.classList.add("bi-eye-slash");
          }
        });
      }
    }
    
    if (emailInput) {
      emailInput.addEventListener("blur", function() {
        if (!this.value || !this.validity.valid) {
          this.classList.add("is-invalid");
        } else {
          this.classList.remove("is-invalid");
        }
      });
    }
    
    if (passwordInput) {
      passwordInput.addEventListener("blur", function() {
        if (!this.value || this.value.length < 6) {
          this.classList.add("is-invalid");
        } else {
          this.classList.remove("is-invalid");
        }
      });
    }
    
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      // Validación antes de enviar
      let isValid = true;
      if (emailInput && (!emailInput.value || !emailInput.validity.valid)) {
        emailInput.classList.add("is-invalid");
        isValid = false;
      }
      if (passwordInput && (!passwordInput.value || passwordInput.value.length < 6)) {
        passwordInput.classList.add("is-invalid");
        isValid = false;
      }
      
      if (!isValid) {
        return;
      }

      const formData = new FormData(loginForm);

      try {
        // Convertir FormData a JSON
        const formDataObj = {};
        formData.forEach((value, key) => {
          formDataObj[key] = value;
        });
        
        // Obtener email del input correcto (pizza o normal)
        const emailValue = emailInput ? emailInput.value : (formDataObj.email || formDataObj.username);
        const passwordValue = passwordInput ? passwordInput.value : formDataObj.password;
        
        const response = await fetch("api/login.php", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            username: emailValue,
            password: passwordValue
          })
        });

        if (!response.ok) {
          const text = await response.text();
          console.error("Error del servidor:", text);
          try {
            const errorResult = JSON.parse(text);
            let errorMessage = errorResult.message || 'Error al iniciar sesión';
            
            // Mostrar intentos restantes si están disponibles
            if (errorResult.attempts_remaining !== undefined) {
              const remaining = errorResult.attempts_remaining;
              const total = errorResult.attempts_total || 5;
              
              if (remaining > 0) {
                errorMessage += ` (Intentos restantes: ${remaining} de ${total})`;
              } else {
                errorMessage += ` (Se ha deshabilitado el inicio de sesión. Intenta más tarde.)`;
              }
            }
            
            notifyUser('Inicio de sesión', errorMessage, 'error');
          } catch (e) {
            notifyUser('Inicio de sesión', 'Error al iniciar sesión. Por favor intenta de nuevo.', 'error');
          }
          return;
        }
        
        const text = await response.text();
        let result;
        try {
          result = JSON.parse(text);
        } catch (err) {
          console.error("Error al parsear JSON:", err, "Respuesta:", text);
          notifyUser('Respuesta inválida', 'El servidor no devolvió JSON válido.', 'error');
          return;
        }
        
        // Mostrar intentos restantes si el login falló
        if (!result.success && result.attempts_remaining !== undefined) {
          const remaining = result.attempts_remaining;
          const total = result.attempts_total || 5;
          
          let errorMessage = result.message || 'Error al iniciar sesión';
          if (remaining > 0) {
            errorMessage += ` (Intentos restantes: ${remaining} de ${total})`;
          } else {
            errorMessage += ` (Se ha deshabilitado el inicio de sesión. Intenta más tarde.)`;
          }
          
          notifyUser('Inicio de sesión', errorMessage, 'error');
          return;
        }
        
        if (!result.success) {
          notifyUser('Inicio de sesión', result.message || 'Error al iniciar sesión', 'error');
          return;
        }
        
        console.log("Respuesta login:", result);

        if (result.success) {
          // Limpiar cualquier mensaje de intentos si el login fue exitoso
          const userId = result.id_usuario
            ?? result.user_id
            ?? result.id
            ?? result.usuario_id
            ?? result.idUsuario
            ?? null;
          
          const normalizedUser = {
            id_usuario: userId,
            user_id: userId,
            id: userId,
            nombre: result.nombre ?? result.username ?? '',
            rol: (result.role ?? result.rol ?? 'cliente').toLowerCase()
          };

          // Persistir siempre en un formato consistente
          localStorage.setItem("usuario", JSON.stringify(normalizedUser));

          const nombreSeguro = (typeof escapeHtml !== 'undefined' && typeof escapeHtml === 'function') 
            ? escapeHtml(normalizedUser.nombre) 
            : (normalizedUser.nombre || '').replace(/[&<>"']/g, function(m) {
                const map = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'};
                return map[m] || m;
              });
          document.getElementById("loginNavItem").outerHTML =
            `<li class="nav-item">
              <a class="nav-link" href="#" id="logoutBtn">👋 Hola, ${nombreSeguro} (Salir)</a>
            </li>`;

          // Verificar si debe cambiar contraseña
          if (result.debe_cambiar_password === true) {
            // Mostrar modal para cambiar contraseña
            const changePasswordModal = new bootstrap.Modal(document.getElementById('changePasswordModal'));
            changePasswordModal.show();
            return; // No redirigir hasta que cambie la contraseña
          }

          // Redirección según rol
          const userRole = normalizedUser.rol;
          switch (userRole) {
            case "admin":
              window.location.href = "views/admin/index.html";
              break;
            case "vendedor":
              window.location.href = "views/vendedor/index.html";
              break;
            case "cliente":
              mostrarSeccion("menu"); 
              break;
            case "repartidor":
              window.location.href = "views/delivery/index.html";
              break;
            default:
              mostrarSeccion("menu");
          }
        } else {
          notifyUser('Inicio de sesión', result.message || 'No se pudo iniciar sesión.', 'warning');
        }
      } catch (error) {
        console.error("Error en login:", error);
        notifyUser('Inicio de sesión', 'Ocurrió un error al intentar iniciar sesión.', 'error');
      }
    });
  }

  // --- Formulario de Registro ---
  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    // Validación en tiempo real
    const nombreInput = document.getElementById("nombre");
    const emailRegInput = document.getElementById("emailReg");
    const passwordRegInput = document.getElementById("passwordReg");
    const telefonoRegInput = document.getElementById("telefonoReg");
    
    // Toggle para mostrar/ocultar contraseña en registro
    const togglePasswordRegBtn = document.getElementById("togglePasswordReg");
    const passwordRegIcon = document.getElementById("passwordRegIcon");
    if (togglePasswordRegBtn && passwordRegInput && passwordRegIcon) {
      togglePasswordRegBtn.addEventListener("click", function(e) {
        e.preventDefault();
        const type = passwordRegInput.getAttribute("type") === "password" ? "text" : "password";
        passwordRegInput.setAttribute("type", type);
        
        // Cambiar icono
        if (type === "password") {
          passwordRegIcon.classList.remove("bi-eye-slash");
          passwordRegIcon.classList.add("bi-eye");
        } else {
          passwordRegIcon.classList.remove("bi-eye");
          passwordRegIcon.classList.add("bi-eye-slash");
        }
      });
    }
    
    // Función auxiliar para validar nombre
    function validateName(input) {
      const value = input.value.trim();
      const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/;
      if (!value || value.length < 2 || !nameRegex.test(value)) {
        input.classList.add("is-invalid");
        return false;
      }
      input.classList.remove("is-invalid");
      return true;
    }
    
    // Función auxiliar para validar teléfono
    function validatePhone(input) {
      const value = input.value.trim();
      const digitsOnly = value.replace(/\D/g, '');
      if (!value || digitsOnly.length < 7 || digitsOnly.length > 15) {
        input.classList.add("is-invalid");
        return false;
      }
      input.classList.remove("is-invalid");
      return true;
    }
    
    if (nombreInput) {
      nombreInput.addEventListener("blur", () => validateName(nombreInput));
      nombreInput.addEventListener("input", () => {
        if (nombreInput.classList.contains("is-invalid")) {
          validateName(nombreInput);
        }
      });
    }
    
    if (emailRegInput) {
      emailRegInput.addEventListener("blur", function() {
        if (!this.value || !this.validity.valid) {
          this.classList.add("is-invalid");
        } else {
          this.classList.remove("is-invalid");
        }
      });
    }
    
    if (passwordRegInput) {
      passwordRegInput.addEventListener("blur", function() {
        if (!this.value || this.value.length < 6) {
          this.classList.add("is-invalid");
        } else {
          this.classList.remove("is-invalid");
        }
      });
    }
    
    if (telefonoRegInput) {
      telefonoRegInput.addEventListener("blur", () => validatePhone(telefonoRegInput));
      telefonoRegInput.addEventListener("input", function() {
        // Solo permitir números, espacios, guiones, paréntesis y +
        this.value = this.value.replace(/[^0-9 ()+\-]/g, '');
        if (this.classList.contains("is-invalid")) {
          validatePhone(telefonoRegInput);
        }
      });
    }
    
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      // Validación antes de enviar
      let isValid = true;
      if (nombreInput && !validateName(nombreInput)) isValid = false;
      if (emailRegInput && (!emailRegInput.value || !emailRegInput.validity.valid)) {
        emailRegInput.classList.add("is-invalid");
        isValid = false;
      }
      if (passwordRegInput && (!passwordRegInput.value || passwordRegInput.value.length < 6)) {
        passwordRegInput.classList.add("is-invalid");
        isValid = false;
      }
      if (telefonoRegInput && !validatePhone(telefonoRegInput)) isValid = false;
      
      if (!isValid) {
        return;
      }

      // Convertir FormData a objeto JSON
      const formDataObj = {};
      const formData = new FormData(registerForm);
      formData.forEach((value, key) => {
        formDataObj[key] = value;
      });

      try {
        const response = await fetch("api/register.php", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(formDataObj)
        });

        if (!response.ok) {
          const text = await response.text();
          console.error("Error del servidor:", text);
          try {
            const errorResult = JSON.parse(text);
            notifyUser('Registro', errorResult.message || 'Error al registrar', 'error');
          } catch (e) {
            notifyUser('Registro', 'Error al registrar. Por favor intenta de nuevo.', 'error');
          }
          return;
        }

        const result = await response.json();
        console.log("Respuesta registro:", result);

        if (result.success) {
          notifyUser('Registro', 'Registro exitoso. Ahora puedes iniciar sesión.', 'success');
          mostrarSeccion("login");
        } else {
          notifyUser('Registro', result.message || 'No se pudo completar el registro.', 'warning');
        }
      } catch (error) {
        console.error("Error en registro:", error);
        notifyUser('Registro', 'Ocurrió un error al intentar registrarte.', 'error');
      }
    });
  }

  // Mostrar registro desde login
  document.getElementById("showRegister")?.addEventListener("click", (e) => {
    e.preventDefault();
    mostrarSeccion("register");
  });

  // Mostrar login desde registro
  document.getElementById("showLogin")?.addEventListener("click", (e) => {
    e.preventDefault();
    mostrarSeccion("login");
  });

  // --- Logout ---
  document.addEventListener("click", async (e) => {
    const targetElement = e.target instanceof Element ? e.target : null;
    let logoutLink = null;

    if (targetElement) {
      if (targetElement.id === "logoutBtn") {
        logoutLink = targetElement;
      } else if (typeof targetElement.closest === "function") {
        logoutLink = targetElement.closest("#logoutBtn");
      }
    }

    if (logoutLink) {
      e.preventDefault();
      const confirmed = await showLogoutConfirmation();
      if (!confirmed) return;
      try {
        await fetch("controllers/logout.php", { credentials: 'include' });
      } catch (error) {
        console.error('Error al cerrar sesión:', error);
      }
      localStorage.removeItem("usuario");
      if (typeof notifyUser === 'function') {
        notifyUser('Sesión cerrada', 'Tu sesión se cerró correctamente.', 'info');
      }
      setTimeout(() => location.reload(), 300);
    }
  });

  // --- Año dinámico ---
  const yearSpan = document.getElementById("year");
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  // --- Cargar productos desde la API ---
  loadProducts();
  
  // --- Inicializar carrito ---
  initializeCart();

  // --- Inicializar búsqueda y filtrado ---
  initializeSearchAndFilter();

  // Actualizar icono de toggle según tema actual
  const themeBtnInit = document.getElementById('themeToggle');
  if (themeBtnInit) {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    themeBtnInit.innerHTML = current === 'light' ? '<i class="bi bi-sun"></i>' : '<i class="bi bi-moon"></i>';
  }
});

// Tamaños de pizza y multiplicadores (protegidos contra redefinición)
var SIZE_FACTORS = window.SIZE_FACTORS || { small: 1.0, medium: 1.3, large: 1.6 };
var SIZE_LABELS = window.SIZE_LABELS || { small: 'Pequeña', medium: 'Mediana', large: 'Familiar' };
window.SIZE_FACTORS = SIZE_FACTORS;
window.SIZE_LABELS = SIZE_LABELS;

// Utilidad: Formato de moneda Bolivianos (Bs.)
function formatCurrencyBOB(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return 'Bs. 0.00';
  return 'Bs. ' + n.toFixed(2);
}

function showLogoutConfirmation() {
  const modalEl = document.getElementById('logoutConfirmModal');
  if (!modalEl || typeof bootstrap === 'undefined') {
    return Promise.resolve(window.confirm('¿Deseas cerrar sesión?'));
  }

  return new Promise((resolve) => {
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    const confirmBtn = document.getElementById('confirmLogoutBtn');
    let decided = false;

    const cleanup = () => {
      confirmBtn?.removeEventListener('click', onConfirm);
      modalEl.removeEventListener('hidden.bs.modal', onHidden);
    };

    const onConfirm = () => {
      decided = true;
      cleanup();
      modal.hide();
      resolve(true);
    };

    const onHidden = () => {
      cleanup();
      if (!decided) {
        resolve(false);
      }
    };

    confirmBtn?.addEventListener('click', onConfirm, { once: true });
    modalEl.addEventListener('hidden.bs.modal', onHidden, { once: true });
    modal.show();
  });
}

// ===============================
// 📌 Función para mostrar secciones
// ===============================
function mostrarSeccion(pageId) {
  document.querySelectorAll("main > section").forEach(section => {
    section.classList.remove("active");
    section.style.display = "none";
  });

  const target = document.getElementById(pageId);
  if (target) {
    target.classList.add("active");
    target.style.display = "block";
    
    // Si se muestra el menú, asegurar que los productos estén cargados y renderizados
    if (pageId === 'menu') {
      // Siempre usar loadProducts() que carga y renderiza con renderProducts (incluye selector de tamaño)
      if (products.length === 0 && filteredProducts.length === 0) {
        // Si no hay productos, cargarlos
        loadProducts();
      } else if (filteredProducts.length > 0) {
        // Si hay productos filtrados, renderizarlos de nuevo para asegurar que los listeners estén activos
        setTimeout(() => {
          renderProducts(filteredProducts);
        }, 100);
      } else if (products.length > 0) {
        // Si hay productos pero no filtrados, filtrarlos y renderizarlos
        filteredProducts = [...products];
        setTimeout(() => {
          renderProducts(filteredProducts);
        }, 100);
      } else {
        // Si no hay productos en ninguna variable, cargar desde la API
        loadProducts();
      }
    }
  }
}

// Manejar navegación por hash al cargar la página
window.addEventListener('load', () => {
  const hash = window.location.hash.substring(1);
  if (hash) {
    // Esperar un momento para que el DOM esté completamente cargado
    setTimeout(() => {
      mostrarSeccion(hash);
    }, 100);
  }
});

// Manejar cambios de hash
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.substring(1);
  if (hash) {
    mostrarSeccion(hash);
  }
});

// ===============================
// 🛒 SISTEMA DE CARRITO DE COMPRAS
// ===============================

// Función para inicializar el carrito
function initializeCart() {
  if (!localStorage.getItem('cart')) {
    localStorage.setItem('cart', JSON.stringify([]));
  }
  updateCartCounter();
}

// Función para cargar productos desde la API
async function loadProducts() {
  try {
    const response = await fetch('api/products.php', {
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const loadedProducts = await response.json();
    
    // Validar que sea un array
    if (!Array.isArray(loadedProducts)) {
      console.error('La API no devolvió un array:', loadedProducts);
      throw new Error('Formato de respuesta inválido');
    }
    
    // Validar y normalizar precios de productos
    const normalizedProducts = loadedProducts.map(product => {
      // Asegurar que el precio sea numérico
      if (product.precio !== undefined) {
        product.precio = parseFloat(product.precio) || 0;
      } else if (product.price !== undefined) {
        product.precio = parseFloat(product.price) || 0;
        delete product.price; // Normalizar a 'precio'
      } else {
        product.precio = 0;
      }
      
      // Validar que el precio sea válido
      if (isNaN(product.precio) || product.precio <= 0) {
        console.warn('Producto con precio inválido:', product);
      }
      
      return product;
    });
    
    if (normalizedProducts.length > 0) {
      products = normalizedProducts;
      window.products = products; // Asegurar que esté disponible globalmente
      filteredProducts = [...products];
      
      // Cargar categorías dinámicamente desde los productos
      loadCategoriesFromProducts(products);
      
      // Renderizar productos con selector de tamaño
      renderProducts(filteredProducts);
      
      // También actualizar la variable pizzas para compatibilidad
      pizzas = normalizedProducts
        .filter(product => product.activa !== 0)
        .map(product => ({
          id: product.id_producto || product.id,
          name: product.nombre,
          category: (product.categoria || '').toLowerCase() || 'general',
          price: parseFloat(product.precio) || 0,
          popular: 0,
          description: product.descripcion || '',
          image: product.imagen || product.img || getProductImage(product.nombre)
        }));
      
      return;
    }
  } catch (error) {
    console.error('Error al cargar productos:', error);
  }
  
  // Si no hay productos o hay error, mostrar mensaje
  if (products.length === 0) {
    console.warn('No se pudieron cargar productos desde la API');
    const menuContainer = document.getElementById('pizzaMenu');
    if (menuContainer) {
      menuContainer.innerHTML = '<div class="col-12 text-center"><p class="text-muted">No hay productos disponibles en este momento.</p></div>';
    }
  } else {
    filteredProducts = [...products];
    renderProducts(filteredProducts);
  }
}

// Mapeo de nombres de productos a archivos de imágenes
const productImageMap = {
  'margarita': 'margarita.png',
  'pepperoni': 'pepperoni.png',
  'hawaiana': 'hawaiana.png',
  'champiñón': 'pizza-con-champinones.jpg',
  'champinon': 'pizza-con-champinones.jpg',
  'champiñones': 'pizza-con-champinones.jpg',
  '4 estaciones': '4_estaciones.jpg',
  'cuatro estaciones': '4_estaciones.jpg',
  'ranchera': 'ranchera.jpg',
  'vegetariana': 'veggie.png',
  'veggie': 'veggie.png',
  'napolitana': 'napolitana.jpg',
  'bbq': 'BBQ_Chiken.webp',
  'bbq chicken': 'BBQ_Chiken.webp',
  'carnes': 'carnes.png',
  'quesos': 'pizza-cuatro-quesos.webp',
  'cuatro quesos': 'pizza-cuatro-quesos.webp',
  'mexicana': 'pizza_mexicana.jpg',
  'anchoas': 'pizza-de-anchoas.jpg',
  'salchicha': 'pizza_salchicha.jpg',
  'pimiento': 'Pizza_pimiento.jpg',
  'pimientos': 'Pizza_pimiento.jpg'
};

// Función para obtener la imagen del producto
function getProductImage(productName) {
  if (!productName) return 'views/vendedor/assets/img/logo.png';
  
  const nombreLower = productName.toLowerCase().trim();
  
  // Remover "pizza" del inicio si existe para mejor matching
  const nombreSinPizza = nombreLower.replace(/^pizza\s+/, '');
  
  // Buscar coincidencia exacta o parcial
  for (const [key, imageFile] of Object.entries(productImageMap)) {
    if (nombreLower.includes(key) || nombreSinPizza.includes(key)) {
      // Construir ruta relativa desde Index.html (raíz del proyecto)
      const imagePath = imageFile.includes('/') ? imageFile : `views/vendedor/assets/img/${imageFile}`;
      return imagePath;
    }
  }
  
  // Si no hay coincidencia, usar imagen por defecto
  return 'views/vendedor/assets/img/logo.png';
}

// Función para renderizar productos en el menú
function renderProducts(products) {
  const pizzaMenu = document.getElementById('pizzaMenu');
  if (!pizzaMenu) {
    console.warn('No se encontró el elemento pizzaMenu');
    return;
  }
  
  if (products.length === 0) {
    pizzaMenu.innerHTML = `
      <div class="col-12">
        <div class="text-center">
          <i class="bi bi-search display-4 text-muted"></i>
          <p class="text-muted">No se encontraron productos que coincidan con tu búsqueda</p>
        </div>
      </div>
    `;
    return;
  }
  
  // Función auxiliar para escape HTML (si no está definida globalmente)
  const escapeHtmlLocal = typeof escapeHtml !== 'undefined' && typeof escapeHtml === 'function' 
    ? escapeHtml 
    : function(text) {
        if (text === null || text === undefined) return '';
        const map = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'};
        return String(text).replace(/[&<>"']/g, m => map[m]);
      };
  
  // Limpiar el contenedor
  pizzaMenu.innerHTML = '';
  
  // Renderizar cada producto individualmente para poder agregar event listeners
  products.forEach(product => {
    const nombreSeguro = escapeHtmlLocal(product.nombre || '');
    const descripcionSegura = escapeHtmlLocal(product.descripcion || '');
    
    // Obtener ID del producto (puede ser id_producto o id)
    const productId = product.id_producto || product.id;
    if (!productId) {
      console.error('Producto sin ID:', product);
      return; // Saltar este producto
    }
    
    // Obtener precio base del producto (asegurar que sea numérico)
    const precioBase = parseFloat(product.precio) || parseFloat(product.price) || 0;
    
    // Validar que el precio sea válido
    if (isNaN(precioBase) || precioBase <= 0) {
      console.error('Producto con precio inválido:', product);
      return; // Saltar este producto
    }
    
    // Detectar si es pizza (similar a la lógica del vendedor)
    const categoriaLower = (product.categoria || '').toLowerCase();
    const nombreLower = (product.nombre || '').toLowerCase();
    const isPizza = categoriaLower === 'pizza' || nombreLower.includes('pizza');
    
    // Usar la función getProductImage para obtener la imagen correcta
    let imagenSegura = product.imagen || product.img;
    if (!imagenSegura || imagenSegura.includes('pexels.com') || imagenSegura.includes('placeholder')) {
      imagenSegura = getProductImage(product.nombre);
    }
    
    // Calcular precio inicial (mediana por defecto para pizzas, precio base para otros)
    const precioInicial = isPizza ? (precioBase * SIZE_FACTORS.medium) : precioBase;
    
    // Crear el elemento de la tarjeta
    const colDiv = document.createElement('div');
    colDiv.className = 'col';
    colDiv.innerHTML = `
      <div class="card h-100 shadow-sm">
        <img src="${imagenSegura}" class="card-img-top" alt="${nombreSeguro}" style="height: 200px; object-fit: cover;" onerror="this.onerror=null; this.src='https://via.placeholder.com/300x200?text=Imagen+no+disponible';">
        <div class="card-body d-flex flex-column">
          <h5 class="card-title">${nombreSeguro}</h5>
          <p class="card-text flex-grow-1">${descripcionSegura || product.desc || ''}</p>

          ${isPizza ? `
          <div class="row g-2 align-items-center mb-2">
            <div class="col-7">
              <label for="size-${productId}" class="form-label small mb-1">Tamaño:</label>
              <select class="form-select form-select-sm" id="size-${productId}">
                <option value="small">Pequeña</option>
                <option value="medium" selected>Mediana</option>
                <option value="large">Familiar</option>
              </select>
            </div>
            <div class="col-5 text-end">
              <label class="form-label small mb-1 d-block">Precio:</label>
              <span id="price-${productId}" class="h6 mb-0 fw-bold text-primary">${formatCurrencyBOB(precioInicial)}</span>
            </div>
          </div>
          ` : `
          <div class="mb-2 text-end">
            <span class="h6 mb-0 fw-bold text-primary">${formatCurrencyBOB(precioBase)}</span>
          </div>
          `}

          <div class="d-flex justify-content-end mt-2">
            <button class="btn btn-primary btn-add-cart" data-product-id="${productId}" data-product-name="${nombreSeguro}" data-product-price="${precioBase}" data-is-pizza="${isPizza ? '1' : '0'}">
              <i class="bi bi-cart-plus"></i> Agregar al Carrito
            </button>
          </div>
        </div>
      </div>
    `;
    
    pizzaMenu.appendChild(colDiv);
    
    // Agregar event listeners después de insertar en el DOM
    // Si es pizza, agregar listener para actualizar precio al cambiar tamaño
    if (isPizza) {
      const sizeSelect = colDiv.querySelector(`#size-${productId}`);
      const priceEl = colDiv.querySelector(`#price-${productId}`);
      
      if (sizeSelect && priceEl) {
        sizeSelect.addEventListener('change', function() {
          const size = this.value;
          const factor = SIZE_FACTORS[size] || 1.0;
          const newPrice = precioBase * factor;
          priceEl.textContent = formatCurrencyBOB(newPrice);
        });
      }
    }
    
    // Agregar listener al botón de agregar al carrito
    const addButton = colDiv.querySelector('.btn-add-cart');
    if (addButton) {
      // Usar una función arrow para mantener el contexto correcto
      addButton.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        try {
          handleAddToCart(this);
        } catch (error) {
          console.error('Error al agregar al carrito:', error);
          notifyUser('Error', 'Hubo un problema al agregar el producto al carrito. Por favor, intenta de nuevo.', 'error');
        }
      });
    } else {
      console.warn('No se encontró el botón de agregar al carrito para el producto:', productId);
    }
  });
}

// Función para recalcular el precio visible en la tarjeta (ya no se usa con la nueva lógica, pero se mantiene por compatibilidad)
function updateCardPrice(id, basePrice) {
  const sel = document.getElementById(`size-${id}`);
  const priceEl = document.getElementById(`price-${id}`);
  if (!sel || !priceEl) {
    return; // Silenciosamente retornar si no existe (puede ser un producto sin tamaño)
  }
  
  const basePriceNum = parseFloat(basePrice);
  if (isNaN(basePriceNum) || basePriceNum <= 0) {
    return;
  }
  
  const factor = SIZE_FACTORS[sel.value] || 1.0;
  const newPrice = basePriceNum * factor;
  priceEl.textContent = formatCurrencyBOB(newPrice);
}

// Función para manejar el botón Agregar con tamaño (similar a la lógica del vendedor)
async function handleAddToCart(button) {
  if (!button) {
    console.error('handleAddToCart: button es null o undefined');
    notifyUser('Error', 'Error al procesar el producto. Por favor, intenta de nuevo.', 'error');
    return;
  }
  
  const idStr = button.getAttribute('data-product-id');
  const id = parseInt(idStr);
  
  if (isNaN(id) || id <= 0) {
    console.error('handleAddToCart: ID de producto inválido', { idStr, id });
    notifyUser('Error', 'ID de producto inválido. Por favor, recarga la página.', 'error');
    return;
  }
  
  const name = button.getAttribute('data-product-name') || '';
  const basePriceStr = button.getAttribute('data-product-price');
  const isPizzaStr = button.getAttribute('data-is-pizza');
  const isPizza = isPizzaStr === '1';
  
  // Obtener el precio base del atributo (debe estar siempre presente)
  let basePrice = parseFloat(basePriceStr);
  
  // Obtener información del producto para verificar stock
  const productsArray = products.length > 0 ? products : (window.products || []);
  let product = productsArray.find(p => {
    const pId = p.id_producto || p.id;
    return pId === id;
  });
  
  // Si no está en el array local, obtener del API
  if (!product) {
    try {
      const response = await fetch(`../../api/products.php?id=${id}`);
      if (response.ok) {
        product = await response.json();
      }
    } catch (error) {
      console.error('Error fetching product:', error);
    }
  }
  
  // Verificar stock si está disponible
  if (product && product.stock_disponible !== undefined && product.stock_disponible !== null) {
    const stock = parseInt(product.stock_disponible, 10);
    if (stock <= 0) {
      notifyUser('Producto Agotado', `Lo sentimos, ${name} no está disponible en este momento.`, 'error');
      return;
    }
  }
  
  // Si el precio del atributo no es válido, usar el del producto
  if (isNaN(basePrice) || basePrice <= 0) {
    if (product) {
      basePrice = parseFloat(product.precio) || parseFloat(product.price) || 0;
    }
  }
  
  // Validar que tenemos un precio base válido
  if (isNaN(basePrice) || basePrice <= 0) {
    console.error('Precio inválido:', { 
      basePriceStr, 
      id, 
      name,
      isPizza,
      button: button,
      productsArray: products.length > 0 ? products.length : (window.products ? window.products.length : 0)
    });
    notifyUser('Error', 'No se pudo obtener el precio del producto. Por favor, recarga la página.', 'error');
    return;
  }
  
  // Obtener el tamaño seleccionado (solo para pizzas)
  let size = null;
  let finalPrice = basePrice;
  
  if (isPizza) {
    const sizeSel = document.getElementById(`size-${id}`);
    if (sizeSel) {
      size = sizeSel.value || 'medium';
      const factor = SIZE_FACTORS[size] || 1.0;
      finalPrice = basePrice * factor;
    } else {
      console.warn(`No se encontró el selector de tamaño para el producto ${id}, usando tamaño por defecto`);
      size = 'medium';
      finalPrice = basePrice * SIZE_FACTORS.medium;
    }
  }
  
  // Validar precio final
  if (isNaN(finalPrice) || finalPrice <= 0) {
    console.error('Precio final inválido:', { basePrice, size, finalPrice, isPizza });
    notifyUser('Error', 'Error al calcular el precio. Por favor, intenta de nuevo.', 'error');
    return;
  }
  
  console.log(`Agregando: ${name}, ${isPizza ? `Tamaño: ${size} (${SIZE_LABELS[size]})` : 'Sin tamaño'}, Precio: ${finalPrice.toFixed(2)}`);
  addToCart(id, name, finalPrice, size);
}

// Función para verificar si el usuario está logueado
function checkUserSession() {
  try {
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    const userId = usuario?.id_usuario ?? usuario?.user_id ?? usuario?.id;
    return Boolean(userId ?? false);
  } catch (error) {
    console.error('Error al verificar la sesión almacenada:', error);
    return false;
  }
}

// Función para mostrar modal de login requerido
function showLoginRequiredModal() {
  // Crear modal si no existe
  let loginModal = document.getElementById('loginRequiredModal');
  if (!loginModal) {
    loginModal = document.createElement('div');
    loginModal.id = 'loginRequiredModal';
    loginModal.className = 'modal fade';
    loginModal.setAttribute('tabindex', '-1');
    loginModal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Inicio de Sesión Requerido</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <p>Para agregar productos al carrito, necesitas iniciar sesión.</p>
            <p class="text-muted">¿Deseas iniciar sesión ahora?</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-primary" id="goToLoginBtn">Iniciar Sesión</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(loginModal);
    
    // Event listener para el botón de login
    document.getElementById('goToLoginBtn').addEventListener('click', () => {
      const modal = bootstrap.Modal.getInstance(loginModal);
      if (modal) modal.hide();
      mostrarSeccion('login');
    });
  }
  
  // Mostrar el modal
  const modal = new bootstrap.Modal(loginModal);
  modal.show();
}

// Función para agregar productos al carrito (similar a la lógica del vendedor)
function addToCart(id, name, price, size = null) {
  // Verificar si el usuario está logueado
  if (!checkUserSession()) {
    showLoginRequiredModal();
    return;
  }
  
  // Validar y convertir precio a número
  const numericPrice = Number(price);
  if (isNaN(numericPrice) || numericPrice <= 0) {
    console.error('Precio inválido al agregar al carrito:', price);
    notifyUser('Error', 'El precio del producto no es válido. Por favor, intenta de nuevo.', 'error');
    return;
  }
  
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  
  // Clave única por id+size para diferenciar tamaños (similar al vendedor)
  const key = size ? `${id}-${size}` : id.toString();
  const existingItem = cart.find(item => {
    if (size) {
      return item.key === key;
    } else {
      return item.id === id && !item.size;
    }
  });
  
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      key,
      id,
      name,
      size: size || null,
      price: numericPrice, // Asegurar que sea un número
      quantity: 1
    });
  }
  
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCounter();
  
  // Mostrar notificación con tamaño si aplica
  const sizeText = size ? ` (${SIZE_LABELS[size]})` : '';
  showNotification(`Agregado: ${name}${sizeText}`, 'success');
}

// Función para actualizar el contador del carrito
function updateCartCounter() {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  
  let cartCounter = document.getElementById('cartCounter');
  if (!cartCounter) {
    const navbar = document.querySelector('.navbar-nav');
    const cartNavItem = document.createElement('li');
    cartNavItem.className = 'nav-item';
    cartNavItem.innerHTML = `
      <a class="nav-link position-relative" href="#" onclick="showCart()" data-bs-toggle="modal" data-bs-target="#cartModal">
        <i class="bi bi-cart3"></i> Carrito
        <span id="cartCounter" class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
          ${totalItems}
        </span>
      </a>
    `;
    navbar.appendChild(cartNavItem);
  } else {
    cartCounter.textContent = totalItems;
    cartCounter.style.display = totalItems > 0 ? 'block' : 'none';
  }
}

// Función para mostrar el carrito
function showCart() {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  const cartModalBody = document.getElementById('cartModalBody');
  
  if (cart.length === 0) {
    cartModalBody.innerHTML = '<p class="text-center">Tu carrito está vacío</p>';
    return;
  }
  
  // Validar y limpiar items con precios inválidos
  const validCart = cart.filter(item => {
    const price = Number(item.price) || 0;
    const quantity = Number(item.quantity) || 0;
    if (isNaN(price) || price <= 0 || isNaN(quantity) || quantity <= 0) {
      console.warn('Item inválido en carrito:', item);
      return false;
    }
    // Asegurar que el precio sea numérico
    item.price = price;
    item.quantity = quantity;
    return true;
  });
  
  // Guardar carrito limpio si hubo cambios
  if (validCart.length !== cart.length) {
    localStorage.setItem('cart', JSON.stringify(validCart));
    notifyUser('Carrito', 'Se eliminaron algunos productos inválidos del carrito.', 'warning');
  }
  
  const total = validCart.reduce((sum, item) => {
    const price = Number(item.price) || 0;
    const quantity = Number(item.quantity) || 0;
    return sum + (price * quantity);
  }, 0);
  
  cartModalBody.innerHTML = `
    <div class="table-responsive">
      <table class="table">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Precio</th>
            <th>Cantidad</th>
            <th>Subtotal</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${validCart.map(item => {
            const price = Number(item.price) || 0;
            const quantity = Number(item.quantity) || 0;
            const subtotal = price * quantity;
            return `
            <tr>
              <td>${item.name || 'Producto'}<div class="text-muted small">${item.size ? SIZE_LABELS[item.size] : 'Mediana'}</div></td>
              <td>${formatCurrencyBOB(price)}</td>
              <td>
                <div class="input-group input-group-sm" style="width: 120px;">
                  <button class="btn btn-outline-secondary" onclick="updateQuantity('${item.key}', ${quantity - 1})">-</button>
                  <input type="text" class="form-control text-center" value="${quantity}" readonly>
                  <button class="btn btn-outline-secondary" onclick="updateQuantity('${item.key}', ${quantity + 1})">+</button>
                </div>
              </td>
              <td>${formatCurrencyBOB(subtotal)}</td>
              <td>
                <button class="btn btn-sm btn-danger" onclick="removeFromCart('${item.key}')">
                  <i class="bi bi-trash"></i>
                </button>
              </td>
            </tr>
          `;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div class="d-flex justify-content-between align-items-center mt-3">
      <h5>Total: ${formatCurrencyBOB(total)}</h5>
      <button class="btn btn-success" onclick="proceedToCheckout()">Proceder al pago</button>
    </div>
  `;
}

// Función para actualizar cantidad
function updateQuantity(key, newQuantity) {
  if (newQuantity <= 0) {
    removeFromCart(key);
    return;
  }
  
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  const item = cart.find(item => item.key === key);
  
  if (item) {
    item.quantity = newQuantity;
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCounter();
    showCart();
  }
}

// Función para eliminar producto del carrito
function removeFromCart(key) {
  let cart = JSON.parse(localStorage.getItem('cart')) || [];
  cart = cart.filter(item => item.key !== key);
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCounter();
  showCart();
}

// Función para proceder al checkout
function proceedToCheckout() {
  const usuario = JSON.parse(localStorage.getItem('usuario'));
  if (!usuario) {
    notifyUser('Inicio de sesión requerido', 'Por favor inicia sesión para continuar con tu pedido', 'warning');
    mostrarSeccion('login');
    return;
  }
  
  window.location.href = 'checkout.html';
}

// Función para mostrar notificaciones
function showNotification(message, type = 'info') {
  notifyUser('Pizza Steve', message, type);
}

// Variables globales para productos y filtrado
let products = [];
let filteredProducts = [];

// Asegurar que products esté disponible globalmente
window.products = products;

// Función para inicializar búsqueda y filtrado
function initializeSearchAndFilter() {
  const searchInput = document.getElementById('searchInput');
  const categoryFilter = document.getElementById('categoryFilter');
  const priceFilter = document.getElementById('priceFilter');

  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
  }
  if (categoryFilter) {
    categoryFilter.addEventListener('change', applyFilters);
  }
  if (priceFilter) {
    priceFilter.addEventListener('change', applyFilters);
  }
}

// Función para cargar categorías dinámicamente desde los productos
function loadCategoriesFromProducts(products) {
  const categoryFilter = document.getElementById('categoryFilter');
  if (!categoryFilter) return;
  
  // Obtener categorías únicas de los productos
  const categories = [...new Set(products.map(p => p.categoria).filter(c => c))];
  
  // Guardar la opción seleccionada actual
  const currentValue = categoryFilter.value;
  
  // Limpiar opciones existentes (excepto "Todas las categorías")
  categoryFilter.innerHTML = '<option value="">Todas las categorías</option>';
  
  // Agregar categorías dinámicamente
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  });
  
  // Restaurar selección si existe
  if (currentValue && categories.includes(currentValue)) {
    categoryFilter.value = currentValue;
  }
}

// Función para aplicar filtros y búsqueda
function applyFilters() {
  const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
  const selectedCategory = document.getElementById('categoryFilter')?.value || '';
  const selectedPrice = document.getElementById('priceFilter')?.value || '';

  filteredProducts = products.filter(product => {
    const matchesSearch = product.nombre.toLowerCase().includes(searchTerm) ||
                         (product.descripcion && product.descripcion.toLowerCase().includes(searchTerm));
    
    // Comparación exacta de categoría (case-sensitive)
    const matchesCategory = !selectedCategory || product.categoria === selectedCategory;
    
    let matchesPrice = true;
    if (selectedPrice) {
      const [min, max] = selectedPrice.split('-').map(Number);
      matchesPrice = product.precio >= min && (max ? product.precio <= max : true);
    }

    return matchesSearch && matchesCategory && matchesPrice;
  });

  // Aplicar ordenamiento si existe sortFilter
  const sortFilter = document.getElementById('sortFilter');
  if (sortFilter) {
    const sortBy = sortFilter.value;
    filteredProducts.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.nombre || '').localeCompare(b.nombre || '');
        case 'price-low':
          return (parseFloat(a.precio) || 0) - (parseFloat(b.precio) || 0);
        case 'price-high':
          return (parseFloat(b.precio) || 0) - (parseFloat(a.precio) || 0);
        case 'popular':
          return 0; // Se puede implementar popularidad más adelante
        default:
          return 0;
      }
    });
  }

  renderProducts(filteredProducts);
}

// --- Restaurar sesión si existe ---
const usuarioGuardado = localStorage.getItem("usuario");
if (usuarioGuardado) {
  try {
    const user = JSON.parse(usuarioGuardado);
    const nombreBase = user?.nombre ?? user?.username ?? '';
    const rolNormalizado = (user?.rol ?? user?.role ?? 'cliente').toLowerCase();

    // Usar escapeHtml para prevenir XSS
    const nombreSeguro = (typeof escapeHtml !== 'undefined' && typeof escapeHtml === 'function') 
      ? escapeHtml(nombreBase) 
      : (nombreBase || '').replace(/[&<>"']/g, function(m) {
          const map = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'};
          return map[m] || m;
        });

    const loginNavItem = document.getElementById("loginNavItem");
    if (loginNavItem) {
      loginNavItem.outerHTML =
        `<li class="nav-item">
           <a class="nav-link" href="#" id="logoutBtn">👋 Hola, ${nombreSeguro} (Salir)</a>
         </li>`;
    }

    switch (rolNormalizado) {
      case "admin":
        window.location.href = "views/admin/index.html";
        break;
      case "vendedor":
        window.location.href = "views/vendedor/index.html";
        break;
      case "cliente":
        mostrarSeccion("menu");
        break;
      case "repartidor":
        window.location.href = "views/delivery/index.html";
        break;
      default:
        mostrarSeccion("home");
    }
  } catch (error) {
    console.error('No se pudo restaurar la sesión almacenada:', error);
    localStorage.removeItem("usuario");
  }
}

// Funciones para filtrado y ordenamiento
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const sortFilter = document.getElementById('sortFilter');
const pizzaMenu = document.getElementById('pizzaMenu');

// Variable para almacenar pizzas cargadas desde la API
let pizzas = [];

// Función para cargar pizzas desde la API
async function loadPizzasFromAPI() {
  try {
    const response = await fetch('api/products.php');
    if (!response.ok) {
      throw new Error('Error al cargar productos');
    }
    const apiProducts = await response.json();
    
    // Convertir productos de la API al formato esperado por el sistema de filtrado
    pizzas = apiProducts
      .filter(product => product.activa !== 0) // Solo productos activos
      .map(product => ({
        id: product.id_producto,
        name: product.nombre,
        category: product.categoria?.toLowerCase() || 'general',
        price: parseFloat(product.precio) || 0,
        popular: 0, // Se puede calcular desde estadísticas si es necesario
        description: product.descripcion || '',
        image: product.imagen || getProductImage(product.nombre)
      }));
    
    // También actualizar la variable products para que renderProducts pueda usarla
    if (products.length === 0) {
      products = apiProducts.filter(product => product.activa !== 0);
      window.products = products;
      filteredProducts = [...products];
    }
    
    // Cargar pizzas al iniciar si el menú está visible
    if (pizzas.length > 0) {
      filterAndSortPizzas();
    } else {
      displayPizzas([]);
    }
  } catch (error) {
    console.error('Error al cargar pizzas desde la API:', error);
    pizzas = [];
    displayPizzas([]);
  }
}


// Función para filtrar y ordenar pizzas
function filterAndSortPizzas() {
  // Siempre usar el sistema principal que usa renderProducts (con selector de tamaño)
  if (products.length > 0) {
    // Usar la función de filtrado principal que renderiza con selector de tamaño
    applyFilters();
  } else {
    // Si products no está disponible, cargar productos primero
    loadProducts();
  }
}

// Función para mostrar las pizzas (actualizada para usar renderProducts que incluye selector de tamaño)
function displayPizzas(pizzasToShow) {
  if (!pizzaMenu) return;
  
  // Convertir pizzas al formato esperado por renderProducts
  const productsToRender = pizzasToShow.map(pizza => ({
    id_producto: pizza.id,
    id: pizza.id,
    nombre: pizza.name,
    descripcion: pizza.description,
    precio: pizza.price,
    categoria: pizza.category,
    imagen: pizza.image,
    img: pizza.image,
    activa: 1
  }));
  
  // Usar renderProducts que incluye el selector de tamaño para pizzas
  renderProducts(productsToRender);
}

// Eventos para los filtros (solo si los elementos existen)
if (searchInput) {
  searchInput.addEventListener('input', filterAndSortPizzas);
}
if (categoryFilter) {
  categoryFilter.addEventListener('change', filterAndSortPizzas);
}
if (sortFilter) {
  sortFilter.addEventListener('change', filterAndSortPizzas);
}

// Cargar pizzas al iniciar y cuando se muestre la sección de menú
document.addEventListener('DOMContentLoaded', () => {
  // Cargar productos desde la API (esto también carga pizzas)
  // loadProducts() ya se llama en el otro DOMContentLoaded, pero asegurémonos de que se ejecute
  if (products.length === 0) {
    loadProducts();
  }
  
  // También cargar pizzas para compatibilidad con el sistema de filtrado antiguo
  loadPizzasFromAPI();
  
  // Observar cuando se muestra la sección de menú para recargar si es necesario
  const menuSection = document.getElementById('menu');
  if (menuSection) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
          const isVisible = menuSection.style.display !== 'none' && 
                           menuSection.offsetParent !== null &&
                           getComputedStyle(menuSection).display !== 'none';
          if (isVisible) {
            // Asegurar que los productos estén cargados y renderizados con selector de tamaño
            if (products.length === 0 && filteredProducts.length === 0) {
              loadProducts();
            } else if (filteredProducts.length > 0) {
              renderProducts(filteredProducts);
            } else if (products.length > 0) {
              filteredProducts = [...products];
              renderProducts(filteredProducts);
            }
          }
        }
      });
    });
    
    observer.observe(menuSection, { attributes: true, attributeFilter: ['style', 'class'] });
  }
});

// NOTA: Esta función addToCart está duplicada y no se usa.
// La función correcta está más arriba (línea ~579) con verificación de sesión.
// Se mantiene comentada por si hay referencias antiguas.
/*
function addToCart(pizzaId) {
  const pizza = pizzas.find(p => p.id === pizzaId);
  if (pizza) {
    // Implementar lógica del carrito
    console.log(`Pizza agregada al carrito: ${pizza.name}`);
  }
}
*/

// Array de promociones
const promotions = [
  {
    id: 1,
    title: "2x1 Martes de Pepperoni",
    description: "Todos los martes, lleva 2 pizzas de pepperoni por el precio de 1",
    startDate: "2025-10-01",
    endDate: "2025-12-31",
    discount: 50.00,
    image: "assets/images/promotions/2x1-pepperoni.jpg",
    active: true
  },
  {
    id: 2,
    title: "Delivery gratis Miércoles",
    description: "Delivery sin costo en todos tus pedidos los días miércoles",
    startDate: "2025-10-01",
    endDate: "2025-12-31",
    discount: 10.00,
    image: "assets/images/promotions/free-delivery.jpg",
    active: true
  },
  {
    id: 3,
    title: "Fines de semana 15% off",
    description: "Disfruta un 15% de descuento en todas las pizzas los fines de semana",
    startDate: "2025-10-01",
    endDate: "2025-12-31",
    discount: 15.00,
    image: "assets/images/promotions/weekend-discount.jpg",
    active: true
  }
];

// Función para mostrar las promociones
function displayPromotions() {
  const promoContainer = document.getElementById('promoContainer');
  promoContainer.innerHTML = '';

  promotions.forEach(promo => {
    if (promo.active) {
      const promoCard = `
        <div class="col">
          <div class="card h-100 promotion-card">
            <div class="card-body">
              <div class="ribbon-wrapper">
                <div class="ribbon">${promo.discount}% OFF</div>
              </div>
              <h3 class="card-title">${promo.title}</h3>
              <p class="card-text">${promo.description}</p>
              <div class="promo-dates">
                <small class="text-muted">
                  Válido desde: ${formatDate(promo.startDate)} 
                  hasta: ${formatDate(promo.endDate)}
                </small>
              </div>
              <button class="btn btn-primary mt-3" onclick="applyPromotion(${promo.id})">
                Aprovechar Promoción
              </button>
            </div>
          </div>
        </div>
      `;
      promoContainer.innerHTML += promoCard;
    }
  });
}

// Función para formatear fechas
function formatDate(dateString) {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(dateString).toLocaleDateString('es-ES', options);
}

// Función para aplicar la promoción
function applyPromotion(promoId) {
  const promotion = promotions.find(p => p.id === promoId);
  if (promotion) {
    // Aquí puedes agregar la lógica para aplicar la promoción al carrito
    notifyUser('Promoción aplicada', `Promoción "${promotion.title}" aplicada correctamente`, 'success');
  }
}

// Agregar estilos CSS para las promociones
const styles = `
  .promotion-card {
    border: none;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transition: transform 0.3s ease;
  }

  .promotion-card:hover {
    transform: translateY(-5px);
  }

  .ribbon-wrapper {
    position: absolute;
    top: 0;
    right: 0;
    width: 100px;
    height: 100px;
    overflow: hidden;
  }

  .ribbon {
    background: #ff4444;
    color: white;
    text-align: center;
    padding: 5px 0;
    width: 150px;
    position: absolute;
    top: 20px;
    right: -40px;
    transform: rotate(45deg);
    font-weight: bold;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
`;

// Agregar los estilos al documento
const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);

// Función para manejar el cambio de contraseña forzado
async function handleForcePasswordChange(modal, user) {
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmNewPassword').value;
  const passwordMismatch = document.getElementById('passwordMismatch');
  
  // Validaciones
  if (!newPassword || newPassword.length < 6) {
    notifyUser('Cambio de Contraseña', 'La contraseña debe tener al menos 6 caracteres.', 'error');
    return;
  }
  
  if (newPassword !== confirmPassword) {
    document.getElementById('confirmNewPassword').classList.add('is-invalid');
    passwordMismatch.style.display = 'block';
    notifyUser('Cambio de Contraseña', 'Las contraseñas no coinciden.', 'error');
    return;
  }
  
  document.getElementById('confirmNewPassword').classList.remove('is-invalid');
  if (passwordMismatch) passwordMismatch.style.display = 'none';
  
  try {
    const response = await fetch('api/change_password.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        new_password: newPassword,
        confirm_password: confirmPassword,
        force_change: true
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      notifyUser('Cambio de Contraseña', 'Contraseña cambiada exitosamente.', 'success');
      modal.hide();
      
      // Redirigir según el rol del usuario
      const userRole = user.rol;
      switch (userRole) {
        case "admin":
          window.location.href = "views/admin/index.html";
          break;
        case "vendedor":
          window.location.href = "views/vendedor/index.html";
          break;
        case "cliente":
          mostrarSeccion("menu"); 
          break;
        case "repartidor":
          window.location.href = "views/delivery/index.html";
          break;
        default:
          mostrarSeccion("menu");
      }
    } else {
      notifyUser('Cambio de Contraseña', result.message || 'Error al cambiar la contraseña.', 'error');
    }
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    notifyUser('Cambio de Contraseña', 'Ocurrió un error al cambiar la contraseña.', 'error');
  }
}

// Cargar las promociones cuando se muestre la sección
document.addEventListener('DOMContentLoaded', () => {
  // ...existing code...
  displayPromotions();
});
