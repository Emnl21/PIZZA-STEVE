// Pizza Steve · Panel Vendedor 
// Guarda datos simulados en localStorage. Todo es 100% front-end.
(() => {
  const $ = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => [...ctx.querySelectorAll(sel)];
  const fmt = new Intl.NumberFormat("es-BO", { style:"currency", currency:"BOB" });
  // Función helper para formatear con Bs. explícitamente
  const formatBs = (amount) => `Bs. ${parseFloat(amount).toFixed(2)}`;
  const todayKey = new Date().toISOString().slice(0,10);

  // --- Datos simulados ---
  const defaultState = {
    promoCumplePct: 20,
    sucursal: "Central",
    theme: "auto",
    productos: [
      { id:"pep", nombre:"Pepperoni", precio: 39, desc:"Clásica con pepperoni crujiente", img:"assets/img/pepperoni.svg" },
      { id:"marg", nombre:"Margarita", precio: 35, desc:"Tomate, mozzarella y albahaca", img:"assets/img/margarita.svg" },
      { id:"hawa", nombre:"Hawaiana", precio: 37, desc:"Jamón y piña dulce", img:"assets/img/hawaiana.svg" },
      { id:"carn", nombre:"Cuatro Carnes", precio: 45, desc:"Pepperoni, jamón, tocino y salchicha", img:"assets/img/carnes.svg" },
      { id:"veg", nombre:"Veggie", precio: 34, desc:"Pimientos, champiñón y aceitunas", img:"assets/img/veggie.svg" },
      { id:"bbq", nombre:"BBQ", precio: 42, desc:"Pollo BBQ y cebolla morada", img:"assets/img/bbq.svg" }
    ],
    clientes: {},
    ordenes: [],
    totales: {} // totales[todayKey] = {ventas, ordenes, clientesNuevos}
  };

  const storeKey = "pizza-steve-panel";
  const state = loadState();

  function loadState(){
    try{
      const raw = localStorage.getItem(storeKey);
      if(!raw) return structuredClone(defaultState);
      const parsed = JSON.parse(raw);
      // merge por si agregamos nuevos campos
      return Object.assign(structuredClone(defaultState), parsed);
    }catch(e){
      return structuredClone(defaultState);
    }
  }
  function saveState(){ localStorage.setItem(storeKey, JSON.stringify(state)); }

  // --- Tema --- Usa ThemeManager centralizado
  const btnTheme = $("#btnTheme");
  
  // Función para aplicar tema usando ThemeManager
  function applyTheme(mode) {
    // Si ThemeManager está disponible, usarlo
    if (window.ThemeManager) {
      window.ThemeManager.apply(mode);
    } else if (window.applyTheme) {
      window.applyTheme(mode);
    } else {
      // Fallback local
      document.documentElement.dataset.theme = mode;
      if (mode === "dark") {
        document.documentElement.classList.add("dark");
        document.body.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
        document.body.classList.remove("dark");
      }
      try {
        localStorage.setItem("theme", mode);
      } catch (e) {}
    }
    
    // Actualizar icono del botón
    if (btnTheme) {
      btnTheme.textContent = mode === "light" ? "🌞" : mode === "dark" ? "🌙" : "🌓";
    }
  }
  
  // Función para alternar tema
  function nextTheme(t){ return t === "light" ? "dark" : "light"; }
  
  // Cargar tema inicial desde localStorage o usar el del ThemeManager
  let initialTheme = "light";
  if (window.ThemeManager) {
    initialTheme = window.ThemeManager.get();
  } else if (window.getCurrentTheme) {
    initialTheme = window.getCurrentTheme();
  } else {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "light" || saved === "dark") {
        initialTheme = saved;
      }
    } catch (e) {}
  }
  
  // Actualizar estado y aplicar tema inicial
  state.theme = initialTheme;
  applyTheme(initialTheme);
  
  // Configurar evento de toggle
  btnTheme?.addEventListener("click", () => {
    state.theme = nextTheme(state.theme);
    applyTheme(state.theme);
    saveState();
  });

  // --- Sidebar móvil ---
  const btnSidebar = $("#btnSidebar");
  const sidebar = $(".sidebar");
  btnSidebar?.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    const isOpen = sidebar.classList.contains("open");
    btnSidebar.setAttribute("aria-expanded", String(isOpen));
  });

  // --- Navegación SPA ---
  const navLinks = $$(".nav a");
  const pages = $$("[data-page]");
  function go(hash){
    const id = (hash || "#vender").replace("#","");
    pages.forEach(p => p.hidden = p.id !== id);
    navLinks.forEach(a => a.classList.toggle("active", a.dataset.nav === "#"+id));
    $("#pageTitle").textContent = id.charAt(0).toUpperCase()+id.slice(1);
    if(window.innerWidth < 960) sidebar.classList.remove("open");
    if(id === "vender") renderProductos();
    if(id === "ordenes") renderOrdenes();
    if(id === "clientes") renderClientes();
    if(id === "resumen") renderResumen();
  }
  navLinks.forEach(a => a.addEventListener("click", () => { location.hash = a.dataset.nav; go(a.dataset.nav); }));
  window.addEventListener("hashchange", () => go(location.hash));
  go(location.hash);

  // --- Sucursal config ---
  $("#sucursalName").textContent = state.sucursal;
  $("#inpSucursal")?.addEventListener("input", (e) => {
    state.sucursal = e.target.value || "Central";
    $("#sucursalName").textContent = state.sucursal;
    saveState();
  });

  // --- Búsqueda de productos ---
  const searchInput = $("#searchInput");
  searchInput?.addEventListener("input", renderProductos);

  // --- Render productos ---
  const productsEl = $("#products");
  function renderProductos(){
    const q = (searchInput?.value || "").toLowerCase();
    productsEl.innerHTML = "";
    state.productos
      .filter(p => p.nombre.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q))
      .forEach(p => {
        const card = document.createElement("div");
        card.className = "product";
        card.innerHTML = `
          <img src="${p.img}" alt="${p.nombre}" loading="lazy"/>
          <div style="flex:1">
            <div class="name">${p.nombre}</div>
            <div class="desc">${p.desc}</div>
            <div class="price">${formatBs(p.precio)}</div>
            <div class="actions">
              <button class="btn btn-ghost" data-add="${p.id}">Agregar</button>
            </div>
          </div>
        `;
        productsEl.appendChild(card);
      });
    productsEl.querySelectorAll("[data-add]").forEach(btn => btn.addEventListener("click", () => addToCart(btn.dataset.add)));
  }

  // --- Carrito ---
  const cart = [];
  const cartList = $("#cartList");
  const cartTotal = $("#cartTotal");
  const cartSubtotal = $("#cartSubtotal");
  const cartDesc = $("#cartDesc");
  const chkCumple = $("#chkCumple");
  $("#btnVaciar")?.addEventListener("click", clearCart);
  $("#btnCheckout")?.addEventListener("click", checkout);

  function addToCart(id){
    const p = state.productos.find(x=>x.id===id);
    if(!p) return;
    const row = cart.find(x=>x.id===id) || cart[cart.push({id, qty:0})-1];
    row.qty++;
    renderCart();
  }
  function setQty(id, qty){
    const idx = cart.findIndex(x=>x.id===id);
    if(idx===-1) return;
    cart[idx].qty = Math.max(0, qty);
    if(cart[idx].qty === 0) cart.splice(idx,1);
    renderCart();
  }
  function clearCart(){ cart.length = 0; renderCart(); }
  function renderCart(){
    cartList.innerHTML = "";
    let subtotal = 0;
    cart.forEach(item => {
      const p = state.productos.find(x=>x.id===item.id);
      const line = p.precio * item.qty;
      subtotal += line;
      const li = document.createElement("div");
      li.className = "cart-item";
      li.innerHTML = `
        <div style="flex:1">
          <div style="font-weight:600">${p.nombre}</div>
          <div class="muted" style="font-size:12px">${formatBs(p.precio)} × ${item.qty}</div>
        </div>
        <div class="qty">
          <button aria-label="disminuir" data-dec="${p.id}">–</button>
          <span>${item.qty}</span>
          <button aria-label="aumentar" data-inc="${p.id}">+</button>
        </div>
        <div style="width:90px;text-align:right;font-weight:700">${fmt.format(line)}</div>
        <button class="btn btn-ghost" data-del="${p.id}" aria-label="quitar">✕</button>
      `;
      cartList.appendChild(li);
    });
    cartList.querySelectorAll("[data-dec]").forEach(b=>b.addEventListener("click",()=>{
      const it = cart.find(x=>x.id===b.dataset.dec); setQty(it.id, it.qty-1);
    }));
    cartList.querySelectorAll("[data-inc]").forEach(b=>b.addEventListener("click",()=>{
      const it = cart.find(x=>x.id===b.dataset.inc); setQty(it.id, it.qty+1);
    }));
    cartList.querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click",()=> setQty(b.dataset.del, 0)));

    const isCumple = !!(chkCumple && chkCumple.checked);
    const desc = isCumple ? (subtotal * (state.promoCumplePct/100)) : 0;
    const total = Math.max(0, subtotal - desc);

    if(cartSubtotal) cartSubtotal.textContent = fmt.format(subtotal);
    if(cartDesc) cartDesc.textContent = (isCumple? "- " : "") + fmt.format(desc);
    cartTotal.textContent = fmt.format(total);
  }

  // --- Checkout ---
  function checkout(){
    if(cart.length === 0) return alert("El carrito está vacío");
    const nombreCliente = ($("#inpCliente")?.value || "Cliente de paso").trim() || "Cliente de paso";
    const id = "ORD-" + Date.now().toString().slice(-6);
    const items = cart.map(c => ({ id:c.id, qty:c.qty, precio: state.productos.find(p=>p.id===c.id).precio }));
    const subtotal = items.reduce((s,i)=> s + i.precio * i.qty, 0);
    const isCumple = !!(chkCumple && chkCumple.checked);
    const descuento = isCumple ? (subtotal * (state.promoCumplePct/100)) : 0;
    const total = Math.max(0, subtotal - descuento);
    const hora = new Date().toLocaleTimeString("es-BO",{hour:"2-digit",minute:"2-digit"});
    state.ordenes.unshift({ id, cliente:nombreCliente, items, subtotal, descuento, total, promo: isCumple ? "cumple" : null, estado:"en-curso", hora, fecha: todayKey });
    // clientes
    const cli = state.clientes[nombreCliente] || { nombre:nombreCliente, pedidos:0, gasto:0, ultimo:"" };
    cli.pedidos += 1;
    cli.gasto += total;
    cli.ultimo = todayKey + " " + hora;
    state.clientes[nombreCliente] = cli;
    // totales del día
    const tot = state.totales[todayKey] || { ventas:0, ordenes:0, clientesNuevos:0 };
    tot.ventas += total;
    tot.ordenes += 1;
    if(cli.pedidos === 1) tot.clientesNuevos += 1;
    state.totales[todayKey] = tot;

    saveState();
    clearCart();
    renderOrdenes();
    renderClientes();
    renderKpis();
    alert("Pedido registrado: " + id);
  }

  // --- Render Órdenes ---
  function renderOrdenes(){
    const tbody = $("#tablaOrdenes");
    tbody.innerHTML = "";
    state.ordenes.filter(o=>o.fecha===todayKey).forEach(o => {
      const tr = document.createElement("tr");
      const itemsCount = o.items.reduce((s,i)=>s+i.qty,0);
      tr.innerHTML = `
        <td>${o.id}</td>
        <td>${o.cliente}</td>
        <td>${itemsCount}</td>
        <td>${formatBs(o.total)}</td>
        <td><span class="status ${o.estado}">${o.estado.replace("-"," ")}</span></td>
        <td>${o.hora}</td>
      `;
      tbody.appendChild(tr);
    });
    $("#ordenesCount").textContent = state.ordenes.filter(o=>o.fecha===todayKey).length;
    // En curso
    const enCurso = state.ordenes.filter(o=>o.fecha===todayKey && o.estado==="en-curso").length;
    $("#kpiEnCurso").textContent = `${enCurso} en curso`;
  }

  // --- Render Clientes ---
  function renderClientes(){
    const tbody = $("#tablaClientes");
    tbody.innerHTML = "";
    const clientes = Object.values(state.clientes).sort((a,b)=>b.gasto-a.gasto);
    clientes.forEach(c => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${c.nombre}</td>
        <td>${c.pedidos}</td>
        <td>${fmt.format(c.gasto)}</td>
        <td>${c.ultimo || "—"}</td>
      `;
      tbody.appendChild(tr);
    });
    $("#clientesCount").textContent = clientes.length;
  }

  // --- KPIs ---
  function renderKpis(){
    const todays = state.ordenes.filter(o=>o.fecha===todayKey);
    const ventas = todays.reduce((s,o)=> s + (o.total ?? 0), 0);
    const ordenes = todays.length;
    const clientesTot = Object.keys(state.clientes).length;
    const clientesNuevos = todays.filter(o=>{
      const c = state.clientes[o.cliente]; return c && c.pedidos === 1;
    }).length;
    const cumpleCount = todays.filter(o=>o.promo === "cumple").length;

    $("#ventasHoy").textContent = fmt.format(ventas);
    $("#kpiOrdenes").textContent = String(ordenes);
    $("#kpiTicket").textContent = fmt.format(ordenes ? ventas/ordenes : 0);
    $("#kpiClientes").textContent = String(clientesTot);
    $("#kpiNuevos").textContent = `${clientesNuevos} nuevos`;
    const y = new Date(Date.now()-86400000).toISOString().slice(0,10);
    const ayVentas = (state.ordenes.filter(o=>o.fecha===y).reduce((s,o)=> s + (o.total ?? 0), 0)) || 0;
    const vs = ayVentas ? ((ventas - ayVentas) / ayVentas) * 100 : (ventas ? 100 : 0);
    $("#kpiVsAyer").textContent = (vs >= 0 ? "+" : "") + vs.toFixed(0) + "% vs ayer";
    const kCum = document.getElementById("kpiCumples"); if(kCum) kCum.textContent = String(cumpleCount);
  }

  // --- Resumen ---
  function renderResumen(){
    // top producto del día
    const cont = {};
    state.ordenes.filter(o=>o.fecha===todayKey).forEach(o => {
      o.items.forEach(it => cont[it.id] = (cont[it.id]||0) + it.qty);
    });
    const top = Object.entries(cont).sort((a,b)=>b[1]-a[1])[0];
    $("#topProducto").textContent = top ? (state.productos.find(p=>p.id===top[0])?.nombre || "—") : "—";
    // horas pico (estimado simple por hora)
    const horas = {};
    state.ordenes.filter(o=>o.fecha===todayKey).forEach(o => {
      const h = o.hora.split(":")[0]; horas[h] = (horas[h]||0) + 1;
    });
    const peak = Object.entries(horas).sort((a,b)=>b[1]-a[1])[0];
    $("#horasPico").textContent = peak ? `${peak[0]}:00 - ${peak[0]}:59` : "—";
  }

  // --- Reset demo ---
  $("#btnResetData")?.addEventListener("click", () => {
    if(confirm("¿Seguro que deseas reiniciar los datos de demostración?")){
      localStorage.removeItem(storeKey);
      location.reload();
    }
  });

  // Primer render
  renderProductos();
  renderOrdenes();
  renderClientes();
  renderKpis();
})();