/* ==========================================================================
   Firebase Initialization
   ========================================================================== */
if (typeof firebase !== 'undefined' && typeof firebaseConfig !== 'undefined' && firebaseConfig.apiKey !== 'SUA_API_KEY' && firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
}

/* ==========================================================================
   State Variables
   ========================================================================== */
let orders = [];
let filterStatus = 'Todos';
let soundEnabled = true;
let lastOrdersCount = 0;
let knownOrderIds = new Set();

/* ==========================================================================
   Initialization & Authentication
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    checkAuthentication();
});

function checkAuthentication() {
    const loginOverlay = document.getElementById('loginOverlay');
    const dashboardWrapper = document.querySelector('.dashboard-wrapper');
    
    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                console.log("✅ Firebase Auth verificado com sucesso!");
                console.log("• User UID:", user.uid);
                console.log("• User Email:", user.email);
                console.log("• Database URL:", firebase.app().options?.databaseURL);
                
                const AUTHORIZED_UIDS = ['Vp5EtNWyHRdu9SD8iLM86yuipvb2'];
                if (AUTHORIZED_UIDS.includes(user.uid)) {
                    console.log("🔑 Usuário Administrador Autorizado (UID):", user.uid);
                }
                
                sessionStorage.setItem('painel_authenticated', 'true');
                if (loginOverlay) loginOverlay.style.display = 'none';
                if (dashboardWrapper) dashboardWrapper.style.display = 'grid';
                
                if (!appStarted) {
                    startApp();
                } else {
                    // Re-attach realtime listeners with authenticated auth socket
                    setupFirebaseRealtime();
                }
            } else {
                console.log("🔒 Nenhum usuário autenticado no Firebase Auth. Aguardando login...");
                sessionStorage.removeItem('painel_authenticated');
                if (loginOverlay) loginOverlay.style.display = 'flex';
                if (dashboardWrapper) dashboardWrapper.style.display = 'none';
            }
        });
    } else {
        const isAuthenticated = sessionStorage.getItem('painel_authenticated') === 'true';
        if (isAuthenticated) {
            if (loginOverlay) loginOverlay.style.display = 'none';
            if (dashboardWrapper) dashboardWrapper.style.display = 'grid';
            startApp();
        } else {
            if (loginOverlay) loginOverlay.style.display = 'flex';
            if (dashboardWrapper) dashboardWrapper.style.display = 'none';
        }
    }
}

let appStarted = false;
function startApp() {
    if (appStarted) return;
    appStarted = true;
    
    initPWA();
    initMenuSync(); // Synchronize menu items and prices
    initShopStatus(); // Synchronize shop status (open/closed)
    
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

function handleLoginSubmit(event) {
    event.preventDefault();
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const errorDiv = document.getElementById('loginError');
    
    const email = emailInput ? emailInput.value.trim() : 'admin@mundodapizza.com';
    const inputPass = passwordInput ? passwordInput.value.trim() : '';
    
    if (!email || !inputPass) return;
    
    showLoading('Verificando acesso no Firebase Auth...');
    
    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().signInWithEmailAndPassword(email, inputPass)
        .then((userCredential) => {
            hideLoading();
            const user = userCredential.user;
            console.log("✅ Firebase Auth: Login efetuado com sucesso!");
            console.log("• currentUser.uid:", user ? user.uid : 'N/A');
            console.log("• currentUser.email:", user ? user.email : 'N/A');
            
            sessionStorage.setItem('painel_authenticated', 'true');
            if (errorDiv) errorDiv.classList.add('display-none');
            showToast('Acesso autorizado ao painel!', 'success');
        })
        .catch((err) => {
            hideLoading();
            console.error("Erro na autenticação Firebase Auth:", err);
            if (errorDiv) errorDiv.classList.remove('display-none');
            passwordInput.value = '';
            passwordInput.focus();
            showToast('E-mail ou senha incorretos!', 'error');
        });
    } else {
        hideLoading();
        if (errorDiv) errorDiv.classList.remove('display-none');
        passwordInput.value = '';
        passwordInput.focus();
        showToast('Serviço de autenticação indisponível. Tente novamente.', 'error', 5000);
    }
}

function handleLogout(event) {
    if (event) event.preventDefault();
    if (confirm("Deseja realmente sair do painel do Mundo da Pizza?")) {
        showLoading('Encerrando sessão...');
        sessionStorage.removeItem('painel_authenticated');
        if (typeof firebase !== 'undefined' && firebase.auth) {
            firebase.auth().signOut()
            .then(() => {
                hideLoading();
                window.location.reload();
            })
            .catch(err => {
                hideLoading();
                console.error("Erro ao fazer logout:", err);
                window.location.reload();
            });
        } else {
            hideLoading();
            window.location.reload();
        }
    }
}

function setupFirebaseRealtime() {
    if (typeof firebase === 'undefined' || firebase.apps.length === 0) return;
    
    const ordersRef = firebase.database().ref('orders');
    
    // Detach previous listeners to prevent duplicate triggers
    ordersRef.off();
    
    ordersRef.on('value', (snapshot) => {
        const data = snapshot.val();
        let ordersArray = [];
        
        if (data) {
            ordersArray = Object.keys(data).map(key => {
                return {
                    ...data[key],
                    firebaseKey: key
                };
            });
        }
        
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
        
        // Trigger background debounced auto-backup of order snapshot safely
        triggerCentralAutoBackup();
        
        // Update server status text to Cloud
        const serverStatus = document.querySelector('.server-status');
        if (serverStatus) {
            serverStatus.className = 'server-status active';
            serverStatus.innerHTML = '<span class="dot" style="background-color: #81c784;"></span> Firebase Cloud';
        }
    }, (error) => {
        console.error("Erro na escuta dos pedidos no Realtime Database (/orders):", error);
        if (error.code === 'PERMISSION_DENIED') {
            console.warn("Aviso: Conexão temporária negada. O listener será re-anexado após validação de auth.");
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
                    <div style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1;">
                        <span class="value" style="font-size: 13px;">${addressHTML}</span>
                        ${order.checkoutType === 'delivery' && order.address ? `
                            <div class="motoboy-quick-actions">
                                <button type="button" class="btn-motoboy-link" onclick="sendToMotoboy('${order.id}')" title="Abrir localização no Google Maps">
                                    <span class="material-symbols-rounded" style="font-size: 16px;">two_wheeler</span>
                                    <span>Enviar p/ Motoboy</span>
                                </button>
                                <button type="button" class="btn-motoboy-link-share" onclick="shareAddressToMotoboy('${order.id}')" title="Compartilhar Endereço">
                                    <span class="material-symbols-rounded" style="font-size: 16px;">share</span>
                                </button>
                            </div>
                        ` : ''}
                    </div>
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
                    ${order.checkoutType === 'delivery' && order.address ? `
                        <button class="btn-motoboy" onclick="sendToMotoboy('${order.id}')" title="Enviar para Motoboy (Google Maps)">
                            <span class="material-symbols-rounded">two_wheeler</span>
                            <span>Motoboy</span>
                        </button>
                    ` : ''}
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
    
    // Update reports in real-time when orders list is updated
    if (typeof renderReportsDashboard === 'function') {
        renderReportsDashboard();
    }
}

/* ==========================================================================
   Motoboy Navigation & Location Helper Functions
   ========================================================================== */
function buildMotoboyAddressQuery(order) {
    if (!order || order.checkoutType !== 'delivery' || !order.address) return '';
    const addr = order.address;
    
    const parts = [];
    if (addr.street) parts.push(addr.street);
    if (addr.number) parts.push(`nº ${addr.number}`);
    if (addr.neighborhood) parts.push(`Bairro ${addr.neighborhood}`);
    
    const city = addr.city || 'Nova Petrópolis';
    const state = addr.state || 'RS';
    parts.push(`${city}, ${state}`);
    
    return parts.join(', ');
}

function buildGoogleMapsUrl(order) {
    const addressStr = buildMotoboyAddressQuery(order);
    if (!addressStr) return '';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressStr)}`;
}

function sendToMotoboy(orderId) {
    const order = orders.find(o => String(o.id) === String(orderId));
    if (!order || order.checkoutType !== 'delivery' || !order.address) {
        alert('Este pedido não possui endereço de entrega.');
        return;
    }
    
    const mapsUrl = buildGoogleMapsUrl(order);
    if (!mapsUrl) {
        alert('Não foi possível gerar a localização para este endereço.');
        return;
    }
    
    window.open(mapsUrl, '_blank');
}

function shareAddressToMotoboy(orderId) {
    const order = orders.find(o => String(o.id) === String(orderId));
    if (!order || order.checkoutType !== 'delivery' || !order.address) {
        alert('Este pedido não possui endereço de entrega.');
        return;
    }
    
    const addressStr = buildMotoboyAddressQuery(order);
    const mapsUrl = buildGoogleMapsUrl(order);
    const shareText = `🚴 *Entrega Mundo da Pizza*\n📍 *DESTINO:* ${addressStr}\n\n🗺️ *Abrir no Google Maps:*\n${mapsUrl}`;
    
    if (navigator.share) {
        navigator.share({
            title: 'Entrega Mundo da Pizza',
            text: shareText
        }).catch(() => {});
    } else {
        const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
        window.open(whatsappShareUrl, '_blank');
    }
}

/* ==========================================================================
   Order State Updates
   ========================================================================== */
function updateOrderStatus(id, newStatus) {
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        const order = orders.find(o => o.id === id);
        const refKey = (order && order.firebaseKey) ? order.firebaseKey : id;
        
        firebase.database().ref(`orders/${refKey}`).update({ status: newStatus })
        .then(() => {
            triggerCentralAutoBackup();
        })
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
            triggerCentralAutoBackup();
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
        text = `Olá, *${order.clientName}*! Seu pedido *#${order.id}* do Mundo da Pizza está pronto e saindo para entrega! 🛵💨`;
    } else {
        text = `Olá, *${order.clientName}*! Seu pedido *#${order.id}* do Mundo da Pizza está pronto e você já pode vir retirar! 🏪🍕`;
    }
    
    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

/* ==========================================================================
   Clear/Reset All Orders Functionality
   ========================================================================== */
function confirmClearAllOrders() {
    const confirmation = confirm("⚠️ ATENÇÃO: Tem certeza absoluta de que deseja ZERAR todos os pedidos do painel? \n\nEsta ação apagará permanentemente todos os registros de pedidos e é irreversível!");
    
    if (confirmation) {
        const doubleConfirmation = confirm("Confirme novamente: Deseja REALMENTE excluir todos os pedidos de forma permanente?");
        if (doubleConfirmation) {
            clearAllOrders();
        }
    }
}

