/**
 * ==============================================================================
 * JC FOOD — MÓDULO DE AUTOATENDIMENTO / TOTEM
 * ==============================================================================
 * Gerenciador completo do Modo Totem / Tablet para atendimento presencial:
 * - ESTADO 1: Tela de espera fullscreen em loop (vídeos e imagens promocionais)
 * - ESTADO 2: Autoatendimento touch-friendly utilizando 100% do catálogo e motor atual
 * - Proteção de inatividade ("Você ainda está aí?")
 * - Reset seguro de sessão e privacidade do cliente
 * - Gravação atômica de pedidos com orderSource: 'totem'
 * - Tela de confirmação e senha com retorno automático
 * ==============================================================================
 */

(function (window, document) {
    'use strict';

    // Constantes e Configurações de Tempo
    const INACTIVITY_TIMEOUT_MS = 60000; // 60 segundos de inatividade para exibir aviso
    const INACTIVITY_WARNING_SEC = 15;   // 15 segundos de contagem regressiva
    const SUCCESS_AUTO_RETURN_SEC = 9;   // 9 segundos para retornar ao descanso pós pedido

    // Lista Padrão de Mídias Promocionais (Fallback de Alta Qualidade)
    const DEFAULT_TOTEM_MEDIA = [
        {
            id: 'promo-1',
            type: 'image',
            title: 'Pizzas Artesanais JC Food',
            description: 'Massa fina, bordas recheadas e os melhores ingredientes selecionados.',
            url: 'assets/gourmet_calabresa.png',
            fit: 'cover',
            duration: 8,
            active: true,
            order: 1
        },
        {
            id: 'promo-2',
            type: 'image',
            title: 'Pizzas Especiais & Nobres',
            description: 'Mais de 40 sabores tradicionais e especiais para você saborear.',
            url: 'assets/gourmet_margherita.png',
            fit: 'cover',
            duration: 8,
            active: true,
            order: 2
        },
        {
            id: 'promo-3',
            type: 'image',
            title: 'Quatro Queijos Nobres',
            description: 'A combinação perfeita de queijos artesanais derretidos no ponto.',
            url: 'assets/gourmet_quatro_queijos.png',
            fit: 'cover',
            duration: 8,
            active: true,
            order: 3
        },
        {
            id: 'promo-4',
            type: 'image',
            title: 'Sobremesas & Pizzas Doces',
            description: 'Finalize sua experiência com nossas irresistíveis pizzas doces artesanais.',
            url: 'assets/gourmet_doce_morango.png',
            fit: 'cover',
            duration: 8,
            active: true,
            order: 4
        }
    ];

    const TotemManager = {
        _isTotem: false,
        _currentState: 'idle', // 'idle' | 'ordering' | 'success'
        _mediaList: [],
        _currentMediaIndex: 0,
        _mediaSlideTimer: null,
        _inactivityTimer: null,
        _warningInterval: null,
        _successTimer: null,
        _isInitialized: false,

        /**
         * Detecta se o aplicativo deve rodar em Modo Autoatendimento
         */
        checkIsTotemMode: function () {
            try {
                const params = new URLSearchParams(window.location.search);
                const modo = (params.get('modo') || params.get('mode') || '').toLowerCase();
                const totem = (params.get('totem') || params.get('autoatendimento') || '').toLowerCase();

                if (modo === 'autoatendimento' || modo === 'totem' || totem === '1' || totem === 'true' || totem === 'sim') {
                    this._isTotem = true;
                    sessionStorage.setItem('totem_active_session', 'true');
                    return true;
                }

                if (sessionStorage.getItem('totem_active_session') === 'true') {
                    this._isTotem = true;
                    return true;
                }
            } catch (e) {
                console.warn('[TotemManager] Erro ao verificar parâmetros de URL:', e);
            }
            return false;
        },

        /**
         * Inicialização do Totem
         */
        init: function () {
            if (this._isInitialized) return;
            this._isInitialized = true;

            if (!this.checkIsTotemMode()) {
                console.log('[TotemManager] Modo convencional ativo (web/delivery).');
                return;
            }

            console.log('[TotemManager] 🔥 MODO AUTOATENDIMENTO / TOTEM ATIVADO!');
            document.body.classList.add('totem-mode');
            document.documentElement.classList.add('totem-mode');

            // Garante início com sessão completamente limpa
            this.resetTotemSession(false);

            // Carrega mídias promocionais e sincroniza com Firebase
            this.initMediaSync();

            // Configura escutas de toques e inatividade
            this.setupTouchInteractions();

            // Intercepta checkout específico para o totem
            this.setupTotemCheckoutHooks();

            // Abre o Estado 1: Tela de Espera
            this.enterIdleState();
        },

        /* ==========================================================================
           1. ESTADO 1: TELA DE ESPERA / PUBLICIDADE EM LOOP
           ========================================================================== */

        /**
         * Sincroniza lista de mídias promocionais (Firebase + Fallback)
         */
        initMediaSync: function () {
            const self = this;
            this._mediaList = [...DEFAULT_TOTEM_MEDIA];

            if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
                try {
                    const dbRef = (typeof TenantContext !== 'undefined' && TenantContext.ref)
                        ? TenantContext.ref('totemMedia')
                        : firebase.database().ref('totemMedia');

                    dbRef.on('value', (snapshot) => {
                        const val = snapshot.val();
                        if (val && typeof val === 'object') {
                            const list = Array.isArray(val) ? val : Object.values(val);
                            const active = list.filter(m => m && m.active !== false);
                            if (active.length > 0) {
                                active.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
                                self._mediaList = active;
                                console.log('[TotemManager] Mídias promocionais atualizadas do Firebase:', active.length);
                                if (self._currentState === 'idle') {
                                    self.renderCurrentMediaSlide();
                                }
                                return;
                            }
                        }
                        self._mediaList = [...DEFAULT_TOTEM_MEDIA];
                        if (self._currentState === 'idle') {
                            self.renderCurrentMediaSlide();
                        }
                    }, (err) => {
                        console.warn('[TotemManager] Falha ao ler totemMedia no Firebase:', err);
                        self._mediaList = [...DEFAULT_TOTEM_MEDIA];
                    });
                } catch (e) {
                    console.warn('[TotemManager] Erro no listener do Firebase:', e);
                }
            }
        },

        /**
         * Transiciona para a Tela de Espera / Publicidade (ESTADO 1)
         */
        enterIdleState: function () {
            this._currentState = 'idle';
            this.stopInactivityTimer();

            // Fecha modais e drawers
            this.closeAllModals();

            // Atualiza badge de itens do totem se houver
            this.updateHeaderCartCount();

            const idleScreen = document.getElementById('totemIdleScreen');
            if (idleScreen) {
                idleScreen.classList.add('active');
            }

            // Inicia reprodução das mídias em loop
            this._currentMediaIndex = 0;
            this.renderCurrentMediaSlide();
        },

        /**
         * Renderiza a mídia promocional atual (imagem ou vídeo)
         */
        renderCurrentMediaSlide: function () {
            if (this._currentState !== 'idle') return;
            if (this._mediaSlideTimer) {
                clearTimeout(this._mediaSlideTimer);
                this._mediaSlideTimer = null;
            }

            const stage = document.getElementById('totemMediaStage');
            const indicatorsContainer = document.getElementById('totemIdleIndicators');
            const captionTitle = document.getElementById('totemIdleCaptionTitle');
            const captionDesc = document.getElementById('totemIdleCaptionDesc');

            if (!stage || !this._mediaList || this._mediaList.length === 0) return;

            if (this._currentMediaIndex >= this._mediaList.length) {
                this._currentMediaIndex = 0;
            }

            const currentMedia = this._mediaList[this._currentMediaIndex];
            const isVideo = currentMedia.type === 'video' || (currentMedia.url && currentMedia.url.match(/\.(mp4|webm|mov)(\?.*)?$/i));

            // Atualiza Legendas
            if (captionTitle) captionTitle.textContent = currentMedia.title || 'JC Food';
            if (captionDesc) captionDesc.textContent = currentMedia.description || 'Toque na tela e faça seu pedido';

            // Atualiza Indicadores
            if (indicatorsContainer) {
                indicatorsContainer.innerHTML = '';
                this._mediaList.forEach((_, idx) => {
                    const dot = document.createElement('div');
                    dot.className = 'totem-indicator-dot' + (idx === this._currentMediaIndex ? ' active' : '');
                    indicatorsContainer.appendChild(dot);
                });
            }

            // Limpa elemento anterior suavemente
            stage.innerHTML = '';

            const self = this;
            const fitClass = currentMedia.fit === 'contain' ? 'contain' : 'cover';

            if (isVideo) {
                const videoEl = document.createElement('video');
                videoEl.className = `totem-slide-media visible ${fitClass}`;
                videoEl.src = currentMedia.url;
                videoEl.autoplay = true;
                videoEl.muted = true;
                videoEl.playsInline = true;
                videoEl.setAttribute('playsinline', '');
                videoEl.setAttribute('webkit-playsinline', '');
                videoEl.style.width = '100%';
                videoEl.style.height = '100%';

                // Quando o vídeo termina, passa para o próximo conteúdo automaticamente
                videoEl.onended = function () {
                    self.nextMediaSlide();
                };

                // Fallback de tempo máximo ou erro ao carregar vídeo
                videoEl.onerror = function () {
                    console.warn('[TotemManager] Erro ao reproduzir vídeo promocional:', currentMedia.url);
                    self._mediaSlideTimer = setTimeout(() => self.nextMediaSlide(), 2000);
                };

                // Limite de segurança de 30s caso o evento onended falhe
                this._mediaSlideTimer = setTimeout(() => {
                    self.nextMediaSlide();
                }, 30000);

                stage.appendChild(videoEl);
                videoEl.play().catch(() => {});
            } else {
                const imgEl = document.createElement('img');
                imgEl.className = `totem-slide-media ${fitClass}`;
                imgEl.src = currentMedia.url;
                imgEl.alt = currentMedia.title || 'Promoção JC Food';

                imgEl.onload = function () {
                    imgEl.classList.add('visible');
                };
                imgEl.onerror = function () {
                    imgEl.src = 'assets/pizza_hero.png';
                    imgEl.classList.add('visible');
                };

                stage.appendChild(imgEl);

                const durationSec = Math.max(4, Number(currentMedia.duration) || 8);
                this._mediaSlideTimer = setTimeout(() => {
                    self.nextMediaSlide();
                }, durationSec * 1000);
            }
        },

        /**
         * Avança para o próximo slide da publicidade
         */
        nextMediaSlide: function () {
            if (this._currentState !== 'idle') return;
            this._currentMediaIndex = (this._currentMediaIndex + 1) % this._mediaList.length;
            this.renderCurrentMediaSlide();
        },

        /* ==========================================================================
           2. ENTRADA NO AUTOATENDIMENTO (ESTADO 2)
           ========================================================================== */

        /**
         * Transiciona da Tela de Espera para o Cardápio
         */
        startOrdering: function () {
            if (this._currentState === 'ordering') return;
            console.log('[TotemManager] 🚀 Cliente tocou na tela. Iniciando autoatendimento...');

            // Interrompe timers da publicidade
            if (this._mediaSlideTimer) {
                clearTimeout(this._mediaSlideTimer);
                this._mediaSlideTimer = null;
            }

            // Tenta ativar modo fullscreen
            this.requestFullscreenSafe();

            // Esconde tela de espera com transição
            const idleScreen = document.getElementById('totemIdleScreen');
            if (idleScreen) {
                idleScreen.classList.remove('active');
            }

            this._currentState = 'ordering';

            // Inicia monitor de inatividade
            this.resetInactivityTimer();

            // Rola suavemente para o topo do cardápio
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },

        /**
         * Solicita tela cheia de forma segura sem quebrar o navegador
         */
        requestFullscreenSafe: function () {
            try {
                const elem = document.documentElement;
                if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                    if (elem.requestFullscreen) {
                        elem.requestFullscreen().catch(() => {});
                    } else if (elem.webkitRequestFullscreen) {
                        elem.webkitRequestFullscreen();
                    }
                }
            } catch (e) {
                // Silencioso se o browser bloquear
            }
        },

        /* ==========================================================================
           3. MONITOR DE INATIVIDADE & PROTEÇÃO ("Você ainda está aí?")
           ========================================================================== */

        setupTouchInteractions: function () {
            const self = this;
            const userActivityEvents = ['touchstart', 'pointerdown', 'click', 'scroll', 'keydown'];

            userActivityEvents.forEach(evt => {
                document.addEventListener(evt, () => {
                    if (self._currentState === 'ordering') {
                        self.resetInactivityTimer();
                    }
                }, { passive: true });
            });
        },

        resetInactivityTimer: function () {
            if (this._currentState !== 'ordering') return;

            // Se o modal de aviso estiver aberto e o usuário tocou fora, fecha o aviso
            this.closeInactivityModal();

            if (this._inactivityTimer) clearTimeout(this._inactivityTimer);

            const self = this;
            this._inactivityTimer = setTimeout(() => {
                self.showInactivityWarning();
            }, INACTIVITY_TIMEOUT_MS);
        },

        stopInactivityTimer: function () {
            if (this._inactivityTimer) {
                clearTimeout(this._inactivityTimer);
                this._inactivityTimer = null;
            }
            if (this._warningInterval) {
                clearInterval(this._warningInterval);
                this._warningInterval = null;
            }
            this.closeInactivityModal();
        },

        showInactivityWarning: function () {
            if (this._currentState !== 'ordering') return;

            const modal = document.getElementById('totemInactivityModal');
            const countdownEl = document.getElementById('totemInactivityCountdown');
            if (!modal) return;

            let remaining = INACTIVITY_WARNING_SEC;
            if (countdownEl) countdownEl.textContent = remaining;
            modal.classList.add('active');

            const self = this;
            if (this._warningInterval) clearInterval(this._warningInterval);

            this._warningInterval = setInterval(() => {
                remaining--;
                if (countdownEl) countdownEl.textContent = remaining;

                if (remaining <= 0) {
                    clearInterval(self._warningInterval);
                    self._warningInterval = null;
                    console.log('[TotemManager] ⏱️ Timeout expirado! Reiniciando sessão do Totem...');
                    self.resetTotemSession(true);
                }
            }, 1000);
        },

        closeInactivityModal: function () {
            if (this._warningInterval) {
                clearInterval(this._warningInterval);
                this._warningInterval = null;
            }
            const modal = document.getElementById('totemInactivityModal');
            if (modal) modal.classList.remove('active');
        },

        /* ==========================================================================
           4. RESET DE SESSÃO & PRIVACIDADE DO CLIENTE
           ========================================================================== */

        /**
         * Limpa todo o estado do cliente anterior e garante privacidade total
         * @param {boolean} returnToIdle - Se deve voltar imediatamente ao Estado 1
         */
        resetTotemSession: function (returnToIdle) {
            console.log('[TotemManager] 🧹 Limpando dados da sessão temporária do totem...');

            // 1. Zera carrinho global
            if (typeof window.cart !== 'undefined') {
                window.cart = [];
            }
            try {
                localStorage.removeItem('jc_food_cart');
                sessionStorage.removeItem('jc_food_cart');
            } catch (e) {}

            // Atualiza UI do carrinho existente
            if (typeof updateCartUI === 'function') {
                updateCartUI();
            }

            // 2. Limpa sessões de autenticação de cliente
            if (typeof CustomerAuth !== 'undefined' && typeof CustomerAuth.clearSession === 'function') {
                CustomerAuth.clearSession();
            }

            // 3. Limpa campos do formulário de checkout
            const fieldsToClear = ['clientName', 'clientPhone', 'totemTableInput', 'pizzaCustomNotes', 'itemCustomNotes', 'cashChange'];
            fieldsToClear.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });

            // 4. Reseta estado do configurador de pizza existente
            if (typeof currentConfiguredProduct !== 'undefined') window.currentConfiguredProduct = null;
            if (typeof currentConfiguredSelections !== 'undefined') window.currentConfiguredSelections = {};
            if (typeof currentConfiguredQuantity !== 'undefined') window.currentConfiguredQuantity = 1;

            // 5. Fecha todos os modais abertos
            this.closeAllModals();

            // 6. Atualiza contador do topo
            this.updateHeaderCartCount();

            // 7. Retorna à tela promocional se solicitado
            if (returnToIdle !== false) {
                this.enterIdleState();
            }
        },

        closeAllModals: function () {
            this.closeInactivityModal();

            const confirmModal = document.getElementById('totemConfirmModal');
            if (confirmModal) confirmModal.classList.remove('active');

            const successModal = document.getElementById('totemSuccessModal');
            if (successModal) successModal.classList.remove('active');

            if (typeof toggleCart === 'function') toggleCart(false);
            if (typeof closeCheckoutModal === 'function') closeCheckoutModal();
            if (typeof closePizzaCustomizer === 'function') closePizzaCustomizer();
            if (typeof closeProductCustomizer === 'function') closeProductCustomizer();
        },

        /* ==========================================================================
           5. BOTÃO "VOLTAR AO INÍCIO" & PROTEÇÃO CONTRA TOQUES ACIDENTAIS
           ========================================================================== */

        handleHomeButtonTouch: function () {
            const hasItemsInCart = Array.isArray(window.cart) && window.cart.length > 0;
            const isCustomizerOpen = document.getElementById('pizzaCustomizerModal')?.classList.contains('active');

            if (hasItemsInCart || isCustomizerOpen) {
                // Solicita confirmação touch amigável
                const confirmModal = document.getElementById('totemConfirmModal');
                if (confirmModal) confirmModal.classList.add('active');
            } else {
                // Nenhum item em risco, volta imediatamente
                this.resetTotemSession(true);
            }
        },

        confirmCancelOrder: function () {
            const confirmModal = document.getElementById('totemConfirmModal');
            if (confirmModal) confirmModal.classList.remove('active');
            this.resetTotemSession(true);
        },

        cancelCancelOrder: function () {
            const confirmModal = document.getElementById('totemConfirmModal');
            if (confirmModal) confirmModal.classList.remove('active');
            this.resetInactivityTimer();
        },

        /* ==========================================================================
           6. CHECKOUT ADAPTADO DO TOTEM & GRAVAÇÃO COM IDENTIFICAÇÃO DE ORIGEM
           ========================================================================== */

        setupTotemCheckoutHooks: function () {
            const self = this;

            // Ajusta rótulos e campos do checkout ao abrir modal
            const originalOpenCheckout = window.openCheckoutModal;
            if (typeof originalOpenCheckout === 'function') {
                window.openCheckoutModal = function () {
                    originalOpenCheckout();
                    if (self._isTotem) {
                        self.adaptCheckoutUIForTotem();
                    }
                };
            }

            // Intercepta submitOrder para tratar finalização específica do Totem
            const originalSubmitOrder = window.submitOrder;
            if (typeof originalSubmitOrder === 'function') {
                window.submitOrder = function () {
                    if (self._isTotem) {
                        self.submitTotemOrder();
                    } else {
                        originalSubmitOrder();
                    }
                };
            }
        },

        adaptCheckoutUIForTotem: function () {
            // Oculta abas desnecessárias de delivery externo e foca em Balcão ou Mesa
            const delTab = document.getElementById('deliveryTab');
            const pickTab = document.getElementById('pickupTab');
            const addrSec = document.getElementById('addressSection');

            if (delTab) {
                delTab.innerHTML = '<span class="material-symbols-rounded">table_restaurant</span><span>Comer no Local</span>';
            }
            if (pickTab) {
                pickTab.innerHTML = '<span class="material-symbols-rounded">shopping_bag</span><span>Para Viagem (Balcão)</span>';
            }
            if (addrSec) {
                addrSec.style.display = 'none';
            }

            const nameInput = document.getElementById('clientName');
            const phoneInput = document.getElementById('clientPhone');
            if (nameInput) nameInput.placeholder = 'Como podemos te chamar? Ex: Lucas';
            if (phoneInput) phoneInput.placeholder = 'WhatsApp com DDD (Opcional)';

            // Força modalidade adequada para totem
            if (typeof setCheckoutType === 'function') {
                setCheckoutType('pickup');
            }
        },

        /**
         * Finalização e gravação de pedido realizado no Totem
         */
        submitTotemOrder: function () {
            if (!window.cart || window.cart.length === 0) {
                if (typeof showToast === 'function') showToast('Seu carrinho está vazio!', 'warning');
                return;
            }

            const nameInput = document.getElementById('clientName');
            const phoneInput = document.getElementById('clientPhone');
            const tableInput = document.getElementById('totemTableInput');

            let clientName = nameInput ? nameInput.value.trim() : '';
            if (!clientName) clientName = 'Cliente Totem';

            let clientPhone = phoneInput ? phoneInput.value.trim() : '';
            let tableNumber = tableInput ? tableInput.value.trim() : '';

            const paymentMethod = document.querySelector('input[name="payment-method"]:checked')?.value || 'pix';
            const cashChange = document.getElementById('cashChange')?.value.trim() || '';

            let subtotal = 0;
            window.cart.forEach(i => subtotal += (Number(i.totalPrice) || 0));
            const total = subtotal;

            const orderId = Date.now();
            const orderShortCode = String(orderId).slice(-4);
            const now = new Date();
            const timeFormatted = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const dateFormatted = now.toLocaleDateString('pt-BR');

            // Determina modalidade presencial
            const isLocal = typeof checkoutType !== 'undefined' && checkoutType === 'delivery'; // no totem, a 1ª aba representa consumo local
            const totemModality = isLocal ? 'Consumo no Local (Mesa)' : 'Retirada no Balcão';

            const orderData = {
                id: orderId,
                shortCode: orderShortCode,
                orderSource: 'totem',
                source: 'self-service',
                origin: 'Totem',
                origem: 'Totem',
                canalOrigem: 'totem',
                isTotem: true,
                customerId: clientPhone ? clientPhone.replace(/\D/g, '') : `totem_${orderId}`,
                customerName: clientName,
                customerPhone: clientPhone || 'Totem Presencial',
                clientName: clientName,
                clientPhone: clientPhone || 'Totem Presencial',
                checkoutType: isLocal ? 'mesa' : 'pickup',
                table: tableNumber || (isLocal ? 'Mesa' : null),
                mesa: tableNumber || (isLocal ? 'Mesa' : null),
                modality: totemModality,
                cart: [...window.cart],
                subtotal: subtotal,
                deliveryFee: 0,
                total: total,
                paymentMethod: paymentMethod,
                cashChange: cashChange,
                status: 'Pendente',
                timestamp: orderId,
                time: timeFormatted,
                date: dateFormatted
            };

            const self = this;
            if (typeof showGlobalLoading === 'function') {
                showGlobalLoading('Enviando seu pedido para a cozinha...');
            }

            function onOrderSavedSuccess() {
                if (typeof hideGlobalLoading === 'function') hideGlobalLoading();
                if (typeof closeCheckoutModal === 'function') closeCheckoutModal();

                // Exibe a tela de confirmação de sucesso
                self.showOrderSuccess(orderData);
            }

            if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
                try {
                    const orderRef = (typeof TenantContext !== 'undefined' && TenantContext.ref)
                        ? TenantContext.ref('orders/' + orderId)
                        : firebase.database().ref('orders/' + orderId);

                    orderRef.set(orderData)
                        .then(() => onOrderSavedSuccess())
                        .catch((err) => {
                            console.warn('[TotemManager] Falha ao gravar pedido no Firebase:', err);
                            onOrderSavedSuccess();
                        });
                } catch (e) {
                    console.warn('[TotemManager] Exceção ao gravar pedido:', e);
                    onOrderSavedSuccess();
                }
            } else {
                onOrderSavedSuccess();
            }
        },

        /* ==========================================================================
           7. TELA DE SUCESSO & RETORNO AUTOMÁTICO AO ESTADO 1
           ========================================================================== */

        showOrderSuccess: function (order) {
            this._currentState = 'success';
            this.stopInactivityTimer();

            const successModal = document.getElementById('totemSuccessModal');
            const orderNumEl = document.getElementById('totemSuccessOrderNumber');
            const returnCountdownEl = document.getElementById('totemSuccessCountdown');
            const metaEl = document.getElementById('totemSuccessMeta');

            if (orderNumEl) {
                orderNumEl.textContent = '#' + (order.shortCode || String(order.id).slice(-4));
            }

            if (metaEl) {
                const modoTxt = order.checkoutType === 'mesa'
                    ? (order.table ? `🍽️ Mesa: ${order.table}` : '🍽️ Consumo no Local')
                    : '🛍️ Retirada no Balcão';
                metaEl.textContent = `${modoTxt} • Cliente: ${order.clientName}`;
            }

            if (successModal) {
                successModal.classList.add('active');
            }

            // Inicia contagem regressiva para voltar ao descanso
            let remaining = SUCCESS_AUTO_RETURN_SEC;
            if (returnCountdownEl) returnCountdownEl.textContent = remaining;

            const self = this;
            if (this._successTimer) clearInterval(this._successTimer);

            this._successTimer = setInterval(() => {
                remaining--;
                if (returnCountdownEl) returnCountdownEl.textContent = remaining;

                if (remaining <= 0) {
                    clearInterval(self._successTimer);
                    self._successTimer = null;
                    self.resetTotemSession(true);
                }
            }, 1000);
        },

        finishOrderImmediately: function () {
            if (this._successTimer) {
                clearInterval(this._successTimer);
                this._successTimer = null;
            }
            this.resetTotemSession(true);
        },

        updateHeaderCartCount: function () {
            const countEl = document.getElementById('totemHeaderCartCount');
            if (!countEl) return;
            const itemsCount = (Array.isArray(window.cart))
                ? window.cart.reduce((acc, item) => acc + (Number(item.quantity) || 1), 0)
                : 0;
            countEl.textContent = itemsCount;
        }
    };

    // Exportação Global
    window.TotemManager = TotemManager;

    // Inicialização automática após carregamento do DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => TotemManager.init());
    } else {
        TotemManager.init();
    }

})(typeof window !== 'undefined' ? window : this, document);
