/* ==========================================================================
   Firebase Initialization
   ========================================================================== */
db = window.db || null;
if (typeof firebase !== 'undefined' && typeof firebaseConfig !== 'undefined' && firebaseConfig.apiKey !== 'SUA_API_KEY') {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
}

/* ==========================================================================
   State Variables
   ========================================================================== */
let orders = [];
let isUsingFallback = false;
let filterStatus = 'Todos';
let soundEnabled = true;
let lastOrdersCount = 0;
let knownOrderIds = new Set();

let CONFIG_SETTINGS = {
    whatsapp: '5554996704189',
    whatsappFormatted: '(54) 99670-4189'
};
let tempSettings = null;
let currentSection = 'orders';
let currentMenuTab = 'flavors';

/* ==========================================================================
   Initialization / Authentication
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupImageUploadListener();
});

function setupImageUploadListener() {
    const uploadInput = document.getElementById('flavorImageUpload');
    if (uploadInput) {
        uploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            if (typeof firebase === 'undefined' || !firebase.storage) {
                console.error("Firebase Storage não está carregado.");
                alert("Erro: O SDK do Firebase Storage não foi carregado corretamente.");
                return;
            }
            
            const storageRef = firebase.storage().ref();
            const fileRef = storageRef.child(`produtos/${Date.now()}_${file.name}`);
            const uploadTask = fileRef.put(file);
            
            const progressDiv = document.getElementById('uploadProgress');
            if (progressDiv) {
                progressDiv.style.display = 'block';
                progressDiv.innerText = "Enviando... 0%";
            }
            
            uploadTask.on('state_changed', 
                (snapshot) => {
                    const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                    if (progressDiv) progressDiv.innerText = `Enviando... ${progress}%`;
                }, 
                (error) => {
                    console.error("Erro no upload:", error);
                    alert("Erro ao fazer upload da imagem: " + error.message);
                    if (progressDiv) progressDiv.style.display = 'none';
                }, 
                () => {
                    uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                        const imgUrlInput = document.getElementById('flavorImage');
                        if (imgUrlInput) imgUrlInput.value = downloadURL;
                        if (progressDiv) {
                            progressDiv.innerText = "Upload concluído com sucesso!";
                            setTimeout(() => { progressDiv.style.display = 'none'; }, 3000);
                        }
                    });
                }
            );
        });
    }
}

function checkAuth() {
    const overlay = document.getElementById('loginOverlay');
    
    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged(user => {
            if (user) {
                if (overlay) overlay.classList.add('display-none');
                initializeDashboard();
            } else {
                if (overlay) overlay.classList.remove('display-none');
            }
        });
        
        const loginForm = document.getElementById('loginForm');
        if (loginForm && !loginForm.dataset.listenerAttached) {
            loginForm.dataset.listenerAttached = 'true';
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = document.getElementById('loginEmail').value.trim();
                const pass = document.getElementById('loginPassword').value;
                const errDiv = document.getElementById('loginErrorMessage');
                
                if (errDiv) errDiv.style.display = 'none';
                
                firebase.auth().signInWithEmailAndPassword(email, pass)
                .catch(err => {
                    console.error("Erro no login:", err);
                    if (errDiv) {
                        errDiv.innerText = "E-mail ou senha incorretos ou permissão negada.";
                        errDiv.style.display = 'block';
                    }
                });
            });
        }
    } else {
        console.warn("Firebase Auth não carregado. Ignorando autenticação.");
        if (overlay) overlay.classList.add('display-none');
        initializeDashboard();
    }
}

function handleLogout() {
    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().signOut().then(() => {
            window.location.reload();
        });
    } else {
        window.location.reload();
    }
}

function initializeDashboard() {
    initMenuSync(); // Synchronize menu items and prices
    initShopStatus(); // Sync shop open/closed status
    
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        setupFirebaseRealtime();
    } else {
        fetchOrders(true); // First load, suppress chime sound
        
        // Set up polling every 5 seconds
        setInterval(() => {
            fetchOrders(false);
        }, 5000);
    }
}

function setupFirebaseRealtime() {
    if (!db) {
        console.warn("Firestore não inicializado. Usando polling local.");
        if (!isUsingFallback) {
            isUsingFallback = true;
            fetchOrders(true);
            setInterval(() => {
                fetchOrders(false);
            }, 5000);
        }
        return;
    }
    ConfigService.subscribeOrders((ordersArray) => {
        
        // Sort newest first
        ordersArray.sort((a, b) => b.timestamp - a.timestamp);
        
        const oldOrders = [...orders];
        orders = ordersArray;
        
        // Check for new orders to play chime sound
        let hasNewPending = false;
        orders.forEach(order => {
            if (order.status === 'Pendente' && !knownOrderIds.has(order.id)) {
                hasNewPending = true;
                knownOrderIds.add(order.id);
            }
            knownOrderIds.add(order.id);
        });
        
        if (hasNewPending && oldOrders.length > 0) {
            playNotificationSound();
        }
        
        updateIndicators();
        renderOrdersList();
        
        if (currentSection === 'reports') {
            renderReportsDashboard();
        }
        
        // Update server status text to Cloud
        const serverStatus = document.querySelector('.server-status');
        if (serverStatus) {
            serverStatus.className = 'server-status active';
            serverStatus.innerHTML = '<span class="dot" style="background-color: #81c784;"></span> Firebase Cloud';
        }
    });
}

/* ==========================================================================
   Data Fetching & Polling
   ========================================================================== */
function fetchOrders(isFirstLoad = false) {
    fetch('/api/orders')
        .then(res => res.json())
        .then(data => {
            const oldOrders = [...orders];
            orders = data;
            
            // Check for new orders to play chime sound
            let hasNewPending = false;
            orders.forEach(order => {
                if (order.status === 'Pendente' && !knownOrderIds.has(order.id)) {
                    hasNewPending = true;
                    knownOrderIds.add(order.id);
                }
                // Also ensure we keep track of already seen orders
                knownOrderIds.add(order.id);
            });
            
            if (hasNewPending && !isFirstLoad) {
                playNotificationSound();
            }
            
            updateIndicators();
            renderOrdersList();
            
            if (currentSection === 'reports') {
                renderReportsDashboard();
            }
        })
        .catch(err => {
            console.error("Error fetching orders:", err);
            const serverStatus = document.querySelector('.server-status');
            if (serverStatus) {
                serverStatus.className = 'server-status';
                serverStatus.innerHTML = '<span class="dot" style="background-color: #c62828;"></span> Offline';
            }
        });
}

/* ==========================================================================
   Update Dashboard Metrics
   ========================================================================== */
function updateIndicators() {
    const pendingCount = orders.filter(o => o.status === 'Pendente').length;
    const preparandoCount = orders.filter(o => o.status === 'Preparando').length;
    const entregaCount = orders.filter(o => o.status === 'Entrega').length;
    
    // Revenue counts only delivered orders today
    const revenue = orders
        .filter(o => o.status === 'Entregue')
        .reduce((sum, o) => sum + o.total, 0);
        
    document.getElementById('pendingCount').innerText = pendingCount;
    document.getElementById('preparandoCount').innerText = preparandoCount;
    document.getElementById('entregaCount').innerText = entregaCount;
    document.getElementById('revenueCount').innerText = `R$ ${revenue.toFixed(2)}`;
}

/* ==========================================================================
   Sound Notification (Web Audio API Synthesizer)
   ========================================================================== */
function playNotificationSound() {
    if (!soundEnabled) return;
    try {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        
        // Chime: Rising double beep (E5 then A5)
        const osc1 = context.createOscillator();
        const gain1 = context.createGain();
        osc1.connect(gain1);
        gain1.connect(context.destination);
        
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(659.25, context.currentTime); // E5
        gain1.gain.setValueAtTime(0, context.currentTime);
        gain1.gain.linearRampToValueAtTime(0.2, context.currentTime + 0.05);
        gain1.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.3);
        osc1.start(context.currentTime);
        osc1.stop(context.currentTime + 0.35);
        
        const osc2 = context.createOscillator();
        const gain2 = context.createGain();
        osc2.connect(gain2);
        gain2.connect(context.destination);
        
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880.00, context.currentTime + 0.12); // A5
        gain2.gain.setValueAtTime(0, context.currentTime + 0.12);
        gain2.gain.linearRampToValueAtTime(0.2, context.currentTime + 0.17);
        gain2.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.45);
        osc2.start(context.currentTime + 0.12);
        osc2.stop(context.currentTime + 0.5);
    } catch (e) {
        console.warn("AudioContext notification failed:", e);
    }
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    const icon = document.getElementById('soundIcon');
    const label = document.querySelector('#soundToggle span:not(.material-symbols-rounded)');
    
    if (soundEnabled) {
        icon.innerText = 'volume_up';
        label.innerText = 'Som Ligado';
        document.getElementById('soundToggle').classList.remove('disabled');
    } else {
        icon.innerText = 'volume_off';
        label.innerText = 'Som Mutado';
        document.getElementById('soundToggle').classList.add('disabled');
    }
}

/* ==========================================================================
   Filter & Rendering
   ========================================================================== */