function clearAllOrders() {
    showLoading('Zerando pedidos no servidor...');
    
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        // Clear from Firebase Realtime Database
        firebase.database().ref('orders').remove()
        .then(() => {
            hideLoading();
            alert("Sucesso: Todos os pedidos foram apagados no Firebase!");
            orders = [];
            knownOrderIds.clear();
            updateIndicators();
            renderOrdersList();
            triggerCentralAutoBackup();
        })
        .catch(err => {
            console.warn("Remoção direta ref('orders') falhou, tentando exclusão por nós individuais...", err);
            
            // Fallback: Delete each order node individually if root delete was restricted
            if (orders.length === 0) {
                hideLoading();
                alert("Nenhum pedido para apagar.");
                return;
            }
            
            const promises = orders.map(o => {
                const key = o.firebaseKey || o.id;
                return firebase.database().ref(`orders/${key}`).remove();
            });
            
            Promise.all(promises)
            .then(() => {
                hideLoading();
                alert("Sucesso: Todos os pedidos foram apagados!");
                orders = [];
                knownOrderIds.clear();
                updateIndicators();
                renderOrdersList();
                triggerCentralAutoBackup();
            })
            .catch(fallbackErr => {
                hideLoading();
                alert("Erro ao zerar pedidos no Firebase. Verifique suas permissões.");
                console.error("Erro no fallback de exclusão de pedidos:", fallbackErr);
            });
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
            hideLoading();
            alert("Sucesso: Todos os pedidos locais foram apagados!");
            orders = [];
            knownOrderIds.clear();
            updateIndicators();
            renderOrdersList();
            triggerCentralAutoBackup();
        })
        .catch(err => {
            hideLoading();
            alert("Erro ao zerar pedidos locais.");
            console.error(err);
        });
    }
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
            <div class="ticket-title">MUNDO DA PIZZA</div>
            <div style="font-size: 11px;">R. Cel. Alfredo Steglich, 28 - sala 4 - Centro</div>
            <div style="font-size: 11px;">Nova Petrópolis - RS | Tel: ${menuData?.settings?.whatsappFormatted || '(54) 99698-5724'}</div>
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
            <span>MUNDO DA PIZZA V</span>
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
                        ${item.notes ? `<br>• OBS: <span style="border: 1px solid #000; padding: 1px 4px; font-weight: bold; border-radius: 2px;">"${item.notes.toUpperCase()}"</span>` : ''}
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
            <div class="ticket-title" style="font-size: 18px; font-weight: bold; letter-spacing: 1px;">COZINHA - MUNDO DA PIZZA</div>
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
let currentSection = 'orders'; // 'orders' or 'menu'
let currentMenuTab = 'flavors'; // 'flavors' or 'prices'

