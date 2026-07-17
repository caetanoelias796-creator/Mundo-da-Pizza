const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const ORDERS_FILE = path.join(__dirname, 'orders.json');
const STATUS_FILE = path.join(__dirname, 'status.json');

app.use(cors());
app.use(express.json());

// Serve static client website files
app.use(express.static(__dirname));

// Ensure orders.json exists
if (!fs.existsSync(ORDERS_FILE)) {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2), 'utf8');
}

// Ensure status.json exists
if (!fs.existsSync(STATUS_FILE)) {
    fs.writeFileSync(STATUS_FILE, JSON.stringify({ isOpen: true }, null, 2), 'utf8');
}

// Read orders helper
function readOrders() {
    try {
        const data = fs.readFileSync(ORDERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Error reading orders file:", err);
        return [];
    }
}

// Write orders helper
function writeOrders(orders) {
    try {
        fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
    } catch (err) {
        console.error("Error writing orders file:", err);
    }
}

// Read status helper
function readStatus() {
    try {
        const data = fs.readFileSync(STATUS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Error reading status file:", err);
        return { isOpen: true };
    }
}

// Write status helper
function writeStatus(status) {
    try {
        fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2), 'utf8');
    } catch (err) {
        console.error("Error writing status file:", err);
    }
}

/* ==========================================================================
   API Endpoints
   ========================================================================== */

// GET /api/status - Get shop status
app.get('/api/status', (req, res) => {
    res.json(readStatus());
});

// PUT /api/status - Update shop status
app.put('/api/status', (req, res) => {
    const { isOpen } = req.body;
    if (typeof isOpen !== 'boolean') {
        return res.status(400).json({ error: "Campo isOpen inválido." });
    }
    const status = { isOpen };
    writeStatus(status);
    console.log(`[INFO] Status da loja atualizado para: ${isOpen ? 'Aberto' : 'Fechado'}`);
    res.json(status);
});

// GET /api/orders - List all orders
app.get('/api/orders', (req, res) => {
    const orders = readOrders();
    // Sort by newest first
    const sorted = orders.sort((a, b) => b.timestamp - a.timestamp);
    res.json(sorted);
});

// POST /api/orders - Add a new order
app.post('/api/orders', (req, res) => {
    const newOrder = req.body;
    
    if (!newOrder.clientName || !newOrder.cart || newOrder.cart.length === 0) {
        return res.status(400).json({ error: "Dados do pedido inválidos ou incompletos." });
    }
    
    const orders = readOrders();
    
    // Auto-generate order details
    const timestamp = Date.now();
    const dateObj = new Date(timestamp);
    const timeFormatted = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dateFormatted = dateObj.toLocaleDateString('pt-BR');
    
    // Create new order record
    const orderRecord = {
        id: orders.length > 0 ? Math.max(...orders.map(o => o.id)) + 1 : 1001,
        clientName: newOrder.clientName,
        clientPhone: newOrder.clientPhone,
        checkoutType: newOrder.checkoutType || 'delivery',
        address: newOrder.address || null,
        paymentMethod: newOrder.paymentMethod,
        cashChange: newOrder.cashChange || null,
        cart: newOrder.cart,
        subtotal: newOrder.subtotal,
        deliveryFee: newOrder.deliveryFee,
        total: newOrder.total,
        status: 'Pendente', // Statuses: Pendente, Preparando, Entrega, Entregue, Cancelado
        timestamp: timestamp,
        time: timeFormatted,
        date: dateFormatted
    };
    
    orders.push(orderRecord);
    writeOrders(orders);
    
    console.log(`[INFO] Novo pedido #${orderRecord.id} recebido de ${orderRecord.clientName}`);
    res.status(201).json(orderRecord);
});

// PUT /api/orders/:id - Update order status
app.put('/api/orders/:id', (req, res) => {
    const orderId = parseInt(req.params.id);
    const { status } = req.body;
    
    const validStatuses = ['Pendente', 'Preparando', 'Entrega', 'Entregue', 'Cancelado'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Status inválido." });
    }
    
    const orders = readOrders();
    const orderIndex = orders.findIndex(o => o.id === orderId);
    
    if (orderIndex === -1) {
        return res.status(404).json({ error: "Pedido não encontrado." });
    }
    
    orders[orderIndex].status = status;
    writeOrders(orders);
    
    console.log(`[INFO] Pedido #${orderId} atualizado para status "${status}"`);
    res.json(orders[orderIndex]);
});

// DELETE /api/orders - Clear all orders
app.delete('/api/orders', (req, res) => {
    writeOrders([]);
    console.log(`[INFO] Todos os pedidos locais foram zerados.`);
    res.json({ message: "Todos os pedidos foram apagados com sucesso." });
});

// Explicit route to serve catalog.html
app.get('/catalog', (req, res) => {
    res.sendFile(path.join(__dirname, 'catalog.html'));
});

// Explicit route to serve painel.html
app.get('/painel', (req, res) => {
    res.sendFile(path.join(__dirname, 'painel.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`==========================================================================`);
    console.log(`   Pizzaria Drill - Servidor Rodando em: http://localhost:${PORT}`);
    console.log(`   Painel Administrativo em: http://localhost:${PORT}/painel`);
    console.log(`==========================================================================`);
});
