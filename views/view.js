const View = {
  renderPizzaMenu: (pizzas) => {
    const menuGrid = document.getElementById('pizzaMenu');
    menuGrid.innerHTML = pizzas.map(pizza => `
      <div class="col">
        <div class="card h-100">
          <img src="${pizza.img}" class="card-img-top" alt="${pizza.name}">
          <div class="card-body">
            <h5 class="card-title">${pizza.name}</h5>
            <p class="card-text">${pizza.description}</p>
          </div>
        </div>
      </div>
    `).join('');
  },

  renderPromotions: (promotions) => {
    const promoContainer = document.getElementById('promoContainer');
    promoContainer.innerHTML = promotions.map(promo => `
      <div class="col">
        <div class="card h-100 text-center p-3">
          <div class="card-body">
            <h5 class="card-title display-6">${promo.title}</h5>
            <p class="card-text">${promo.description}</p>
            <a href="#" class="btn btn-primary mt-auto" data-promo="${promo.title}">¡La quiero!</a>
          </div>
        </div>
      </div>
    `).join('');
  }
};