const DEFAULT_MENU_DATA = {
  "menu_items": {
    "pizzas": [
      {
        "id": "calabresa",
        "name": "Calabresa",
        "description": "Molho, mussarela, calabresa e orégano.",
        "image": "assets/gourmet_calabresa.png",
        "category": "salgadas",
        "categoryType": "promocional",
        "badge": "Mais Pedida",
        "available": true
      },
      {
        "id": "marguerita",
        "name": "Marguerita",
        "description": "Molho, mussarela, tomate em rodelas, manjericão, azeitona e orégano.",
        "image": "assets/gourmet_margherita.png",
        "category": "salgadas",
        "categoryType": "promocional",
        "badge": "Vegetariana",
        "available": true
      },
      {
        "id": "napolitana",
        "name": "Napolitana",
        "description": "Molho, mussarela, tomate, azeitona e orégano.",
        "image": "assets/pizza_hero.png",
        "category": "salgadas",
        "categoryType": "promocional",
        "badge": "",
        "available": true
      },
      {
        "id": "portuguesa",
        "name": "Portuguesa",
        "description": "Molho, mussarela, presunto, ovo, cebola, pimentão, azeitona e orégano.",
        "image": "assets/pizza_hero.png",
        "category": "salgadas",
        "categoryType": "promocional",
        "badge": "Clássica",
        "available": true
      },
      {
        "id": "americana",
        "name": "Americana",
        "description": "Molho, mussarela, frango desfiado, champignon, azeitona e orégano.",
        "image": "assets/pizza_hero.png",
        "category": "salgadas",
        "categoryType": "promocional",
        "badge": "",
        "available": true
      },
      {
        "id": "frango_catupiry",
        "name": "Frango com Catupiry",
        "description": "Molho, mussarela, frango catupiry xadrez e orégano.",
        "image": "assets/pizza_hero.png",
        "category": "salgadas",
        "categoryType": "promocional",
        "badge": "",
        "available": true
      },
      {
        "id": "alho_oleo",
        "name": "Alho e Óleo",
        "description": "Molho, mussarela, alho e óleo ao molho 4 queijos e orégano.",
        "image": "assets/pizza_hero.png",
        "category": "salgadas",
        "categoryType": "promocional",
        "badge": "",
        "available": true
      },
      {
        "id": "atum",
        "name": "Atum",
        "description": "Molho, mussarela, atum e orégano.",
        "image": "assets/pizza_hero.png",
        "category": "salgadas",
        "categoryType": "promocional",
        "badge": "",
        "available": true
      },
      {
        "id": "vegetariana",
        "name": "Vegetariana",
        "description": "Molho, mussarela, palmito, champignon, brócolis, milho, azeitona e orégano.",
        "image": "assets/pizza_hero.png",
        "category": "salgadas",
        "categoryType": "promocional",
        "badge": "Vegetariana",
        "available": true
      },
      {
        "id": "brocolis",
        "name": "Brócolis",
        "description": "Molho, mussarela, brócolis ao molho branco, catupiry e orégano.",
        "image": "assets/pizza_hero.png",
        "category": "salgadas",
        "categoryType": "promocional",
        "badge": "",
        "available": true
      },
      {
        "id": "carijo",
        "name": "Carijó (Fricassê)",
        "description": "Molho, mussarela, frango ao molho, milho, ervilha, catupiry e batata palha.",
        "image": "assets/pizza_hero.png",
        "category": "salgadas",
        "categoryType": "tradicional",
        "badge": "",
        "available": true
      },
      {
        "id": "alcapone",
        "name": "Alcapone",
        "description": "Molho, mussarela, provolone, bacon, milho e orégano.",
        "image": "assets/pizza_hero.png",
        "category": "salgadas",
        "categoryType": "tradicional",
        "badge": "",
        "available": true
      },
      {
        "id": "italiana",
        "name": "Italiana",
        "description": "Molho, mussarela, milho, ervilha, salame italiano, catupiry, azeitona e orégano.",
        "image": "assets/pizza_hero.png",
        "category": "salgadas",
        "categoryType": "tradicional",
        "badge": "",
        "available": true
      },
      {
        "id": "strogonoff_frango",
        "name": "Strogonoff de Frango",
        "description": "Molho, mussarela, strogonoff de frango, orégano e batata palha.",
        "image": "assets/pizza_hero.png",
        "category": "salgadas",
        "categoryType": "tradicional",
        "badge": "",
        "available": true
      },
      {
        "id": "cinco_queijos",
        "name": "5 Queijos",
        "description": "Molho, mussarela, parmesão, provolone, catupiry, cheddar, azeitona e orégano.",
        "image": "assets/gourmet_quatro_queijos.png",
        "category": "salgadas",
        "categoryType": "tradicional",
        "badge": "Mais Pedida",
        "available": true
      },
      {
        "id": "alho_poro",
        "name": "Alho Poró",
        "description": "Molho, mussarela, alho poró ao molho e orégano.",
        "image": "assets/pizza_hero.png",
        "category": "salgadas",
        "categoryType": "tradicional",
        "badge": "",
        "available": true
      },
      {
        "id": "tomate_seco_rucula",
        "name": "Tomate Seco com Rúcula",
        "description": "Molho, mussarela, tomate seco, parmesão e rúcula.",
        "image": "assets/gourmet_margherita.png",
        "category": "salgadas",
        "categoryType": "tradicional",
        "badge": "Vegetariana",
        "available": true
      },
      {
        "id": "bacon_quatro_queijos",
        "name": "Bacon com 4 Queijos",
        "description": "Molho, mussarela, bacon, molho 4 queijos e orégano.",
        "image": "assets/gourmet_quatro_queijos.png",
        "category": "salgadas",
        "categoryType": "tradicional",
        "badge": "",
        "available": true
      },
      {
        "id": "calabresa_cebola_caramelizada",
        "name": "Calabresa com Cebola Caramelizada",
        "description": "Molho, mussarela, provolone, calabresa defumada, cebola caramelizada e orégano.",
        "image": "assets/gourmet_calabresa.png",
        "category": "salgadas",
        "categoryType": "tradicional",
        "badge": "Premium",
        "available": true
      },
      {
        "id": "frango_barbecue",
        "name": "Frango com Barbecue",
        "description": "Molho, mussarela, frango em cubos, molho barbecue e orégano.",
        "image": "assets/pizza_hero.png",
        "category": "salgadas",
        "categoryType": "tradicional",
        "badge": "",
        "available": true
      },
      {
        "id": "bah_tche",
        "name": "Bah Tchê",
        "description": "Molho, mussarela, frango, bacon, pimentões, milho, cebola, catupiry e orégano.",
        "image": "assets/pizza_hero.png",
        "category": "salgadas",
        "categoryType": "tradicional",
        "badge": "",
        "available": true
      },
      {
        "id": "canadense",
        "name": "Canadense",
        "description": "Molho, mussarela, lombo, champignon, bacon crocante, cebola e orégano.",
        "image": "assets/pizza_hero.png",
        "category": "salgadas",
        "categoryType": "especial",
        "badge": "",
        "available": true
      },
      {
        "id": "mexicana",
        "name": "Mexicana",
        "description": "Molho, mussarela, bacon, calabresa, pimentão, doritos e orégano.",
        "image": "assets/pizza_hero.png",
        "category": "salgadas",
        "categoryType": "especial",
        "badge": "",
        "available": true
      },
      {
        "id": "coracao",
        "name": "Coração",
        "description": "Molho, mussarela, coração ao molho e orégano.",
        "image": "assets/pizza_hero.png",
        "category": "salgadas",
        "categoryType": "especial",
        "badge": "Favorito",
        "available": true
      },
      {
        "id": "file",
        "name": "Filé",
        "description": "Molho, mussarela, filé ao molho e orégano.",
        "image": "assets/pizza_hero.png",
        "category": "salgadas",
        "categoryType": "especial",
        "badge": "",
        "available": true
      },
      {
        "id": "file_mostarda",
        "name": "Filé com Mostarda",
        "description": "Molho, mussarela, iscas de carne com molho mostarda.",
        "image": "assets/pizza_hero.png",
        "category": "salgadas",
        "categoryType": "especial",
        "badge": "",
        "available": true
      },
      {
        "id": "strogonoff_carne",
        "name": "Strogonoff de Carne",
        "description": "Molho, mussarela, strogonoff de carne, orégano e batata palha.",
        "image": "assets/pizza_hero.png",
        "category": "salgadas",
        "categoryType": "especial",
        "badge": "",
        "available": true
      },
      {
        "id": "pepperoni",
        "name": "Pepperoni",
        "description": "Molho, mussarela, pepperoni, azeitona e orégano.",
        "image": "assets/pizza_hero.png",
        "category": "salgadas",
        "categoryType": "especial",
        "badge": "Mais Pedida",
        "available": true
      },
      {
        "id": "alemanha",
        "name": "Alemanha",
        "description": "Molho, mussarela, calabresa, abacaxi, manjericão e orégano.",
        "image": "assets/pizza_hero.png",
        "category": "salgadas",
        "categoryType": "especial",
        "badge": "",
        "available": true
      },
      {
        "id": "imperio",
        "name": "Império",
        "description": "Molho, mussarela, calabresa, filé, bacon, tomate, catupiry, azeitona e orégano.",
        "image": "assets/pizza_hero.png",
        "category": "salgadas",
        "categoryType": "especial",
        "badge": "Super Premium",
        "available": true
      },
      {
        "id": "file_barbecue",
        "name": "Filé com Barbecue",
        "description": "Molho, mussarela, iscas de carne, barbecue e orégano.",
        "image": "assets/pizza_hero.png",
        "category": "salgadas",
        "categoryType": "especial",
        "badge": "",
        "available": true
      },
      {
        "id": "costela_uruguaia",
        "name": "Costela Uruguaia",
        "description": "Molho de cerveja preta, mussarela, costela desfiada e orégano.",
        "image": "assets/pizza_hero.png",
        "category": "salgadas",
        "categoryType": "especial",
        "badge": "Destaque",
        "available": true
      },
      {
        "id": "lombo_abacaxi",
        "name": "Lombo com Abacaxi",
        "description": "Molho, mussarela, lombo, abacaxi, catupiry e orégano.",
        "image": "assets/pizza_hero.png",
        "category": "salgadas",
        "categoryType": "especial",
        "badge": "",
        "available": true
      },
      {
        "id": "camarao",
        "name": "Camarão",
        "description": "Molho, mussarela, camarão ao alho e óleo e orégano.",
        "image": "assets/pizza_hero.png",
        "category": "salgadas",
        "categoryType": "camarao",
        "badge": "Premium",
        "available": true
      },
      {
        "id": "camarao_rose",
        "name": "Camarão ao Molho Rosé",
        "description": "Molho, mussarela, camarão ao molho rose e orégano.",
        "image": "assets/pizza_hero.png",
        "category": "salgadas",
        "categoryType": "camarao",
        "badge": "Premium",
        "available": true
      },
      {
        "id": "mms",
        "name": "M&Ms",
        "description": "Chocolate ao leite e M&Ms coloridos.",
        "image": "assets/pizza_chocolate.png",
        "category": "doces",
        "categoryType": "promocional",
        "badge": "Kids",
        "available": true
      },
      {
        "id": "banana_nevada",
        "name": "Banana Nevada",
        "description": "Banana em rodelas, canela, açúcar e chocolate branco.",
        "image": "assets/pizza_chocolate.png",
        "category": "doces",
        "categoryType": "promocional",
        "badge": "",
        "available": true
      },
      {
        "id": "banana_chocolate",
        "name": "Banana com Chocolate",
        "description": "Doce de leite, banana e chocolate ao leite.",
        "image": "assets/pizza_chocolate.png",
        "category": "doces",
        "categoryType": "promocional",
        "badge": "",
        "available": true
      },
      {
        "id": "pacoquinha",
        "name": "Paçoquinha",
        "description": "Chocolate ao leite e paçoquinha.",
        "image": "assets/pizza_chocolate.png",
        "category": "doces",
        "categoryType": "promocional",
        "badge": "",
        "available": true
      },
      {
        "id": "chocolate_morango",
        "name": "Chocolate com Morango",
        "description": "Chocolate ao leite, leite condensado e morangos frescos.",
        "image": "assets/gourmet_doce_morango.png",
        "category": "doces",
        "categoryType": "tradicional",
        "badge": "Mais Pedida",
        "available": true
      },
      {
        "id": "charge",
        "name": "Charge",
        "description": "Chocolate ao leite, doce de leite e amendoim.",
        "image": "assets/pizza_chocolate.png",
        "category": "doces",
        "categoryType": "tradicional",
        "badge": "",
        "available": true
      },
      {
        "id": "dois_amores",
        "name": "Dois Amores",
        "description": "Chocolate branco e chocolate preto.",
        "image": "assets/pizza_chocolate.png",
        "category": "doces",
        "categoryType": "tradicional",
        "badge": "",
        "available": true
      },
      {
        "id": "california",
        "name": "Califórnia",
        "description": "Figo, abacaxi, pêssego e cereja.",
        "image": "assets/pizza_chocolate.png",
        "category": "doces",
        "categoryType": "tradicional",
        "badge": "Vegetariana",
        "available": true
      },
      {
        "id": "prestigio",
        "name": "Prestígio",
        "description": "Chocolate ao leite e coco ralado.",
        "image": "assets/pizza_chocolate.png",
        "category": "doces",
        "categoryType": "tradicional",
        "badge": "",
        "available": true
      },
      {
        "id": "romeu_julieta",
        "name": "Romeu e Julieta",
        "description": "Mussarela e goiabada cremosa.",
        "image": "assets/pizza_chocolate.png",
        "category": "doces",
        "categoryType": "tradicional",
        "badge": "",
        "available": true
      },
      {
        "id": "bis",
        "name": "Bis",
        "description": "Chocolate preto, chocolate branco, bis preto e bis branco.",
        "image": "assets/pizza_chocolate.png",
        "category": "doces",
        "categoryType": "tradicional",
        "badge": "",
        "available": true
      },
      {
        "id": "negresco",
        "name": "Negresco",
        "description": "Chocolate preto, creme e bolacha Negresco triturada.",
        "image": "assets/pizza_chocolate.png",
        "category": "doces",
        "categoryType": "tradicional",
        "badge": "",
        "available": true
      },
      {
        "id": "kinder_bueno",
        "name": "Kinder Bueno",
        "description": "Creme de Leite Ninho, morango e Kinder Bueno.",
        "image": "assets/gourmet_doce_morango.png",
        "category": "doces",
        "categoryType": "especial",
        "badge": "Doce Premium",
        "available": true
      },
      {
        "id": "estikadinho",
        "name": "Estikadinho",
        "description": "Chocolate branco, estikadinho, morango e creme de leite.",
        "image": "assets/gourmet_doce_morango.png",
        "category": "doces",
        "categoryType": "especial",
        "badge": "Doce Premium",
        "available": true
      },
      {
        "id": "ouro_branco",
        "name": "Ouro Branco",
        "description": "Chocolate branco e bombom Ouro Branco.",
        "image": "assets/pizza_chocolate.png",
        "category": "doces",
        "categoryType": "especial",
        "badge": "",
        "available": true
      },
      {
        "id": "chocolate_nozes",
        "name": "Chocolate Branco com Nozes",
        "description": "Chocolate branco e nozes raladas.",
        "image": "assets/pizza_chocolate.png",
        "category": "doces",
        "categoryType": "especial",
        "badge": "",
        "available": true
      },
      {
        "id": "kitkat",
        "name": "KitKat",
        "description": "Chocolate preto, creme de KitKat e pedaços de KitKat.",
        "image": "assets/pizza_chocolate.png",
        "category": "doces",
        "categoryType": "especial",
        "badge": "",
        "available": true
      }
    ],
    "bebidas": [
      {
        "id": "coca_350",
        "name": "Coca-Cola Lata 350ml",
        "description": "Refrigerante Coca-Cola lata 350ml gelado.",
        "image": "assets/gourmet_bebida.png",
        "category": "bebidas",
        "price": 6,
        "available": true
      },
      {
        "id": "guarana_350",
        "name": "Guaraná Antarctica Lata 350ml",
        "description": "Refrigerante Guaraná Antarctica lata 350ml gelado.",
        "image": "assets/gourmet_bebida.png",
        "category": "bebidas",
        "price": 5.5,
        "available": true
      },
      {
        "id": "coca_2l",
        "name": "Coca-Cola 2 Litros",
        "description": "Refrigerante Coca-Cola garrafa 2 litros bem gelado.",
        "image": "assets/gourmet_bebida.png",
        "category": "bebidas",
        "price": 12,
        "available": true
      },
      {
        "id": "suco_uva",
        "name": "Suco de Uva Integral Prats 300ml",
        "description": "Suco de uva 100% integral e natural.",
        "image": "assets/gourmet_bebida.png",
        "category": "bebidas",
        "price": 8,
        "available": true
      },
      {
        "id": "agua_mineral",
        "name": "Água Mineral 500ml",
        "description": "Água mineral natural sem gás.",
        "image": "assets/gourmet_bebida.png",
        "category": "bebidas",
        "price": 4,
        "available": true
      }
    ]
  },
  "pizza_prices": {
    "broto": {
      "promocional": 65,
      "tradicional": 70,
      "especial": 75,
      "camarao": 80
    },
    "media": {
      "promocional": 75,
      "tradicional": 80,
      "especial": 85,
      "camarao": 90
    },
    "grande": {
      "promocional": 90,
      "tradicional": 100,
      "especial": 110,
      "camarao": 115
    },
    "vulcao": {
      "promocional": 90,
      "tradicional": 100,
      "especial": 110,
      "camarao": 110
    },
    "trem": {
      "promocional": 160,
      "tradicional": 175,
      "especial": 195,
      "camarao": 210
    }
  },
  "borders": {
    "sem-borda": {
      "name": "Sem Borda",
      "price": 0
    },
    "catupiry": {
      "name": "Borda de Catupiry",
      "price": 8
    },
    "cheddar": {
      "name": "Borda de Cheddar",
      "price": 8
    },
    "chocolate": {
      "name": "Borda de Chocolate Duo",
      "price": 10
    }
  },
  "settings": {
    "whatsapp": "5554996985724",
    "whatsappFormatted": "(54) 99698-5724",
    "deliveryFees": {
      "centro": { "name": "Centro", "fee": 10.00 },
      "logradouro": { "name": "Logradouro", "fee": 10.00 },
      "juriti": { "name": "Juriti", "fee": 10.00 },
      "pousada": { "name": "Pousada", "fee": 15.00 },
      "bavaria": { "name": "Bavária", "fee": 15.00 },
      "pia": { "name": "Pia", "fee": 15.00 },
      "vila-rica": { "name": "Vila Rica", "fee": 18.00 },
      "vale-verde": { "name": "Vale Verde", "fee": 18.00 },
      "vila-germania": { "name": "Vila Germânia", "fee": 18.00 },
      "linha-imperial": { "name": "Linha Imperial", "fee": 22.00 },
      "vila-olinda": { "name": "Vila Olinda", "fee": 25.00 },
      "linha-olinda": { "name": "Linha Olinda", "fee": 30.00 },
      "pinhal": { "name": "Pinhal", "fee": 40.00 }
    }
  },
  "promo_config": {
    "show_popup": true,
    "facebook_url": "https://www.facebook.com/photo?fbid=869832745812820&set=a.127662080029894"
  }
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
    
    // Reset active states
    btnNavOrders.classList.remove('active');
    btnNavMenu.classList.remove('active');
    if (btnNavReports) btnNavReports.classList.remove('active');
    if (btnNavSettings) btnNavSettings.classList.remove('active');
    
    // Hide sections
    sectionOrders.classList.add('display-none');
    sectionMenu.classList.add('display-none');
    if (sectionReports) sectionReports.classList.add('display-none');
    if (sectionSettings) sectionSettings.classList.add('display-none');
    
    if (section === 'orders') {
        btnNavOrders.classList.add('active');
        sectionOrders.classList.remove('display-none');
    } else if (section === 'menu') {
        btnNavMenu.classList.add('active');
        sectionMenu.classList.remove('display-none');
        
        if (!menuData) {
            initMenuSync();
        } else {
            renderMenuManager();
        }
    } else if (section === 'reports') {
        if (btnNavReports) btnNavReports.classList.add('active');
        if (sectionReports) {
            sectionReports.classList.remove('display-none');
            renderReportsDashboard();
        }
    } else if (section === 'settings') {
        if (btnNavSettings) btnNavSettings.classList.add('active');
        if (sectionSettings) {
            sectionSettings.classList.remove('display-none');
            renderSettingsDashboard();
        }
    }
}