function setFilter(status) {
    filterStatus = status;
    
    // Toggle active tab class
    document.querySelectorAll('.filter-tab').forEach(tab => {
        if (tab.getAttribute('data-status') === status) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    renderOrdersList();
}

function renderOrdersList() {
    const grid = document.getElementById('ordersListGrid');
    const emptyState = document.getElementById('emptyState');
    grid.innerHTML = '';
    
    const filtered = orders.filter(order => {
        if (filterStatus === 'Todos') return true;
        return order.status === filterStatus;
    });
    
    if (filtered.length === 0) {
        emptyState.classList.remove('display-none');
        grid.classList.add('display-none');
        return;
    }
    
    emptyState.classList.add('display-none');
    grid.classList.remove('display-none');
    
    filtered.forEach(order => {
        const card = document.createElement('div');
        card.className = 'order-card';
        
        // Items list formatting
        let itemsHTML = '';
        order.cart.forEach(item => {
            if (item.type === 'pizza') {
                itemsHTML += `
                    <div class="order-item-row">
                        <span class="order-item-qty-name">${item.quantity}x Pizza ${item.sizeName}</span>
                        <span class="order-item-price">R$ ${item.totalPrice.toFixed(2)}</span>
                    </div>
                    <div class="order-item-details">
                        Sabores: ${item.flavorNames.join(' e ')}<br>
                        Borda: ${item.borderName}
                        ${item.notes ? `<br>Obs: "${item.notes}"` : ''}
                    </div>
                `;
            } else if (item.type === 'acai') {
                let adds = [];
                if (item.freeAdditions && item.freeAdditions.length > 0) {
                    adds.push(`Grátis: ${item.freeAdditions.join(', ')}`);
                }
                if (item.paidAdditions && item.paidAdditions.length > 0) {
                    adds.push(`Pagos: ${item.paidAdditions.map(a => `${a.name} (+R$ ${a.price.toFixed(2)})`).join(', ')}`);
                }
                itemsHTML += `
                    <div class="order-item-row">
                        <span class="order-item-qty-name">${item.quantity}x Açaí ${item.size}</span>
                        <span class="order-item-price">R$ ${item.totalPrice.toFixed(2)}</span>
                    </div>
                    <div class="order-item-details">
                        ${adds.length > 0 ? adds.join('<br>') : 'Sem adicionais'}
                        ${item.notes ? `<br>Obs: "${item.notes}"` : ''}
                    </div>
                `;
            } else {
                itemsHTML += `
                    <div class="order-item-row">
                        <span class="order-item-qty-name">${item.quantity}x ${item.name}</span>
                        <span class="order-item-price">R$ ${item.totalPrice.toFixed(2)}</span>
                    </div>
                `;
            }
        });
        
        // Status button progression
        let actionButtonHTML = '';
        let cancelButtonHTML = '';
        
        if (order.status === 'Pendente') {
            actionButtonHTML = `
                <button class="btn-status-next" onclick="updateOrderStatus(${order.id}, 'Preparando')">
                    <span class="material-symbols-rounded">play_arrow</span>
                    Aceitar
                </button>
            `;
            cancelButtonHTML = `<button class="btn-cancel" onclick="updateOrderStatus(${order.id}, 'Cancelado')">Recusar</button>`;
        } else if (order.status === 'Preparando') {
            actionButtonHTML = `
                <button class="btn-status-next" onclick="updateOrderStatus(${order.id}, 'Entrega')">
                    <span class="material-symbols-rounded">delivery_dining</span>
                    Pronto
                </button>
            `;
            cancelButtonHTML = `<button class="btn-cancel" onclick="updateOrderStatus(${order.id}, 'Cancelado')">Cancelar</button>`;
        } else if (order.status === 'Entrega') {
            actionButtonHTML = `
                <button class="btn-whatsapp-notify" onclick="notifyCustomerReady(${order.id})" title="Enviar WhatsApp avisando que está pronto">
                    <span class="material-symbols-rounded">chat</span>
                    Avisar Cliente
                </button>
                <button class="btn-status-next" onclick="updateOrderStatus(${order.id}, 'Entregue')">
                    <span class="material-symbols-rounded">check</span>
                    Entregar
                </button>
            `;
        }
        
        // Address formatted
        let addressHTML = 'Retirada no Balcão';
        if (order.checkoutType === 'delivery' && order.address) {
            const addr = order.address;
            addressHTML = `${addr.street}, nº ${addr.number}<br>Bairro: ${addr.neighborhood}${addr.reference ? `<br>Ref: ${addr.reference}` : ''}`;
        }
        
        // Payment translation
        const payments = { 'pix': 'Pix', 'card': 'Cartão (Maquininha)', 'cash': 'Dinheiro' };
        let paymentHTML = payments[order.paymentMethod] || order.paymentMethod;
        if (order.paymentMethod === 'cash' && order.cashChange) {
            paymentHTML += ` (Troco para ${order.cashChange})`;
        }
        
        card.innerHTML = `
            <div class="order-card-header">
                <div class="order-id-time">
                    <h4>Pedido #${order.id}</h4>
                    <span>Recebido às ${order.time} - ${order.date}</span>
                </div>
                <span class="status-badge status-${order.status.toLowerCase()}">${order.status}</span>
            </div>
            
            <div class="customer-details">
                <div class="customer-row">
                    <span class="label">Cliente:</span>
                    <span class="value">${order.clientName}</span>
                </div>
                <div class="customer-row">
                    <span class="label">WhatsApp:</span>
                    <span class="value" style="display: flex; align-items: center; gap: 6px;">
                        ${order.clientPhone}
                        <a href="https://api.whatsapp.com/send?phone=55${order.clientPhone.replace(/\D/g, '')}" target="_blank" style="color: #25d366; display: inline-flex; align-items: center; text-decoration: none;" title="Conversar no WhatsApp">
                            <span class="material-symbols-rounded" style="font-size: 18px;">chat</span>
                        </a>
                    </span>
                </div>
                <div class="customer-row">
                    <span class="label">Tipo:</span>
                    <span class="value">${order.checkoutType === 'delivery' ? '🚗 Tele-Entrega' : '🏪 Retirada no Balcão'}</span>
                </div>
                <div class="customer-row" style="align-items: flex-start;">
                    <span class="label">Endereço:</span>
                    <span class="value" style="font-size: 13px;">${addressHTML}</span>
                </div>
                <div class="customer-row">
                    <span class="label">Pagamento:</span>
                    <span class="value">${paymentHTML}</span>
                </div>
            </div>
            
            <div class="order-items-summary">
                <div class="summary-title">Itens do Pedido</div>
                <div class="order-item-list">
                    ${itemsHTML}
                </div>
            </div>
            
            <div class="order-card-footer">
                <div class="footer-total">
                    <span class="label">Total Geral</span>
                    <h5 class="value">R$ ${order.total.toFixed(2)}</h5>
                </div>
                
                <div class="footer-actions">
                    ${cancelButtonHTML}
                    <button class="btn-print" onclick="printOrderTicket(${order.id})" title="Imprimir Cupom Completo">
                        <span class="material-symbols-rounded">print</span>
                    </button>
                    <button class="btn-print btn-print-kitchen" onclick="printKitchenTicket(${order.id})" title="Imprimir Via Cozinha">
                        <span class="material-symbols-rounded">local_pizza</span>
                    </button>
                    ${actionButtonHTML}
                </div>
            </div>
        `;
        
        grid.appendChild(card);
    });
}

/* ==========================================================================
   Order State Updates
   ========================================================================== */
function updateOrderStatus(id, newStatus) {
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0 && db) {
        const order = orders.find(o => o.id === id);
        const refKey = (order && order.firebaseKey) ? order.firebaseKey : id;
        
        ConfigService.updateOrderStatus(refKey, newStatus)
        .catch(err => {
            alert("Erro ao atualizar status no Firebase.");
            console.error(err);
        });
    } else {
        fetch(`/api/orders/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        })
        .then(res => {
            if (!res.ok) throw new Error("Falha ao atualizar");
            return res.json();
        })
        .then(() => {
            fetchOrders(true); // Update silently
        })
        .catch(err => {
            alert("Erro ao atualizar status do pedido.");
            console.error(err);
        });
    }
}

function notifyCustomerReady(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) {
        alert("Pedido não encontrado.");
        return;
    }
    
    let phone = order.clientPhone.replace(/\D/g, '');
    if (phone.length === 10 || phone.length === 11) {
        phone = '55' + phone;
    }
    
    let text = '';
    if (order.checkoutType === 'delivery') {
        text = `Olá, *${order.clientName}*! Seu pedido *#${order.id}* da Pizzaria Drill está pronto e saindo para entrega! 🛵💨`;
    } else {
        text = `Olá, *${order.clientName}*! Seu pedido *#${order.id}* da Pizzaria Drill está pronto e você já pode vir retirar! 🏪🍕`;
    }
    
    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

/* ==========================================================================
   Thermal Receipt Printing Integration
   ========================================================================== */
function printOrderTicket(id) {
    const order = orders.find(o => o.id === id);
    if (!order) return;
    
    const printSection = document.getElementById('printSection');
    
    let itemsHTML = '';
    order.cart.forEach(item => {
        if (item.type === 'pizza') {
            itemsHTML += `
                <div class="ticket-item">
                    <div class="ticket-item-header">
                        <span>${item.quantity}x Pizza ${item.sizeName}</span>
                        <span>R$ ${item.totalPrice.toFixed(2)}</span>
                    </div>
                    <div class="ticket-item-details">
                        Sabores: ${item.flavorNames.join(' / ')}<br>
                        Borda: ${item.borderName}
                        ${item.notes ? `<br>Obs: "${item.notes}"` : ''}
                    </div>
                </div>
            `;
        } else if (item.type === 'acai') {
            let adds = [];
            if (item.freeAdditions && item.freeAdditions.length > 0) {
                adds.push(`Grátis: ${item.freeAdditions.join(', ')}`);
            }
            if (item.paidAdditions && item.paidAdditions.length > 0) {
                adds.push(`Pagos: ${item.paidAdditions.map(a => `${a.name} (+R$ ${a.price.toFixed(2)})`).join(', ')}`);
            }
            itemsHTML += `
                <div class="ticket-item">
                    <div class="ticket-item-header">
                        <span>${item.quantity}x Açaí ${item.size}</span>
                        <span>R$ ${item.totalPrice.toFixed(2)}</span>
                    </div>
                    <div class="ticket-item-details">
                        ${adds.length > 0 ? adds.join('<br>') : 'Sem adicionais'}
                        ${item.notes ? `<br>Obs: "${item.notes}"` : ''}
                    </div>
                </div>
            `;
        } else {
            itemsHTML += `
                <div class="ticket-item">
                    <div class="ticket-item-header">
                        <span>${item.quantity}x ${item.name}</span>
                        <span>R$ ${item.totalPrice.toFixed(2)}</span>
                    </div>
                </div>
            `;
        }
    });
    
    let addressHTML = 'RETIRADA NO BALCÃO';
    if (order.checkoutType === 'delivery' && order.address) {
        const addr = order.address;
        addressHTML = `
            ${addr.street.toUpperCase()}, Nº ${addr.number}
            BAIRRO: ${addr.neighborhood.toUpperCase()}
            ${addr.reference ? `REF: ${addr.reference.toUpperCase()}` : ''}
        `;
    }
    
    const payments = { 'pix': 'PIX', 'card': 'CARTÃO (MAQUININHA)', 'cash': 'DINHEIRO' };
    let paymentHTML = payments[order.paymentMethod] || order.paymentMethod.toUpperCase();
    if (order.paymentMethod === 'cash' && order.cashChange) {
        paymentHTML += ` (TROCO PARA ${order.cashChange})`;
    }
    
    printSection.innerHTML = `
        <div class="ticket-header">
            <div class="ticket-title">PIZZARIA DRILL</div>
            <div style="font-size: 11px;">Rua das Quaresmeiras, Nº 30 - Vale Verde</div>
            <div style="font-size: 11px;">Nova Petrópolis - RS | Tel: ${CONFIG_SETTINGS.whatsappFormatted || CONFIG_SETTINGS.whatsapp}</div>
            <div class="ticket-separator"></div>
            <div style="font-size: 14px; font-weight: bold;">PEDIDO #${order.id}</div>
            <div style="font-size: 11px;">Status: ${order.status.toUpperCase()}</div>
            <div style="font-size: 11px;">Data: ${order.date} | Horário: ${order.time}</div>
        </div>
        
        <div>
            <div class="ticket-section-title">Dados do Cliente</div>
            <div class="ticket-info-row">
                <span class="ticket-info-label">CLIENTE:</span>
                <span>${order.clientName.toUpperCase()}</span>
            </div>
            <div class="ticket-info-row">
                <span class="ticket-info-label">TELEFONE:</span>
                <span>${order.clientPhone}</span>
            </div>
            <div class="ticket-info-row">
                <span class="ticket-info-label">ENTREGA:</span>
                <span>${order.checkoutType === 'delivery' ? 'SIM - TELE-ENTREGA' : 'NÃO - RETIRADA'}</span>
            </div>
            <div style="margin-top: 4px;">
                <span class="ticket-info-label">ENDEREÇO:</span><br>
                <span style="font-size: 11px; font-weight: bold;">${addressHTML}</span>
            </div>
            <div class="ticket-info-row" style="margin-top: 4px;">
                <span class="ticket-info-label">PAGAMENTO:</span>
                <span>${paymentHTML}</span>
            </div>
        </div>
        
        <div class="ticket-separator"></div>
        
        <div>
            <div class="ticket-section-title">Itens do Pedido</div>
            <div style="margin-top: 4px;">
                ${itemsHTML}
            </div>
        </div>
        
        <div class="ticket-totals">
            <div class="ticket-total-row">
                <span>SUBTOTAL:</span>
                <span>R$ ${order.subtotal.toFixed(2)}</span>
            </div>
            <div class="ticket-total-row">
                <span>TAXA ENTREGA:</span>
                <span>${order.deliveryFee === 0 ? 'GRÁTIS' : `R$ ${order.deliveryFee.toFixed(2)}`}</span>
            </div>
            <div class="ticket-total-row grand-total">
                <span>TOTAL A PAGAR:</span>
                <span>R$ ${order.total.toFixed(2)}</span>
            </div>
        </div>
        
        <div class="ticket-footer">
            <span>OBRIGADO PELA PREFERÊNCIA!</span><br>
            <span>PIZZARIA DRILL</span>
        </div>
    `;
    
    // Launch print
    window.print();
}

function printKitchenTicket(id) {
    const order = orders.find(o => o.id === id);
    if (!order) return;
    
    const printSection = document.getElementById('printSection');
    
    let itemsHTML = '';
    order.cart.forEach(item => {
        if (item.type === 'pizza') {
            itemsHTML += `
                <div class="ticket-item" style="margin-bottom: 15px;">
                    <div class="ticket-item-header" style="font-weight: bold; font-size: 14px; border-bottom: 1px dashed #000; padding-bottom: 2px;">
                        <span>${item.quantity}x Pizza ${item.sizeName.toUpperCase()}</span>
                    </div>
                    <div class="ticket-item-details" style="font-size: 13px; line-height: 1.4; margin-top: 4px; padding-left: 8px;">
                        • SABORES: ${item.flavorNames.join(' / ').toUpperCase()}<br>
                        • BORDA: ${item.borderName.toUpperCase()}
                        ${item.notes ? `<br>• OBS: <span style="background-color: #000; color: #fff; padding: 0 4px; font-weight: bold; border-radius: 2px;">"${item.notes.toUpperCase()}"</span>` : ''}
                    </div>
                </div>
            `;
        } else if (item.type === 'acai') {
            let adds = [];
            if (item.freeAdditions && item.freeAdditions.length > 0) {
                adds.push(`GRÁTIS: ${item.freeAdditions.join(', ').toUpperCase()}`);
            }
            if (item.paidAdditions && item.paidAdditions.length > 0) {
                adds.push(`PAGOS: ${item.paidAdditions.map(a => `${a.name} (+R$ ${a.price.toFixed(2)})`).join(', ').toUpperCase()}`);
            }
            itemsHTML += `
                <div class="ticket-item" style="margin-bottom: 15px;">
                    <div class="ticket-item-header" style="font-weight: bold; font-size: 14px; border-bottom: 1px dashed #000; padding-bottom: 2px;">
                        <span>${item.quantity}x AÇAÍ ${item.size.toUpperCase()}</span>
                    </div>
                    <div class="ticket-item-details" style="font-size: 13px; line-height: 1.4; margin-top: 4px; padding-left: 8px;">
                        ${adds.length > 0 ? `• ${adds.join('<br>• ')}` : '• SEM ADICIONAIS'}
                        ${item.notes ? `<br>• OBS: <span style="background-color: #000; color: #fff; padding: 0 4px; font-weight: bold; border-radius: 2px;">"${item.notes.toUpperCase()}"</span>` : ''}
                    </div>
                </div>
            `;
        } else {
            itemsHTML += `
                <div class="ticket-item" style="margin-bottom: 15px;">
                    <div class="ticket-item-header" style="font-weight: bold; font-size: 14px; border-bottom: 1px dashed #000; padding-bottom: 2px;">
                        <span>${item.quantity}x ${item.name.toUpperCase()}</span>
                    </div>
                </div>
            `;
        }
    });
    
    printSection.innerHTML = `
        <div class="ticket-header" style="text-align: center; margin-bottom: 15px; border-bottom: 2px dashed #000; padding-bottom: 10px;">
            <div class="ticket-title" style="font-size: 18px; font-weight: bold; letter-spacing: 1px;">COZINHA - PIZZARIA DRILL</div>
            <div class="ticket-separator"></div>
            <div style="font-size: 20px; font-weight: 800; margin: 5px 0;">PEDIDO #${order.id}</div>
            <div style="font-size: 11px; font-family: monospace;">Data: ${order.date} | Horário: ${order.time}</div>
        </div>
        
        <div style="margin-bottom: 12px; font-size: 13px; line-height: 1.4;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="font-weight: bold;">CLIENTE:</span>
                <span style="font-weight: bold; font-size: 14px;">${order.clientName.toUpperCase()}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span style="font-weight: bold;">TIPO:</span>
                <span style="font-weight: bold;">${order.checkoutType === 'delivery' ? '🚗 DELIVERY' : '🏪 RETIRADA'}</span>
            </div>
        </div>
        
        <div class="ticket-separator" style="border-top: 2px dashed #000; margin: 10px 0;"></div>
        
        <div>
            <div class="ticket-section-title" style="font-weight: bold; font-size: 12px; margin-bottom: 10px;">Itens da Cozinha</div>
            <div style="margin-top: 4px;">
                ${itemsHTML}
            </div>
        </div>
        
        <div class="ticket-separator" style="border-top: 2px dashed #000; margin: 10px 0;"></div>
        
        <div class="ticket-footer" style="text-align: center; font-size: 13px; font-weight: bold; margin-top: 15px; border: 1px solid #000; padding: 4px; letter-spacing: 2px;">
            VIA DA COZINHA
        </div>
    `;
    
    // Launch print
    window.print();
}

/* ==========================================================================
   State Variables for Menu Management
   ========================================================================== */
let menuData = null;

const DEFAULT_MENU_DATA = {
    menu_items: {
        pizzas: [
            // --- TRADICIONAIS (SALGADAS) ---
            { id: 'calabresa', name: 'Calabresa', description: 'Molho de tomate, mussarela, calabresa e orégano.', image: 'assets/pizza_calabresa.png', category: 'salgadas', categoryType: 'tradicional', available: true },
            { id: 'frango_catupiry', name: 'Frango com Catupiry', description: 'Molho de tomate, mussarela, frango, catupiry e orégano.', image: 'assets/pizza_hero.png', category: 'salgadas', categoryType: 'tradicional', available: true },
            { id: 'bacon', name: 'Bacon', description: 'Molho de tomate, mussarela, bacon, parmesão e orégano.', image: 'assets/pizza_hero.png', category: 'salgadas', categoryType: 'tradicional', available: true },
            { id: 'quatro_queijos', name: '4 Queijos', description: 'Molho de tomate, mussarela, provolone, parmesão, catupiry e orégano.', image: 'assets/pizza_quatro_queijos.png', category: 'salgadas', categoryType: 'tradicional', available: true },
            { id: 'quatro_queijos_bacon', name: '4 Queijos com Bacon', description: 'Molho de tomate, mussarela, provolone, parmesão, requeijão, bacon e orégano.', image: 'assets/pizza_quatro_queijos.png', category: 'salgadas', categoryType: 'tradicional', available: true },
            { id: 'paulista', name: 'Paulista', description: 'Molho de tomate, mussarela, calabresa, cebola, azeitona e orégano.', image: 'assets/pizza_calabresa.png', category: 'salgadas', categoryType: 'tradicional', available: true },
            { id: 'alho_oleo', name: 'Alho e Óleo', description: 'Molho de tomate, mussarela, alho granulado, parmesão e orégano.', image: 'assets/pizza_hero.png', category: 'salgadas', categoryType: 'tradicional', available: true },
            { id: 'basca', name: 'Basca', description: 'Molho de tomate, mussarela, alho granulado, tomate picado, bacon e orégano.', image: 'assets/pizza_hero.png', category: 'salgadas', categoryType: 'tradicional', available: true },
            { id: 'marguerita', name: 'Marguerita', description: 'Molho de tomate, mussarela, tomate fatiado, parmesão, manjericão e orégano.', image: 'assets/pizza_margherita.png', category: 'salgadas', categoryType: 'tradicional', available: true },
            { id: 'milho', name: 'Milho', description: 'Molho de tomate, mussarela, milho, requeijão e orégano.', image: 'assets/pizza_hero.png', category: 'salgadas', categoryType: 'tradicional', available: true },
            { id: 'brocolis', name: 'Brócolis', description: 'Molho de tomate, mussarela, brócolis, requeijão e orégano.', image: 'assets/pizza_hero.png', category: 'salgadas', categoryType: 'tradicional', available: true },
            { id: 'brocolis_especial', name: 'Brócolis Especial', description: 'Molho de tomate, mussarela, brócolis, alho granulado, bacon e orégano.', image: 'assets/pizza_hero.png', category: 'salgadas', categoryType: 'tradicional', available: true },
            { id: 'bacon_especial', name: 'Bacon Especial', description: 'Molho de tomate, mussarela, bacon, milho, cheddar e orégano.', image: 'assets/pizza_hero.png', category: 'salgadas', categoryType: 'tradicional', available: true },
            { id: 'frango_especial', name: 'Frango Especial', description: 'Molho de tomate, mussarela, frango, bacon, milho e orégano.', image: 'assets/pizza_hero.png', category: 'salgadas', categoryType: 'tradicional', available: true },
            { id: 'portuguesa', name: 'Portuguesa', description: 'Molho de tomate, mussarela, presunto, pimentão, cebola, ovo, azeitona e orégano.', image: 'assets/pizza_hero.png', category: 'salgadas', categoryType: 'tradicional', available: true },
            { id: 'lombo_canadense', name: 'Lombo Canadense', description: 'Molho de tomate, mussarela, lombo, requeijão e orégano.', image: 'assets/pizza_hero.png', category: 'salgadas', categoryType: 'tradicional', available: true },

            // --- ESPECIAIS (SALGADAS) ---
            { id: 'file', name: 'Filé', description: 'Molho de tomate, mussarela, iscas de filé, requeijão e orégano.', image: 'assets/pizza_hero.png', category: 'salgadas', categoryType: 'especial', badge: 'Mais Pedido', available: true },
            { id: 'file_fritas', name: 'Filé com Fritas', description: 'Molho de tomate, mussarela, iscas de filé, batata frita, requeijão e orégano.', image: 'assets/pizza_hero.png', category: 'salgadas', categoryType: 'especial', available: true },
            { id: 'file_palha', name: 'Filé com Palha', description: 'Molho de tomate, mussarela, iscas de filé, batata palha e orégano.', image: 'assets/pizza_hero.png', category: 'salgadas', categoryType: 'especial', available: true },
            { id: 'strogonoff', name: 'Strogonoff', description: 'Molho de tomate, mussarela, strogonoff de carne, batata palha e orégano.', image: 'assets/pizza_hero.png', category: 'salgadas', categoryType: 'especial', available: true },
            { id: 'gaucha', name: 'Gaúcha', description: 'Molho de tomate, mussarela, iscas de filé, cebola, molho barbecue e orégano.', image: 'assets/pizza_hero.png', category: 'salgadas', categoryType: 'especial', available: true },
            { id: 'diavola', name: 'Diávola', description: 'Molho de tomate, mussarela, pepperoni, cebola roxa, azeitona e orégano.', image: 'assets/pizza_hero.png', category: 'salgadas', categoryType: 'especial', available: true },
            { id: 'mafiosa', name: 'Mafiosa', description: 'Molho de tomate, mussarela, pepperoni, cebola, pimentão, molho de pimenta e orégano.', image: 'assets/pizza_hero.png', category: 'salgadas', categoryType: 'especial', available: true },
            { id: 'doritos', name: 'Doritos', description: 'Molho de tomate, mussarela, iscas de filé, cheddar, Doritos e orégano.', image: 'assets/pizza_hero.png', category: 'salgadas', categoryType: 'especial', badge: 'Destaque', available: true },
            { id: 'coracao', name: 'Coração', description: 'Molho de tomate, mussarela, coração de galinha, requeijão e orégano.', image: 'assets/pizza_hero.png', category: 'salgadas', categoryType: 'especial', available: true },
            { id: 'coracao_alho', name: 'Coração com Alho', description: 'Molho de tomate, mussarela, coração de galinha, alho granulado, parmesão e orégano.', image: 'assets/pizza_hero.png', category: 'salgadas', categoryType: 'especial', available: true },
            { id: 'texas', name: 'Texas', description: 'Molho de tomate, mussarela, pepperoni, queijo provolone e orégano.', image: 'assets/pizza_hero.png', category: 'salgadas', categoryType: 'especial', available: true },
            { id: 'file_especial', name: 'Filé Especial', description: 'Molho de tomate, mussarela, iscas de filé, alho granulado, bacon e orégano.', image: 'assets/pizza_hero.png', category: 'salgadas', categoryType: 'especial', available: true },
            { id: 'gauchinha', name: 'Gauchinha', description: 'Molho de tomate, mussarela, costela desfiada, molho mostarda e orégano.', image: 'assets/pizza_hero.png', category: 'salgadas', categoryType: 'especial', available: true },
            { id: 'gauderia', name: 'Gaudéria', description: 'Molho de tomate, mussarela, costela desfiada, cebola, barbecue, queijo coalho e orégano.', image: 'assets/pizza_hero.png', category: 'salgadas', categoryType: 'especial', badge: 'Premium', available: true },
            { id: 'moda_casa', name: 'Moda da Casa', description: 'Molho de tomate, mussarela, calabresa, ovo, batata frita, cheddar e orégano.', image: 'assets/pizza_hero.png', category: 'salgadas', categoryType: 'especial', available: true },
            { id: 'lombo_abacaxi', name: 'Lombo com Abacaxi', description: 'Molho de tomate, mussarela, lombo canadense, abacaxi e orégano.', image: 'assets/pizza_hero.png', category: 'salgadas', categoryType: 'especial', available: true },

            // --- TRADICIONAIS (DOCES) ---
            { id: 'choco_preto', name: 'Choco Preto', description: 'Creme de leite e chocolate preto.', image: 'assets/pizza_chocolate.png', category: 'doces', categoryType: 'tradicional', available: true },
            { id: 'choco_branco', name: 'Choco Branco', description: 'Creme de leite e chocolate branco.', image: 'assets/pizza_chocolate.png', category: 'doces', categoryType: 'tradicional', available: true },
            { id: 'romeu_julieta_doce', name: 'Romeu e Julieta', description: 'Creme de leite, goiabada e mussarela.', image: 'assets/pizza_chocolate.png', category: 'doces', categoryType: 'tradicional', available: true },
            { id: 'confetes', name: 'Confetes', description: 'Creme de leite, chocolate (preto ou branco) e confetes.', image: 'assets/pizza_chocolate.png', category: 'doces', categoryType: 'tradicional', available: true },

            // --- ESPECIAIS (DOCES) ---
            { id: 'morango_moreno', name: 'Morango Moreno', description: 'Creme de leite, chocolate preto e morangos frescos.', image: 'assets/pizza_chocolate.png', category: 'doces', categoryType: 'especial', badge: 'Mais Pedido', available: true },
            { id: 'branco_morango', name: 'Branco com Morango', description: 'Creme de leite, chocolate branco e morangos frescos.', image: 'assets/pizza_chocolate.png', category: 'doces', categoryType: 'especial', available: true },
            { id: 'bombom', name: 'Bombom', description: 'Creme de leite, chocolate (preto ou branco) e bombom triturado.', image: 'assets/pizza_chocolate.png', category: 'doces', categoryType: 'especial', available: true },
            { id: 'stikadinho', name: 'Stikadinho', description: 'Creme de leite, chocolate preto, morango e chocolate Stikadinho.', image: 'assets/pizza_chocolate.png', category: 'doces', categoryType: 'especial', badge: 'Doce Premium', available: true },
            { id: 'banana_canela', name: 'Banana com Canela', description: 'Creme de leite, doce de leite, banana, mussarela e canela.', image: 'assets/pizza_chocolate.png', category: 'doces', categoryType: 'especial', available: true },
            { id: 'branco_abacaxi', name: 'Branco com Abacaxi', description: 'Creme de leite, chocolate branco e abacaxi.', image: 'assets/pizza_chocolate.png', category: 'doces', categoryType: 'especial', available: true }
        ],
        calzones: [
            { id: 'calzone_quatro_queijos', name: 'Quatro queijos', description: 'Mussarela, parmesão, provolone e requeijão.', price: 37.00, image: 'assets/pizza_hero.png' },
            { id: 'calzone_file_cheddar', name: 'Filé com cheddar', description: 'Mussarela, iscas de carne e cheddar.', price: 38.00, image: 'assets/pizza_hero.png' },
            { id: 'calzone_bacon', name: 'Bacon', description: 'Mussarela, bacon, tomate e alho.', price: 36.00, image: 'assets/pizza_hero.png' },
            { id: 'calzone_frango_requeijao', name: 'Frango com requeijão', description: 'Mussarela, frango e requeijão.', price: 32.00, image: 'assets/pizza_hero.png' },
            { id: 'calzone_costela_barbecue', name: 'Costela com barbecue', description: 'Mussarela, costela desfiada e barbecue.', price: 38.00, image: 'assets/pizza_hero.png' },
            { id: 'calzone_doce', name: 'Choco branco ou preto', description: 'Chocolate ao leite ou chocolate branco.', price: 35.00, image: 'assets/pizza_chocolate.png' }
        ],
        bebidas: [
            { id: 'coca_2l', name: 'Coca Cola 2l', price: 16.00, image: 'assets/coca_cola.png' },
            { id: 'guarana_2l', name: 'Guarana 2l', price: 15.00, image: 'assets/guarana.png' },
            { id: 'coca_600', name: 'Coca Cola 600ml', price: 10.00, image: 'assets/coca_cola.png' },
            { id: 'coca_zero_600', name: 'Coca Cola Zero 600ml', price: 10.00, image: 'assets/coca_cola.png' },
            { id: 'guarana_600', name: 'Guarana 600ml', price: 9.00, image: 'assets/guarana.png' },
            { id: 'coca_lata', name: 'Coca Cola lata', price: 6.00, image: 'assets/coca_cola.png' },
            { id: 'coca_zero_lata', name: 'Coca Cola Zero lata', price: 6.00, image: 'assets/coca_cola.png' },
            { id: 'guarana_lata', name: 'Guarana lata', price: 6.00, image: 'assets/guarana.png' },
            { id: 'agua', name: 'Agua com ou s/ gás', price: 4.00, image: 'assets/agua.png' },
            { id: 'vinho_seco', name: 'Vinho Seco', price: 35.00, image: 'assets/vinho.png' },
            { id: 'vinho_suave', name: 'Vinho Suave', price: 35.00, image: 'assets/vinho.png' }
        ],
        lanches: []
    },
    pizza_prices: {
        broto: { promocional: 65.0, tradicional: 70.0, especial: 75.0, camarao: 80.0 },
        media: { promocional: 75.0, tradicional: 80.0, especial: 85.0, camarao: 90.0 },
        grande: { promocional: 90.0, tradicional: 100.0, especial: 110.0, camarao: 115.0 },
        vulcao: { promocional: 90.0, tradicional: 100.0, especial: 110.0, camarao: 110.0 },
        trem: { promocional: 160.0, tradicional: 175.0, especial: 195.0, camarao: 210.0 }
    },
    borders: {
        'sem-borda': { name: 'Sem Borda', price: 0.00, category: 'ambas' },
        'requeijao': { name: 'Requeijão Cremoso', price: 13.00, category: 'salgadas' },
        'cheddar': { name: 'Borda de Cheddar', price: 13.00, category: 'salgadas' },
        'catupiry': { name: 'Borda de Catupiry', price: 16.00, category: 'salgadas' },
        'choco-preto': { name: 'Borda de Chocolate', price: 13.00, category: 'doces' },
        'choco-branco': { name: 'Borda de Chocolate Branco', price: 13.00, category: 'doces' },
        'choco-misto': { name: 'Borda de Chocolate Preto e Branco', price: 13.00, category: 'doces' },
        'doce-de-leite': { name: 'Borda Doce de Leite', price: 13.00, category: 'doces' }
    },
    settings: {
        whatsapp: '5554996985724',
        whatsappFormatted: '(54) 99698-5724',
        deliveryFees: {
            'centro': { name: 'Centro', fee: 10.00 },
            'logradouro': { name: 'Logradouro', fee: 10.00 },
            'juriti': { name: 'Juriti', fee: 10.00 },
            'pousada': { name: 'Pousada', fee: 15.00 },
            'bavaria': { name: 'Bavária', fee: 15.00 },
            'pia': { name: 'Pia', fee: 15.00 },
            'vila-rica': { name: 'Vila Rica', fee: 18.00 },
            'vale-verde': { name: 'Vale Verde', fee: 18.00 },
            'vila-germania': { name: 'Vila Germânia', fee: 18.00 },
            'linha-imperial': { name: 'Linha Imperial', fee: 22.00 },
            'vila-olinda': { name: 'Vila Olinda', fee: 25.00 },
            'linha-olinda': { name: 'Linha Olinda', fee: 30.00 },
            'pinhal': { name: 'Pinhal', fee: 40.00 }
        }
    },
    categories: [
        { id: 'todos', name: 'Todos', icon: '🍽️' },
        { id: 'mais-pedidos', name: 'Mais Pedidos', icon: '🔥' },
        { id: 'pizzas', name: 'Pizzas', icon: '🍕' },
        { id: 'lanches', name: 'Lanches', icon: '🍔' },
        { id: 'calzones', name: 'Calzones', icon: '🥟' },
        { id: 'bebidas', name: 'Bebidas', icon: '🥤' },
        { id: 'acai', name: 'Açaís', icon: '🍧' }
    ],
    banners: [
        { tag: 'Promoção', title: 'Pizzas Promocionais G', subtitle: 'Selecione apenas sabores promocionais e pague preço único fixo!', gradient: 'linear-gradient(135deg, #b71c1c 0%, #1a0a0a 100%)' },
        { tag: 'Forno de Pedra', title: 'Massa Fina & Crocante', subtitle: 'Ingredientes frescos selecionados diariamente', gradient: 'linear-gradient(135deg, #ffd600 0%, #3e2723 100%)' }
    ],
    acai_adicionais: []
};

/* ==========================================================================
   Menu Manager Functions
   ========================================================================== */
function switchSection(section) {
    currentSection = section;
    const btnNavOrders = document.getElementById('btnNavOrders');
    const btnNavMenu = document.getElementById('btnNavMenu');
    const btnNavReports = document.getElementById('btnNavReports');
    const btnNavSettings = document.getElementById('btnNavSettings');
    
    const sectionOrders = document.getElementById('section-orders');
    const sectionMenu = document.getElementById('section-menu');
    const sectionReports = document.getElementById('section-reports');
    const sectionSettings = document.getElementById('section-settings');
    
    if (btnNavOrders) btnNavOrders.classList.remove('active');
    if (btnNavMenu) btnNavMenu.classList.remove('active');
    if (btnNavReports) btnNavReports.classList.remove('active');
    if (btnNavSettings) btnNavSettings.classList.remove('active');
    
    if (sectionOrders) sectionOrders.classList.add('display-none');
    if (sectionMenu) sectionMenu.classList.add('display-none');
    if (sectionReports) sectionReports.classList.add('display-none');
    if (sectionSettings) sectionSettings.classList.add('display-none');
    
    if (section === 'orders') {
        if (btnNavOrders) btnNavOrders.classList.add('active');
        if (sectionOrders) sectionOrders.classList.remove('display-none');
    } else if (section === 'menu') {
        if (btnNavMenu) btnNavMenu.classList.add('active');
        if (sectionMenu) sectionMenu.classList.remove('display-none');
        
        if (!menuData) {
            initMenuSync();
        } else {
            renderMenuManager();
        }
    } else if (section === 'reports') {
        if (btnNavReports) btnNavReports.classList.add('active');
        if (sectionReports) sectionReports.classList.remove('display-none');
        renderReportsDashboard();
    } else if (section === 'settings') {
        if (btnNavSettings) btnNavSettings.classList.add('active');
        if (sectionSettings) sectionSettings.classList.remove('display-none');
        renderSettingsDashboard();
    }
}

function setMenuTab(tab) {
    currentMenuTab = tab;
    
    const tabs = ['Flavors', 'SweetPizzas', 'Calzones', 'Bebidas', 'Lanches', 'Acais', 'Prices', 'Categorias', 'Banners', 'Promocoes'];
    tabs.forEach(t => {
        const tabEl = document.getElementById('tab' + t);
        const contentEl = document.getElementById('menuTab' + t);
        if (tabEl) {
            if (t.toLowerCase() === tab) {
                tabEl.classList.add('active');
            } else {
                tabEl.classList.remove('active');
            }
        }
        if (contentEl) {
            if (t.toLowerCase() === tab) {
                contentEl.classList.remove('display-none');
            } else {
                contentEl.classList.add('display-none');
            }
        }
    });

    const btnAdd = document.getElementById('btnAddMenuProduct');
    const btnText = document.getElementById('btnAddMenuProductText');
    if (btnAdd) {
        if (tab === 'prices') {
            btnAdd.style.display = 'none';
        } else {
            btnAdd.style.display = 'inline-flex';
            if (tab === 'flavors') {
                btnText.innerText = 'Adicionar Sabor Salgado';
                btnAdd.onclick = () => openAddMenuProductModal('pizza');
            } else if (tab === 'sweetpizzas') {
                btnText.innerText = 'Adicionar Sabor Doce';
                btnAdd.onclick = () => openAddMenuProductModal('pizza');
            } else if (tab === 'calzones') {
                btnText.innerText = 'Adicionar Calzone';
                btnAdd.onclick = () => openAddMenuProductModal('calzone');
            } else if (tab === 'bebidas') {
                btnText.innerText = 'Adicionar Bebida';
                btnAdd.onclick = () => openAddMenuProductModal('bebida');
            } else if (tab === 'lanches') {
                btnText.innerText = 'Adicionar Lanche';
                btnAdd.onclick = () => openAddMenuProductModal('lanche');
            } else if (tab === 'acais') {
                btnText.innerText = 'Adicionar Açaí';
                btnAdd.onclick = () => openAddMenuProductModal('acai');
            } else if (tab === 'categorias') {
                btnText.innerText = 'Adicionar Categoria';
                btnAdd.onclick = () => openCategoryModal();
            } else if (tab === 'banners') {
                btnText.innerText = 'Adicionar Banner';
                btnAdd.onclick = () => openBannerModal();
            } else if (tab === 'promocoes') {
                btnText.innerText = 'Adicionar Combo/Promo';
                btnAdd.onclick = () => openPromotionModal();
            }
        }
    }
}

function initMenuSync() {
    // Render default menu data immediately as a fallback
    menuData = DEFAULT_MENU_DATA;
    renderMenuManager();

    if (typeof firebase !== 'undefined' && firebase.apps.length > 0 && db) {
        let configSettingsLoaded = false;
        let deliveryFeesLoaded = false;
        let productsLoaded = false;
        let categoriesLoaded = false;
        let bannersLoaded = false;
        let promotionsLoaded = false;

        const tryRender = () => {
            if (configSettingsLoaded && deliveryFeesLoaded && productsLoaded && categoriesLoaded && bannersLoaded && promotionsLoaded) {
                renderMenuManager();
            }
        };

        // Listen to config/settings
        ConfigService.subscribeSettings((data) => {
            if (data) {
                CONFIG_SETTINGS = { ...CONFIG_SETTINGS, ...data };
                if (!menuData) menuData = {};
                if (!menuData.settings) menuData.settings = {};
                Object.assign(menuData.settings, data);
                tempSettings = JSON.parse(JSON.stringify(menuData.settings));
            }
            configSettingsLoaded = true;
            tryRender();
        });

        // Listen to config/delivery_fees
        ConfigService.subscribeDeliveryFees((data) => {
            if (data) {
                if (!menuData) menuData = {};
                if (!menuData.settings) menuData.settings = {};
                menuData.settings.deliveryFees = data;
                if (tempSettings) tempSettings.deliveryFees = data;
            }
            deliveryFeesLoaded = true;
            tryRender();
        });

        // Listen to categorias
        ProductsService.subscribeCategories((list) => {
            if (!menuData) menuData = {};
            menuData.categories = list;
            categoriesLoaded = true;
            tryRender();
        });

        // Listen to banners
        ProductsService.subscribeBanners((list) => {
            if (!menuData) menuData = {};
            menuData.banners = list;
            bannersLoaded = true;
            tryRender();
        });

        // Listen to promocoes (for promotion combos list)
        ProductsService.subscribePromotions((list) => {
            if (!menuData) menuData = {};
            menuData.promotions = list;
            promotionsLoaded = true;
            tryRender();
        });

        // Listen to produtos (all items)
        ProductsService.subscribeProducts((list) => {
            if (!menuData) menuData = {};
            menuData.menu_items = { pizzas: [], lanches: [], calzones: [], bebidas: [], acais: [] };
            menuData.borders = {};
            menuData.acai_adicionais = [];

            list.forEach((item) => {
                if (item.category === 'pizzas' || item.category === 'salgadas' || item.category === 'doces') {
                    menuData.menu_items.pizzas.push(item);
                } else if (item.category === 'lanches') {
                    menuData.menu_items.lanches.push(item);
                } else if (item.category === 'calzones') {
                    menuData.menu_items.calzones.push(item);
                } else if (item.category === 'bebidas') {
                    menuData.menu_items.bebidas.push(item);
                } else if (item.category === 'acais' || item.category === 'acai') {
                    menuData.menu_items.acais.push(item);
                } else if (item.category === 'bordas') {
                    const key = item.id.replace('borda_', '');
                    menuData.borders[key] = { name: item.name, price: item.price, category: item.subcategory || 'ambas' };
                } else if (item.category === 'acai_adicionais') {
                    menuData.acai_adicionais.push(item);
                }
            });
            productsLoaded = true;
            tryRender();
        });
    } else {
        menuData = DEFAULT_MENU_DATA;
        renderMenuManager();
    }
}

// Global filter functions wrapper for input searches
function filterFlavorsList() {
    renderFlavorsList();
}

function renderCalzonesList() {
    const grid = document.getElementById('calzonesListGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const searchVal = document.getElementById('searchCalzone') ? document.getElementById('searchCalzone').value.toLowerCase().trim() : '';
    const calzones = menuData.menu_items?.calzones || [];
    calzones.forEach((calzone) => {
        if (searchVal && !calzone.name.toLowerCase().includes(searchVal) && !(calzone.description || '').toLowerCase().includes(searchVal)) {
            return;
        }
        const card = document.createElement('div');
        card.className = 'flavor-card';
        if (calzone.available === false) card.style.opacity = '0.6';
        const isChecked = calzone.available !== false ? 'checked' : '';
        
        card.innerHTML = `
            <div class="flavor-card-header">
                <div class="flavor-card-info">
                    <h4 style="margin: 0; color: var(--text-main); font-size: 15px;">${calzone.name}</h4>
                </div>
                <label class="switch" title="${calzone.available !== false ? 'Disponível no Site' : 'Pausado/Indisponível'}">
                    <input type="checkbox" ${isChecked} onchange="toggleFlavorAvailability('${calzone.id}', this.checked)">
                    <span class="slider"></span>
                </label>
            </div>
            <p class="flavor-card-desc" style="margin: 0; flex: 1;">${calzone.description || 'Sem descrição.'}</p>
            <div style="font-size: 13px; color: var(--primary); font-weight: 700; margin-top: 8px;">
                Preço: R$ ${(calzone.price || 0).toFixed(2).replace('.', ',')}
            </div>
            <div class="flavor-card-actions">
                <button class="btn-icon-action" onclick="openEditFlavorModal('${calzone.id}')" title="Editar Calzone">
                    <span class="material-symbols-rounded" style="font-size: 18px;">edit</span>
                </button>
                <button class="btn-icon-action delete" onclick="deleteFlavor('${calzone.id}')" title="Excluir Calzone">
                    <span class="material-symbols-rounded" style="font-size: 18px;">delete</span>
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function filterCalzonesList() {
    renderCalzonesList();
}

function renderBebidasList() {
    const grid = document.getElementById('bebidasListGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const searchVal = document.getElementById('searchBebida') ? document.getElementById('searchBebida').value.toLowerCase().trim() : '';
    const bebidas = menuData.menu_items?.bebidas || [];
    bebidas.forEach((bebida) => {
        if (searchVal && !bebida.name.toLowerCase().includes(searchVal) && !(bebida.description || '').toLowerCase().includes(searchVal)) {
            return;
        }
        const card = document.createElement('div');
        card.className = 'flavor-card';
        if (bebida.available === false) card.style.opacity = '0.6';
        const isChecked = bebida.available !== false ? 'checked' : '';
        
        card.innerHTML = `
            <div class="flavor-card-header">
                <div class="flavor-card-info">
                    <h4 style="margin: 0; color: var(--text-main); font-size: 15px;">${bebida.name}</h4>
                </div>
                <label class="switch" title="${bebida.available !== false ? 'Disponível no Site' : 'Pausado/Indisponível'}">
                    <input type="checkbox" ${isChecked} onchange="toggleFlavorAvailability('${bebida.id}', this.checked)">
                    <span class="slider"></span>
                </label>
            </div>
            <p class="flavor-card-desc" style="margin: 0; flex: 1;">${bebida.description || 'Sem descrição.'}</p>
            <div style="font-size: 13px; color: var(--primary); font-weight: 700; margin-top: 8px;">
                Preço: R$ ${(bebida.price || 0).toFixed(2).replace('.', ',')}
            </div>
            <div class="flavor-card-actions">
                <button class="btn-icon-action" onclick="openEditFlavorModal('${bebida.id}')" title="Editar Bebida">
                    <span class="material-symbols-rounded" style="font-size: 18px;">edit</span>
                </button>
                <button class="btn-icon-action delete" onclick="deleteFlavor('${bebida.id}')" title="Excluir Bebida">
                    <span class="material-symbols-rounded" style="font-size: 18px;">delete</span>
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function filterBebidasList() {
    renderBebidasList();
}

function renderLanchesList() {
    const grid = document.getElementById('lanchesListGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const searchVal = document.getElementById('searchLanche') ? document.getElementById('searchLanche').value.toLowerCase().trim() : '';
    const filterCat = document.getElementById('filterLancheCategory') ? document.getElementById('filterLancheCategory').value : 'todos';
    const lanches = menuData.menu_items?.lanches || [];
    lanches.forEach((lanche) => {
        if (searchVal && !lanche.name.toLowerCase().includes(searchVal) && !(lanche.description || '').toLowerCase().includes(searchVal)) {
            return;
        }
        if (filterCat !== 'todos' && lanche.subcategory !== filterCat) {
            return;
        }
        const card = document.createElement('div');
        card.className = 'flavor-card';
        if (lanche.available === false) card.style.opacity = '0.6';
        const isChecked = lanche.available !== false ? 'checked' : '';
        
        card.innerHTML = `
            <div class="flavor-card-header">
                <div class="flavor-card-info">
                    <h4 style="margin: 0; color: var(--text-main); font-size: 15px;">${lanche.name}</h4>
                    <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px;">
                        <span class="category-tag salgada" style="text-transform: capitalize;">${lanche.subcategory || 'lanche'}</span>
                    </div>
                </div>
                <label class="switch" title="${lanche.available !== false ? 'Disponível no Site' : 'Pausado/Indisponível'}">
                    <input type="checkbox" ${isChecked} onchange="toggleFlavorAvailability('${lanche.id}', this.checked)">
                    <span class="slider"></span>
                </label>
            </div>
            <p class="flavor-card-desc" style="margin: 0; flex: 1;">${lanche.description || 'Sem descrição.'}</p>
            <div style="font-size: 13px; color: var(--primary); font-weight: 700; margin-top: 8px;">
                Preço: R$ ${(lanche.price || 0).toFixed(2).replace('.', ',')}
            </div>
            <div class="flavor-card-actions">
                <button class="btn-icon-action" onclick="openEditFlavorModal('${lanche.id}')" title="Editar Lanche">
                    <span class="material-symbols-rounded" style="font-size: 18px;">edit</span>
                </button>
                <button class="btn-icon-action delete" onclick="deleteFlavor('${lanche.id}')" title="Excluir Lanche">
                    <span class="material-symbols-rounded" style="font-size: 18px;">delete</span>
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function filterLanchesList() {
    renderLanchesList();
}

function renderAcaisList() {
    const grid = document.getElementById('acaisListGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const searchVal = document.getElementById('searchAcai') ? document.getElementById('searchAcai').value.toLowerCase().trim() : '';
    const acais = menuData.menu_items?.acais || [];
    acais.forEach((acai) => {
        if (searchVal && !acai.name.toLowerCase().includes(searchVal) && !(acai.description || '').toLowerCase().includes(searchVal)) {
            return;
        }
        const card = document.createElement('div');
        card.className = 'flavor-card';
        if (acai.available === false) card.style.opacity = '0.6';
        const isChecked = acai.available !== false ? 'checked' : '';
        
        card.innerHTML = `
            <div class="flavor-card-header">
                <div class="flavor-card-info">
                    <h4 style="margin: 0; color: var(--text-main); font-size: 15px;">${acai.name}</h4>
                    <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px;">
                        <span class="category-tag salgada" style="text-transform: capitalize;">${acai.category || 'açaí'}</span>
                    </div>
                </div>
                <label class="switch" title="${acai.available !== false ? 'Disponível no Site' : 'Pausado/Indisponível'}">
                    <input type="checkbox" ${isChecked} onchange="toggleFlavorAvailability('${acai.id}', this.checked)">
                    <span class="slider"></span>
                </label>
            </div>
            <p class="flavor-card-desc" style="margin: 0; flex: 1;">${acai.description || 'Sem descrição.'}</p>
            <div style="font-size: 13px; color: var(--primary); font-weight: 700; margin-top: 8px;">
                Preço: R$ ${(acai.price || 0).toFixed(2).replace('.', ',')}
            </div>
            <div class="flavor-card-actions">
                <button class="btn-icon-action" onclick="openEditFlavorModal('${acai.id}')" title="Editar Açaí">
                    <span class="material-symbols-rounded" style="font-size: 18px;">edit</span>
                </button>
                <button class="btn-icon-action delete" onclick="deleteFlavor('${acai.id}')" title="Excluir Açaí">
                    <span class="material-symbols-rounded" style="font-size: 18px;">delete</span>
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function filterAcaisList() {
    renderAcaisList();
}

function renderMenuManager() {
    if (!menuData) return;
    
    renderFlavorsList();
    renderSweetFlavorsList();
    renderCalzonesList();
    renderBebidasList();
    renderLanchesList();
    renderAcaisList();
    renderPricesMatrix();
    renderBordersTable();
    renderAcaiAdditionsTable();
    renderCategoriasList();
    renderBannersList();
    renderPromocoesList();
}

function renderFlavorsList() {
    const grid = document.getElementById('flavorsListGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    const searchVal = document.getElementById('searchFlavor').value.toLowerCase().trim();
    const pizzas = menuData.menu_items?.pizzas || [];
    
    pizzas.forEach((pizza) => {
        const cat = pizza.subcategory || pizza.category;
        if (cat === 'doces') {
            return;
        }
        
        if (searchVal && !pizza.name.toLowerCase().includes(searchVal) && !pizza.description.toLowerCase().includes(searchVal)) {
            return;
        }
        
        const card = document.createElement('div');
        card.className = 'flavor-card';
        if (pizza.available === false) {
            card.style.opacity = '0.6';
        }
        
        const badgeHTML = pizza.badge ? `<span class="flavor-badge-label">${pizza.badge}</span>` : '';
        const isChecked = pizza.available !== false ? 'checked' : '';
        const promoTagHTML = pizza.isPromo ? `<span class="category-tag promo" style="background: rgba(255, 193, 7, 0.15); color: #ffc107; border: 1px solid rgba(255, 193, 7, 0.3); font-weight: bold;">Promoção</span>` : '';
        
        card.innerHTML = `
            <div class="flavor-card-header">
                <div class="flavor-card-info">
                    <h4 style="margin: 0; color: var(--text-main); font-size: 15px;">${pizza.name}</h4>
                    <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px;">
                        <span class="category-tag salgada">Salgada</span>
                        ${promoTagHTML}
                    </div>
                </div>
                
                <label class="switch" title="${pizza.available !== false ? 'Disponível no Site' : 'Pausado/Indisponível'}">
                    <input type="checkbox" ${isChecked} onchange="toggleFlavorAvailability('${pizza.id}', this.checked)">
                    <span class="slider"></span>
                </label>
            </div>
            
            <p class="flavor-card-desc" style="margin: 0; flex: 1;">${pizza.description}</p>
            
            <div class="flavor-card-prices" style="font-size: 11px; color: var(--text-muted); margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px 0; border-top: 1px dashed rgba(255,255,255,0.05); border-bottom: 1px dashed rgba(255,255,255,0.05);">
                <span>Broto (B): <strong>R$ ${pizza.prices?.B || 0}</strong></span>
                <span>Média (M): <strong>R$ ${pizza.prices?.M || 0}</strong></span>
                <span>Grande (G): <strong>R$ ${pizza.prices?.G || 0}</strong></span>
                <span>Família (F): <strong>R$ ${pizza.prices?.F || 0}</strong></span>
            </div>
            
            <div class="flavor-card-meta" style="margin-top: 8px;">
                <span class="flavor-price-tier" style="font-weight: 600; color: var(--primary); font-size: 12px; text-transform: uppercase;">
                    ${pizza.categoryType || 'promocional'}
                </span>
                ${badgeHTML}
            </div>
            
            <div class="flavor-card-actions">
                <button class="btn-icon-action" onclick="openEditFlavorModal('${pizza.id}')" title="Editar Sabor">
                    <span class="material-symbols-rounded" style="font-size: 18px;">edit</span>
                </button>
                <button class="btn-icon-action delete" onclick="deleteFlavor('${pizza.id}')" title="Excluir Sabor">
                    <span class="material-symbols-rounded" style="font-size: 18px;">delete</span>
                </button>
            </div>
        `;
        
        grid.appendChild(card);
    });
}

function filterFlavorsList() {
    renderFlavorsList();
}

function renderSweetFlavorsList() {
    const grid = document.getElementById('sweetFlavorsListGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    const searchVal = document.getElementById('searchSweetFlavor') ? document.getElementById('searchSweetFlavor').value.toLowerCase().trim() : '';
    const pizzas = menuData.menu_items?.pizzas || [];
    
    pizzas.forEach((pizza) => {
        const cat = pizza.subcategory || pizza.category;
        if (cat !== 'doces') {
            return;
        }
        
        if (searchVal && !pizza.name.toLowerCase().includes(searchVal) && !pizza.description.toLowerCase().includes(searchVal)) {
            return;
        }
        
        const card = document.createElement('div');
        card.className = 'flavor-card';
        if (pizza.available === false) {
            card.style.opacity = '0.6';
        }
        
        const badgeHTML = pizza.badge ? `<span class="flavor-badge-label">${pizza.badge}</span>` : '';
        const isChecked = pizza.available !== false ? 'checked' : '';
        const promoTagHTML = pizza.isPromo ? `<span class="category-tag promo" style="background: rgba(255, 193, 7, 0.15); color: #ffc107; border: 1px solid rgba(255, 193, 7, 0.3); font-weight: bold;">Promoção</span>` : '';
        
        card.innerHTML = `
            <div class="flavor-card-header">
                <div class="flavor-card-info">
                    <h4 style="margin: 0; color: var(--text-main); font-size: 15px;">${pizza.name}</h4>
                    <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px;">
                        <span class="category-tag doce">Doce</span>
                        ${promoTagHTML}
                    </div>
                </div>
                
                <label class="switch" title="${pizza.available !== false ? 'Disponível no Site' : 'Pausado/Indisponível'}">
                    <input type="checkbox" ${isChecked} onchange="toggleFlavorAvailability('${pizza.id}', this.checked)">
                    <span class="slider"></span>
                </label>
            </div>
            
            <p class="flavor-card-desc" style="margin: 0; flex: 1;">${pizza.description}</p>
            
            <div class="flavor-card-prices" style="font-size: 11px; color: var(--text-muted); margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px 0; border-top: 1px dashed rgba(255,255,255,0.05); border-bottom: 1px dashed rgba(255,255,255,0.05);">
                <span>Broto (B): <strong>R$ ${pizza.prices?.B || 0}</strong></span>
                <span>Média (M): <strong>R$ ${pizza.prices?.M || 0}</strong></span>
                <span>Grande (G): <strong>R$ ${pizza.prices?.G || 0}</strong></span>
                <span>Família (F): <strong>R$ ${pizza.prices?.F || 0}</strong></span>
            </div>
            
            <div class="flavor-card-meta" style="margin-top: 8px;">
                <span class="flavor-price-tier" style="font-weight: 600; color: var(--primary); font-size: 12px; text-transform: uppercase;">
                    ${pizza.categoryType || 'promocional'}
                </span>
                ${badgeHTML}
            </div>
            
            <div class="flavor-card-actions">
                <button class="btn-icon-action" onclick="openEditFlavorModal('${pizza.id}')" title="Editar Sabor">
                    <span class="material-symbols-rounded" style="font-size: 18px;">edit</span>
                </button>
                <button class="btn-icon-action delete" onclick="deleteFlavor('${pizza.id}')" title="Excluir Sabor">
                    <span class="material-symbols-rounded" style="font-size: 18px;">delete</span>
                </button>
            </div>
        `;
        
        grid.appendChild(card);
    });
}

function filterSweetFlavorsList() {
    renderSweetFlavorsList();
}

function renderPricesMatrix() {
    const tbody = document.getElementById('pricesMatrixBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const sizes = ['broto', 'media', 'grande', 'vulcao', 'trem'];
    const sizeLabels = {
        'broto': 'Broto (20cm)',
        'media': 'Média (30cm)',
        'grande': 'Grande (35cm)',
        'vulcao': 'Vulcão (35cm)',
        'trem': 'Trem (50cm)'
    };
    
    const prices = menuData.pizza_prices || {};
    
    sizes.forEach(size => {
        const sizePrices = prices[size] || { promocional: 0, tradicional: 0, especial: 0, camarao: 0 };
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border-color)';
        
        tr.innerHTML = `
            <td style="padding: 12px 10px; font-weight: 600; color: var(--text-main);">${sizeLabels[size]}</td>
            <td style="padding: 8px 10px;">
                <input type="number" step="0.50" class="price-input" data-size="${size}" data-category="promocional" value="${sizePrices.promocional || 0}" style="padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-main); width: 85px;">
            </td>
            <td style="padding: 8px 10px;">
                <input type="number" step="0.50" class="price-input" data-size="${size}" data-category="tradicional" value="${sizePrices.tradicional || 0}" style="padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-main); width: 85px;">
            </td>
            <td style="padding: 8px 10px;">
                <input type="number" step="0.50" class="price-input" data-size="${size}" data-category="especial" value="${sizePrices.especial || 0}" style="padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-main); width: 85px;">
            </td>
            <td style="padding: 8px 10px;">
                <input type="number" step="0.50" class="price-input" data-size="${size}" data-category="camarao" value="${sizePrices.camarao || 0}" style="padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-main); width: 85px;">
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderBordersTable() {
    const tbody = document.getElementById('bordersTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const borders = menuData.borders || {};
    
    Object.keys(borders).forEach(key => {
        const border = borders[key];
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border-color)';
        
        let catLabel = 'Salgada';
        if (border.category === 'doces') {
            catLabel = 'Doce';
        } else if (border.category === 'ambas') {
            catLabel = 'Ambas';
        } else if (!border.category) {
            // Fallback para dados legados
            const cleanKey = key.toLowerCase();
            if (cleanKey.includes('choco') || cleanKey.includes('doce') || cleanKey.includes('leite') || cleanKey.includes('misto')) {
                catLabel = 'Doce';
            }
        }
        
        tr.innerHTML = `
            <td style="padding: 12px 10px; font-weight: 600; color: var(--text-light); font-family: monospace;">${key}</td>
            <td style="padding: 12px 10px; color: var(--text-main);">${border.name}</td>
            <td style="padding: 12px 10px; color: var(--text-muted); font-size: 13px;">${catLabel}</td>
            <td style="padding: 8px 10px;">
                <input type="number" step="0.50" class="border-price-input" data-id="${key}" value="${border.price}" style="padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-main); width: 85px;">
            </td>
            <td style="padding: 12px 10px; text-align: right;">
                ${key === 'sem-borda' ? '' : `
                <button type="button" class="btn-icon-action delete" onclick="deleteBorder('${key}')" title="Excluir Borda" style="border: none; background: transparent; color: #ef4444; cursor: pointer; padding: 4px; border-radius: var(--radius-sm); display: inline-flex; align-items: center; justify-content: center;">
                    <span class="material-symbols-rounded" style="font-size: 18px;">delete</span>
                </button>
                `}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openBorderModal() {
    document.getElementById('borderForm').reset();
    openModal('borderModal');
}

function closeBorderModal() {
    closeModal('borderModal');
}

function updateLocalPricesAndBorders() {
    if (!menuData) return;
    
    // Save pizza prices
    const priceInputs = document.querySelectorAll('.price-input');
    priceInputs.forEach(input => {
        const size = input.getAttribute('data-size');
        const category = input.getAttribute('data-category');
        if (menuData.pizza_prices) {
            if (!menuData.pizza_prices[size]) {
                menuData.pizza_prices[size] = {};
            }
            menuData.pizza_prices[size][category] = parseFloat(input.value) || 0;
        }
    });

    // Save border prices
    const borderPriceInputs = document.querySelectorAll('.border-price-input');
    borderPriceInputs.forEach(input => {
        const key = input.getAttribute('data-id');
        if (menuData.borders && menuData.borders[key]) {
            menuData.borders[key].price = parseFloat(input.value) || 0;
        }
    });

    // Save acai additions prices
    const acaiPriceInputs = document.querySelectorAll('.acai-addition-price-input');
    acaiPriceInputs.forEach(input => {
        const id = input.getAttribute('data-id');
        const item = menuData.acai_adicionais.find(a => a.id === id);
        if (item) {
            item.price = parseFloat(input.value) || 0;
            if (item.price === 0) item.type = 'free';
            else if (item.price === 5) item.type = 'paid_5';
            else if (item.price === 2.5) item.type = 'paid_2.5';
            else item.type = `paid_${item.price}`;
        }
    });
}

function deleteBorder(key) {
    if (key === 'sem-borda') {
        alert("A opção 'Sem Borda' não pode ser excluída.");
        return;
    }
    if (confirm("Tem certeza que deseja excluir esta borda?")) {
        updateLocalPricesAndBorders();
        delete menuData.borders[key];
        renderBordersTable();
    }
}

function saveNewBorder(event) {
    event.preventDefault();
    if (!menuData) return;
    
    const nameInput = document.getElementById('borderName');
    const priceInput = document.getElementById('borderPrice');
    const categoryInput = document.getElementById('borderCategory');
    
    const name = nameInput.value.trim();
    const price = parseFloat(priceInput.value) || 0;
    const category = categoryInput ? categoryInput.value : 'salgadas';
    
    if (!name) return;
    
    // Generate key
    const key = name.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
        .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric with hyphens
        .replace(/(^-|-$)/g, ''); // trim hyphens
        
    if (!key) {
        alert("Nome de borda inválido.");
        return;
    }
    
    if (menuData.borders && menuData.borders[key]) {
        alert("Já existe uma borda com este nome ou identificador.");
        return;
    }
    
    updateLocalPricesAndBorders();
    
    if (!menuData.borders) {
        menuData.borders = {};
    }
    
    menuData.borders[key] = {
        name: name,
        price: price,
        category: category
    };
    
    closeBorderModal();
    renderBordersTable();
}

/* ==========================================================================
   Açaí Additions Management Functions
   ========================================================================== */
function renderAcaiAdditionsTable() {
    const tbody = document.getElementById('acaiAdditionsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const additions = menuData.acai_adicionais || [];
    
    // Sort additions alphabetically by name
    additions.sort((a, b) => a.name.localeCompare(b.name));
    
    additions.forEach(item => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border-color)';
        
        let typeLabel = 'Grátis';
        let defaultPrice = 0.00;
        if (item.type === 'paid_5') {
            typeLabel = 'Pago (Base R$ 5,00)';
            defaultPrice = 5.00;
        } else if (item.type === 'paid_2.5') {
            typeLabel = 'Pago (Base R$ 2,50)';
            defaultPrice = 2.50;
        }
        
        const actualPrice = item.price !== undefined ? item.price : defaultPrice;
        const isChecked = item.available !== false ? 'checked' : '';
        
        tr.innerHTML = `
            <td style="padding: 12px 10px; font-weight: 600; color: var(--text-main);">${item.name}</td>
            <td style="padding: 12px 10px; color: var(--text-light); font-size: 13px;">${typeLabel}</td>
            <td style="padding: 8px 10px;">
                <input type="number" step="0.10" class="acai-addition-price-input" data-id="${item.id}" value="${actualPrice}" style="padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-main); width: 85px;">
            </td>
            <td style="padding: 8px 10px; text-align: center;">
                <label class="switch" style="margin: 0 auto; display: inline-block;" title="${item.available !== false ? 'Ativo' : 'Pausado'}">
                    <input type="checkbox" ${isChecked} onchange="toggleAcaiAdditionAvailability('${item.id}', this.checked)">
                    <span class="slider"></span>
                </label>
            </td>
            <td style="padding: 12px 10px; text-align: right;">
                <button type="button" class="btn-icon-action delete" onclick="deleteAcaiAddition('${item.id}')" title="Excluir Adicional" style="border: none; background: transparent; color: #ef4444; cursor: pointer; padding: 4px; border-radius: var(--radius-sm); display: inline-flex; align-items: center; justify-content: center;">
                    <span class="material-symbols-rounded" style="font-size: 18px;">delete</span>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openAcaiAdditionModal() {
    document.getElementById('acaiAdditionForm').reset();
    openModal('acaiAdditionModal');
}

function closeAcaiAdditionModal() {
    closeModal('acaiAdditionModal');
}

function saveNewAcaiAddition(event) {
    event.preventDefault();
    
    const name = document.getElementById('acaiAdditionName').value.trim();
    const type = document.getElementById('acaiAdditionType').value;
    
    if (!name) {
        alert("Por favor, preencha o nome do adicional.");
        return;
    }
    
    // Generate a unique ID for the addition based on its name
    const cleanId = 'add_' + name.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove accents
        .replace(/[^a-z0-9]+/g, '_'); // replace non-alphanumeric with _
        
    let price = 0;
    if (type === 'paid_5') price = 5;
    if (type === 'paid_2.5') price = 2.5;
    
    const newAddition = {
        id: cleanId,
        name: name,
        price: price,
        category: 'acai_adicionais',
        type: type,
        available: true
    };
    
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0 && db) {
        ProductsService.saveProduct(cleanId, newAddition)
        .then(() => {
            closeAcaiAdditionModal();
        })
        .catch(err => {
            console.error(err);
            alert("Erro ao salvar o adicional no Firebase.");
        });
    } else {
        if (!menuData.acai_adicionais) menuData.acai_adicionais = [];
        // Check if ID already exists
        if (menuData.acai_adicionais.some(a => a.id === cleanId)) {
            alert("Já existe um adicional com este nome.");
            return;
        }
        menuData.acai_adicionais.push(newAddition);
        closeAcaiAdditionModal();
        renderAcaiAdditionsTable();
    }
}

function toggleAcaiAdditionAvailability(id, isChecked) {
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0 && db) {
        ProductsService.updateProductAvailability(id, isChecked)
        .catch(err => {
            console.error(err);
            alert("Erro ao alterar disponibilidade do adicional.");
        });
    } else {
        const item = menuData.acai_adicionais.find(i => i.id === id);
        if (item) {
            item.available = isChecked;
            renderAcaiAdditionsTable();
        }
    }
}

function deleteAcaiAddition(id) {
    if (confirm("Tem certeza que deseja excluir este adicional de açaí?")) {
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0 && db) {
            ProductsService.deleteProduct(id)
            .catch(err => {
                console.error(err);
                alert("Erro ao excluir o adicional no Firebase.");
            });
        } else {
            const index = menuData.acai_adicionais.findIndex(a => a.id === id);
            if (index !== -1) {
                menuData.acai_adicionais.splice(index, 1);
                renderAcaiAdditionsTable();
            }
        }
    }
}

function saveMenuPrices() {
    const priceInputs = document.querySelectorAll('.price-input');
    const borderPriceInputs = document.querySelectorAll('.border-price-input');
    const acaiPriceInputs = document.querySelectorAll('.acai-addition-price-input');
    
    const updatedPrices = JSON.parse(JSON.stringify(menuData.pizza_prices || {}));
    const updatedBorders = JSON.parse(JSON.stringify(menuData.borders || {}));
    
    priceInputs.forEach(input => {
        const size = input.getAttribute('data-size');
        const category = input.getAttribute('data-category');
        if (!updatedPrices[size]) {
            updatedPrices[size] = {};
        }
        updatedPrices[size][category] = parseFloat(input.value) || 0;
    });
    
    borderPriceInputs.forEach(input => {
        const key = input.getAttribute('data-id');
        if (updatedBorders[key]) {
            updatedBorders[key].price = parseFloat(input.value) || 0;
        }
    });
    
    acaiPriceInputs.forEach(input => {
        const id = input.getAttribute('data-id');
        const item = menuData.acai_adicionais.find(a => a.id === id);
        if (item) {
            item.price = parseFloat(input.value) || 0;
            if (item.price === 0) item.type = 'free';
            else if (item.price === 5) item.type = 'paid_5';
            else if (item.price === 2.5) item.type = 'paid_2.5';
            else item.type = `paid_${item.price}`;
        }
    });
    
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0 && db) {
        const promises = [];
        
        // Save pizza prices matrix to Firestore
        if (ConfigService.savePizzaPrices) {
            const pricesPromise = ConfigService.savePizzaPrices(updatedPrices);
            promises.push(pricesPromise);
        }
        
        // Save borders
        Object.keys(updatedBorders).forEach(key => {
            const border = updatedBorders[key];
            const borderPromise = ProductsService.saveProduct(`borda_${key}`, {
                id: `borda_${key}`,
                name: border.name,
                price: border.price,
                category: 'bordas',
                subcategory: border.category || 'ambas',
                available: true
            });
            promises.push(borderPromise);
        });
        
        // Save acai additions
        menuData.acai_adicionais.forEach(item => {
            const itemPromise = ProductsService.saveProduct(item.id, item);
            promises.push(itemPromise);
        });
        
        Promise.all(promises)
        .then(() => {
            alert("Preços, bordas e adicionais de açaí atualizados com sucesso no Firebase!");
        })
        .catch(err => {
            console.error(err);
            alert("Erro ao salvar preços no Firebase.");
        });
    } else {
        menuData.pizza_prices = updatedPrices;
        menuData.borders = updatedBorders;
        alert("Preços locais salvos (sem Firebase).");
    }
}

function toggleFlavorAvailability(id, isChecked) {
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0 && db) {
        ProductsService.updateProductAvailability(id, isChecked)
        .then(() => {
            console.log(`Disponibilidade alterada para: ${isChecked}`);
        })
        .catch(err => console.error("Erro ao alterar disponibilidade no Firebase:", err));
    }
}

function saveMenuItem(event) {
    event.preventDefault();
    if (!menuData) return;
    
    const type = document.getElementById('menuItemType').value;
    const idField = document.getElementById('flavorEditId').value;
    const name = document.getElementById('flavorName').value.trim();
    const image = document.getElementById('flavorImage').value;
    
    const dbType = type === 'pizza' ? 'pizzas' : (type === 'calzone' ? 'calzones' : (type === 'bebida' ? 'bebidas' : (type === 'acai' ? 'acais' : 'lanches')));
    
    let targetItem = {};
    let id = idField;
    
    if (idField) {
        const items = menuData.menu_items?.[dbType] || [];
        const existing = items.find(i => i.id === idField);
        targetItem = existing ? { ...existing } : { id: idField };
    } else {
        id = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        targetItem = { id: id, available: true };
    }
    
    targetItem.name = name;
    targetItem.image = image;
    targetItem.category = dbType;
    
    if (type === 'pizza') {
        targetItem.description = document.getElementById('flavorDescription').value.trim();
        targetItem.subcategory = document.getElementById('flavorCategory').value;
        targetItem.categoryType = document.getElementById('flavorCategoryType').value;
        targetItem.badge = document.getElementById('flavorBadge').value.trim();
        targetItem.isPromo = document.getElementById('flavorIsPromo')?.checked || false;
        targetItem.prices = {
            B: parseFloat(document.getElementById('priceBrotinho').value) || 0,
            M: parseFloat(document.getElementById('priceMedia').value) || 0,
            G: parseFloat(document.getElementById('priceGrande').value) || 0,
            F: parseFloat(document.getElementById('priceFamilia').value) || 0
        };
    } else {
        targetItem.price = parseFloat(document.getElementById('itemPrice').value) || 0;
        
        const promoPriceInput = document.getElementById('itemPromoPrice').value;
        if (promoPriceInput !== '') {
            targetItem.promoPrice = parseFloat(promoPriceInput) || 0;
        } else {
            targetItem.promoPrice = null;
        }
        
        if (type === 'calzone' || type === 'lanche' || type === 'acai') {
            targetItem.description = document.getElementById('flavorDescription').value.trim();
        }
        if (type === 'lanche') {
            targetItem.subcategory = document.getElementById('flavorCategory').value;
        }
    }
    targetItem.isPromo = document.getElementById('flavorIsPromo')?.checked || false;
    
    const promoDaysChecked = [];
    document.querySelectorAll('input[name="promoDay"]:checked').forEach(chk => {
        promoDaysChecked.push(chk.value);
    });
    targetItem.promoDays = promoDaysChecked;
    
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0 && db) {
        ProductsService.saveProduct(id, targetItem)
        .then(() => {
            closeFlavorModal();
            alert("Item gravado com sucesso!");
        })
        .catch(err => {
            console.error(err);
            alert("Erro ao gravar item no Firebase.");
        });
    } else {
        closeFlavorModal();
        alert("Gravado localmente (sem Firebase).");
    }
}

function deleteMenuItem(type, id) {
    if (!confirm(`Tem certeza que deseja excluir este item permanentemente?`)) return;
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0 && db) {
        ProductsService.deleteProduct(id)
        .then(() => {
            alert("Item excluído com sucesso!");
        })
        .catch(err => {
            console.error(err);
            alert("Erro ao excluir item no Firebase.");
        });
    }
}

function toggleItemAvailability(type, id, isChecked) {
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0 && db) {
        ProductsService.updateProductAvailability(id, isChecked)
        .then(() => {
            console.log(`Disponibilidade alterada para: ${isChecked}`);
        })
        .catch(err => console.error("Erro ao alterar disponibilidade no Firebase:", err));
    }
}

function confirmClearAllOrders() {
    const confirmation = confirm("⚠️ ATENÇÃO: Tem certeza absoluta de que deseja ZERAR todos os pedidos do painel? \n\nEsta ação apagará permanentemente todos os registros de pedidos e é irreversível!");
    
    if (confirmation) {
        // Double confirmation to prevent accidental clicks
        const doubleConfirmation = confirm("Confirme novamente: Deseja REALMENTE excluir todos os pedidos de forma permanente?");
        if (doubleConfirmation) {
            clearAllOrders();
        }
    }
}

function clearAllOrders() {
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0 && db) {
        ConfigService.clearAllOrders()
        .then(() => {
            alert("Sucesso: Todos os pedidos foram apagados no Firebase!");
            orders = [];
            knownOrderIds.clear();
            updateIndicators();
            renderOrdersList();
        })
        .catch(err => {
            alert("Erro ao zerar pedidos no Firebase.");
            console.error(err);
        });
    } else {
        // Clear from Local Express API
        fetch('/api/orders', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(res => {
            if (!res.ok) throw new Error("Erro na requisição ao servidor.");
            return res.json();
        })
        .then(data => {
            alert("Sucesso: Todos os pedidos locais foram apagados!");
            orders = [];
            knownOrderIds.clear();
            updateIndicators();
            renderOrdersList();
        })
        .catch(err => {
            alert("Erro ao zerar pedidos locais.");
            console.error(err);
        });
    }
}

/* ==========================================================================
   Reports / Stats Dashboard Functions
   ========================================================================== */
function renderReportsDashboard() {
    if (!orders) return;
    
    const range = document.getElementById('reportFilterRange').value;
    const now = Date.now();
    let filteredOrders = orders.filter(o => o.status === 'Entregue');
    
    // Filter by date range
    if (range === 'today') {
        const startOfToday = new Date().setHours(0,0,0,0);
        filteredOrders = filteredOrders.filter(o => o.timestamp >= startOfToday);
    } else if (range === '7days') {
        const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
        filteredOrders = filteredOrders.filter(o => o.timestamp >= sevenDaysAgo);
    } else if (range === '30days') {
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
        filteredOrders = filteredOrders.filter(o => o.timestamp >= thirtyDaysAgo);
    }
    
    // Calculate basic stats
    let totalRevenue = 0;
    let paymentsCount = { pix: 0, card: 0, cash: 0 };
    let paymentsRevenue = { pix: 0, card: 0, cash: 0 };
    let productsCount = {};
    
    filteredOrders.forEach(order => {
        totalRevenue += order.total;
        
        // Payment breakdown
        const method = order.paymentMethod ? order.paymentMethod.toLowerCase() : 'cash';
        if (paymentsCount[method] !== undefined) {
            paymentsCount[method]++;
            paymentsRevenue[method] += order.total;
        }
        
        // Product counts
        if (order.cart) {
            order.cart.forEach(item => {
                let name = item.name;
                if (item.type === 'pizza') {
                    name = `Pizza ${item.sizeName} (${item.flavorNames.join('/')})`;
                } else if (item.type === 'acai') {
                    name = `Açaí ${item.size}`;
                }
                productsCount[name] = (productsCount[name] || 0) + item.quantity;
            });
        }
    });
    
    const orderCount = filteredOrders.length;
    const avgTicket = orderCount > 0 ? (totalRevenue / orderCount) : 0;
    
    // Render summary metrics
    document.getElementById('reportRevenue').innerText = `R$ ${totalRevenue.toFixed(2).replace('.', ',')}`;
    document.getElementById('reportOrdersCount').innerText = orderCount;
    document.getElementById('reportTicketAverage').innerText = `R$ ${avgTicket.toFixed(2).replace('.', ',')}`;
    
    // Render payment distribution
    const totalPayments = (paymentsCount.pix + paymentsCount.card + paymentsCount.cash) || 1;
    const pixPct = (paymentsCount.pix / totalPayments) * 100;
    const cardPct = (paymentsCount.card / totalPayments) * 100;
    const cashPct = (paymentsCount.cash / totalPayments) * 100;
    
    const payContainer = document.getElementById('reportPaymentMethodsList');
    if (payContainer) {
        payContainer.innerHTML = `
            <div class="report-bar-row">
                <div class="report-bar-label">
                    <span>Pix (${paymentsCount.pix} ped.)</span>
                    <span class="value">R$ ${paymentsRevenue.pix.toFixed(2).replace('.', ',')} (${pixPct.toFixed(0)}%)</span>
                </div>
                <div class="report-bar-track">
                    <div class="report-bar-fill pix" style="width: ${pixPct}%"></div>
                </div>
            </div>
            <div class="report-bar-row">
                <div class="report-bar-label">
                    <span>Cartão (${paymentsCount.card} ped.)</span>
                    <span class="value">R$ ${paymentsRevenue.card.toFixed(2).replace('.', ',')} (${cardPct.toFixed(0)}%)</span>
                </div>
                <div class="report-bar-track">
                    <div class="report-bar-fill card" style="width: ${cardPct}%"></div>
                </div>
            </div>
            <div class="report-bar-row">
                <div class="report-bar-label">
                    <span>Dinheiro (${paymentsCount.cash} ped.)</span>
                    <span class="value">R$ ${paymentsRevenue.cash.toFixed(2).replace('.', ',')} (${cashPct.toFixed(0)}%)</span>
                </div>
                <div class="report-bar-track">
                    <div class="report-bar-fill cash" style="width: ${cashPct}%"></div>
                </div>
            </div>
        `;
    }
    
    // Render Top 5 Products
    const sortedProducts = Object.keys(productsCount).map(name => {
        return { name: name, count: productsCount[name] };
    }).sort((a, b) => b.count - a.count);
    
    const topContainer = document.getElementById('reportTopProductsList');
    if (topContainer) {
        if (sortedProducts.length === 0) {
            topContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 20px 0;">Nenhum produto vendido no período.</p>';
        } else {
            topContainer.innerHTML = '';
            const maxQty = sortedProducts[0].count || 1;
            sortedProducts.slice(0, 5).forEach(prod => {
                const pct = (prod.count / maxQty) * 100;
                const row = document.createElement('div');
                row.className = 'report-bar-row';
                row.innerHTML = `
                    <div class="report-bar-label">
                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 75%;">${prod.name}</span>
                        <span class="value">${prod.count} unid.</span>
                    </div>
                    <div class="report-bar-track">
                        <div class="report-bar-fill item" style="width: ${pct}%"></div>
                    </div>
                `;
                topContainer.appendChild(row);
            });
        }
    }
}

/* ==========================================================================
   Settings Panel Logic & Operations
   ========================================================================== */
function renderSettingsDashboard() {
    if (!menuData) return;
    
    if (!tempSettings) {
        tempSettings = menuData.settings ? JSON.parse(JSON.stringify(menuData.settings)) : {
            whatsapp: '5554996704189',
            whatsappFormatted: '(54) 99670-4189',
            deliveryFees: {}
        };
    }
    
    document.getElementById('settingsWhatsapp').value = tempSettings.whatsapp || '';
    document.getElementById('settingsWhatsappFormatted').value = tempSettings.whatsappFormatted || '';
    document.getElementById('settingsPromoActive').checked = tempSettings.promoActive || false;
    document.getElementById('settingsPromoPrice').value = tempSettings.promoPrice || 95.00;
    const selectedSizes = [];
    const promoSizeRaw = tempSettings.promoSize || 'G';
    if (Array.isArray(promoSizeRaw)) {
        selectedSizes.push(...promoSizeRaw);
    } else if (typeof promoSizeRaw === 'string') {
        selectedSizes.push(...promoSizeRaw.split(',').map(s => s.trim()));
    } else {
        selectedSizes.push(String(promoSizeRaw));
    }
    
    document.querySelectorAll('input[name="promoSizes"]').forEach(cb => {
        cb.checked = selectedSizes.includes(cb.value);
    });
    
    const promoDiscountActiveChg = document.getElementById('settingsPromoDiscountActive');
    if (promoDiscountActiveChg) promoDiscountActiveChg.checked = tempSettings.promoDiscountActive || false;
    const promoDiscountPercentInput = document.getElementById('settingsPromoDiscountPercent');
    if (promoDiscountPercentInput) promoDiscountPercentInput.value = tempSettings.promoDiscountPercent || 20;
    
    const promoLanchesPercent = document.getElementById('settingsPromoLanchesDiscountPercent');
    if (promoLanchesPercent) promoLanchesPercent.value = tempSettings.promoLanchesDiscountPercent || 20;
    
    const promoCalzonesPercent = document.getElementById('settingsPromoCalzonesDiscountPercent');
    if (promoCalzonesPercent) promoCalzonesPercent.value = tempSettings.promoCalzonesDiscountPercent || 20;
    
    const promoBebidasPercent = document.getElementById('settingsPromoBebidasDiscountPercent');
    if (promoBebidasPercent) promoBebidasPercent.value = tempSettings.promoBebidasDiscountPercent || 20;
    
    togglePromoDiscountGroup();
    
    renderSettingsFeesTable();
}

function renderSettingsFeesTable() {
    const tbody = document.getElementById('settingsFeesBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const fees = tempSettings.deliveryFees || {};
    const keys = Object.keys(fees);
    
    if (keys.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 15px 0;">Nenhuma taxa de entrega cadastrada.</td></tr>`;
        return;
    }
    
    keys.forEach(key => {
        const item = fees[key];
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border-color)';
        tr.innerHTML = `
            <td style="padding: 10px 5px; font-size: 13px; color: var(--text-muted); font-family: monospace;">${key}</td>
            <td style="padding: 10px 5px; font-size: 14px; color: var(--text-light);">${item.name}</td>
            <td style="padding: 10px 5px; font-size: 14px; font-weight: 500;">
                <input type="number" step="0.50" value="${item.fee.toFixed(2)}" onchange="updateBairroFee('${key}', this.value)" style="width: 80px; padding: 4px 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-main); font-size: 13px;">
            </td>
            <td style="padding: 10px 5px; text-align: center;">
                <button onclick="deleteBairroRow('${key}')" class="btn-action btn-delete-item" style="border: none; background: transparent; cursor: pointer; color: #ef5350;" title="Excluir bairro">
                    <span class="material-symbols-rounded" style="font-size: 18px;">delete</span>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updateBairroFee(key, value) {
    if (tempSettings && tempSettings.deliveryFees && tempSettings.deliveryFees[key]) {
        tempSettings.deliveryFees[key].fee = parseFloat(value) || 0;
    }
}

function deleteBairroRow(key) {
    if (tempSettings && tempSettings.deliveryFees) {
        delete tempSettings.deliveryFees[key];
        renderSettingsFeesTable();
    }
}

function addBairroRow() {
    const idInput = document.getElementById('newBairroId');
    const nameInput = document.getElementById('newBairroName');
    const feeInput = document.getElementById('newBairroFee');
    
    const id = idInput.value.trim().toLowerCase().replace(/\s+/g, '-').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const name = nameInput.value.trim();
    const fee = parseFloat(feeInput.value);
    
    if (!id || !name || isNaN(fee)) {
        alert("Preencha todos os campos corretamente para adicionar o bairro.");
        return;
    }
    
    if (!tempSettings.deliveryFees) tempSettings.deliveryFees = {};
    
    tempSettings.deliveryFees[id] = { name: name, fee: fee };
    
    idInput.value = '';
    nameInput.value = '';
    feeInput.value = '';
    
    renderSettingsFeesTable();
}

function saveSettings() {
    
    const whatsapp = document.getElementById('settingsWhatsapp').value.trim();
    const whatsappFormatted = document.getElementById('settingsWhatsappFormatted').value.trim();
    const promoActive = document.getElementById('settingsPromoActive')?.checked || false;
    const promoPrice = parseFloat(document.getElementById('settingsPromoPrice')?.value) || 0;
    const promoSize = Array.from(document.querySelectorAll('input[name="promoSizes"]:checked')).map(cb => cb.value).join(',');
    const promoDiscountActive = document.getElementById('settingsPromoDiscountActive')?.checked || false;
    const promoDiscountPercent = parseInt(document.getElementById('settingsPromoDiscountPercent')?.value) || 20;
    const promoLanchesDiscountPercent = parseInt(document.getElementById('settingsPromoLanchesDiscountPercent')?.value) || 20;
    const promoCalzonesDiscountPercent = parseInt(document.getElementById('settingsPromoCalzonesDiscountPercent')?.value) || 20;
    const promoBebidasDiscountPercent = parseInt(document.getElementById('settingsPromoBebidasDiscountPercent')?.value) || 20;
    
    if (!whatsapp) {
        alert("O número do WhatsApp é obrigatório.");
        return;
    }
    
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0 && db) {
        const settingsPromise = ConfigService.saveSettings({
            whatsapp: whatsapp,
            whatsappFormatted: whatsappFormatted,
            promoActive: promoActive,
            promoPrice: promoPrice,
            promoSize: promoSize,
            promoDiscountActive: promoDiscountActive,
            promoDiscountPercent: promoDiscountPercent,
            promoLanchesDiscountPercent: promoLanchesDiscountPercent,
            promoCalzonesDiscountPercent: promoCalzonesDiscountPercent,
            promoBebidasDiscountPercent: promoBebidasDiscountPercent
        });
        
        const feesPromise = ConfigService.saveDeliveryFees(tempSettings.deliveryFees || {});
        
        Promise.all([settingsPromise, feesPromise])
        .then(() => {
            alert("Configurações salvas no banco de dados com sucesso!");
        })
        .catch(err => {
            console.error("Erro ao salvar configurações no Firebase:", err);
            alert("Erro ao salvar configurações.");
        });
    } else {
        alert("Configurações salvas localmente com sucesso! (Firebase offline)");
    }
}

function populateImageSuggestions(type) {
    const suggestionsContainer = document.getElementById('imageSuggestions');
    if (!suggestionsContainer) return;
    
    suggestionsContainer.innerHTML = '';
    
    let suggestions = [];
    if (type === 'pizza') {
        suggestions = [
            { label: 'Calabresa', value: 'assets/pizza_calabresa.png' },
            { label: 'Marguerita', value: 'assets/pizza_margherita.png' },
            { label: '4 Queijos', value: 'assets/pizza_quatro_queijos.png' },
            { label: 'Chocolate', value: 'assets/pizza_chocolate.png' },
            { label: 'Padrão', value: 'assets/pizza_hero.png' }
        ];
    } else if (type === 'calzone') {
        suggestions = [
            { label: 'Salgado', value: 'assets/pizza_hero.png' },
            { label: 'Doce', value: 'assets/pizza_chocolate.png' }
        ];
    } else if (type === 'bebida') {
        suggestions = [
            { label: 'Coca Cola', value: 'assets/coca_cola.png' },
            { label: 'Guaraná', value: 'assets/guarana.png' },
            { label: 'Energético', value: 'assets/energetico.png' },
            { label: 'Água', value: 'assets/agua.png' },
            { label: 'Vinho', value: 'assets/vinho.png' },
            { label: 'Padrão', value: 'assets/pizza_hero.png' }
        ];
    } else if (type === 'lanche') {
        suggestions = [
            { label: 'Hambúrguer', value: 'assets/lanche_hamburguer.png' },
            { label: 'Xis', value: 'assets/lanche_xis.png' },
            { label: 'Barca', value: 'assets/lanche_barca.png' },
            { label: 'Fritas', value: 'assets/lanche_fritas.png' },
            { label: 'Açaí', value: 'assets/acai_hero.png' },
            { label: 'Padrão', value: 'assets/pizza_hero.png' }
        ];
    } else if (type === 'acai') {
        suggestions = [
            { label: 'Açaí', value: 'assets/acai_hero.png' }
        ];
    }
    
    if (suggestions.length === 0) return;

    const label = document.createElement('span');
    label.textContent = 'Sugestões rápidas: ';
    label.style.fontSize = '12px';
    label.style.color = 'var(--text-light)';
    label.style.marginRight = '4px';
    label.style.alignSelf = 'center';
    suggestionsContainer.appendChild(label);
    
    suggestions.forEach((sug) => {
        const link = document.createElement('a');
        link.href = '#';
        link.textContent = sug.label;
        link.style.fontSize = '11px';
        link.style.color = 'var(--primary)';
        link.style.textDecoration = 'none';
        link.style.cursor = 'pointer';
        link.style.background = 'rgba(230, 92, 0, 0.1)';
        link.style.padding = '3px 8px';
        link.style.borderRadius = '4px';
        link.style.border = '1px solid rgba(230, 92, 0, 0.2)';
        link.style.transition = 'all 0.2s ease';
        
        link.addEventListener('mouseenter', () => { 
            link.style.background = 'rgba(230, 92, 0, 0.2)'; 
            link.style.borderColor = 'rgba(230, 92, 0, 0.4)';
        });
        link.addEventListener('mouseleave', () => { 
            link.style.background = 'rgba(230, 92, 0, 0.1)'; 
            link.style.borderColor = 'rgba(230, 92, 0, 0.2)';
        });
        
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const input = document.getElementById('flavorImage');
            if (input) input.value = sug.value;
        });
        suggestionsContainer.appendChild(link);
    });
}

/* ==========================================================================
   Shop Status Management (Open/Closed Toggle)
   ========================================================================== */
function initShopStatus() {
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0 && db) {
        ConfigService.subscribeShopStatus((data) => {
            if (data) {
                const isOpen = data.isOpen !== undefined ? data.isOpen : (data.open !== undefined ? data.open : true);
                const toggle = document.getElementById('shopStatusToggle');
                const label = document.getElementById('shopStatusLabel');
                
                if (toggle) toggle.checked = isOpen;
                if (label) {
                    label.innerText = isOpen ? "Aberto" : "Fechado";
                    label.style.color = isOpen ? "#81c784" : "#ef5350";
                }
            }
        });
    } else {
        fetch('/api/status')
            .then(res => res.json())
            .then(data => {
                const toggle = document.getElementById('shopStatusToggle');
                const label = document.getElementById('shopStatusLabel');
                if (data && typeof data.isOpen === 'boolean') {
                    if (toggle) toggle.checked = data.isOpen;
                    if (label) {
                        label.innerText = data.isOpen ? "Aberto" : "Fechado";
                        label.style.color = data.isOpen ? "#81c784" : "#ef5350";
                    }
                }
            })
            .catch(err => console.error("Erro ao carregar status local:", err));
    }
}

function toggleShopStatus(isOpen) {
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0 && db) {
        ConfigService.saveShopStatus(isOpen)
        .then(() => {
            console.log(`Status de funcionamento da Pizzaria Drill alterado para: ${isOpen ? 'Aberto' : 'Fechado'}`);
        })
        .catch(err => console.error("Erro ao alterar status de funcionamento no Firebase:", err));
    } else {
        fetch('/api/status', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isOpen: isOpen })
        })
        .then(res => res.json())
        .then(data => {
            const label = document.getElementById('shopStatusLabel');
            if (label) {
                label.innerText = isOpen ? "Aberto" : "Fechado";
                label.style.color = isOpen ? "#81c784" : "#ef5350";
            }
        })
        .catch(err => console.error("Erro ao alterar status local:", err));
    }
}


/* ==========================================================================
   Modals Helpers (Restored & New)
   ========================================================================== */
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('display-none');
    setTimeout(() => {
        modal.style.opacity = '1';
        modal.style.pointerEvents = 'auto';
    }, 10);
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
    setTimeout(() => {
        modal.classList.add('display-none');
    }, 300);
}

function openCategoryModal(cat = null) {
    const modal = document.getElementById('categoryModal');
    if (!modal) return;
    
    if (cat) {
        document.getElementById('categoryModalTitle').innerText = 'Editar Categoria';
        document.getElementById('categoryEditId').value = cat.id;
        document.getElementById('categoryName').value = cat.name || '';
        document.getElementById('categoryIcon').value = cat.icon || '';
        document.getElementById('categoryOrder').value = cat.order || '';
    } else {
        document.getElementById('categoryModalTitle').innerText = 'Adicionar Nova Categoria';
        document.getElementById('categoryEditId').value = '';
        document.getElementById('categoryName').value = '';
        document.getElementById('categoryIcon').value = '';
        document.getElementById('categoryOrder').value = '';
    }
    
    openModal('categoryModal');
}

function closeCategoryModal() {
    closeModal('categoryModal');
}

function openBannerModal(banner = null) {
    const modal = document.getElementById('bannerModal');
    if (!modal) return;
    
    if (banner) {
        document.getElementById('bannerModalTitle').innerText = 'Editar Banner';
        document.getElementById('bannerEditId').value = banner.id;
        document.getElementById('bannerTag').value = banner.tag || '';
        document.getElementById('bannerTitleText').value = banner.title || '';
        document.getElementById('bannerSubtitle').value = banner.subtitle || '';
        document.getElementById('bannerGradient').value = banner.gradient || '';
        document.getElementById('bannerImage').value = banner.image || '';
    } else {
        document.getElementById('bannerModalTitle').innerText = 'Adicionar Novo Banner';
        document.getElementById('bannerEditId').value = '';
        document.getElementById('bannerTag').value = '';
        document.getElementById('bannerTitleText').value = '';
        document.getElementById('bannerSubtitle').value = '';
        document.getElementById('bannerGradient').value = 'linear-gradient(135deg, #b71c1c 0%, #1a0a0a 100%)';
        document.getElementById('bannerImage').value = '';
    }
    
    populateBannerImageSuggestions();
    openModal('bannerModal');
}

function closeBannerModal() {
    closeModal('bannerModal');
}

function openPromotionModal(promo = null) {
    // We open flavorModal (which is product modal) with isPromo forced to true,
    // because promo item is just a product in Firestore!
    if (promo) {
        openEditFlavorModal(promo.id);
    } else {
        // Clear flavorModal and preset type to pizza, but with isPromo checked
        openAddMenuProductModal('pizza');
        const isPromoChk = document.getElementById('flavorIsPromo');
        if (isPromoChk) isPromoChk.checked = true;
    }
}

function closePromotionModal() {
    closeModal('promotionModal');
}

/* ==========================================================================
   CRUD Handlers for Categories, Banners, Promotions
   ========================================================================== */
function saveCategoryItem(event) {
    event.preventDefault();
    const idField = document.getElementById('categoryEditId').value;
    const name = document.getElementById('categoryName').value.trim();
    const icon = document.getElementById('categoryIcon').value.trim();
    const order = parseInt(document.getElementById('categoryOrder').value) || 0;
    
    let id = idField;
    if (!idField) {
        id = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    }
    
    const categoryDoc = { id, name, icon, order };
    
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0 && db) {
        ProductsService.saveCategory(id, categoryDoc)
        .then(() => {
            closeCategoryModal();
            alert("Categoria salva com sucesso!");
        })
        .catch(err => {
            console.error(err);
            alert("Erro ao salvar categoria.");
        });
    }
}

function deleteCategory(id) {
    if (!confirm("Tem certeza que deseja excluir esta categoria permanentemente?")) return;
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0 && db) {
        ProductsService.deleteCategory(id)
        .then(() => {
            alert("Categoria excluída com sucesso!");
        })
        .catch(err => {
            console.error(err);
            alert("Erro ao excluir categoria.");
        });
    }
}

function saveBannerItem(event) {
    event.preventDefault();
    const idField = document.getElementById('bannerEditId').value;
    const tag = document.getElementById('bannerTag').value.trim();
    const title = document.getElementById('bannerTitleText').value.trim();
    const subtitle = document.getElementById('bannerSubtitle').value.trim();
    const gradient = document.getElementById('bannerGradient').value.trim();
    const image = document.getElementById('bannerImage').value.trim();
    
    let id = idField;
    if (!idField) {
        id = 'banner_' + Date.now();
    }
    
    const bannerDoc = { id, tag, title, subtitle, gradient, image };
    
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0 && db) {
        ProductsService.saveBanner(id, bannerDoc)
        .then(() => {
            closeBannerModal();
            alert("Banner salvo com sucesso!");
        })
        .catch(err => {
            console.error(err);
            alert("Erro ao salvar banner.");
        });
    }
}

function deleteBanner(id) {
    if (!confirm("Tem certeza que deseja excluir este banner?")) return;
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0 && db) {
        ProductsService.deleteBanner(id)
        .then(() => {
            alert("Banner excluído com sucesso!");
        })
        .catch(err => {
            console.error(err);
            alert("Erro ao excluir banner.");
        });
    }
}

/* ==========================================================================
   Dynamic Render Lists for Categories, Banners, Promotions
   ========================================================================== */
function renderCategoriasList() {
    const grid = document.getElementById('categoriasListGrid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const cats = menuData.categories || [];
    cats.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    cats.forEach(cat => {
        const card = document.createElement('div');
        card.className = 'flavor-card';
        
        card.innerHTML = `
            <div class="flavor-card-header">
                <div class="flavor-card-info">
                    <h4 style="margin: 0; color: var(--text-main); font-size: 15px;">${cat.icon || '🍽️'} ${cat.name}</h4>
                </div>
            </div>
            <p class="flavor-card-desc" style="margin: 0; flex: 1;">Ordem de exibição: <strong>#${cat.order || 0}</strong></p>
            <div class="flavor-card-actions" style="margin-top: 15px;">
                <button class="btn-icon-action" onclick="openEditCategory('${cat.id}')" title="Editar Categoria">
                    <span class="material-symbols-rounded" style="font-size: 18px;">edit</span>
                </button>
                <button class="btn-icon-action delete" onclick="deleteCategory('${cat.id}')" title="Excluir Categoria">
                    <span class="material-symbols-rounded" style="font-size: 18px;">delete</span>
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function openEditCategory(id) {
    const cats = menuData.categories || [];
    const cat = cats.find(c => c.id === id);
    if (cat) openCategoryModal(cat);
}

function renderBannersList() {
    const grid = document.getElementById('bannersListGrid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const banners = menuData.banners || [];
    
    banners.forEach(banner => {
        const card = document.createElement('div');
        card.className = 'flavor-card';
        card.style.background = banner.gradient || 'var(--bg-card)';
        card.style.position = 'relative';
        card.style.overflow = 'hidden';
        
        card.innerHTML = `
            <div class="flavor-card-header" style="position: relative; z-index: 2;">
                <div class="flavor-card-info">
                    <h4 style="margin: 0; color: #fff; font-size: 16px; font-family: var(--font-display);">${banner.title}</h4>
                    <span style="font-size: 11px; background: rgba(255,255,255,0.25); color: #fff; padding: 2px 6px; border-radius: 4px; margin-top: 4px; display: inline-block;">${banner.tag}</span>
                </div>
            </div>
            <p style="margin: 10px 0; color: rgba(255,255,255,0.9); font-size: 13px; flex: 1; position: relative; z-index: 2; max-width: 70%;">${banner.subtitle}</p>
            ${banner.image ? `<img src="${banner.image}" style="position: absolute; right: 10px; bottom: 10px; width: 60px; height: 60px; object-fit: contain; opacity: 0.8; z-index: 1;" />` : ''}
            <div class="flavor-card-actions" style="margin-top: 15px; position: relative; z-index: 2;">
                <button class="btn-icon-action" onclick="openEditBanner('${banner.id}')" title="Editar Banner" style="background: rgba(255,255,255,0.25); color: #fff;">
                    <span class="material-symbols-rounded" style="font-size: 18px;">edit</span>
                </button>
                <button class="btn-icon-action delete" onclick="deleteBanner('${banner.id}')" title="Excluir Banner" style="background: rgba(255,255,255,0.25); color: #fff;">
                    <span class="material-symbols-rounded" style="font-size: 18px;">delete</span>
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function openEditBanner(id) {
    const banners = menuData.banners || [];
    const banner = banners.find(b => b.id === id);
    if (banner) openBannerModal(banner);
}

function renderPromocoesList() {
    const grid = document.getElementById('promocoesListGrid');
    if (!grid) return;
    grid.innerHTML = '';
    
    // In our system, promotions are loaded from MENU_ITEMS where isPromo is true
    const promos = [];
    const dbTypes = ['pizzas', 'lanches', 'calzones', 'bebidas', 'acais'];
    dbTypes.forEach(type => {
        const list = menuData.menu_items?.[type] || [];
        list.forEach(item => {
            if (item.isPromo) {
                promos.push({ ...item, type });
            }
        });
    });
    
    promos.forEach(promo => {
        const card = document.createElement('div');
        card.className = 'flavor-card';
        if (promo.available === false) {
            card.style.opacity = '0.6';
        }
        
        const badgeHTML = promo.badge ? `<span class="flavor-badge-label" style="background: #b71c1c; color: #fff;">${promo.badge}</span>` : '';
        const isChecked = promo.available !== false ? 'checked' : '';
        
        let priceText = '';
        if (promo.type === 'pizza' || promo.type === 'pizzas') {
            priceText = `B: R$ ${promo.prices?.B || 0} / M: R$ ${promo.prices?.M || 0} / G: R$ ${promo.prices?.G || 0} / F: R$ ${promo.prices?.F || 0}`;
        } else {
            priceText = `R$ ${(promo.price || 0).toFixed(2).replace('.', ',')}`;
        }
        
        let daysText = 'Todos os dias';
        if (promo.promoDays && promo.promoDays.length > 0) {
            const mapDays = { segunda: 'Seg', terca: 'Ter', quarta: 'Qua', quinta: 'Qui', sexta: 'Sex', sabado: 'Sáb', domingo: 'Dom' };
            daysText = promo.promoDays.map(d => mapDays[d] || d).join(', ');
        }
        
        card.innerHTML = `
            <div class="flavor-card-header">
                <div class="flavor-card-info">
                    <h4 style="margin: 0; color: var(--text-main); font-size: 15px;">${promo.name}</h4>
                    <div style="margin-top: 4px; display: flex; flex-direction: column; gap: 4px;">
                        <div style="display: flex; gap: 4px;">
                            <span class="category-tag salgada" style="text-transform: uppercase;">${promo.type}</span>
                            ${badgeHTML}
                        </div>
                        <span style="font-size: 11px; color: var(--text-muted);">📅 ${daysText}</span>
                    </div>
                </div>
                <label class="switch" title="${promo.available !== false ? 'Disponível no Site' : 'Pausado/Indisponível'}">
                    <input type="checkbox" ${isChecked} onchange="toggleFlavorAvailability('${promo.id}', this.checked)">
                    <span class="slider"></span>
                </label>
            </div>
            <p class="flavor-card-desc" style="margin: 0; flex: 1;">${promo.description || ''}</p>
            <div style="font-size: 12px; font-weight: bold; color: var(--primary); margin: 8px 0;">
                ${priceText}
            </div>
            <div class="flavor-card-actions">
                <button class="btn-icon-action" onclick="openEditFlavorModal('${promo.id}')" title="Editar Promoção">
                    <span class="material-symbols-rounded" style="font-size: 18px;">edit</span>
                </button>
                <button class="btn-icon-action delete" onclick="deletePromotionFromList('${promo.id}', '${promo.type}')" title="Remover das Promoções">
                    <span class="material-symbols-rounded" style="font-size: 18px;">delete</span>
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function deletePromotionFromList(id, type) {
    if (!confirm("Tem certeza que deseja remover este item das promoções? (Ele continuará cadastrado no cardápio)")) return;
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0 && db) {
        ProductsService.updateProduct(id, { isPromo: false })
        .then(() => {
            alert("Item removido das promoções com sucesso!");
        })
        .catch(err => {
            console.error(err);
            alert("Erro ao remover promoção.");
        });
    }
}


/* ==========================================================================
   Product Modal Add/Edit/Adjust Functions (Restored)
   ========================================================================== */
function openAddMenuProductModal(type) {
    if (currentMenuTab === 'categorias') {
        openCategoryModal();
        return;
    }
    if (currentMenuTab === 'banners') {
        openBannerModal();
        return;
    }
    if (currentMenuTab === 'promocoes') {
        openPromotionModal();
        return;
    }
    let finalType = type || 'pizza';
    let preselectedCategory = '';
    if (!type) {
        if (currentMenuTab === 'flavors') {
            finalType = 'pizza';
            preselectedCategory = 'salgadas';
        }
        if (currentMenuTab === 'sweetpizzas') {
            finalType = 'pizza';
            preselectedCategory = 'doces';
        }
        if (currentMenuTab === 'calzones') finalType = 'calzone';
        if (currentMenuTab === 'bebidas') finalType = 'bebida';
        if (currentMenuTab === 'lanches') finalType = 'lanche';
        if (currentMenuTab === 'acais') finalType = 'acai';
    }
    openAddMenuItemModal(finalType, preselectedCategory);
}

function openAddMenuItemModal(type, preselectedCategory) {
    document.getElementById('menuItemType').value = type;
    document.getElementById('flavorEditId').value = '';
    document.getElementById('flavorForm').reset();
    
    // Reset checkbox promocional e dias
    const promoPriceField = document.getElementById('itemPromoPrice');
    if (promoPriceField) promoPriceField.value = '';
    
    const promoCheck = document.getElementById('flavorIsPromo');
    if (promoCheck) promoCheck.checked = false;
    document.querySelectorAll('input[name="promoDay"]').forEach(chk => {
        chk.checked = false;
    });
    togglePromoDaysGroup();
    
    adjustModalFields(type, false, preselectedCategory);
    
    const imgInput = document.getElementById('flavorImage');
    if (imgInput) {
        if (type === 'bebida') {
            imgInput.value = 'assets/agua.png';
        } else if (type === 'lanche') {
            imgInput.value = 'assets/lanche_hamburguer.png';
        } else if (type === 'acai') {
            imgInput.value = 'assets/acai_hero.png';
        } else {
            imgInput.value = 'assets/pizza_hero.png';
        }
    }
    
    openModal('flavorModal');
}

function openEditFlavorModal(id) {
    // Detect item type based on id and database type
    if (!menuData) return;
    let foundType = 'pizza';
    let item = null;
    
    const dbTypes = { pizzas: 'pizza', calzones: 'calzone', lanches: 'lanche', bebidas: 'bebida', acais: 'acai' };
    Object.keys(dbTypes).forEach(dbKey => {
        const list = menuData.menu_items?.[dbKey] || [];
        const found = list.find(i => i.id === id);
        if (found) {
            item = found;
            foundType = dbTypes[dbKey];
        }
    });
    
    if (item) {
        openEditMenuItemModal(foundType, id);
    }
}

function openEditMenuItemModal(type, id) {
    if (!menuData) return;
    
    document.getElementById('menuItemType').value = type;
    document.getElementById('flavorEditId').value = id;
    
    const dbType = type === 'pizza' ? 'pizzas' : (type === 'calzone' ? 'calzones' : (type === 'bebida' ? 'bebidas' : (type === 'acai' ? 'acais' : 'lanches')));
    const items = menuData.menu_items?.[dbType] || [];
    const item = items.find(i => i.id === id);
    if (!item) return;
    
    document.getElementById('flavorName').value = item.name;
    
    if (type === 'pizza') {
        document.getElementById('flavorDescription').value = item.description || '';
        document.getElementById('flavorCategory').value = item.category || 'salgadas';
        document.getElementById('flavorCategoryType').value = item.categoryType || 'tradicional';
        document.getElementById('flavorBadge').value = item.badge || '';
        document.getElementById('flavorImage').value = item.image || 'assets/pizza_hero.png';
        const promoCheck = document.getElementById('flavorIsPromo');
        if (promoCheck) promoCheck.checked = item.isPromo || false;
        document.getElementById('itemPrice').value = '';
        
        // Carrega os preços por tamanho
        document.getElementById('priceBrotinho').value = item.prices?.B || '';
        document.getElementById('priceMedia').value = item.prices?.M || '';
        document.getElementById('priceGrande').value = item.prices?.G || '';
        document.getElementById('priceFamilia').value = item.prices?.F || '';
    } else {
        document.getElementById('flavorDescription').value = item.description || '';
        document.getElementById('itemPrice').value = item.price || 0;
        document.getElementById('itemPromoPrice').value = item.promoPrice !== undefined ? item.promoPrice : '';
        document.getElementById('flavorImage').value = item.image || '';
        const promoCheck = document.getElementById('flavorIsPromo');
        if (promoCheck) promoCheck.checked = item.isPromo || false;
        
        // Wait briefly for categories dropdown to populate, then select current item category
        setTimeout(() => {
            const catSelect = document.getElementById('flavorCategory');
            if (catSelect) {
                catSelect.value = item.category || '';
            }
        }, 50);
    }
    
    const promoDays = item.promoDays || [];
    document.querySelectorAll('input[name="promoDay"]').forEach(chk => {
        chk.checked = promoDays.includes(chk.value);
    });
    togglePromoDaysGroup();
    
    adjustModalFields(type, true);
    openModal('flavorModal');
}

function adjustModalFields(type, isEdit, preselectedCategory) {
    const promoGroup = document.getElementById('flavorPromoGroup');
    if (promoGroup) {
        promoGroup.style.display = 'flex'; // ALWAYS show promo checkbox!
    }
    
    const itemPromoPriceGroup = document.getElementById('itemPromoPriceGroup');
    if (itemPromoPriceGroup) {
        itemPromoPriceGroup.style.display = (type === 'pizza') ? 'none' : 'flex';
    }
    
    const title = document.getElementById('flavorModalTitle');
    const nameLabel = document.getElementById('flavorNameLabel');
    const descGroup = document.getElementById('flavorDescriptionGroup');
    const priceGroup = document.getElementById('itemPriceGroup');
    const pizzaPricesGroup = document.getElementById('pizzaPricesGroup');
    const catsGroup = document.getElementById('flavorCategoriesGroup');
    const badgeGroup = document.getElementById('flavorBadgeGroup');
    const imgLabel = document.getElementById('flavorImageLabel');
    
    const descInput = document.getElementById('flavorDescription');
    const priceInput = document.getElementById('itemPrice');
    
    const priceB = document.getElementById('priceBrotinho');
    const priceM = document.getElementById('priceMedia');
    const priceG = document.getElementById('priceGrande');
    const priceF = document.getElementById('priceFamilia');
    
    if (type === 'pizza') {
        title.innerText = isEdit ? 'Editar Sabor de Pizza' : 'Adicionar Novo Sabor de Pizza';
        nameLabel.innerText = 'Nome do Sabor';
        descGroup.style.display = 'flex';
        descInput.required = true;
        
        priceGroup.style.display = 'none';
        priceInput.required = false;
        
        pizzaPricesGroup.style.display = 'flex';
        priceB.required = true;
        priceM.required = true;
        priceG.required = true;
        priceF.required = true;
        
        catsGroup.style.display = 'flex';
        const catSelect = document.getElementById('flavorCategory');
        if (catSelect) {
            catSelect.innerHTML = `
                <option value="salgadas">Salgadas</option>
                <option value="doces">Doces</option>
            `;
            if (preselectedCategory) {
                catSelect.value = preselectedCategory;
            }
        }
        badgeGroup.style.display = 'flex';
        imgLabel.innerText = 'Ilustração da Pizza';
    } else {
        // Calzone, lanche, bebida, etc.
        title.innerText = isEdit ? `Editar ${type.toUpperCase()}` : `Adicionar Novo ${type.toUpperCase()}`;
        nameLabel.innerText = `Nome do Item`;
        descGroup.style.display = (type === 'bebida') ? 'none' : 'flex';
        descInput.required = (type !== 'bebida');
        
        priceGroup.style.display = 'flex';
        priceInput.required = true;
        
        pizzaPricesGroup.style.display = 'none';
        priceB.required = false;
        priceM.required = false;
        priceG.required = false;
        priceF.required = false;
        
        catsGroup.style.display = 'flex';
        const catSelect = document.getElementById('flavorCategory');
        if (catSelect) {
            const categories = menuData.categories || [];
            // Load all categories except pizzas and bordas
            const filtered = categories.filter(c => c.id !== 'pizzas' && c.id !== 'bordas');
            catSelect.innerHTML = filtered.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            
            if (!isEdit) {
                // Set default matching category value
                if (type === 'calzone' && filtered.some(c => c.id === 'calzones')) {
                    catSelect.value = 'calzones';
                } else if (type === 'bebida' && filtered.some(c => c.id === 'bebidas')) {
                    catSelect.value = 'bebidas';
                } else if (type === 'lanche' && filtered.some(c => c.id === 'lanches')) {
                    catSelect.value = 'lanches';
                } else if (type === 'acai' && (filtered.some(c => c.id === 'acais') || filtered.some(c => c.id === 'acai'))) {
                    catSelect.value = filtered.find(c => c.id === 'acais' || c.id === 'acai').id;
                }
            }
        }
        badgeGroup.style.display = 'none';
        imgLabel.innerText = 'Ilustração';
    }
    
    // Popular sugestões rápidas de imagens baseadas no tipo de item
    populateImageSuggestions(type);
}

function deleteFlavor(id) {
    // Map flavor id to its type
    if (!menuData) return;
    let foundType = 'pizza';
    const dbTypes = ['pizzas', 'calzones', 'lanches', 'bebidas', 'acais'];
    dbTypes.forEach(dbKey => {
        const list = menuData.menu_items?.[dbKey] || [];
        if (list.some(i => i.id === id)) {
            foundType = dbKey;
        }
    });
    deleteMenuItem(foundType, id);
}

function closeFlavorModal() {
    closeModal('flavorModal');
}

function populateBannerImageSuggestions() {
    const container = document.getElementById('bannerImageSuggestions');
    if (!container) return;
    container.innerHTML = '';
    
    const suggestions = [
        { label: 'Pizza Destaque', value: 'assets/pizza_hero.png' },
        { label: 'Açaí Destaque', value: 'assets/acai_hero.png' },
        { label: 'Lanches Destaque', value: 'assets/lanche_hamburguer.png' },
        { label: 'Bebidas Destaque', value: 'assets/coca_cola.png' },
        { label: 'Calabresa', value: 'assets/pizza_calabresa.png' },
        { label: 'Chocolate Doce', value: 'assets/pizza_chocolate.png' }
    ];
    
    const label = document.createElement('span');
    label.textContent = 'Sugestões rápidas: ';
    label.style.fontSize = '12px';
    label.style.color = 'var(--text-muted)';
    label.style.marginRight = '4px';
    container.appendChild(label);
    
    suggestions.forEach(sug => {
        const link = document.createElement('a');
        link.href = '#';
        link.textContent = sug.label;
        link.style.fontSize = '12px';
        link.style.color = '#ffc107';
        link.style.textDecoration = 'none';
        link.style.marginRight = '8px';
        link.style.cursor = 'pointer';
        link.style.background = 'rgba(255, 193, 7, 0.1)';
        link.style.padding = '2px 6px';
        link.style.borderRadius = '4px';
        link.style.border = '1px solid rgba(255, 193, 7, 0.2)';
        link.style.transition = 'all var(--transition)';
        
        link.addEventListener('mouseenter', () => { link.style.background = 'rgba(255, 193, 7, 0.2)'; });
        link.addEventListener('mouseleave', () => { link.style.background = 'rgba(255, 193, 7, 0.1)'; });
        
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const input = document.getElementById('bannerImage');
            if (input) input.value = sug.value;
        });
        container.appendChild(link);
    });
}

function togglePromoDaysGroup() {
    const isPromo = document.getElementById('flavorIsPromo')?.checked;
    const daysGroup = document.getElementById('flavorPromoDaysGroup');
    if (daysGroup) {
        daysGroup.style.display = isPromo ? 'flex' : 'none';
    }
}

function togglePromoDiscountGroup() {
    const isDiscountActive = document.getElementById('settingsPromoDiscountActive')?.checked;
    const group = document.getElementById('promoDiscountGroup');
    if (group) {
        group.style.display = isDiscountActive ? 'flex' : 'none';
    }
}
