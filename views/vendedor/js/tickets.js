// Funciones para gestión de tickets
// Este archivo debe ser incluido después de main.js

(function () {
    'use strict';

    const $ = (sel) => document.querySelector(sel);
    const formatBs = (amount) => `Bs. ${parseFloat(amount).toFixed(2)}`;
    let currentTicketForPrint = null;

    // Helper para hacer peticiones API
    const apiFetch = async (url, options = {}) => {
        const defaultOptions = {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };
        return fetch(url, { ...defaultOptions, ...options });
    };

    // Manejo de respuestas
    async function handleResponse(response) {
        if (!response.ok) {
            const text = await response.text();
            let errorMessage = 'Error en la petición';
            try {
                const errorData = JSON.parse(text);
                errorMessage = errorData.message || errorData.error || errorMessage;
            } catch (e) {
                errorMessage = text || `Error ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        return response.json();
    }

    // Cargar tickets desde la API
    window.loadTickets = async function (filters = {}) {
        try {
            let url = '../../api/tickets.php';
            const params = new URLSearchParams();

            if (filters.estado) params.append('estado', filters.estado);
            if (filters.search) params.append('search', filters.search);

            if (params.toString()) {
                url += '?' + params.toString();
            }

            const response = await apiFetch(url);
            const data = await handleResponse(response);

            if (data.success && Array.isArray(data.tickets)) {
                window.ticketsData = data.tickets;
                renderTickets();
            } else {
                window.ticketsData = [];
                renderTickets();
            }
        } catch (error) {
            console.error('Error cargando tickets:', error);
            if (typeof showNotification === 'function') {
                showNotification('Error', 'No se pudieron cargar los tickets.', 'error');
            }
            window.ticketsData = [];
            renderTickets();
        }
    };

    // Renderizar lista de tickets
    function renderTickets() {
        const ticketsCount = $('#ticketsCount');
        if (ticketsCount) {
            ticketsCount.textContent = window.ticketsData?.length || 0;
        }

        const tablaTickets = $('#tablaTickets');
        if (!tablaTickets) return;

        tablaTickets.innerHTML = '';

        if (!window.ticketsData || window.ticketsData.length === 0) {
            tablaTickets.innerHTML = '<tr><td colspan="7" class="text-center">No hay tickets para mostrar</td></tr>';
            return;
        }

        window.ticketsData.forEach(ticket => {
            const tr = document.createElement('tr');
            const customerName = (ticket.cliente_manual && ticket.cliente_manual.nombre) || ticket.cliente_nombre || 'Cliente mostrador';

            // Formatear fecha
            const fecha = new Date(ticket.fecha_creacion);
            const fechaStr = fecha.toLocaleDateString('es-BO', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            // Badge de estado
            let estadoClass = 'status';
            let estadoText = ticket.estado;

            if (ticket.estado === 'entregado') {
                estadoClass += ' entregado';
                estadoText = 'Entregado';
            } else if (ticket.estado === 'cancelado') {
                estadoClass += ' cancelado';
                estadoText = 'Cancelado';
            } else {
                estadoClass += ' pendiente';
                estadoText = 'Pendiente';
            }

            tr.innerHTML = `
                <td><strong>${ticket.numero_ticket}</strong></td>
                <td>${customerName}</td>
                <td>${ticket.items_count} items</td>
                <td>${formatBs(ticket.total)}</td>
                <td><span class="${estadoClass}">${estadoText}</span></td>
                <td>${fechaStr}</td>
                <td>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        <button class="btn btn-sm btn-info" data-view-ticket="${ticket.id_ticket}">Ver</button>
                        ${ticket.estado === 'pendiente' ? `
                            <button class="btn btn-sm btn-success" data-entregar-ticket="${ticket.id_ticket}">Entregar</button>
                            <button class="btn btn-sm btn-danger" data-cancelar-ticket="${ticket.id_ticket}">Cancelar</button>
                        ` : ''}
                    </div>
                </td>
            `;

            tablaTickets.appendChild(tr);
        });

        // Agregar event listeners
        tablaTickets.querySelectorAll('[data-view-ticket]').forEach(btn => {
            btn.addEventListener('click', () => {
                viewTicketDetails(btn.dataset.viewTicket);
            });
        });

        tablaTickets.querySelectorAll('[data-entregar-ticket]').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm('¿Confirmas que este pedido ha sido entregado al cliente?')) {
                    await updateTicketStatus(btn.dataset.entregarTicket, 'entregado');
                }
            });
        });

        tablaTickets.querySelectorAll('[data-cancelar-ticket]').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm('¿Estás seguro de que deseas cancelar este pedido?')) {
                    await updateTicketStatus(btn.dataset.cancelarTicket, 'cancelado');
                }
            });
        });
    }

    // Ver detalles del ticket
    async function viewTicketDetails(ticketId) {
        try {
            const response = await apiFetch(`../../api/tickets.php?id=${ticketId}`);
            const data = await handleResponse(response);

            if (data.success && data.ticket) {
                showTicketModal(data.ticket);
            } else {
                if (typeof showNotification === 'function') {
                    showNotification('Error', 'No se pudo cargar el ticket.', 'error');
                }
            }
        } catch (error) {
            console.error('Error cargando detalles del ticket:', error);
            if (typeof showNotification === 'function') {
                showNotification('Error', 'No se pudo cargar el ticket.', 'error');
            }
        }
    }

    // Mostrar modal con detalles
    function showTicketModal(ticket) {
        const modal = $('#ticketModal');
        const ticketDetails = $('#ticketDetails');

        if (!modal || !ticketDetails) return;

        currentTicketForPrint = ticket;

        const fecha = new Date(ticket.fecha_creacion);
        const fechaStr = fecha.toLocaleDateString('es-BO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const manualData = ticket.cliente_manual || {};
        const clienteInfo = ticket.cliente || {};
        const clienteNombre = manualData.nombre || clienteInfo.nombre || 'Cliente mostrador';
        const clienteDoc = manualData.ci || manualData.ci_nit || clienteInfo.documento || '—';
        const metodoPago = (manualData.metodo_pago || ticket.metodo_pago || 'efectivo').toUpperCase();
        const notasExtra = manualData.notas || ticket.notas_text || ticket.notas || '';

        const productos = Array.isArray(ticket.productos) ? ticket.productos : [];
        let productosHTML = '';
        productos.forEach(prod => {
            productosHTML += `
                <div class="ticket-product-item">
                    <div class="ticket-product-name">${prod.nombre}</div>
                    <div class="ticket-product-qty">x${prod.cantidad}</div>
                    <div class="ticket-product-price">${formatBs(prod.subtotal)}</div>
                </div>
            `;
        });

        let estadoBadge = '';
        if (ticket.estado === 'entregado') {
            estadoBadge = '<span class="status entregado">Entregado</span>';
        } else if (ticket.estado === 'cancelado') {
            estadoBadge = '<span class="status cancelado">Cancelado</span>';
        } else {
            estadoBadge = '<span class="status pendiente">Pendiente</span>';
        }

        ticketDetails.innerHTML = `
            <div class="ticket-header">
                <h3>${ticket.sucursal.nombre}</h3>
                <div style="color: var(--muted); font-size: 13px;">${ticket.sucursal.direccion}</div>
                <div style="color: var(--muted); font-size: 13px;">Tel: ${ticket.sucursal.telefono}</div>
            </div>
            
            <div class="ticket-number">
                Ticket: ${ticket.numero_ticket}
            </div>
            
            <div class="ticket-info">
                <div class="ticket-info-row">
                    <span class="ticket-info-label">Cliente:</span>
                    <span class="ticket-info-value">${clienteNombre}</span>
                </div>
                <div class="ticket-info-row">
                    <span class="ticket-info-label">C.I. / NIT:</span>
                    <span class="ticket-info-value">${clienteDoc}</span>
                </div>
                <div class="ticket-info-row">
                    <span class="ticket-info-label">Teléfono:</span>
                    <span class="ticket-info-value">${clienteInfo.telefono || 'N/A'}</span>
                </div>
                <div class="ticket-info-row">
                    <span class="ticket-info-label">Dirección:</span>
                    <span class="ticket-info-value">${clienteInfo.direccion || 'Mostrador'}</span>
                </div>
                <div class="ticket-info-row">
                    <span class="ticket-info-label">Fecha:</span>
                    <span class="ticket-info-value">${fechaStr}</span>
                </div>
                <div class="ticket-info-row">
                    <span class="ticket-info-label">Método de pago:</span>
                    <span class="ticket-info-value">${metodoPago}</span>
                </div>
                <div class="ticket-info-row">
                    <span class="ticket-info-label">Estado:</span>
                    <span class="ticket-info-value">${estadoBadge}</span>
                </div>
                ${ticket.vendedor ? `
                <div class="ticket-info-row">
                    <span class="ticket-info-label">Atendido por:</span>
                    <span class="ticket-info-value">${ticket.vendedor}</span>
                </div>
                ` : ''}
            </div>
            
            <div class="ticket-products">
                <h4>Productos</h4>
                ${productosHTML}
            </div>
            
            <div class="ticket-totals">
                <div class="ticket-total-row subtotal">
                    <span>Subtotal:</span>
                    <span>${formatBs(ticket.subtotal)}</span>
                </div>
                ${ticket.descuento > 0 ? `
                <div class="ticket-total-row discount">
                    <span>Descuento ${ticket.es_cumpleanero ? '(Cumpleañero 🎉)' : ''}:</span>
                    <span>- ${formatBs(ticket.descuento)}</span>
                </div>
                ` : ''}
                <div class="ticket-total-row total">
                    <span>TOTAL:</span>
                    <span>${formatBs(ticket.total)}</span>
                </div>
            </div>
            
            ${notasExtra ? `
            <div class="ticket-footer">
                <strong>Notas:</strong> ${notasExtra}
            </div>
            ` : ''}
            
            <div class="ticket-footer">
                ¡Gracias por su preferencia! 🍕
            </div>
            
            <div class="ticket-actions">
                <button class="btn btn-ghost" id="btnPrintTicket">Imprimir ticket</button>
                ${ticket.estado === 'pendiente' ? `
                    <div style="display:flex; gap:10px; flex-wrap:wrap;">
                        <button class="btn btn-success" id="btnEntregarModal">Marcar como Entregado</button>
                        <button class="btn btn-danger" id="btnCancelarModal">Cancelar Pedido</button>
                    </div>
                ` : ''}
            </div>
        `;

        modal.style.display = 'flex';

        const btnPrintTicket = $('#btnPrintTicket');
        if (btnPrintTicket) {
            btnPrintTicket.addEventListener('click', () => {
                if (currentTicketForPrint) {
                    printTicket(currentTicketForPrint);
                }
            });
        }

        if (ticket.estado === 'pendiente') {
            const btnEntregarModal = $('#btnEntregarModal');
            const btnCancelarModal = $('#btnCancelarModal');

            if (btnEntregarModal) {
                btnEntregarModal.addEventListener('click', async () => {
                    modal.style.display = 'none';
                    await updateTicketStatus(ticket.id_ticket, 'entregado');
                });
            }

            if (btnCancelarModal) {
                btnCancelarModal.addEventListener('click', async () => {
                    modal.style.display = 'none';
                    await updateTicketStatus(ticket.id_ticket, 'cancelado');
                });
            }
        }
    }

    function printTicket(ticket) {
        const manualData = ticket.cliente_manual || {};
        const clienteNombre = manualData.nombre || ticket.cliente?.nombre || 'Cliente mostrador';
        const clienteDoc = manualData.ci || manualData.ci_nit || ticket.cliente?.documento || '—';
        const metodoPago = (manualData.metodo_pago || ticket.metodo_pago || 'efectivo').toUpperCase();
        const fecha = new Date(ticket.fecha_creacion);
        const fechaStr = fecha.toLocaleString('es-BO', { hour12: false });
        const productos = Array.isArray(ticket.productos) ? ticket.productos : [];
        const itemsHtml = productos.map(prod => {
            const nombre = prod.nombre.length > 18 ? prod.nombre.slice(0, 18) : prod.nombre;
            const qty = String(prod.cantidad).padStart(2, ' ');
            const price = formatBs(prod.subtotal);
            return `<div class="row"><span>${qty} x ${nombre}</span><span>${price}</span></div>`;
        }).join('');
        const notasExtra = manualData.notas || ticket.notas_text || ticket.notas || '';

        const html = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${ticket.numero_ticket}</title>
<style>
body { font-family: "Courier New", monospace; margin: 0; padding: 12px; background: #fff; color: #111; }
.receipt { width: 280px; margin: 0 auto; }
.center { text-align: center; }
.row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; }
.totals .row { font-weight: bold; }
.divider { border-top: 1px dashed #555; margin: 8px 0; }
.small { font-size: 11px; color: #555; }
.title { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
.uppercase { text-transform: uppercase; }
</style>
</head>
<body>
<div class="receipt">
  <div class="center">
    <div class="title">Pizza Steve</div>
    <div class="small">${ticket.sucursal.nombre}</div>
    <div class="small">${ticket.sucursal.direccion}</div>
    <div class="small">Tel: ${ticket.sucursal.telefono}</div>
  </div>
  <div class="divider"></div>
  <div class="row"><span>Ticket:</span><span>${ticket.numero_ticket}</span></div>
  <div class="row"><span>Fecha:</span><span>${fechaStr}</span></div>
  <div class="divider"></div>
  <div class="row"><span>Cliente:</span><span class="uppercase">${clienteNombre}</span></div>
  <div class="row"><span>Doc.:</span><span>${clienteDoc}</span></div>
  <div class="row"><span>Pago:</span><span>${metodoPago}</span></div>
  <div class="divider"></div>
  <div class="small">Detalle</div>
  ${itemsHtml}
  <div class="divider"></div>
  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${formatBs(ticket.subtotal)}</span></div>
    ${ticket.descuento > 0 ? `<div class="row"><span>Descuento</span><span>- ${formatBs(ticket.descuento)}</span></div>` : ''}
    <div class="row"><span>Total</span><span>${formatBs(ticket.total)}</span></div>
  </div>
  ${notasExtra ? `<div class="divider"></div><div class="small">Notas: ${notasExtra}</div>` : ''}
  <div class="divider"></div>
  <div class="center small">¡Gracias por tu compra! 🍕</div>
</div>
</body>
</html>`;

        const printWindow = window.open('', '_blank', 'width=380,height=600');
        if (!printWindow) {
            alert('Habilita las ventanas emergentes para imprimir el ticket.');
            return;
        }
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 300);
    }

    // Actualizar estado del ticket
    async function updateTicketStatus(ticketId, nuevoEstado) {
        try {
            const response = await apiFetch('../../api/tickets.php', {
                method: 'PUT',
                body: JSON.stringify({
                    id_ticket: parseInt(ticketId),
                    estado: nuevoEstado
                })
            });

            const data = await handleResponse(response);

            if (data.success) {
                if (typeof showNotification === 'function') {
                    showNotification(
                        'Ticket actualizado',
                        `El ticket ha sido marcado como ${nuevoEstado}.`,
                        'success'
                    );
                }
                await window.loadTickets();
            } else {
                if (typeof showNotification === 'function') {
                    showNotification('Error', data.message || 'No se pudo actualizar el ticket.', 'error');
                }
            }
        } catch (error) {
            console.error('Error actualizando ticket:', error);
            if (typeof showNotification === 'function') {
                showNotification('Error', 'No se pudo actualizar el ticket.', 'error');
            }
        }
    }

    // Inicializar tickets cuando se carga la sección
    function initTicketsSection() {
        const searchTickets = $('#searchTickets');
        const filterEstado = $('#filterEstado');
        const btnClearFilters = $('#btnClearFilters');
        const btnRefreshTickets = $('#btnRefreshTickets');
        const btnCloseTicketModal = $('#btnCloseTicketModal');
        const ticketModal = $('#ticketModal');

        if (searchTickets) {
            searchTickets.addEventListener('input', () => {
                const filters = {
                    search: searchTickets.value.trim(),
                    estado: filterEstado?.value || ''
                };
                window.loadTickets(filters);
            });
        }

        if (filterEstado) {
            filterEstado.addEventListener('change', () => {
                const filters = {
                    search: searchTickets?.value.trim() || '',
                    estado: filterEstado.value
                };
                window.loadTickets(filters);
            });
        }

        if (btnClearFilters) {
            btnClearFilters.addEventListener('click', () => {
                if (searchTickets) searchTickets.value = '';
                if (filterEstado) filterEstado.value = '';
                window.loadTickets();
            });
        }

        if (btnRefreshTickets) {
            btnRefreshTickets.addEventListener('click', () => {
                const filters = {
                    search: searchTickets?.value.trim() || '',
                    estado: filterEstado?.value || ''
                };
                window.loadTickets(filters);
            });
        }

        if (btnCloseTicketModal) {
            btnCloseTicketModal.addEventListener('click', () => {
                if (ticketModal) {
                    ticketModal.style.display = 'none';
                }
            });
        }

        if (ticketModal) {
            ticketModal.addEventListener('click', (e) => {
                if (e.target === ticketModal) {
                    ticketModal.style.display = 'none';
                }
            });
        }
    }

    // Auto-inicializar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTicketsSection);
    } else {
        initTicketsSection();
    }
})();