function setMenuTab(tab) {
    currentMenuTab = tab;
    const tabFlavors = document.getElementById('tabFlavors');
    const tabPrices = document.getElementById('tabPrices');
    const tabSimpleItems = document.getElementById('tabSimpleItems');
    const tabPromo = document.getElementById('tabPromo');
    
    const menuTabFlavors = document.getElementById('menuTabFlavors');
    const menuTabPrices = document.getElementById('menuTabPrices');
    const menuTabSimpleItems = document.getElementById('menuTabSimpleItems');
    const menuTabPromo = document.getElementById('menuTabPromo');
    
    // Reset active tab class
    if (tabFlavors) tabFlavors.classList.remove('active');
    if (tabPrices) tabPrices.classList.remove('active');
    if (tabSimpleItems) tabSimpleItems.classList.remove('active');
    if (tabPromo) tabPromo.classList.remove('active');
    
    // Hide all tab contents
    if (menuTabFlavors) menuTabFlavors.classList.add('display-none');
    if (menuTabPrices) menuTabPrices.classList.add('display-none');
    if (menuTabSimpleItems) menuTabSimpleItems.classList.add('display-none');
    if (menuTabPromo) menuTabPromo.classList.add('display-none');
    
    if (tab === 'flavors') {
        if (tabFlavors) tabFlavors.classList.add('active');
        if (menuTabFlavors) menuTabFlavors.classList.remove('display-none');
    } else if (tab === 'prices') {
        if (tabPrices) tabPrices.classList.add('active');
        if (menuTabPrices) menuTabPrices.classList.remove('display-none');
    } else if (tab === 'simpleItems') {
        if (tabSimpleItems) tabSimpleItems.classList.add('active');
        if (menuTabSimpleItems) menuTabSimpleItems.classList.remove('display-none');
        renderSimpleItemsList();
    } else if (tab === 'promo') {
        if (tabPromo) tabPromo.classList.add('active');
        if (menuTabPromo) menuTabPromo.classList.remove('display-none');
        loadPromoConfigIntoUI();
    }
}

function initMenuSync() {
    // Render default menu data immediately as a fallback
    menuData = DEFAULT_MENU_DATA;
    renderMenuManager();

    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        const menuRef = firebase.database().ref('menu');
        menuRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                menuData = data;
                renderMenuManager();
            } else {
                console.log("Banco de dados do cardápio vazio. Semeando valores padrão do painel...");
                firebase.database().ref('menu').set(DEFAULT_MENU_DATA)
                .then(() => console.log("Cardápio semeado com sucesso a partir do painel."))
                .catch(err => console.error("Erro ao semear cardápio a partir do painel:", err));
            }
        });
    } else {
        // Fallback local - FETCH from local API
        fetch('/api/menu')
            .then(res => res.json())
            .then(data => {
                menuData = data;
                renderMenuManager();
            })
            .catch(err => {
                console.error("Erro ao buscar cardápio local, usando DEFAULT_MENU_DATA:", err);
                menuData = DEFAULT_MENU_DATA;
                renderMenuManager();
            });
    }
}

function renderMenuManager() {
    if (!menuData) return;
    
    renderFlavorsList();
    renderPricesMatrix();
    renderBordersTable();
    
    // Update settings dashboard if active
    if (typeof renderSettingsDashboard === 'function') {
        renderSettingsDashboard();
    }
}

function renderFlavorsList() {
    const grid = document.getElementById('flavorsListGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    const searchVal = document.getElementById('searchFlavor').value.toLowerCase().trim();
    const filterCat = document.getElementById('filterCategory').value;
    
    const pizzas = menuData.menu_items?.pizzas || [];
    
    pizzas.forEach((pizza) => {
        if (searchVal && !pizza.name.toLowerCase().includes(searchVal) && !pizza.description.toLowerCase().includes(searchVal)) {
            return;
        }
        
        if (filterCat !== 'todos' && pizza.category !== filterCat) {
            return;
        }
        
        const card = document.createElement('div');
        card.className = 'flavor-card';
        if (pizza.available === false) {
            card.style.opacity = '0.6';
        }
        
        const badgeHTML = pizza.badge ? `<span class="flavor-badge-label">${pizza.badge}</span>` : '';
        const isChecked = pizza.available !== false ? 'checked' : '';
        
        card.innerHTML = `
            <div class="flavor-card-header">
                <div class="flavor-card-info">
                    <h4 style="margin: 0; color: var(--text-main); font-size: 15px;">${pizza.name}</h4>
                    <span class="category-tag ${pizza.category === 'salgadas' ? 'salgada' : 'doce'}">
                        ${pizza.category === 'salgadas' ? 'Salgada' : 'Doce'}
                    </span>
                </div>
                
                <label class="switch" title="${pizza.available !== false ? 'Disponível no Site' : 'Pausado/Indisponível'}">
                    <input type="checkbox" ${isChecked} onchange="toggleFlavorAvailability('${pizza.id}', this.checked)">
                    <span class="slider"></span>
                </label>
            </div>
            
            <p class="flavor-card-desc" style="margin: 0; flex: 1;">${pizza.description}</p>
            
            <div class="flavor-card-meta">
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

function renderPricesMatrix() {
    const tbody = document.getElementById('pricesMatrixBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const sizes = ['broto', 'media', 'grande', 'vulcao', 'trem'];
    const sizeLabels = {
        'broto': 'Broto (4 fatias)',
        'media': 'Média (8 fatias)',
        'grande': 'Grande (12 fatias)',
        'vulcao': 'Vulcão (12 fatias)',
        'trem': 'Trem (24 fatias)'
    };
    
    const prices = menuData.pizza_prices || {};
    
    sizes.forEach(size => {
        const sizePrices = prices[size] || { promocional: 0, tradicional: 0, especial: 0, camarao: 0 };
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border-color)';
        
        tr.innerHTML = `
            <td style="padding: 12px 10px; font-weight: 600; color: var(--text-main);">${sizeLabels[size]}</td>
            <td style="padding: 8px 10px;">
                <input type="number" step="0.50" class="price-input" data-size="${size}" data-category="promocional" value="${sizePrices.promocional}" style="padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-main); width: 85px;">
            </td>
            <td style="padding: 8px 10px;">
                <input type="number" step="0.50" class="price-input" data-size="${size}" data-category="tradicional" value="${sizePrices.tradicional}" style="padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-main); width: 85px;">
            </td>
            <td style="padding: 8px 10px;">
                <input type="number" step="0.50" class="price-input" data-size="${size}" data-category="especial" value="${sizePrices.especial}" style="padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-main); width: 85px;">
            </td>
            <td style="padding: 8px 10px;">
                <input type="number" step="0.50" class="price-input" data-size="${size}" data-category="camarao" value="${sizePrices.camarao}" style="padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-main); width: 85px;">
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
        
        const isSemBorda = key === 'sem-borda';
        const nameInputHTML = isSemBorda 
            ? `<span style="font-weight: 500; padding: 8px 0; display: inline-block; color: var(--text-muted);">${border.name}</span>`
            : `<input type="text" class="border-name-input" data-id="${key}" value="${border.name}" style="width: 100%; max-width: 250px; padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-main);">`;
            
        const priceInputHTML = isSemBorda
            ? `<span style="color: var(--text-muted);">R$ 0,00 (Grátis)</span>`
            : `<input type="number" step="0.50" class="border-price-input" data-id="${key}" value="${border.price}" style="width: 85px; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-main);">`;
            
        tr.innerHTML = `
            <td style="padding: 12px 10px; font-family: monospace; font-size: 13px; color: var(--text-light);">${key}</td>
            <td style="padding: 8px 10px;">${nameInputHTML}</td>
            <td style="padding: 8px 10px;">${priceInputHTML}</td>
        `;
        tbody.appendChild(tr);
    });
}

function saveMenuPrices() {
    if (!menuData) return;
    
    const priceInputs = document.querySelectorAll('.price-input');
    const updatedPrices = JSON.parse(JSON.stringify(menuData.pizza_prices || {}));
    
    priceInputs.forEach(input => {
        const size = input.getAttribute('data-size');
        const category = input.getAttribute('data-category');
        const val = parseFloat(input.value) || 0;
        
        if (!updatedPrices[size]) updatedPrices[size] = {};
        updatedPrices[size][category] = val;
    });
    
    const updatedBorders = JSON.parse(JSON.stringify(menuData.borders || {}));
    const borderNameInputs = document.querySelectorAll('.border-name-input');
    const borderPriceInputs = document.querySelectorAll('.border-price-input');
    
    borderNameInputs.forEach(input => {
        const key = input.getAttribute('data-id');
        if (updatedBorders[key]) {
            updatedBorders[key].name = input.value.trim() || updatedBorders[key].name;
        }
    });
    
    borderPriceInputs.forEach(input => {
        const key = input.getAttribute('data-id');
        if (updatedBorders[key]) {
            updatedBorders[key].price = parseFloat(input.value) || 0;
        }
    });
    
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        firebase.database().ref('menu/pizza_prices').set(updatedPrices)
        .then(() => {
            return firebase.database().ref('menu/borders').set(updatedBorders);
        })
        .then(() => {
            triggerCentralAutoBackup();
            alert("Preços e bordas atualizados com sucesso no Firebase!");
        })
        .catch(err => {
            console.error(err);
            alert("Erro ao salvar preços no Firebase.");
        });
    } else {
        menuData.pizza_prices = updatedPrices;
        menuData.borders = updatedBorders;
        triggerCentralAutoBackup();
        alert("Preços locais salvos (sem Firebase).");
    }
}

function toggleFlavorAvailability(id, isChecked) {
    if (!menuData) return;
    
    const pizzas = menuData.menu_items?.pizzas || [];
    const index = pizzas.findIndex(p => p.id === id);
    if (index === -1) return;
    
    pizzas[index].available = isChecked;
    
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        firebase.database().ref(`menu/menu_items/pizzas/${index}/available`).set(isChecked)
        .then(() => {
            triggerCentralAutoBackup();
            console.log(`Disponibilidade de ${pizzas[index].name} alterada para: ${isChecked}`);
        })
        .catch(err => console.error("Erro ao alterar disponibilidade no Firebase:", err));
    } else {
        triggerCentralAutoBackup();
        renderFlavorsList();
    }
}

function openAddFlavorModal() {
    document.getElementById('flavorModalTitle').innerText = 'Adicionar Novo Sabor';
    document.getElementById('flavorEditId').value = '';
    document.getElementById('flavorForm').reset();
    
    // Set default value and trigger suggestions
    document.getElementById('flavorImage').value = 'assets/pizza_hero.png';
    updateFlavorImagePreview('assets/pizza_hero.png');
    onFlavorCategoryChange('salgadas');
    
    openModal('flavorModal');
}

