const Controller = {
  init: () => {
    // Cargar contenido dinámico inicial
    Controller.loadMenu();
    Controller.loadPromotions();
  },

  loadMenu: () => {
    const pizzas = pizzaData.pizzas;
    View.renderPizzaMenu(pizzas);
  },

  loadPromotions: () => {
    const promotions = pizzaData.promotions;
    View.renderPromotions(promotions);
  }
};

// Inicializar el controlador cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', Controller.init);
