const mockOrders = [
    {
        id: 'ORD-001',
        customerName: 'Juan Perez',
        address: 'Av. Arce, La Paz',
        status: 'pending',
        paymentType: 'efectivo',
        price: 85.50,
        coordinates: { lat: -16.505, lng: -68.130 }
    },
    {
        id: 'ORD-002',
        customerName: 'Maria Garcia',
        address: 'Calle 21 de Calacoto, La Paz',
        status: 'pending',
        paymentType: 'qr',
        price: 120.00,
        coordinates: { lat: -16.538, lng: -68.084 }
    },
    {
        id: 'ORD-003',
        customerName: 'Carlos Quispe',
        address: 'Plaza Murillo, La Paz',
        status: 'completed',
        paymentType: 'transferencia',
        price: 99.99,
        coordinates: { lat: -16.495, lng: -68.133 }
    },
    {
        id: 'ORD-004',
        customerName: 'Ana Choque',
        address: 'Cerca al Estadio Hernando Siles',
        status: 'pending',
        paymentType: 'efectivo',
        price: 65.00,
        coordinates: { lat: -16.500, lng: -68.120 }
    },
    {
        id: 'ORD-005',
        customerName: 'Pedro Infante',
        address: 'Zona de Obrajes',
        status: 'completed',
        paymentType: 'qr',
        price: 150.25,
        coordinates: { lat: -16.525, lng: -68.100 }
    }
];