function openEditFlavorModal(id) {
    if (!menuData) return;
    
    const pizzas = menuData.menu_items?.pizzas || [];
    const pizza = pizzas.find(p => p.id === id);
    if (!pizza) return;
    
    document.getElementById('flavorModalTitle').innerText = 'Editar Sabor';
    document.getElementById('flavorEditId').value = pizza.id;
    document.getElementById('flavorName').value = pizza.name;
    document.getElementById('flavorDescription').value = pizza.description;
    document.getElementById('flavorCategory').value = pizza.category;
    document.getElementById('flavorCategoryType').value = pizza.categoryType || 'promocional';
    document.getElementById('flavorBadge').value = pizza.badge || '';
    document.getElementById('flavorImage').value = pizza.image || 'assets/pizza_hero.png';
    updateFlavorImagePreview(pizza.image || 'assets/pizza_hero.png');
    
    // Trigger suggestions
    onFlavorCategoryChange(pizza.category);
    
    openModal('flavorModal');
}

function closeFlavorModal() {
    closeModal('flavorModal');
}

function openModal(modalId) {
    const overlay = document.getElementById(modalId);
    overlay.classList.remove('display-none');
    setTimeout(() => {
        overlay.classList.add('active');
        overlay.style.pointerEvents = 'auto';
        overlay.style.opacity = '1';
    }, 10);
}

function closeModal(modalId) {
    const overlay = document.getElementById(modalId);
    overlay.classList.remove('active');
    overlay.style.pointerEvents = 'none';
    overlay.style.opacity = '0';
    setTimeout(() => {
        overlay.classList.add('display-none');
    }, 300);
}

function deleteFlavor(id) {
    if (!menuData) return;
    
    const pizzas = menuData.menu_items?.pizzas || [];
    const pizza = pizzas.find(p => p.id === id);
    if (!pizza) return;
    
    if (!confirm(`Tem certeza que deseja excluir o sabor "${pizza.name}" permanentemente?`)) return;
    
    const updatedPizzas = pizzas.filter(p => p.id !== id);
    
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        firebase.database().ref('menu/menu_items/pizzas').set(updatedPizzas)
        .then(() => {
            triggerCentralAutoBackup();
            alert(`Sabor "${pizza.name}" excluído com sucesso!`);
        })
        .catch(err => {
            console.error(err);
            alert("Erro ao excluir sabor no Firebase.");
        });
    } else {
        menuData.menu_items.pizzas = updatedPizzas;
        triggerCentralAutoBackup();
        renderFlavorsList();
    }
}

function saveFlavor(event) {
    event.preventDefault();
    if (!menuData) return;
    
    const idField = document.getElementById('flavorEditId').value;
    const name = document.getElementById('flavorName').value.trim();
    const description = document.getElementById('flavorDescription').value.trim();
    const category = document.getElementById('flavorCategory').value;
    const categoryType = document.getElementById('flavorCategoryType').value;
    const badge = document.getElementById('flavorBadge').value.trim();
    const image = document.getElementById('flavorImage').value;
    
    const pizzas = menuData.menu_items?.pizzas || [];
    
    if (idField) {
        const index = pizzas.findIndex(p => p.id === idField);
        if (index !== -1) {
            pizzas[index].name = name;
            pizzas[index].description = description;
            pizzas[index].category = category;
            pizzas[index].categoryType = categoryType;
            pizzas[index].badge = badge;
            pizzas[index].image = image;
        }
    } else {
        const id = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        
        if (pizzas.some(p => p.id === id)) {
            alert("Já existe um sabor cadastrado com um nome muito parecido. Por favor, use um nome diferente.");
            return;
        }
        
        pizzas.push({
            id: id,
            name: name,
            description: description,
            category: category,
            categoryType: categoryType,
            badge: badge,
            image: image,
            available: true
        });
    }
    
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        firebase.database().ref('menu/menu_items/pizzas').set(pizzas)
        .then(() => {
            closeFlavorModal();
            triggerCentralAutoBackup();
            alert("Sabor gravado com sucesso!");
        })
        .catch(err => {
            console.error(err);
            alert("Erro ao gravar sabor no Firebase.");
        });
    } else {
        closeFlavorModal();
        triggerCentralAutoBackup();
        renderFlavorsList();
    }
}

/* ==========================================================================
   Shop Status Management
   ========================================================================== */
function initShopStatus() {
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        firebase.database().ref('status/isOpen').on('value', (snapshot) => {
            const isOpen = snapshot.val();
            const toggle = document.getElementById('shopStatusToggle');
            const label = document.getElementById('shopStatusLabel');
            
            if (isOpen !== null) {
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
    const label = document.getElementById('shopStatusLabel');
    if (label) {
        label.innerText = isOpen ? "Aberto" : "Fechado";
        label.style.color = isOpen ? "#81c784" : "#ef5350";
    }
    
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        firebase.database().ref('status').set({ isOpen: isOpen })
        .catch(err => console.error("Erro ao salvar status no Firebase:", err));
    } else {
        fetch('/api/status', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isOpen: isOpen })
        })
        .catch(err => console.error("Erro ao atualizar status local:", err));
    }
}

/* ==========================================================================
   Bebidas e Sobremesas Management (Simple Items CRUD)
   ========================================================================== */
function renderSimpleItemsList() {
    const grid = document.getElementById('simpleItemsListGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    if (!menuData) return;
    
    const searchVal = document.getElementById('searchSimpleItem').value.toLowerCase().trim();
    const filterCat = document.getElementById('filterSimpleCategory').value;
    
    let combinedItems = [];
    
    if (filterCat === 'todos' || filterCat === 'bebidas') {
        const bebidas = menuData.menu_items?.bebidas || [];
        bebidas.forEach(item => combinedItems.push({ ...item, category: 'bebidas' }));
    }
    
    if (filterCat === 'todos' || filterCat === 'sobremesas') {
        const sobremesas = menuData.menu_items?.sobremesas || [];
        sobremesas.forEach(item => combinedItems.push({ ...item, category: 'sobremesas' }));
    }
    
    combinedItems.forEach((item) => {
        if (searchVal && !item.name.toLowerCase().includes(searchVal) && !item.description.toLowerCase().includes(searchVal)) {
            return;
        }
        
        const card = document.createElement('div');
        card.className = 'flavor-card';
        if (item.available === false) {
            card.style.opacity = '0.6';
        }
        
        const isChecked = item.available !== false ? 'checked' : '';
        const catLabel = item.category === 'bebidas' ? 'Bebida' : 'Sobremesa';
        
        card.innerHTML = `
            <div class="flavor-card-header">
                <div class="flavor-card-info">
                    <h4 style="margin: 0; color: var(--text-main); font-size: 15px;">${item.name}</h4>
                    <span class="category-tag ${item.category === 'bebidas' ? 'salgada' : 'doce'}">
                        ${catLabel}
                    </span>
                </div>
                
                <label class="switch" title="${item.available !== false ? 'Disponível no Site' : 'Pausado/Indisponível'}">
                    <input type="checkbox" ${isChecked} onchange="toggleSimpleItemAvailability('${item.id}', '${item.category}', this.checked)">
                    <span class="slider"></span>
                </label>
            </div>
            
            <p class="flavor-card-desc" style="margin: 0; flex: 1;">${item.description}</p>
            
            <div class="flavor-card-meta">
                <span class="flavor-price-tier" style="font-weight: 600; color: var(--primary); font-size: 13px;">
                    R$ ${item.price.toFixed(2).replace('.', ',')}
                </span>
            </div>
            
            <div class="flavor-card-actions">
                <button class="btn-icon-action" onclick="openEditSimpleItemModal('${item.id}', '${item.category}')" title="Editar Item">
                    <span class="material-symbols-rounded" style="font-size: 18px;">edit</span>
                </button>
                <button class="btn-icon-action delete" onclick="deleteSimpleItem('${item.id}', '${item.category}')" title="Excluir Item">
                    <span class="material-symbols-rounded" style="font-size: 18px;">delete</span>
                </button>
            </div>
        `;
        
        grid.appendChild(card);
    });
}

function filterSimpleItemsList() {
    renderSimpleItemsList();
}

function openAddSimpleItemModal() {
    document.getElementById('simpleItemModalTitle').innerText = 'Adicionar Novo Item';
    document.getElementById('simpleItemEditId').value = '';
    document.getElementById('simpleItemEditCategory').value = '';
    document.getElementById('simpleItemForm').reset();
    
    onSimpleItemCategorySelectChange('bebidas');
    
    openModal('simpleItemModal');
}

function onSimpleItemCategorySelectChange(val) {
    const imgInput = document.getElementById('simpleItemImage');
    if (!imgInput) return;
    
    if (val === 'bebidas') {
        imgInput.value = 'assets/gourmet_bebida.png';
    } else {
        imgInput.value = 'assets/gourmet_sobremesa.png';
    }
    
    populateSimpleItemSuggestions(val);
}

function openEditSimpleItemModal(id, category) {
    if (!menuData) return;
    
    const list = category === 'bebidas' ? menuData.menu_items?.bebidas : menuData.menu_items?.sobremesas;
    if (!list) return;
    
    const item = list.find(i => i.id === id);
    if (!item) return;
    
    document.getElementById('simpleItemModalTitle').innerText = 'Editar Item';
    document.getElementById('simpleItemEditId').value = item.id;
    document.getElementById('simpleItemEditCategory').value = category;
    
    document.getElementById('simpleItemName').value = item.name;
    document.getElementById('simpleItemDescription').value = item.description;
    document.getElementById('simpleItemCategorySelect').value = category;
    document.getElementById('simpleItemPrice').value = item.price;
    document.getElementById('simpleItemImage').value = item.image || (category === 'bebidas' ? 'assets/gourmet_bebida.png' : 'assets/gourmet_sobremesa.png');
    
    // Trigger suggestions
    populateSimpleItemSuggestions(category);
    
    openModal('simpleItemModal');
}

function closeSimpleItemModal() {
    closeModal('simpleItemModal');
}

function toggleSimpleItemAvailability(id, category, isChecked) {
    if (!menuData) return;
    
    const list = category === 'bebidas' ? menuData.menu_items?.bebidas : menuData.menu_items?.sobremesas;
    if (!list) return;
    
    const index = list.findIndex(i => i.id === id);
    if (index === -1) return;
    
    list[index].available = isChecked;
    
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        firebase.database().ref(`menu/menu_items/${category}/${index}/available`).set(isChecked)
        .then(() => {
            console.log(`Disponibilidade de ${list[index].name} alterada para: ${isChecked}`);
        })
        .catch(err => console.error("Erro ao alterar disponibilidade no Firebase:", err));
    } else {
        saveLocalMenu(() => {
            renderSimpleItemsList();
        });
    }
}

function deleteSimpleItem(id, category) {
    if (!menuData) return;
    
    const list = category === 'bebidas' ? menuData.menu_items?.bebidas : menuData.menu_items?.sobremesas;
    if (!list) return;
    
    const item = list.find(i => i.id === id);
    if (!item) return;
    
    if (!confirm(`Tem certeza que deseja excluir o item "${item.name}" permanentemente?`)) return;
    
    const updatedList = list.filter(i => i.id !== id);
    
    if (category === 'bebidas') {
        menuData.menu_items.bebidas = updatedList;
    } else {
        menuData.menu_items.sobremesas = updatedList;
    }
    
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        firebase.database().ref(`menu/menu_items/${category}`).set(updatedList)
        .then(() => {
            alert(`Item "${item.name}" excluído com sucesso!`);
            renderSimpleItemsList();
        })
        .catch(err => {
            console.error(err);
            alert("Erro ao excluir item no Firebase.");
        });
    } else {
        saveLocalMenu(() => {
            alert(`Item "${item.name}" excluído localmente com sucesso!`);
            renderSimpleItemsList();
        });
    }
}

function saveSimpleItem(event) {
    event.preventDefault();
    if (!menuData) return;
    
    const idField = document.getElementById('simpleItemEditId').value;
    const oldCategory = document.getElementById('simpleItemEditCategory').value;
    
    const name = document.getElementById('simpleItemName').value.trim();
    const description = document.getElementById('simpleItemDescription').value.trim();
    const newCategory = document.getElementById('simpleItemCategorySelect').value;
    const price = parseFloat(document.getElementById('simpleItemPrice').value) || 0;
    const image = document.getElementById('simpleItemImage').value;
    
    if (!menuData.menu_items.bebidas) menuData.menu_items.bebidas = [];
    if (!menuData.menu_items.sobremesas) menuData.menu_items.sobremesas = [];
    
    if (idField) {
        if (oldCategory !== newCategory) {
            const oldList = oldCategory === 'bebidas' ? menuData.menu_items.bebidas : menuData.menu_items.sobremesas;
            const itemIndex = oldList.findIndex(i => i.id === idField);
            let itemData = { id: idField, name, description, category: newCategory, price, image, available: true };
            if (itemIndex !== -1) {
                itemData.available = oldList[itemIndex].available !== false;
                oldList.splice(itemIndex, 1);
            }
            
            const newList = newCategory === 'bebidas' ? menuData.menu_items.bebidas : menuData.menu_items.sobremesas;
            newList.push(itemData);
        } else {
            const list = newCategory === 'bebidas' ? menuData.menu_items.bebidas : menuData.menu_items.sobremesas;
            const index = list.findIndex(i => i.id === idField);
            if (index !== -1) {
                list[index].name = name;
                list[index].description = description;
                list[index].category = newCategory;
                list[index].price = price;
                list[index].image = image;
            }
        }
    } else {
        const id = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        const list = newCategory === 'bebidas' ? menuData.menu_items.bebidas : menuData.menu_items.sobremesas;
        
        if (list.some(i => i.id === id)) {
            alert("Já existe um item cadastrado com um nome muito parecido.");
            return;
        }
        
        list.push({
            id: id,
            name: name,
            description: description,
            category: newCategory,
            price: price,
            image: image,
            available: true
        });
    }
    
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        firebase.database().ref('menu/menu_items').set(menuData.menu_items)
        .then(() => {
            closeSimpleItemModal();
            alert("Item gravado com sucesso no Firebase!");
            renderSimpleItemsList();
        })
        .catch(err => {
            console.error(err);
            alert("Erro ao gravar item no Firebase.");
        });
    } else {
        saveLocalMenu(() => {
            closeSimpleItemModal();
            alert("Item gravado localmente com sucesso!");
            renderSimpleItemsList();
        });
    }
}

function saveLocalMenu(callback) {
    fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(menuData)
    })
    .then(res => res.json())
    .then(data => {
        if (callback) callback();
    })
    .catch(err => {
        console.error("Erro ao salvar cardápio localmente:", err);
        if (callback) callback();
    });
}

/* ==========================================================================
   Image Suggestion Helpers
   ========================================================================== */
function onFlavorCategoryChange(val) {
    populateFlavorImageSuggestions(val);
}

function populateFlavorImageSuggestions(category) {
    const suggestionsContainer = document.getElementById('imageSuggestions');
    if (!suggestionsContainer) return;
    
    suggestionsContainer.innerHTML = '';
    
    let suggestions = [];
    if (category === 'salgadas') {
        suggestions = [
            { label: 'Calabresa (Gourmet)', value: 'assets/gourmet_calabresa.png' },
            { label: 'Calabresa', value: 'assets/pizza_calabresa.png' },
            { label: 'Marguerita (Gourmet)', value: 'assets/gourmet_margherita.png' },
            { label: 'Marguerita', value: 'assets/pizza_margherita.png' },
            { label: '4 Queijos (Gourmet)', value: 'assets/gourmet_quatro_queijos.png' },
            { label: '4 Queijos', value: 'assets/pizza_quatro_queijos.png' },
            { label: 'Padrão / Hero', value: 'assets/pizza_hero.png' }
        ];
    } else { // doces
        suggestions = [
            { label: 'Morango (Gourmet)', value: 'assets/gourmet_doce_morango.png' },
            { label: 'Chocolate', value: 'assets/pizza_chocolate.png' },
            { label: 'Padrão / Hero', value: 'assets/pizza_hero.png' }
        ];
    }
    
    renderSuggestionsInto(suggestionsContainer, suggestions, 'flavorImage');
}

function populateSimpleItemSuggestions(category) {
    const suggestionsContainer = document.getElementById('simpleItemImageSuggestions');
    if (!suggestionsContainer) return;
    
    suggestionsContainer.innerHTML = '';
    
    let suggestions = [];
    if (category === 'bebidas') {
        suggestions = [
            { label: 'Bebidas (Padrão)', value: 'assets/gourmet_bebida.png' }
        ];
    } else { // sobremesas
        suggestions = [
            { label: 'Sobremesas (Padrão)', value: 'assets/gourmet_sobremesa.png' }
        ];
    }
    
    renderSuggestionsInto(suggestionsContainer, suggestions, 'simpleItemImage');
}

function renderSuggestionsInto(container, suggestions, targetInputId) {
    const label = document.createElement('span');
    label.textContent = 'Sugestões rápidas: ';
    label.style.fontSize = '12px';
    label.style.color = 'var(--text-muted)';
    label.style.marginRight = '4px';
    container.appendChild(label);
    
    suggestions.forEach((sug) => {
        const link = document.createElement('a');
        link.href = '#';
        link.textContent = sug.label;
        link.style.fontSize = '12px';
        link.style.color = '#ffc107'; // Golden/Accent color
        link.style.textDecoration = 'none';
        link.style.marginRight = '8px';
        link.style.cursor = 'pointer';
        link.style.background = 'rgba(255, 193, 7, 0.1)';
        link.style.padding = '2px 6px';
        link.style.borderRadius = '4px';
        link.style.border = '1px solid rgba(255, 193, 7, 0.2)';
        link.style.transition = 'all var(--transition)';
        
        link.addEventListener('mouseenter', () => {
            link.style.background = 'rgba(255, 193, 7, 0.2)';
        });
        link.addEventListener('mouseleave', () => {
            link.style.background = 'rgba(255, 193, 7, 0.1)';
        });
        
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const input = document.getElementById(targetInputId);
            if (input) {
                input.value = sug.value;
            }
        });
        container.appendChild(link);
    });
}

/* ==========================================================================
   Store Settings Functions
   ========================================================================== */
function renderSettingsDashboard() {
    if (!menuData) return;
    
    if (!menuData.settings) {
        menuData.settings = {
            whatsapp: '5554996985724',
            whatsappFormatted: '(54) 99698-5724',
            deliveryFees: {}
        };
        if (DEFAULT_MENU_DATA.settings && DEFAULT_MENU_DATA.settings.deliveryFees) {
            menuData.settings.deliveryFees = JSON.parse(JSON.stringify(DEFAULT_MENU_DATA.settings.deliveryFees));
        }
    }
    
    const settings = menuData.settings;
    const settingsWhatsapp = document.getElementById('settingsWhatsapp');
    const settingsWhatsappFormatted = document.getElementById('settingsWhatsappFormatted');
    
    if (settingsWhatsapp) settingsWhatsapp.value = settings.whatsapp || '';
    if (settingsWhatsappFormatted) settingsWhatsappFormatted.value = settings.whatsappFormatted || '';
    
    const feesBody = document.getElementById('settingsFeesBody');
    if (feesBody) {
        feesBody.innerHTML = '';
        const fees = settings.deliveryFees || {};
        const sortedKeys = Object.keys(fees).sort((a, b) => fees[a].name.localeCompare(fees[b].name));
        
        if (sortedKeys.length === 0) {
            feesBody.innerHTML = '<tr><td colspan="4" style="padding: 15px; text-align: center; color: var(--text-muted); font-size: 13px;">Nenhum bairro cadastrado.</td></tr>';
        } else {
            sortedKeys.forEach(key => {
                const item = fees[key];
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid var(--border-color)';
                tr.innerHTML = `
                    <td style="padding: 8px 5px; color: var(--text-muted); font-size: 12px; font-family: monospace;">${key}</td>
                    <td style="padding: 8px 5px; font-weight: 500; font-size: 14px;">${item.name}</td>
                    <td style="padding: 8px 5px;">
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span style="font-size: 13px; color: var(--text-muted);">R$</span>
                            <input type="number" step="0.50" value="${item.fee}" class="bairro-fee-input" data-id="${key}" style="width: 75px; padding: 6px 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-main); font-size: 13px;">
                        </div>
                    </td>
                    <td style="padding: 8px 5px; text-align: center;">
                        <button type="button" onclick="deleteBairroRow('${key}')" style="background: transparent; border: none; color: #ef5350; cursor: pointer; display: inline-flex; align-items: center;" title="Excluir Bairro">
                            <span class="material-symbols-rounded" style="font-size: 18px;">delete</span>
                        </button>
                    </td>
                `;
                feesBody.appendChild(tr);
            });
        }
    }
}

function addBairroRow() {
    if (!menuData || !menuData.settings) return;
    
    const idInput = document.getElementById('newBairroId');
    const nameInput = document.getElementById('newBairroName');
    const feeInput = document.getElementById('newBairroFee');
    
    if (!idInput || !nameInput || !feeInput) return;
    
    const id = idInput.value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9_-]/g, "-");
    const name = nameInput.value.trim();
    const fee = parseFloat(feeInput.value);
    
    if (!id || !name || isNaN(fee)) {
        alert("Preencha todos os campos do novo bairro de forma válida.");
        return;
    }
    
    if (!menuData.settings.deliveryFees) {
        menuData.settings.deliveryFees = {};
    }
    
    if (menuData.settings.deliveryFees[id]) {
        alert("Já existe um bairro cadastrado com este Identificador (ID).");
        return;
    }
    
    menuData.settings.deliveryFees[id] = { name: name, fee: fee };
    TAXAS_ENTREGA[id] = { name: name, fee: fee };
    
    idInput.value = '';
    nameInput.value = '';
    feeInput.value = '';
    
    triggerCentralAutoBackup();
    renderSettingsDashboard();
}

function deleteBairroRow(key) {
    if (!menuData || !menuData.settings || !menuData.settings.deliveryFees) return;
    
    if (confirm(`Deseja realmente remover as taxas do bairro "${menuData.settings.deliveryFees[key]?.name || key}"?`)) {
        delete menuData.settings.deliveryFees[key];
        delete TAXAS_ENTREGA[key];
        triggerCentralAutoBackup();
        renderSettingsDashboard();
    }
}

function saveSettings() {
    if (!menuData || !menuData.settings) return;
    
    const whatsapp = document.getElementById('settingsWhatsapp').value.trim();
    const whatsappFormatted = document.getElementById('settingsWhatsappFormatted').value.trim();
    
    if (!whatsapp) {
        alert("O número de WhatsApp da empresa é obrigatório.");
        return;
    }
    
    menuData.settings.whatsapp = whatsapp;
    menuData.settings.whatsappFormatted = whatsappFormatted;
    
    const inputs = document.querySelectorAll('.bairro-fee-input');
    inputs.forEach(input => {
        const key = input.getAttribute('data-id');
        const fee = parseFloat(input.value);
        if (menuData.settings.deliveryFees && menuData.settings.deliveryFees[key]) {
            menuData.settings.deliveryFees[key].fee = isNaN(fee) ? 0 : fee;
        }
    });
    
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        firebase.database().ref('menu/settings').set(menuData.settings)
        .then(() => {
            triggerCentralAutoBackup();
            alert("Configurações salvas com sucesso no Firebase!");
        })
        .catch(err => {
            alert("Erro ao salvar configurações no Firebase: " + err.message);
            console.error(err);
        });
    } else {
        saveLocalMenu(() => {
            triggerCentralAutoBackup();
            alert("Configurações salvas localmente com sucesso!");
        });
    }
}

/* ==========================================================================
   Reports Dashboard Functionality
   ========================================================================== */
function renderReportsDashboard() {
    const filterVal = document.getElementById('reportsPeriodFilter')?.value || 'all';
    
    // Time calculations
    const now = Date.now();
    const millisecondsInDay = 24 * 60 * 60 * 1000;
    
    const filteredOrders = orders.filter(order => {
        if (!order.timestamp) return filterVal === 'all';
        
        const diffDays = (now - order.timestamp) / millisecondsInDay;
        
        if (filterVal === 'today') {
            const orderDate = new Date(order.timestamp).toDateString();
            const todayDate = new Date().toDateString();
            return orderDate === todayDate;
        } else if (filterVal === '7days') {
            return diffDays <= 7;
        } else if (filterVal === 'month') {
            return diffDays <= 30;
        }
        return true; // all
    });

    // 1. Sales summary (status: Entregue)
    const completedOrders = filteredOrders.filter(o => o.status === 'Entregue');
    const canceledOrders = filteredOrders.filter(o => o.status === 'Cancelado');
    
    const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const avgOrder = completedOrders.length > 0 ? (totalRevenue / completedOrders.length) : 0;
    
    // Update summary cards
    const repTotalRevenueEl = document.getElementById('repTotalRevenue');
    const repCompletedOrdersEl = document.getElementById('repCompletedOrders');
    const repAverageOrderEl = document.getElementById('repAverageOrder');
    const repCanceledOrdersEl = document.getElementById('repCanceledOrders');
    
    if (repTotalRevenueEl) repTotalRevenueEl.innerText = `R$ ${totalRevenue.toFixed(2).replace('.', ',')}`;
    if (repCompletedOrdersEl) repCompletedOrdersEl.innerText = completedOrders.length;
    if (repAverageOrderEl) repAverageOrderEl.innerText = `R$ ${avgOrder.toFixed(2).replace('.', ',')}`;
    if (repCanceledOrdersEl) repCanceledOrdersEl.innerText = canceledOrders.length;

    // 2. Payment Methods distribution
    const paymentsCount = { pix: 0, card: 0, cash: 0 };
    const paymentsRevenue = { pix: 0, card: 0, cash: 0 };
    completedOrders.forEach(o => {
        const method = o.paymentMethod;
        if (paymentsCount[method] !== undefined) {
            paymentsCount[method]++;
            paymentsRevenue[method] += (o.total || 0);
        }
    });
    
    const totalPaymentsRevenue = paymentsRevenue.pix + paymentsRevenue.card + paymentsRevenue.cash;
    
    const paymentsContainer = document.getElementById('paymentMethodsDistribution');
    if (paymentsContainer) {
        paymentsContainer.innerHTML = '';
        
        const labels = { pix: 'Pix', card: 'Cartão (Maquininha)', cash: 'Dinheiro' };
        const classes = { pix: 'pix', card: 'card', cash: 'cash' };
        
        ['pix', 'card', 'cash'].forEach(method => {
            const rev = paymentsRevenue[method];
            const pct = totalPaymentsRevenue > 0 ? (rev / totalPaymentsRevenue) * 100 : 0;
            const count = paymentsCount[method];
            
            const html = `
                <div class="report-bar-row">
                    <div class="report-bar-label">
                        <span>${labels[method]} (${count} ped.)</span>
                        <span class="value">R$ ${rev.toFixed(2).replace('.', ',')} (${pct.toFixed(0)}%)</span>
                    </div>
                    <div class="report-bar-track">
                        <div class="report-bar-fill ${classes[method]}" style="width: ${pct}%;"></div>
                    </div>
                </div>
            `;
            paymentsContainer.insertAdjacentHTML('beforeend', html);
        });
    }

    // 3. Top 5 Best Sellers
    const itemQuantities = {};
    completedOrders.forEach(o => {
        if (!o.cart) return;
        o.cart.forEach(item => {
            if (item.type === 'pizza') {
                if (item.flavorNames && item.flavorNames.length > 0) {
                    item.flavorNames.forEach(flavor => {
                        const key = `Pizza Sabor: ${flavor}`;
                        itemQuantities[key] = (itemQuantities[key] || 0) + (item.quantity || 1);
                    });
                } else {
                    const key = `Pizza ${item.sizeName || 'Montada'}`;
                    itemQuantities[key] = (itemQuantities[key] || 0) + (item.quantity || 1);
                }
            } else {
                const key = item.name;
                itemQuantities[key] = (itemQuantities[key] || 0) + (item.quantity || 1);
            }
        });
    });
    
    const sortedItems = Object.keys(itemQuantities)
        .map(key => ({ name: key, qty: itemQuantities[key] }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);
        
    const topProductsContainer = document.getElementById('topSellingProductsList');
    if (topProductsContainer) {
        topProductsContainer.innerHTML = '';
        
        if (sortedItems.length === 0) {
            topProductsContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 20px 0;">Nenhum produto vendido no período selecionado.</div>';
        } else {
            const maxQty = Math.max(...sortedItems.map(i => i.qty));
            
            sortedItems.forEach(item => {
                const pct = maxQty > 0 ? (item.qty / maxQty) * 100 : 0;
                const html = `
                    <div class="report-bar-row">
                        <div class="report-bar-label">
                            <span>${item.name}</span>
                            <span class="value">${item.qty} un.</span>
                        </div>
                        <div class="report-bar-track">
                            <div class="report-bar-fill item" style="width: ${pct}%;"></div>
                        </div>
                    </div>
                `;
                topProductsContainer.insertAdjacentHTML('beforeend', html);
            });
        }
    }
}

function loadPromoConfigIntoUI() {
    if (!menuData) return;
    const config = menuData.promo_config || { show_popup: false, facebook_url: "" };
    
    const showCheckbox = document.getElementById('promoShowPopup');
    const urlInput = document.getElementById('promoFacebookUrl');
    
    if (showCheckbox) showCheckbox.checked = !!config.show_popup;
    if (urlInput) urlInput.value = config.facebook_url || "";
}

function savePromoConfig(event) {
    event.preventDefault();
    if (!menuData) return;
    
    const show_popup = document.getElementById('promoShowPopup').checked;
    const facebook_url = document.getElementById('promoFacebookUrl').value.trim();
    
    if (!menuData.promo_config) {
        menuData.promo_config = {};
    }
    
    menuData.promo_config.show_popup = show_popup;
    menuData.promo_config.facebook_url = facebook_url;
    
    // Save to Firebase or local server
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        firebase.database().ref('menu/promo_config').set(menuData.promo_config)
        .then(() => {
            triggerCentralAutoBackup();
            alert("Configurações do Pop-up salvas com sucesso!");
        })
        .catch(err => {
            console.error("Erro ao salvar config no Firebase:", err);
            alert("Erro ao salvar configurações no Firebase.");
        });
    } else {
        // Local API save
        fetch('/api/menu', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(menuData)
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                triggerCentralAutoBackup();
                alert("Configurações do Pop-up salvas localmente!");
            } else {
                alert("Erro ao salvar configurações localmente.");
            }
        })
        .catch(err => {
            console.error("Erro ao salvar localmente:", err);
            alert("Erro de conexão ao salvar localmente.");
        });
    }
}

/* ==========================================================================
   PWA & Service Worker Integration for Admin Panel
   ========================================================================== */
let swRegistration = null;

function initPWA() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').then(reg => {
            swRegistration = reg;
            if (reg.waiting) {
                promptUpdate(reg.waiting);
            }
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            promptUpdate(newWorker);
                        }
                    });
                }
            });
        }).catch(err => {
            console.warn('Admin Service Worker registration failed:', err);
        });

        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                refreshing = true;
                window.location.reload();
            }
        });
    }
}

function promptUpdate(worker) {
    const banner = document.getElementById('updateBanner');
    if (banner) banner.classList.remove('display-none');
}

function applyAppUpdate() {
    if (swRegistration && swRegistration.waiting) {
        swRegistration.waiting.postMessage({ action: 'skipWaiting' });
    } else {
        window.location.reload();
    }
}

/* ==========================================================================
   Toast Notifications & Standardized Loading Spinner Overlay
   ========================================================================== */
function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    
    const icons = {
        success: 'check_circle',
        error: 'error',
        warning: 'warning',
        info: 'info'
    };
    
    toast.innerHTML = `
        <span class="material-symbols-rounded">${icons[type] || 'info'}</span>
        <span>${escapeHtml(message)}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function showLoading(message = 'Processando...') {
    const overlay = document.getElementById('globalLoading');
    const textSpan = document.getElementById('loadingText');
    if (overlay) {
        if (textSpan) textSpan.innerText = message;
        overlay.classList.remove('display-none');
    }
}

function hideLoading() {
    const overlay = document.getElementById('globalLoading');
    if (overlay) {
        overlay.classList.add('display-none');
    }
}

function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* ==========================================================================
   Image Manager: Client-Side Canvas Compression, Preview & Removal
   ========================================================================== */
function compressAndProcessImage(file, maxWidth, maxHeight, quality, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            let canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }
            if (height > maxHeight) {
                width = Math.round((width * maxHeight) / height);
                height = maxHeight;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            callback(null, dataUrl);
        };
        img.onerror = function() {
            callback(new Error('Erro ao carregar imagem para compressão'));
        };
        img.src = e.target.result;
    };
    reader.onerror = function() {
        callback(new Error('Erro ao ler arquivo de imagem'));
    };
    reader.readAsDataURL(file);
}

function handleFlavorFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showToast('Por favor, selecione um arquivo de imagem válido.', 'warning');
        return;
    }
    
    showLoading('Otimizando imagem...');
    compressAndProcessImage(file, 800, 800, 0.82, (err, compressedDataUrl) => {
        hideLoading();
        if (err) {
            console.error(err);
            showToast('Não foi possível processar a imagem.', 'error');
            return;
        }
        
        const input = document.getElementById('flavorImage');
        if (input) {
            input.value = compressedDataUrl;
            updateFlavorImagePreview(compressedDataUrl, file.name);
            showToast('Imagem enviada e otimizada com sucesso!', 'success');
        }
    });
}

function updateFlavorImagePreview(url, fileName = '') {
    const card = document.getElementById('flavorImagePreviewCard');
    const thumb = document.getElementById('flavorImagePreviewThumb');
    const nameEl = document.getElementById('flavorImagePreviewName');
    
    if (!card || !thumb) return;
    
    if (url && url.trim().length > 0) {
        thumb.src = url;
        nameEl.innerText = fileName || (url.length > 40 ? url.substring(0, 37) + '...' : url);
        card.classList.remove('display-none');
    } else {
        card.classList.add('display-none');
    }
}

function removeFlavorImage() {
    const input = document.getElementById('flavorImage');
    const fileInput = document.getElementById('flavorFileInput');
    if (input) input.value = '';
    if (fileInput) fileInput.value = '';
    updateFlavorImagePreview('');
    showToast('Imagem removida.', 'info');
}

function handleSimpleItemFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showToast('Por favor, selecione um arquivo de imagem válido.', 'warning');
        return;
    }
    
    showLoading('Otimizando imagem...');
    compressAndProcessImage(file, 800, 800, 0.82, (err, compressedDataUrl) => {
        hideLoading();
        if (err) {
            console.error(err);
            showToast('Não foi possível processar a imagem.', 'error');
            return;
        }
        
        const input = document.getElementById('simpleItemImage');
        if (input) {
            input.value = compressedDataUrl;
            updateSimpleItemImagePreview(compressedDataUrl, file.name);
            showToast('Imagem enviada e otimizada com sucesso!', 'success');
        }
    });
}

function updateSimpleItemImagePreview(url, fileName = '') {
    const card = document.getElementById('simpleItemImagePreviewCard');
    const thumb = document.getElementById('simpleItemImagePreviewThumb');
    const nameEl = document.getElementById('simpleItemImagePreviewName');
    
    if (!card || !thumb) return;
    
    if (url && url.trim().length > 0) {
        thumb.src = url;
        nameEl.innerText = fileName || (url.length > 40 ? url.substring(0, 37) + '...' : url);
        card.classList.remove('display-none');
    } else {
        card.classList.add('display-none');
    }
}

function removeSimpleItemImage() {
    const input = document.getElementById('simpleItemImage');
    const fileInput = document.getElementById('simpleItemFileInput');
    if (input) input.value = '';
    if (fileInput) fileInput.value = '';
    updateSimpleItemImagePreview('');
    showToast('Imagem removida.', 'info');
}

/* ==========================================================================
   Backup & Export/Import Manager (JSON)
   ========================================================================== */
function exportMenuBackup() {
    try {
        if (!menuData) {
            showToast('Dados do cardápio não disponíveis para exportação.', 'warning');
            return;
        }
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(menuData, null, 2));
        const downloadAnchor = document.createElement('a');
        const today = new Date().toISOString().slice(0, 10);
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `mundo-da-pizza-cardapio-${today}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        showToast('Backup do cardápio exportado com sucesso!', 'success');
    } catch (e) {
        console.error("Erro ao exportar cardápio:", e);
        showToast('Não foi possível exportar o backup do cardápio.', 'error');
    }
}

function exportSettingsBackup() {
    try {
        const settingsBackup = {
            settings: CONFIG_SETTINGS,
            deliveryFees: TAXAS_ENTREGA,
            promo_config: menuData?.promo_config || {}
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(settingsBackup, null, 2));
        const downloadAnchor = document.createElement('a');
        const today = new Date().toISOString().slice(0, 10);
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `mundo-da-pizza-configuracoes-${today}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        showToast('Backup das configurações exportado com sucesso!', 'success');
    } catch (e) {
        console.error("Erro ao exportar configurações:", e);
        showToast('Não foi possível exportar o backup das configurações.', 'error');
    }
}

function exportOrdersBackup() {
    try {
        if (!orders || orders.length === 0) {
            showToast('Nenhum pedido registrado para exportação.', 'warning');
            return;
        }
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(orders, null, 2));
        const downloadAnchor = document.createElement('a');
        const today = new Date().toISOString().slice(0, 10);
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `mundo-da-pizza-pedidos-${today}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        showToast('Backup de pedidos exportado com sucesso!', 'success');
    } catch (e) {
        console.error("Erro ao exportar pedidos:", e);
        showToast('Não foi possível exportar o backup de pedidos.', 'error');
    }
}

function validateMenuBackupData(data) {
    if (!data || typeof data !== 'object') {
        return { valid: false, error: 'O arquivo não é um objeto JSON válido.' };
    }
    
    if (!data.menu_items || typeof data.menu_items !== 'object') {
        return { valid: false, error: 'O arquivo não contém a estrutura "menu_items".' };
    }
    
    if (!Array.isArray(data.menu_items.pizzas) || data.menu_items.pizzas.length === 0) {
        return { valid: false, error: 'Nenhum sabor de pizza válido encontrado no arquivo de backup.' };
    }
    
    if (!Array.isArray(data.menu_items.bebidas)) {
        return { valid: false, error: 'A seção de bebidas do arquivo de backup está ausente ou malformatada.' };
    }
    
    const invalidPizza = data.menu_items.pizzas.find(p => !p.name || !p.category);
    if (invalidPizza) {
        return { valid: false, error: 'Existem sabores de pizza com nome ou categoria ausentes no backup.' };
    }

    return { valid: true, error: null };
}

function handleImportMenuBackup(event) {
    const fileInput = event.target;
    const file = fileInput.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            
            // 1. Strict JSON Schema Validation BEFORE changing any data or database state
            const validation = validateMenuBackupData(importedData);
            if (!validation.valid) {
                showToast(`Falha na validação do backup: ${validation.error}`, 'error', 6000);
                fileInput.value = '';
                return;
            }
            
            const countPizzas = importedData.menu_items.pizzas.length;
            const countBebidas = importedData.menu_items.bebidas.length;
            
            // 2. Explicit User Confirmation with Data Summary
            const userConfirmed = confirm(
                `⚠️ CONFIRMAÇÃO DE RESTAURAÇÃO DE BACKUP:\n\n` +
                `Foi encontrado no arquivo:\n` +
                `• ${countPizzas} sabores de pizza\n` +
                `• ${countBebidas} itens de bebidas\n\n` +
                `Deseja aplicar estas alterações ao cardápio do Mundo da Pizza?`
            );
            
            if (!userConfirmed) {
                showToast('Restauração de backup cancelada pelo usuário.', 'info');
                fileInput.value = '';
                return;
            }
            
            const finalConfirm = confirm("⚠️ ATENÇÃO: Os dados do cardápio serão atualizados com as informações do backup. Confirmar?");
            if (!finalConfirm) {
                showToast('Restauração cancelada.', 'info');
                fileInput.value = '';
                return;
            }
            
            // 3. Apply changes ONLY after 100% validation and double confirmation
            showLoading('Restaurando cardápio...');
            menuData = importedData;
            
            if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
                firebase.database().ref('menu').set(importedData)
                .then(() => {
                    hideLoading();
                    renderMenuManager();
                    showToast('Cardápio restaurado e sincronizado com sucesso no Firebase!', 'success');
                })
                .catch(err => {
                    hideLoading();
                    console.error("Erro ao salvar no Firebase:", err);
                    showToast('Erro de conexão ao salvar cardápio no Firebase.', 'error');
                });
            } else {
                hideLoading();
                renderMenuManager();
                showToast('Cardápio restaurado localmente com sucesso!', 'success');
            }
        } catch (err) {
            console.error("Erro na leitura do JSON:", err);
            showToast('O arquivo selecionado não é um JSON válido.', 'error');
        } finally {
            fileInput.value = '';
        }
    };
    reader.readAsText(file);
}

/* ==========================================================================
   Centralized Automatic Background Backup System (Debounced & Full Recoverable Payload)
   ========================================================================== */
let centralAutoBackupTimer = null;

function triggerCentralAutoBackup() {
    if (centralAutoBackupTimer) clearTimeout(centralAutoBackupTimer);
    
    // 3000ms Debounce: Groups rapid user edits together before saving to DB
    centralAutoBackupTimer = setTimeout(() => {
        performCentralAutoBackgroundBackup();
    }, 3000);
}

function performCentralAutoBackgroundBackup() {
    try {
        if (!menuData) return;
        
        // Deep safe snapshot copy of all live orders
        const ordersSnapshot = (orders || []).map(order => ({
            id: order.id,
            timestamp: order.timestamp || Date.now(),
            date: order.date || '',
            time: order.time || '',
            clientName: order.clientName || '',
            clientPhone: order.clientPhone || '',
            checkoutType: order.checkoutType || 'delivery',
            address: order.address ? { ...order.address } : null,
            paymentMethod: order.paymentMethod || '',
            cashChange: order.cashChange || '',
            subtotal: order.subtotal || 0,
            deliveryFee: order.deliveryFee || 0,
            total: order.total || 0,
            status: order.status || 'Pendente',
            cart: Array.isArray(order.cart) ? order.cart.map(item => ({ ...item })) : []
        }));
        
        // Full recoverable data snapshot containing 100% of catalog, prices, borders, settings, fees, promo config AND complete orders
        const fullBackupSnapshot = {
            timestamp: new Date().toISOString(),
            menu_items: menuData.menu_items || {},
            pizza_prices: menuData.pizza_prices || {},
            borders: menuData.borders || {},
            settings: CONFIG_SETTINGS || {},
            deliveryFees: TAXAS_ENTREGA || {},
            promo_config: menuData.promo_config || {},
            orders: ordersSnapshot,
            orders_summary: {
                totalOrdersCount: ordersSnapshot.length,
                pendingCount: ordersSnapshot.filter(o => o.status === 'Pendente').length
            }
        };
        
        // 1. Save locally in localStorage (latest backup + history rotation of last 5 snapshots)
        const historyStr = localStorage.getItem('auto_backup_history');
        let history = [];
        if (historyStr) {
            try { history = JSON.parse(historyStr); } catch (e) {}
        }
        
        history.unshift(fullBackupSnapshot);
        if (history.length > 5) history = history.slice(0, 5);
        
        localStorage.setItem('auto_backup_latest', JSON.stringify(fullBackupSnapshot));
        localStorage.setItem('auto_backup_history', JSON.stringify(history));
        
        // 2. Safe write to Firebase Realtime Database at /backups/latest
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            firebase.database().ref('backups/latest').set(fullBackupSnapshot)
            .then(() => {
                console.log("Auto-backup centralizado completo (com catálogo e pedidos) gravado no Firebase.");
            })
            .catch(err => {
                console.warn("Aviso: Auto-backup Firebase em segundo plano adiado (offline):", err);
            });
        }
    } catch (e) {
        console.warn("Erro no auto-backup centralizado:", e);
    }
}



