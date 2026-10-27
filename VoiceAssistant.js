/**
 * ==============================================================================
 * JC FOOD — VOICE ASSISTANT WITH AI (VoiceAssistant.js)
 * ==============================================================================
 * Módulo oficial de Atendimento por Voz com Inteligência Artificial para o JC Food.
 * 
 * ARQUITETURA E RESPONSABILIDADES:
 * 1. Captura e Reconhecimento de Fala (Web Speech API em pt-BR com fallback de texto)
 * 2. Síntese de Voz (SpeechSynthesis em pt-BR com controle de interrupção)
 * 3. NLU / Interpretação de Intenções e Entidades em Português Brasileiro
 * 4. Suporte Completo a Todo o Cardápio (Pizzas, Hambúrgueres/Lanches, Calzones, Bebidas)
 * 5. Máquina de Estados Conversacional Inteligente com Guias de Opções
 * 6. Integração com o Catálogo Real (sharedOptionGroups, menu_items) e Isolamento Multiempresa
 * 7. Integração com o Motor Oficial de Pizzas (PizzaEngine.js)
 * 8. Integração Oficial com o Carrinho e Checkout (app.js)
 * 9. Segurança estrita (sem chamadas arbitrárias ao banco, validação de preços)
 * ==============================================================================
 */

(function (window) {
    'use strict';

    // Utilitário para remoção de acentos e normalização de texto
    function normalizeText(str) {
        if (!str || typeof str !== 'string') return '';
        return str
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Utilitário monetário compatível
    function formatMoney(value) {
        const num = Number(value) || 0;
        return 'R$ ' + num.toFixed(2).replace('.', ',');
    }

    const VoiceAssistant = {
        version: '1.2.0',
        activeTenant: null,
        isOpen: false,
        isListening: false,
        isSpeaking: false,
        speechSupported: false,
        recognition: null,
        activeUtterance: null,
        
        // Estado Conversacional da Sessão
        conversationState: {
            step: 'IDLE', // IDLE, GREETING, CHOOSING_BURGER, CHOOSING_CALZONE, BUILDING_PIZZA_SIZE, BUILDING_PIZZA_FLAVORS, ASKING_BORDER, ASKING_BEVERAGE, REVIEW_CART
            pendingPizza: {
                sizeId: null,
                sizeObj: null,
                flavors: [],
                borderObj: null,
                quantity: 1,
                notes: ''
            },
            history: []
        },

        // Configurações do Assistente por Empresa (com fallbacks)
        settings: {
            enabled: true,
            assistantName: 'Assistente JC',
            greeting: 'Olá! Sou o assistente de voz do JC Food. Posso anotar seu pedido! Temos pizzas, hambúrgueres com fritas, calzones e bebidas. O que você gostaria de pedir hoje?',
            voiceRate: 1.05,
            voicePitch: 1.0,
            autoListen: true
        },

        /**
         * Inicialização do módulo de voz
         */
        getCompanyId: function () {
            if (this.activeTenant) return this.activeTenant;
            if (typeof TenantContext !== 'undefined' && typeof TenantContext.getCompanyId === 'function') {
                this.activeTenant = TenantContext.getCompanyId();
            }
            if (!this.activeTenant) this.activeTenant = 'jc-food';
            return this.activeTenant;
        },

        init: function () {
            this.activeTenant = this.getCompanyId();

            this.loadSettings();
            this.setupSpeechRecognition();
            this.renderUI();
            this.attachEventListeners();

            // Monitora mudança de tenant
            if (typeof TenantContext !== 'undefined' && typeof TenantContext.onCompanyChange === 'function') {
                TenantContext.onCompanyChange((newTenantId) => {
                    this.activeTenant = newTenantId;
                    this.loadSettings();
                    this.resetConversation();
                });
            }

            console.log('[VoiceAssistant] Módulo inicializado com sucesso para o tenant:', this.activeTenant);
        },

        /**
         * Carrega configurações específicas do tenant ativo
         */
        loadSettings: function () {
            try {
                const menu = (typeof menuData !== 'undefined' && menuData) ? menuData : null;
                const vConf = menu?.settings?.voiceAssistant || {};
                const compName = menu?.settings?.companyName || 'JC Food';

                this.settings.enabled = vConf.enabled !== false;
                this.settings.assistantName = vConf.assistantName || 'Assistente JC';
                this.settings.greeting = (vConf.greeting || 'Olá! Sou o assistente de voz do {companyName}. Posso anotar seu pedido! Temos pizzas, hambúrgueres com fritas, calzones e bebidas. O que você gostaria de pedir hoje?')
                    .replace('{companyName}', compName);
                this.settings.voiceRate = parseFloat(vConf.voiceRate) || 1.05;
                this.settings.voicePitch = parseFloat(vConf.voicePitch) || 1.0;
                this.settings.autoListen = vConf.autoListen !== false;

                // Atualiza visibilidade dos botões conforme configuração
                const floatBtn = document.getElementById('jcVoiceFloatBtn');
                if (floatBtn) {
                    floatBtn.style.display = this.settings.enabled ? 'flex' : 'none';
                }
                const heroBtn = document.getElementById('jcVoiceHeroBtn');
                if (heroBtn) {
                    heroBtn.style.display = this.settings.enabled ? 'inline-flex' : 'none';
                }
            } catch (e) {
                console.warn('[VoiceAssistant] Erro ao carregar configurações de voz:', e);
            }
        },

        /**
         * Configura a Web Speech API para reconhecimento em pt-BR
         */
        setupSpeechRecognition: function () {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                console.warn('[VoiceAssistant] Web Speech API de reconhecimento não suportada neste navegador.');
                this.speechSupported = false;
                return;
            }

            this.speechSupported = true;
            try {
                this.recognition = new SpeechRecognition();
                this.recognition.lang = 'pt-BR';
                this.recognition.continuous = false;
                this.recognition.interimResults = false;
                this.recognition.maxAlternatives = 1;

                this.recognition.onstart = () => {
                    this.isListening = true;
                    this.updateUIStatus('Ouvindo você...', 'listening');
                };

                this.recognition.onresult = (event) => {
                    this.isListening = false;
                    const transcript = event.results[0][0].transcript;
                    console.log('[VoiceAssistant] Fala capturada:', transcript);
                    this.handleUserInput(transcript);
                };

                this.recognition.onerror = (event) => {
                    this.isListening = false;
                    console.warn('[VoiceAssistant] Erro no reconhecimento de voz:', event.error);
                    
                    if (event.error === 'not-allowed') {
                        this.updateUIStatus('Microfone bloqueado. Digite abaixo ou libere nas permissões.', 'error');
                        this.addBotMessage('Não consegui acessar seu microfone. Você pode digitar sua mensagem no campo abaixo!');
                    } else if (event.error === 'no-speech') {
                        this.updateUIStatus('Nenhuma fala detectada. Toque no microfone para tentar de novo.', 'idle');
                    } else {
                        this.updateUIStatus('Pronto para ouvir', 'idle');
                    }
                };

                this.recognition.onend = () => {
                    this.isListening = false;
                    if (!this.isSpeaking && this.isOpen) {
                        this.updateUIStatus('Toque no microfone para falar', 'idle');
                    }
                };
            } catch (err) {
                console.error('[VoiceAssistant] Falha ao instanciar SpeechRecognition:', err);
                this.speechSupported = false;
            }
        },

        /**
         * Inicia a captura de fala
         */
        startListening: function () {
            if (!this.speechSupported || !this.recognition) {
                this.updateUIStatus('Reconhecimento por voz não suportado neste navegador. Digite abaixo!', 'idle');
                const textInput = document.getElementById('voiceTextInput');
                if (textInput) textInput.focus();
                return;
            }

            this.stopSpeaking();

            try {
                this.recognition.start();
            } catch (e) {
                try {
                    this.recognition.stop();
                    setTimeout(() => {
                        try { this.recognition.start(); } catch (err) {}
                    }, 200);
                } catch (err) {}
            }
        },

        /**
         * Para a captura de fala
         */
        stopListening: function () {
            if (this.recognition && this.isListening) {
                try { this.recognition.stop(); } catch (e) {}
            }
            this.isListening = false;
            this.updateUIStatus('Toque no microfone para falar', 'idle');
        },

        /**
         * Síntese de voz: fala a resposta do bot em voz alta
         */
        speak: function (text, onEndCallback) {
            if (!('speechSynthesis' in window)) {
                if (typeof onEndCallback === 'function') onEndCallback();
                return;
            }

            this.stopSpeaking();
            this.stopListening();

            const cleanText = text
                .replace(/\*+/g, '')
                .replace(/<[^>]*>/g, '')
                .replace(/R\$\s*(\d+)[,.](\d{2})/g, '$1 reais e $2 centavos')
                .replace(/R\$\s*(\d+)/g, '$1 reais');

            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.lang = 'pt-BR';
            utterance.rate = this.settings.voiceRate || 1.05;
            utterance.pitch = this.settings.voicePitch || 1.0;

            const voices = window.speechSynthesis.getVoices();
            const ptVoice = voices.find(v => v.lang === 'pt-BR' && (v.name.includes('Google') || v.name.includes('Luciana') || v.name.includes('Maria') || v.name.includes('Natural') || v.name.includes('Yara')));
            if (ptVoice) {
                utterance.voice = ptVoice;
            }

            utterance.onstart = () => {
                this.isSpeaking = true;
                this.activeUtterance = utterance;
                this.updateUIStatus(`${this.settings.assistantName} falando...`, 'speaking');
            };

            utterance.onend = () => {
                this.isSpeaking = false;
                this.activeUtterance = null;
                this.updateUIStatus('Toque no microfone para falar', 'idle');

                if (typeof onEndCallback === 'function') {
                    onEndCallback();
                } else if (this.settings.autoListen && this.isOpen) {
                    setTimeout(() => {
                        if (this.isOpen && !this.isSpeaking && !this.isListening) {
                            this.startListening();
                        }
                    }, 350);
                }
            };

            utterance.onerror = (e) => {
                this.isSpeaking = false;
                this.activeUtterance = null;
                this.updateUIStatus('Toque no microfone para falar', 'idle');
                if (typeof onEndCallback === 'function') onEndCallback();
            };

            window.speechSynthesis.speak(utterance);
        },

        /**
         * Interrompe qualquer reprodução de áudio imediatamente
         */
        stopSpeaking: function () {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
            this.isSpeaking = false;
            this.activeUtterance = null;
        },

        /**
         * Abre a interface modal do assistente
         */
        open: function () {
            this.loadSettings();
            if (!this.settings.enabled) {
                if (typeof showToast === 'function') {
                    showToast('O atendimento por voz está desativado no momento.', 'info');
                }
                return;
            }

            this.isOpen = true;
            const modal = document.getElementById('jcVoiceModalBackdrop');
            if (modal) {
                modal.classList.add('active');
            }

            if (this.conversationState.history.length === 0) {
                this.addBotMessage(this.settings.greeting, null, ['Quero um Hambúrguer', 'Quero uma Pizza', 'Ver Calzones', 'Ver Cardápio']);
                this.speak(this.settings.greeting);
            } else {
                this.updateUIStatus('Toque no microfone para falar', 'idle');
            }

            this.updateCartFooterUI();
        },

        /**
         * Fecha a interface modal do assistente
         */
        close: function () {
            this.isOpen = false;
            this.stopListening();
            this.stopSpeaking();
            const modal = document.getElementById('jcVoiceModalBackdrop');
            if (modal) {
                modal.classList.remove('active');
            }
        },

        /**
         * Alterna estado aberto/fechado
         */
        toggle: function () {
            if (this.isOpen) this.close();
            else this.open();
        },

        /**
         * Reinicia o estado da conversa
         */
        resetConversation: function () {
            this.conversationState = {
                step: 'IDLE',
                pendingPizza: {
                    sizeId: null,
                    sizeObj: null,
                    flavors: [],
                    borderObj: null,
                    quantity: 1,
                    notes: ''
                },
                history: []
            };

            const chat = document.getElementById('voiceChatMessages');
            if (chat) {
                chat.innerHTML = '';
            }
            this.updateCartFooterUI();
        },

        /**
         * Atualiza o indicador de status visual da UI
         */
        updateUIStatus: function (statusText, mode) {
            const label = document.getElementById('voiceStatusText');
            const dot = document.getElementById('voiceStatusDot');
            const waves = document.getElementById('voiceWaveContainer');
            const mainMic = document.getElementById('voiceMainMicBtn');

            if (label) label.innerText = statusText;

            if (dot) {
                dot.className = 'voice-status-dot';
                if (mode === 'listening') dot.classList.add('listening');
                if (mode === 'speaking') dot.classList.add('speaking');
            }

            if (waves) {
                if (mode === 'listening' || mode === 'speaking') {
                    waves.classList.add('active');
                } else {
                    waves.classList.remove('active');
                }
            }

            if (mainMic) {
                if (mode === 'listening') mainMic.classList.add('listening');
                else mainMic.classList.remove('listening');
            }
        },

        /**
         * Adiciona mensagem do usuário no chat
         */
        addUserMessage: function (text) {
            const chat = document.getElementById('voiceChatMessages');
            if (!chat) return;

            const msgDiv = document.createElement('div');
            msgDiv.className = 'voice-msg user';
            msgDiv.innerHTML = `
                <div class="voice-msg-avatar">
                    <span class="material-symbols-rounded">person</span>
                </div>
                <div class="voice-msg-bubble">${this.escapeHTML(text)}</div>
            `;
            chat.appendChild(msgDiv);
            chat.scrollTop = chat.scrollHeight;

            this.conversationState.history.push({ sender: 'user', text: text });
        },

        /**
         * Adiciona mensagem do bot no chat com suporte a cards e sugestões
         */
        addBotMessage: function (text, itemCardData, quickChips) {
            const chat = document.getElementById('voiceChatMessages');
            if (!chat) return;

            const msgDiv = document.createElement('div');
            msgDiv.className = 'voice-msg bot';

            let cardHTML = '';
            if (itemCardData) {
                cardHTML = `
                    <div class="voice-item-card">
                        <div class="voice-item-card-title">
                            <span>${this.escapeHTML(itemCardData.title)}</span>
                            <span class="material-symbols-rounded" style="color: var(--primary); font-size: 18px;">${itemCardData.icon || 'fastfood'}</span>
                        </div>
                        <div class="voice-item-card-desc">${this.escapeHTML(itemCardData.desc || '')}</div>
                        <div class="voice-item-card-price">${itemCardData.priceFormatted || ''}</div>
                    </div>
                `;
            }

            let chipsHTML = '';
            if (quickChips && Array.isArray(quickChips) && quickChips.length > 0) {
                chipsHTML = '<div class="voice-chips-container">' +
                    quickChips.map(chip => `<button type="button" class="voice-chip" onclick="VoiceAssistant.handleChipClick('${this.escapeHTML(chip)}')">${this.escapeHTML(chip)}</button>`).join('') +
                    '</div>';
            }

            msgDiv.innerHTML = `
                <div class="voice-msg-avatar">
                    <span class="material-symbols-rounded">smart_toy</span>
                </div>
                <div>
                    <div class="voice-msg-bubble">${this.formatMarkdown(text)}</div>
                    ${cardHTML}
                    ${chipsHTML}
                </div>
            `;

            chat.appendChild(msgDiv);
            chat.scrollTop = chat.scrollHeight;

            this.conversationState.history.push({ sender: 'bot', text: text });
            this.updateCartFooterUI();
        },

        /**
         * Clique em sugestão rápida (Chip)
         */
        handleChipClick: function (text) {
            this.handleUserInput(text);
        },

        /**
         * Envia mensagem do campo de texto manual
         */
        sendTextMessage: function () {
            const input = document.getElementById('voiceTextInput');
            if (!input) return;
            const text = input.value.trim();
            if (!text) return;
            input.value = '';
            this.handleUserInput(text);
        },

        /**
         * Processamento central de texto do cliente (NLU & State Machine)
         */
        handleUserInput: function (rawText) {
            if (!rawText || !rawText.trim()) return;

            const text = rawText.trim();
            this.addUserMessage(text);

            const norm = normalizeText(text);

            // 1. Comando direto: Cancelar / Limpar / Parar
            if (norm.includes('cancelar tudo') || norm.includes('limpar carrinho') || norm.includes('esvaziar carrinho')) {
                this.handleClearCartIntent();
                return;
            }

            // 2. Comando direto: Ver Carrinho / Resumo / Total
            if (norm.includes('quanto deu') || norm.includes('ver carrinho') || norm.includes('meu pedido') || norm.includes('ver pedido') || norm === 'total') {
                this.handleReviewCartIntent();
                return;
            }

            // 3. Comando direto: Finalizar Pedido / Checkout
            if (norm.includes('finalizar') || norm.includes('fechar pedido') || norm.includes('quero pagar') || norm.includes('concluir') || norm.includes('checkout')) {
                this.handleCheckoutIntent();
                return;
            }

            // 4. Fluxo guiado baseado no estado atual da máquina de conversação
            switch (this.conversationState.step) {
                case 'CHOOSING_BURGER':
                    this.handleStepChoosingBurger(norm, text);
                    return;

                case 'CHOOSING_CALZONE':
                    this.handleStepChoosingCalzone(norm, text);
                    return;

                case 'BUILDING_PIZZA_SIZE':
                    this.handleStepPizzaSize(norm, text);
                    return;

                case 'BUILDING_PIZZA_FLAVORS':
                    this.handleStepPizzaFlavors(norm, text);
                    return;

                case 'ASKING_BORDER':
                    this.handleStepBorder(norm, text);
                    return;

                case 'ASKING_BEVERAGE':
                    this.handleStepBeverage(norm, text);
                    return;
            }

            // 5. NLU Geral: Detecta com prioridade hambúrgueres, calzones, pizzas, bebidas e consultas
            this.interpretGeneralIntent(norm, text);
        },

        /**
         * Interpretador Geral de Intenções (NLU com Priorização de Categorias)
         */
        interpretGeneralIntent: function (norm, text) {
            const catalog = this.getCatalogData();

            // =========================================================================
            // PRIORIDADE 1: HAMBÚRGUERES & LANCHES
            // Se o usuário falou hambúrguer, burguer, lanche, sanduíche, x-frango, etc.
            // =========================================================================
            const isBurgerQuery = norm.includes('hamburguer') || norm.includes('burguer') || norm.includes('burger') || norm.includes('lanche') || norm.includes('sanduiche') || norm.includes('x frango') || norm.includes('x-frango');
            
            if (isBurgerQuery) {
                const detectedBurgers = this.detectBurgersInText(norm, catalog);
                if (detectedBurgers.length > 0) {
                    this.addGeneralProductsToCart(detectedBurgers);
                    return;
                }
                // Se não especificou o hambúrguer, apresenta as opções de lanche
                this.handleBurgerInquiry(norm);
                return;
            }

            // =========================================================================
            // PRIORIDADE 2: CALZONES
            // Se o usuário falou calzone, calzones, calzone de costela, etc.
            // =========================================================================
            const isCalzoneQuery = norm.includes('calzone') || norm.includes('calzones');
            if (isCalzoneQuery) {
                const detectedCalzones = this.detectCalzonesInText(norm, catalog);
                if (detectedCalzones.length > 0) {
                    this.addGeneralProductsToCart(detectedCalzones);
                    return;
                }
                // Se não especificou o sabor de calzone, apresenta os calzones
                this.handleCalzoneInquiry(norm);
                return;
            }

            // =========================================================================
            // PRIORIDADE 3: BEBIDAS
            // Se o usuário pediu bebidas específicas ou consultou opções para beber
            // =========================================================================
            const identifiedBeverages = this.detectBeveragesInText(norm, catalog);
            if (identifiedBeverages.length > 0) {
                this.addBeveragesToCart(identifiedBeverages);
                return;
            }
            if (norm.includes('bebida') || norm.includes('refrigerante') || norm.includes('cerveja') || norm.includes('suco') || norm.includes('o que tem pra beber') || norm.includes('o que tem de beber')) {
                this.handleBeverageInquiry(norm);
                return;
            }

            // =========================================================================
            // PRIORIDADE 4: PRODUTOS GERAIS
            // =========================================================================
            const identifiedProducts = this.detectGeneralProductsInText(norm, catalog);
            if (identifiedProducts.length > 0) {
                this.addGeneralProductsToCart(identifiedProducts);
                return;
            }

            // =========================================================================
            // PRIORIDADE 5: PIZZAS (SABORES OU TAMANHOS)
            // =========================================================================
            const identifiedSize = this.detectSizeInText(norm, catalog);
            const identifiedFlavors = this.detectFlavorsInText(norm, catalog);

            if (norm.includes('pizza') || identifiedFlavors.length > 0 || (identifiedSize && !identifiedBeverages.length)) {
                this.startPizzaOrderFlow(identifiedSize, identifiedFlavors, norm);
                return;
            }

            // =========================================================================
            // PRIORIDADE 6: CONSULTA GERAL DE CARDÁPIO / AJUDA
            // =========================================================================
            if (norm.includes('cardapio') || norm.includes('sabores') || norm.includes('quais') || norm.includes('opcoes') || norm.includes('opcao') || norm.includes('o que tem') || norm.includes('o que voces tem') || norm.includes('menu') || norm.includes('ajuda')) {
                this.handleMenuInquiry(norm);
                return;
            }

            // =========================================================================
            // PRIORIDADE 7: SAUDAÇÕES
            // =========================================================================
            if (norm.match(/^(oi|ola|bom dia|boa tarde|boa noite|opa|e ai)/)) {
                const reply = `Olá! Tudo bem? O que você gostaria de pedir hoje? Temos deliciosos hambúrgueres com fritas, pizzas artesanais, calzones recheados e bebidas geladas!`;
                this.addBotMessage(reply, null, ['Quero um Hambúrguer', 'Quero uma Pizza', 'Ver Calzones', 'Ver Cardápio']);
                this.speak(reply);
                return;
            }

            // Fallback amigável
            const fallbackReply = `Não entendi completamente o que deseja. Você pode dizer, por exemplo:\n• *"Quero um Burguer Tradicional"*\n• *"Quero uma pizza grande de calabresa"*\n• *"Quais as opções de lanches?"*\n• *"Adicione uma Coca-Cola 2 litros"*`;
            this.addBotMessage(fallbackReply, null, ['Burguer Tradicional', 'Pizza Calabresa', 'Opções de Lanche', 'Ver Carrinho']);
            this.speak(`Não entendi. Você pode pedir um hambúrguer, uma pizza, um calzone ou uma bebida! O que você prefere?`);
        },

        /* ==========================================================================
           MÓDULO DE HAMBÚRGUERES & LANCHES
           ========================================================================== */

        /**
         * Apresenta as opções completas de Hambúrgueres e Lanches do cardápio
         */
        handleBurgerInquiry: function (norm) {
            const catalog = this.getCatalogData();
            const burgers = catalog.menu_items?.hamburgueres || [];
            const arr = Array.isArray(burgers) ? burgers : Object.values(burgers);

            this.conversationState.step = 'CHOOSING_BURGER';

            if (arr.length === 0) {
                const reply = `No momento não temos hambúrgueres disponíveis. Que tal uma deliciosa pizza ou calzone?`;
                this.addBotMessage(reply, null, ['Ver Pizzas', 'Ver Calzones']);
                this.speak(reply);
                return;
            }

            let msg = `Temos opções incríveis de hambúrgueres e lanches artesanais:\n\n`;
            const chips = [];

            arr.forEach(b => {
                const priceStr = formatMoney(b.price || b.basePrice || 0);
                const desc = b.description ? ` - ${b.description}` : '';
                msg += `🍔 **${b.name} (${priceStr})**${desc}\n\n`;
                chips.push(b.name);
            });

            msg += `Qual deles você gostaria de pedir?`;
            chips.push('Ver Bebidas');
            chips.push('Ver Pizzas');

            this.addBotMessage(msg, null, chips);
            this.speak(`Temos o Burguer Tradicional com batata frita por 28 reais, e o X-Frango completo por 26 reais. Qual você prefere?`);
        },

        /**
         * Processa a escolha do cliente quando o bot perguntou qual hambúrguer ele prefere
         */
        handleStepChoosingBurger: function (norm, text) {
            const catalog = this.getCatalogData();
            const detectedBurgers = this.detectBurgersInText(norm, catalog);

            if (detectedBurgers.length > 0) {
                this.conversationState.step = 'IDLE';
                this.addGeneralProductsToCart(detectedBurgers);
                return;
            }

            if (norm.includes('tradicional') || norm.includes('primeiro') || norm.includes('com fritas')) {
                const b = (catalog.menu_items?.hamburgueres || []).find(item => item.id === 'burguer_tradicional') || {
                    id: 'burguer_tradicional',
                    name: 'Burguer Tradicional',
                    price: 28,
                    category: 'hamburgueres',
                    description: 'Acompanha 100g de batata frita'
                };
                this.conversationState.step = 'IDLE';
                this.addGeneralProductsToCart([{ ...b, quantity: 1 }]);
                return;
            }

            if (norm.includes('frango') || norm.includes('segundo') || norm.includes('x frango')) {
                const b = (catalog.menu_items?.hamburgueres || []).find(item => item.id === 'x_frango') || {
                    id: 'x_frango',
                    name: 'X-Frango',
                    price: 26,
                    category: 'hamburgueres',
                    description: 'Lanche completo de frango'
                };
                this.conversationState.step = 'IDLE';
                this.addGeneralProductsToCart([{ ...b, quantity: 1 }]);
                return;
            }

            // Se mudou de ideia
            if (norm.includes('pizza') || norm.includes('calzone') || norm.includes('nao quero') || norm.includes('cancela')) {
                this.conversationState.step = 'IDLE';
                this.interpretGeneralIntent(norm, text);
                return;
            }

            const reply = `Não entendi qual hambúrguer você prefere. Escolha entre o **Burguer Tradicional** ou o **X-Frango**:`;
            this.addBotMessage(reply, null, ['Burguer Tradicional', 'X-Frango', 'Ver Pizzas']);
            this.speak(`Você prefere o Burguer Tradicional ou o X-Frango?`);
        },

        /**
         * Detecta itens de hambúrguer no texto falado
         */
        detectBurgersInText: function (norm, catalog) {
            const burgers = catalog.menu_items?.hamburgueres || [];
            const arr = Array.isArray(burgers) ? burgers : Object.values(burgers);
            const matched = [];

            arr.forEach(item => {
                const iNorm = normalizeText(item.name);
                const id = item.id;
                let isMatch = false;

                if (id === 'burguer_tradicional') {
                    isMatch = norm.includes('burguer tradicional') || 
                              norm.includes('hamburguer tradicional') || 
                              norm.includes('burger tradicional') || 
                              norm.includes('burguer com fritas') || 
                              norm.includes('hamburguer com fritas') ||
                              ((norm.includes('hamburguer') || norm.includes('burguer') || norm.includes('lanche')) && (norm.includes('tradicional') || norm.includes('fritas') || norm.includes('cheddar') || norm.includes('140g')));
                } else if (id === 'x_frango') {
                    isMatch = norm.includes('x frango') || 
                              norm.includes('x-frango') || 
                              norm.includes('xfrango') || 
                              norm.includes('hamburguer de frango') || 
                              norm.includes('lanche de frango') || 
                              norm.includes('burguer de frango') ||
                              ((norm.includes('hamburguer') || norm.includes('burguer') || norm.includes('lanche')) && norm.includes('frango'));
                } else {
                    isMatch = norm.includes(iNorm) || (id && norm.includes(normalizeText(id.replace(/_/g, ' '))));
                }

                if (isMatch && !matched.some(m => m.id === item.id)) {
                    const qty = this.extractQuantityInText(norm) || 1;
                    matched.push({ ...item, quantity: qty, category: 'hamburgueres' });
                }
            });

            return matched;
        },

        /* ==========================================================================
           MÓDULO DE CALZONES
           ========================================================================== */

        /**
         * Apresenta as opções de calzones
         */
        handleCalzoneInquiry: function (norm) {
            const catalog = this.getCatalogData();
            const calzones = catalog.menu_items?.calzones || [];
            const arr = Array.isArray(calzones) ? calzones : Object.values(calzones);

            this.conversationState.step = 'CHOOSING_CALZONE';

            if (arr.length === 0) {
                const reply = `No momento não temos calzones cadastrados. Que tal uma pizza ou hambúrguer?`;
                this.addBotMessage(reply, null, ['Ver Pizzas', 'Ver Hambúrgueres']);
                this.speak(reply);
                return;
            }

            let msg = `Nossos calzones são assados na hora e super recheados! Temos opções salgadas e doces:\n\n`;
            const salgados = arr.filter(c => !c.id.includes('choco'));
            const doces = arr.filter(c => c.id.includes('choco'));

            if (salgados.length > 0) {
                msg += `🥟 **Salgados:**\n`;
                salgados.forEach(c => {
                    msg += `• **${c.name}** (${formatMoney(c.price || c.basePrice)})\n`;
                });
                msg += `\n`;
            }

            if (doces.length > 0) {
                msg += `🍫 **Doces:**\n`;
                doces.forEach(c => {
                    msg += `• **${c.name}** (${formatMoney(c.price || c.basePrice)})\n`;
                });
                msg += `\n`;
            }

            msg += `Qual sabor de calzone você gostaria?`;
            const topChips = salgados.slice(0, 3).map(c => c.name).concat(doces.slice(0, 1).map(c => c.name));

            this.addBotMessage(msg, null, topChips);
            this.speak(`Temos calzones de costela, filé com cheddar, frango, bacon, quatro queijos e opções doces de chocolate! Qual sabor você prefere?`);
        },

        /**
         * Processa a escolha do cliente para Calzones
         */
        handleStepChoosingCalzone: function (norm, text) {
            const catalog = this.getCatalogData();
            const detectedCalzones = this.detectCalzonesInText(norm, catalog);

            if (detectedCalzones.length > 0) {
                this.conversationState.step = 'IDLE';
                this.addGeneralProductsToCart(detectedCalzones);
                return;
            }

            if (norm.includes('pizza') || norm.includes('hamburguer') || norm.includes('cancela')) {
                this.conversationState.step = 'IDLE';
                this.interpretGeneralIntent(norm, text);
                return;
            }

            const reply = `Não reconheci esse sabor de calzone. Temos: Frango, Costela, Filé com Cheddar, Bacon, 4 Queijos ou Chocolate:`;
            this.addBotMessage(reply, null, ['Calzone Costela', 'Calzone Frango', 'Calzone Filé c/ Cheddar']);
            this.speak(`Por favor, escolha um dos nossos sabores de calzone: Costela, Frango, Filé com Cheddar ou 4 Queijos.`);
        },

        /**
         * Detecta itens de calzone no texto falado
         */
        detectCalzonesInText: function (norm, catalog) {
            const calzones = catalog.menu_items?.calzones || [];
            const arr = Array.isArray(calzones) ? calzones : Object.values(calzones);
            const matched = [];

            arr.forEach(item => {
                const iNorm = normalizeText(item.name);
                const id = item.id;
                let isMatch = false;

                if (norm.includes(iNorm)) {
                    isMatch = true;
                } else if (norm.includes('calzone') || norm.includes('calzones')) {
                    if (id.includes('costela') && norm.includes('costela')) isMatch = true;
                    if (id.includes('file_cheddar') && (norm.includes('file') || norm.includes('cheddar'))) isMatch = true;
                    if (id.includes('frango') && norm.includes('frango')) isMatch = true;
                    if (id.includes('bacon') && norm.includes('bacon')) isMatch = true;
                    if (id.includes('quatro_queijos') && (norm.includes('4 queijos') || norm.includes('quatro queijos') || norm.includes('queijo'))) isMatch = true;
                    if (id.includes('choco_branco') && (norm.includes('chocolate branco') || norm.includes('branco'))) isMatch = true;
                    if (id.includes('choco_preto') && (norm.includes('chocolate preto') || norm.includes('preto') || norm.includes('chocolate'))) isMatch = true;
                }

                if (isMatch && !matched.some(m => m.id === item.id)) {
                    const qty = this.extractQuantityInText(norm) || 1;
                    matched.push({ ...item, quantity: qty, category: 'calzones' });
                }
            });

            return matched;
        },

        /* ==========================================================================
           MÓDULO DE BEBIDAS
           ========================================================================== */

        /**
         * Apresenta as opções de bebidas disponíveis
         */
        handleBeverageInquiry: function (norm) {
            const catalog = this.getCatalogData();
            const drinks = catalog.menu_items?.bebidas || [];
            const arr = Array.isArray(drinks) ? drinks : Object.values(drinks);

            if (arr.length === 0) {
                const reply = `Não encontrei bebidas cadastradas no momento. Que tal um hambúrguer ou uma pizza?`;
                this.addBotMessage(reply, null, ['Burguer Tradicional', 'Pizza Calabresa']);
                this.speak(reply);
                return;
            }

            let msg = `Temos diversas opções de bebidas bem geladas:\n\n`;
            arr.slice(0, 8).forEach(d => {
                msg += `🥤 **${d.name}** (${formatMoney(d.price || d.basePrice)})\n`;
            });

            msg += `\nQual bebida você deseja adicionar ao seu pedido?`;
            const topChips = ['Coca-Cola 2L', 'Guaraná 2L', 'Coca Lata', 'Água Mineral'];

            this.addBotMessage(msg, null, topChips);
            this.speak(`Temos refrigerantes de 2 litros, latinhas geladas, água e sucos! Qual bebida você gostaria?`);
        },

        /* ==========================================================================
           FLUXO GUIADO DE PIZZAS (COM PIZZA ENGINE)
           ========================================================================== */

        /**
         * Inicia o fluxo de montagem de pizza
         */
        startPizzaOrderFlow: function (size, flavors, norm) {
            const catalog = this.getCatalogData();
            this.conversationState.pendingPizza = {
                sizeId: size ? size.id : null,
                sizeObj: size || null,
                flavors: flavors || [],
                borderObj: null,
                quantity: 1,
                notes: ''
            };

            // Detecta se já informou borda na mesma frase
            const detectedBorder = this.detectBorderInText(norm, catalog);
            if (detectedBorder) {
                this.conversationState.pendingPizza.borderObj = detectedBorder;
            }

            // Se NÃO informou o tamanho, pergunta o tamanho e já guarda os sabores identificados
            if (!this.conversationState.pendingPizza.sizeObj) {
                this.conversationState.step = 'BUILDING_PIZZA_SIZE';
                const availableSizes = this.getAvailableSizesList(catalog);
                
                let reply = '';
                if (this.conversationState.pendingPizza.flavors.length > 0) {
                    const flavorNames = this.conversationState.pendingPizza.flavors.map(f => f.name).join(' e ');
                    reply = `Sabor **${flavorNames}** anotado com sucesso! Qual tamanho de pizza você prefere? Temos ${availableSizes.join(' e ')}.`;
                } else {
                    reply = `Com certeza! Qual tamanho de pizza você prefere? Temos ${availableSizes.join(' e ')}.`;
                }

                const chips = availableSizes.map(s => 'Tamanho ' + s);
                this.addBotMessage(reply, null, chips);
                this.speak(reply);
                return;
            }

            // Se tem tamanho mas não tem sabores
            const maxFlavors = this.conversationState.pendingPizza.sizeObj.maxFlavors || 2;
            if (this.conversationState.pendingPizza.flavors.length === 0) {
                this.conversationState.step = 'BUILDING_PIZZA_FLAVORS';
                const reply = `Perfeito, tamanho ${this.conversationState.pendingPizza.sizeObj.name}! Esse tamanho permite até ${maxFlavors} sabores. Quais sabores você gostaria?`;
                this.addBotMessage(reply, null, ['Calabresa', '4 Queijos', 'Frango com Catupiry', 'Marguerita']);
                this.speak(reply);
                return;
            }

            // Se informou 1 sabor mas o tamanho permite 2 ou 3 e o cliente não especificou que quer inteira
            if (this.conversationState.pendingPizza.flavors.length === 1 && maxFlavors > 1 && !norm.includes('so ') && !norm.includes('apenas') && !norm.includes('inteira')) {
                this.conversationState.step = 'BUILDING_PIZZA_FLAVORS';
                const flavorName = this.conversationState.pendingPizza.flavors[0].name;
                const reply = `Ótima escolha: **${flavorName}**! A pizza ${this.conversationState.pendingPizza.sizeObj.name} aceita até ${maxFlavors} sabores. Gostaria de adicionar um segundo sabor meio a meio, ou prefere ela inteira de ${flavorName}?`;
                this.addBotMessage(reply, null, [`Inteira de ${flavorName}`, 'Adicionar 4 Queijos', 'Adicionar Marguerita']);
                this.speak(reply);
                return;
            }

            // Se já temos tamanho e sabores completos, vai para a borda
            this.proceedToBorderStep();
        },

        /**
         * Passo de Tamanho da Pizza
         */
        handleStepPizzaSize: function (norm, text) {
            const catalog = this.getCatalogData();
            const size = this.detectSizeInText(norm, catalog);

            // Se o usuário falou um sabor neste passo em vez do tamanho (ex: repetiu "Calabresa")
            const additionalFlavors = this.detectFlavorsInText(norm, catalog);
            if (additionalFlavors.length > 0) {
                additionalFlavors.forEach(f => {
                    if (!this.conversationState.pendingPizza.flavors.some(existing => existing.id === f.id)) {
                        this.conversationState.pendingPizza.flavors.push(f);
                    }
                });
            }

            if (!size) {
                const availableSizes = this.getAvailableSizesList(catalog);
                const currentFlavors = this.conversationState.pendingPizza.flavors.map(f => f.name).join(' e ');
                let reply = '';
                if (currentFlavors) {
                    reply = `Entendido, sabor **${currentFlavors}**! Agora me diga: qual tamanho você prefere? Temos ${availableSizes.join(' ou ')}.`;
                } else {
                    reply = `Por favor, escolha um dos tamanhos disponíveis: ${availableSizes.join(' ou ')}.`;
                }
                this.addBotMessage(reply, null, availableSizes.map(s => 'Tamanho ' + s));
                this.speak(reply);
                return;
            }

            this.conversationState.pendingPizza.sizeId = size.id;
            this.conversationState.pendingPizza.sizeObj = size;

            // Se já tínhamos sabores anotados
            if (this.conversationState.pendingPizza.flavors.length > 0) {
                const maxFlavors = size.maxFlavors || 2;
                if (this.conversationState.pendingPizza.flavors.length === 1 && maxFlavors > 1 && !norm.includes('so ') && !norm.includes('apenas') && !norm.includes('inteira')) {
                    this.conversationState.step = 'BUILDING_PIZZA_FLAVORS';
                    const flavorName = this.conversationState.pendingPizza.flavors[0].name;
                    const reply = `Tamanho ${size.name} selecionado com sabor **${flavorName}**! A pizza ${size.name} permite até ${maxFlavors} sabores. Deseja adicionar mais um sabor meio a meio ou prefere inteira de ${flavorName}?`;
                    this.addBotMessage(reply, null, [`Inteira de ${flavorName}`, 'Adicionar 4 Queijos', 'Adicionar Frango com Catupiry']);
                    this.speak(reply);
                    return;
                }
                this.proceedToBorderStep();
            } else {
                this.conversationState.step = 'BUILDING_PIZZA_FLAVORS';
                const maxFlavors = size.maxFlavors || 2;
                const reply = `Tamanho ${size.name} selecionado! Ela pode ter até ${maxFlavors} sabores. Qual sabor você gostaria?`;
                this.addBotMessage(reply, null, ['Calabresa', '4 Queijos', 'Frango com Catupiry', 'Portuguesa']);
                this.speak(reply);
            }
        },

        /**
         * Passo de Sabores da Pizza
         */
        handleStepPizzaFlavors: function (norm, text) {
            const catalog = this.getCatalogData();
            const pending = this.conversationState.pendingPizza;
            const maxFlavors = pending.sizeObj?.maxFlavors || 2;

            // Se o cliente respondeu "só calabresa", "inteira", "apenas esse"
            if (norm.includes('inteira') || norm.includes('so esse') || norm.includes('so essa') || norm.includes('apenas') || norm.includes('nao precisa outro') || norm.includes('so calabresa') || norm.includes('apenas calabresa')) {
                if (pending.flavors.length > 0) {
                    this.proceedToBorderStep();
                    return;
                }
            }

            const foundFlavors = this.detectFlavorsInText(norm, catalog);

            if (foundFlavors.length === 0) {
                const reply = `Não encontrei esse sabor no cardápio. Você pode escolher entre nossos sabores tradicionais como Calabresa, 4 Queijos, Marguerita, Portuguesa ou Frango com Catupiry!`;
                this.addBotMessage(reply, null, ['Calabresa', '4 Queijos', 'Marguerita', 'Portuguesa']);
                this.speak(reply);
                return;
            }

            // Adiciona sabores sem duplicar
            foundFlavors.forEach(f => {
                if (!pending.flavors.some(existing => existing.id === f.id) && pending.flavors.length < maxFlavors) {
                    pending.flavors.push(f);
                }
            });

            this.proceedToBorderStep();
        },

        /**
         * Avança para a pergunta de Borda Recheada
         */
        proceedToBorderStep: function () {
            const pending = this.conversationState.pendingPizza;
            const catalog = this.getCatalogData();

            // Se já tem borda definida, adiciona diretamente
            if (pending.borderObj) {
                this.commitPizzaToCart();
                return;
            }

            const borders = this.getAvailableBordersList(catalog);
            if (borders.length === 0) {
                this.commitPizzaToCart();
                return;
            }

            this.conversationState.step = 'ASKING_BORDER';
            const borderDisplayNames = borders.map(b => b.name);
            const reply = `Gostaria de adicionar borda recheada na sua pizza? Temos ${borderDisplayNames.join(', ')} ou tradicional sem borda.`;
            const chips = ['Sem Borda'].concat(borderDisplayNames.map(b => 'Borda ' + b));
            this.addBotMessage(reply, null, chips);
            this.speak(reply);
        },

        /**
         * Passo de Borda Recheada
         */
        handleStepBorder: function (norm, text) {
            const catalog = this.getCatalogData();
            const pending = this.conversationState.pendingPizza;

            if (norm.includes('sem borda') || norm.includes('nao precisa') || norm.includes('tradicional') || norm === 'nao' || norm.includes('nenhuma')) {
                pending.borderObj = null;
                this.commitPizzaToCart();
                return;
            }

            const border = this.detectBorderInText(norm, catalog);
            if (border) {
                pending.borderObj = border;
                this.commitPizzaToCart();
            } else {
                const borders = this.getAvailableBordersList(catalog);
                const reply = `Não reconheci essa borda. Deseja adicionar alguma destas: ${borders.map(b => b.name).join(', ')} ou prefere sem borda?`;
                this.addBotMessage(reply, null, ['Sem Borda'].concat(borders.map(b => 'Borda ' + b.name)));
                this.speak(reply);
            }
        },

        /**
         * Finaliza a pizza e adiciona ao carrinho usando o PizzaEngine oficial
         */
        commitPizzaToCart: function () {
            const pending = this.conversationState.pendingPizza;
            const catalog = this.getCatalogData();

            if (!pending.sizeObj || pending.flavors.length === 0) {
                this.addBotMessage('Houve um problema com a seleção da pizza. Vamos recomeçar?');
                this.conversationState.step = 'IDLE';
                return;
            }

            const sizeKey = pending.sizeObj.id;
            const flavors = pending.flavors.map(f => ({
                id: f.id,
                name: f.name,
                categoryType: f.categoryType || (f.category === 'pizzas_especiais' || f.isEspecial ? 'especial' : 'tradicional'),
                price: Number(f.price || 0)
            }));

            // Preços oficiais de pizza do catálogo
            const activePrices = catalog.pizza_config?.prices || catalog.settings?.pizzaPrices || {
                media: { tradicional: 45, especial: 55 },
                grande: { tradicional: 60, especial: 70 }
            };

            let unitPrice = 0;
            if (typeof PizzaEngine !== 'undefined' && PizzaEngine.calculatePizzaPrice) {
                const calc = PizzaEngine.calculatePizzaPrice(sizeKey, flavors, activePrices, null, 'tradicional');
                if (calc && calc.price > 0) {
                    unitPrice = calc.price;
                }
            }

            // Fallback baseado nos preços por tamanho
            if (unitPrice <= 0) {
                const hasEspecial = flavors.some(f => f.categoryType === 'especial');
                if (sizeKey === 'grande') {
                    unitPrice = hasEspecial ? (activePrices.grande?.especial || 70) : (activePrices.grande?.tradicional || 60);
                } else {
                    unitPrice = hasEspecial ? (activePrices.media?.especial || 55) : (activePrices.media?.tradicional || 45);
                }
            }

            // Adiciona valor da borda
            let borderPrice = 0;
            let borderName = '';
            if (pending.borderObj) {
                borderPrice = Number(pending.borderObj.price || 0);
                borderName = pending.borderObj.name || '';
                unitPrice += borderPrice;
            }

            const totalPrice = unitPrice * pending.quantity;
            const flavorNames = flavors.map(f => f.name).join(' / ');
            const fullTitle = `Pizza ${pending.sizeObj.name} (${flavorNames})`;

            const cartItem = {
                cartItemId: 'voice_pizza_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                id: 'pizza_' + sizeKey + '_' + flavors.map(f => f.id).join('_'),
                name: fullTitle,
                category: 'pizzas',
                isPizza: true,
                pizzaSize: sizeKey,
                pizzaSizeName: pending.sizeObj.name,
                flavors: flavors,
                border: pending.borderObj ? { id: pending.borderObj.id, name: borderName, price: borderPrice } : null,
                singlePrice: unitPrice,
                basePrice: unitPrice - borderPrice,
                quantity: pending.quantity,
                totalPrice: totalPrice,
                notes: pending.notes || 'Pedido por voz'
            };

            // Injeção Oficial no Carrinho Global
            this.pushToOfficialCart(cartItem);

            // Apresenta confirmação e pergunta sobre bebidas
            this.conversationState.step = 'ASKING_BEVERAGE';
            const cardData = {
                title: fullTitle,
                desc: pending.borderObj ? `Com borda recheada de ${borderName}` : 'Borda tradicional sem recheio',
                priceFormatted: formatMoney(totalPrice),
                icon: 'local_pizza'
            };

            const confirmReply = `Prontinho! Adicionei ao seu pedido a **${fullTitle}** por **${formatMoney(totalPrice)}**. Gostaria de adicionar alguma bebida gelada para acompanhar?`;
            this.addBotMessage(confirmReply, cardData, ['Coca-Cola 2 Litros', 'Guaraná Lata', 'Água Mineral', 'Não, só isso']);
            this.speak(confirmReply);
        },

        /**
         * Passo de Bebida após pizza ou lanche
         */
        handleStepBeverage: function (norm, text) {
            if (norm.includes('nao') || norm.includes('so isso') || norm.includes('nao precisa') || norm.includes('fechar') || norm.includes('so isso mesmo') || norm.includes('pode finalizar')) {
                this.conversationState.step = 'IDLE';
                this.handleReviewCartIntent();
                return;
            }

            const catalog = this.getCatalogData();
            const drinks = this.detectBeveragesInText(norm, catalog);

            if (drinks.length > 0) {
                this.addBeveragesToCart(drinks);
            } else {
                const reply = `Não encontrei essa bebida. Deseja uma Coca-Cola 2L, Guaraná Lata, Suco ou podemos ir para a finalização?`;
                this.addBotMessage(reply, null, ['Coca-Cola 2L', 'Guaraná Lata', 'Ver Carrinho', 'Finalizar Pedido']);
                this.speak(reply);
            }
        },

        /* ==========================================================================
           BEBIDAS E PRODUTOS GERAIS (HAMBÚRGUERES, CALZONES, ETC.)
           ========================================================================== */

        /**
         * Adiciona bebidas ao carrinho
         */
        addBeveragesToCart: function (beverages) {
            beverages.forEach(b => {
                const unitPrice = Number(b.price || b.basePrice || 0);
                const qty = b.quantity || 1;
                const totalPrice = unitPrice * qty;

                const cartItem = {
                    cartItemId: 'voice_bev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                    id: b.id,
                    name: b.name,
                    category: 'bebidas',
                    singlePrice: unitPrice,
                    basePrice: unitPrice,
                    adicionais: [],
                    quantity: qty,
                    totalPrice: totalPrice,
                    notes: 'Pedido por voz'
                };

                this.pushToOfficialCart(cartItem);

                const cardData = {
                    title: `${qty}x ${b.name}`,
                    desc: 'Bebida bem gelada',
                    priceFormatted: formatMoney(totalPrice),
                    icon: 'sports_bar'
                };

                const reply = `Adicionei **${qty}x ${b.name}** ao seu pedido por **${formatMoney(totalPrice)}**!`;
                this.addBotMessage(reply, cardData, ['Ver Carrinho', 'Pedir Outro Item', 'Finalizar Pedido']);
                this.speak(reply);
            });

            this.conversationState.step = 'IDLE';
        },

        /**
         * Adiciona produtos gerais (hambúrgueres, lanches, calzones) ao carrinho
         */
        addGeneralProductsToCart: function (products) {
            products.forEach(p => {
                const unitPrice = Number(p.price || p.basePrice || 0);
                const qty = p.quantity || 1;
                const totalPrice = unitPrice * qty;

                const cartItem = {
                    cartItemId: 'voice_prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                    id: p.id,
                    name: p.name,
                    category: p.category || 'hamburgueres',
                    singlePrice: unitPrice,
                    basePrice: unitPrice,
                    adicionais: [],
                    quantity: qty,
                    totalPrice: totalPrice,
                    notes: 'Pedido por voz'
                };

                this.pushToOfficialCart(cartItem);

                const isBurger = (p.category === 'hamburgueres') || p.id.includes('burguer') || p.id.includes('x_');
                const isCalzone = (p.category === 'calzones') || p.id.includes('calzone');

                const cardData = {
                    title: `${qty}x ${p.name}`,
                    desc: p.description || (isBurger ? 'Hambúrguer com batata frita' : 'Calzone assado na hora'),
                    priceFormatted: formatMoney(totalPrice),
                    icon: isBurger ? 'lunch_dining' : (isCalzone ? 'bakery_dining' : 'fastfood')
                };

                const confirmReply = `Adicionei **${qty}x ${p.name}** ao seu pedido por **${formatMoney(totalPrice)}**! Gostaria de uma bebida gelada para acompanhar?`;
                this.addBotMessage(confirmReply, cardData, ['Coca-Cola 2L', 'Guaraná Lata', 'Água Mineral', 'Finalizar Pedido']);
                this.speak(`Adicionei ${p.name} por ${formatMoney(totalPrice)}! Deseja uma bebida para acompanhar ou podemos finalizar?`);
            });

            this.conversationState.step = 'ASKING_BEVERAGE';
        },

        /* ==========================================================================
           INTEGRAÇÃO COM O CARRINHO E CHECKOUT OFICIAL
           ========================================================================== */

        /**
         * Adiciona item de forma segura ao array oficial 'cart' do JC Food
         */
        pushToOfficialCart: function (cartItem) {
            if (typeof window.cart !== 'undefined' && Array.isArray(window.cart)) {
                window.cart.push(cartItem);
            } else if (typeof cart !== 'undefined' && Array.isArray(cart)) {
                cart.push(cartItem);
            }

            if (typeof saveCartToStorage === 'function') {
                saveCartToStorage();
            }
            if (typeof updateCartUI === 'function') {
                updateCartUI();
            }
            if (typeof showToast === 'function') {
                showToast(`${cartItem.quantity}x ${cartItem.name} adicionado ao pedido!`, 'success');
            }

            this.updateCartFooterUI();
        },

        /**
         * Resumo e revisão do carrinho falada e visual
         */
        handleReviewCartIntent: function () {
            const currentCart = (typeof window.cart !== 'undefined') ? window.cart : (typeof cart !== 'undefined' ? cart : []);

            if (!currentCart || currentCart.length === 0) {
                const emptyReply = `Seu carrinho está vazio no momento. Que tal escolher um delicioso hambúrguer, pizza ou calzone?`;
                this.addBotMessage(emptyReply, null, ['Burguer Tradicional', 'Pizza Calabresa', 'Calzone de Costela', 'Ver Cardápio']);
                this.speak(emptyReply);
                return;
            }

            let subtotal = 0;
            const itemsList = currentCart.map(item => {
                const price = item.totalPrice || (item.singlePrice * item.quantity) || 0;
                subtotal += price;
                return `• ${item.quantity}x ${item.name} (${formatMoney(price)})`;
            }).join('\n');

            const reply = `Aqui está o resumo do seu pedido:\n\n${itemsList}\n\n**Total: ${formatMoney(subtotal)}**.\n\nPodemos ir para a finalização do seu pedido?`;
            this.addBotMessage(reply, null, ['Finalizar Pedido', 'Adicionar Mais Itens', 'Limpar Carrinho']);
            this.speak(`Seu pedido tem ${currentCart.length} itens, totalizando ${formatMoney(subtotal)}. Podemos finalizar?`);
        },

        /**
         * Esvazia o carrinho com confirmação
         */
        handleClearCartIntent: function () {
            if (typeof window.cart !== 'undefined') window.cart = [];
            if (typeof cart !== 'undefined') cart = [];

            if (typeof saveCartToStorage === 'function') saveCartToStorage();
            if (typeof updateCartUI === 'function') updateCartUI();

            const reply = `Seu carrinho foi esvaziado. O que você gostaria de pedir agora?`;
            this.addBotMessage(reply, null, ['Burguer Tradicional', 'Quero uma Pizza', 'Ver Cardápio']);
            this.speak(reply);
            this.updateCartFooterUI();
        },

        /**
         * Encaminha o cliente para o Checkout Oficial do JC Food
         */
        handleCheckoutIntent: function () {
            const currentCart = (typeof window.cart !== 'undefined') ? window.cart : (typeof cart !== 'undefined' ? cart : []);

            if (!currentCart || currentCart.length === 0) {
                const reply = `Seu carrinho ainda está vazio! Adicione algum produto antes de finalizar.`;
                this.addBotMessage(reply, null, ['Burguer Tradicional', 'Pizza Calabresa', 'Ver Bebidas']);
                this.speak(reply);
                return;
            }

            const reply = `Excelente! Estou abrindo a tela de finalização para você conferir seu endereço e forma de pagamento com segurança.`;
            this.addBotMessage(reply);
            this.speak(reply, () => {
                this.close();
                if (typeof openCheckoutModal === 'function') {
                    openCheckoutModal();
                } else if (typeof toggleCart === 'function') {
                    toggleCart(true);
                }
            });
        },

        /**
         * Consultas Gerais de Cardápio (Exibe tudo: Hambúrgueres, Pizzas, Calzones, Bebidas)
         */
        handleMenuInquiry: function (norm) {
            // Se o usuário perguntou especificamente sobre hambúrgueres / lanches
            if (norm.includes('hamburguer') || norm.includes('burguer') || norm.includes('lanche')) {
                this.handleBurgerInquiry(norm);
                return;
            }

            // Se o usuário perguntou sobre calzones
            if (norm.includes('calzone')) {
                this.handleCalzoneInquiry(norm);
                return;
            }

            // Se o usuário perguntou sobre bebidas
            if (norm.includes('bebida') || norm.includes('refrigerante')) {
                this.handleBeverageInquiry(norm);
                return;
            }

            // Cardápio Completo
            const reply = `Nosso cardápio completo conta com:\n\n🍔 **Hambúrgueres & Lanches:**\n• Burguer Tradicional com 100g de batata frita (R$ 28,00)\n• X-Frango completo (R$ 26,00)\n\n🍕 **Pizzas Artesanais:**\n• Mais de 60 sabores tradicionais e especiais nos tamanhos Média e Grande!\n\n🥟 **Calzones Recheados:**\n• Sabores salgados como Costela, Filé c/ Cheddar e doces de Chocolate!\n\n🥤 **Bebidas Geladas:**\n• Refrigerantes 2L, latas, água mineral, sucos e vinhos!\n\nQual opção você gostaria de pedir agora?`;

            this.addBotMessage(reply, null, ['Ver Hambúrgueres', 'Ver Pizzas', 'Ver Calzones', 'Ver Bebidas']);
            this.speak(`No nosso cardápio temos hambúrgueres com batata frita, pizzas artesanais, calzones recheados e bebidas bem geladas! Qual opção você prefere?`);
        },

        /* ==========================================================================
           DETECÇÃO DE ENTIDADES (NLU ENGINE)
           ========================================================================== */

        /**
         * Retorna TODOS os sabores de pizza disponíveis no catálogo
         */
        getAllFlavorsFromCatalog: function (catalog) {
            const flavors = [];
            const addedIds = new Set();

            function addFlavor(f, categoryType) {
                if (!f || !f.name) return;
                const id = f.id || normalizeText(f.name).replace(/\s+/g, '_');
                if (addedIds.has(id)) return;
                addedIds.add(id);

                flavors.push({
                    id: id,
                    name: f.name,
                    categoryType: categoryType || (f.isEspecial ? 'especial' : 'tradicional'),
                    ingredients: f.ingredients || '',
                    price: Number(f.price || 0)
                });
            }

            // 1. Extração prioritária: sharedOptionGroups
            if (catalog.sharedOptionGroups) {
                if (Array.isArray(catalog.sharedOptionGroups.saboresTradicionais)) {
                    catalog.sharedOptionGroups.saboresTradicionais.forEach(f => addFlavor(f, 'tradicional'));
                }
                if (Array.isArray(catalog.sharedOptionGroups.saboresEspeciais)) {
                    catalog.sharedOptionGroups.saboresEspeciais.forEach(f => addFlavor(f, 'especial'));
                }
                if (Array.isArray(catalog.sharedOptionGroups.saboresDoces)) {
                    catalog.sharedOptionGroups.saboresDoces.forEach(f => addFlavor(f, 'doce'));
                }

                Object.keys(catalog.sharedOptionGroups).forEach(key => {
                    if (key !== 'crust' && key !== 'saboresTradicionais' && key !== 'saboresEspeciais' && key !== 'saboresDoces') {
                        const grp = catalog.sharedOptionGroups[key];
                        if (Array.isArray(grp)) {
                            grp.forEach(f => addFlavor(f, key.toLowerCase().includes('especial') ? 'especial' : 'tradicional'));
                        } else if (grp && Array.isArray(grp.options)) {
                            grp.options.forEach(f => addFlavor(f, key.toLowerCase().includes('especial') ? 'especial' : 'tradicional'));
                        }
                    }
                });
            }

            // 2. Extração de pizza_config.flavors
            if (catalog.pizza_config?.flavors) {
                const pFlavors = Array.isArray(catalog.pizza_config.flavors) ? catalog.pizza_config.flavors : Object.values(catalog.pizza_config.flavors);
                pFlavors.forEach(f => addFlavor(f, f.categoryType || 'tradicional'));
            }

            // 3. Extração de menu_items de pizza
            const cats = ['pizzas_salgadas', 'pizzas_tradicionais', 'pizzas_especiais', 'pizzas_doces'];
            cats.forEach(c => {
                if (catalog.menu_items && catalog.menu_items[c]) {
                    const arr = Array.isArray(catalog.menu_items[c]) ? catalog.menu_items[c] : Object.values(catalog.menu_items[c]);
                    arr.forEach(item => {
                        if (item.optionGroups && Array.isArray(item.optionGroups)) {
                            item.optionGroups.forEach(grp => {
                                if (grp.options && Array.isArray(grp.options)) {
                                    grp.options.forEach(opt => addFlavor(opt, c.includes('especial') ? 'especial' : 'tradicional'));
                                }
                            });
                        }
                        if (item && item.name && !item.name.toLowerCase().includes('pedaços') && !item.name.toLowerCase().includes('pedacos')) {
                            addFlavor(item, c.includes('especial') ? 'especial' : 'tradicional');
                        }
                    });
                }
            });

            // 4. Sabores padrão essenciais
            if (flavors.length === 0) {
                const defaults = [
                    { id: 'calabresa', name: 'Calabresa', categoryType: 'tradicional' },
                    { id: '4_queijos', name: '4 Queijos', categoryType: 'tradicional' },
                    { id: 'frango_catupiry', name: 'Frango com Catupiry', categoryType: 'tradicional' },
                    { id: 'marguerita', name: 'Marguerita', categoryType: 'tradicional' },
                    { id: 'portuguesa', name: 'Portuguesa', categoryType: 'tradicional' },
                    { id: 'bacon', name: 'Bacon', categoryType: 'tradicional' },
                    { id: 'alho_e_oleo', name: 'Alho e Óleo', categoryType: 'tradicional' }
                ];
                defaults.forEach(d => addFlavor(d, d.categoryType));
            }

            return flavors;
        },

        /**
         * Detecta tamanho de pizza no texto
         */
        detectSizeInText: function (input, catalog) {
            const norm = normalizeText(input);
            const sizesConfig = catalog.pizza_config?.sizes || {
                media: { id: 'media', name: 'Média', maxFlavors: 2 },
                grande: { id: 'grande', name: 'Grande', maxFlavors: 3 }
            };

            const sizesArr = Object.values(sizesConfig);

            if (norm.includes('media') || norm.includes('medio') || norm.includes('8 fatias') || norm.includes('8 pedacos')) {
                return sizesArr.find(s => s.id === 'media' || normalizeText(s.name).includes('media')) || { id: 'media', name: 'Média', maxFlavors: 2 };
            }
            if (norm.includes('grande') || norm.includes('12 fatias') || norm.includes('12 pedacos')) {
                return sizesArr.find(s => s.id === 'grande' || normalizeText(s.name).includes('grande')) || { id: 'grande', name: 'Grande', maxFlavors: 3 };
            }
            if (norm.includes('familia') || norm.includes('gigante') || norm.includes('trem')) {
                return sizesArr.find(s => normalizeText(s.name).includes('familia') || normalizeText(s.name).includes('trem')) || sizesArr[sizesArr.length - 1];
            }
            if (norm.includes('pequena') || norm.includes('broto')) {
                return sizesArr.find(s => normalizeText(s.name).includes('pequena') || normalizeText(s.name).includes('broto')) || sizesArr[0];
            }

            return null;
        },

        /**
         * Detecta sabores de pizza no texto
         */
        detectFlavorsInText: function (input, catalog) {
            const norm = normalizeText(input);
            const allFlavors = this.getAllFlavorsFromCatalog(catalog);
            const matched = [];

            allFlavors.forEach(flavor => {
                const fNorm = normalizeText(flavor.name);
                const idNorm = normalizeText((flavor.id || '').replace(/_/g, ' '));

                let isMatch = norm.includes(fNorm) || (idNorm && norm.includes(idNorm));

                if (!isMatch) {
                    if ((fNorm.includes('4 queijos') || idNorm.includes('4 queijos')) && (norm.includes('quatro queijos') || norm.includes('4 queijos'))) {
                        isMatch = true;
                    } else if (fNorm.includes('calabresa') && norm.includes('calabresa')) {
                        isMatch = true;
                    } else if (fNorm.includes('frango') && norm.includes('frango')) {
                        isMatch = true;
                    } else if (fNorm.includes('marguerita') && (norm.includes('marguerita') || norm.includes('margarita'))) {
                        isMatch = true;
                    } else if (fNorm.includes('portuguesa') && norm.includes('portuguesa')) {
                        isMatch = true;
                    } else if (fNorm.includes('alho e oleo') && (norm.includes('alho') || norm.includes('alho e oleo'))) {
                        isMatch = true;
                    }
                }

                if (!isMatch) {
                    const stopWords = ['especial', 'tradicional', 'gourmet', 'pizza', 'com', 'ao', 'de', 'do', 'da', 'e', 'a', 'o'];
                    const keywords = fNorm.split(' ').filter(w => w.length >= 4 && !stopWords.includes(w));
                    for (const kw of keywords) {
                        if (norm.includes(kw)) {
                            isMatch = true;
                            break;
                        }
                    }
                }

                if (!isMatch && this.fuzzyMatchWords(norm, fNorm)) {
                    isMatch = true;
                }

                if (isMatch && !matched.some(m => m.id === flavor.id)) {
                    matched.push(flavor);
                }
            });

            return matched;
        },

        /**
         * Detecta bordas recheadas no texto
         */
        detectBorderInText: function (input, catalog) {
            const norm = normalizeText(input);
            const borders = this.getAvailableBordersList(catalog);
            for (const b of borders) {
                const bNorm = normalizeText(b.name);
                const idNorm = normalizeText(b.id || '');
                if (norm.includes(bNorm) || (idNorm && norm.includes(idNorm)) || norm.includes('borda de ' + bNorm) || norm.includes('borda ' + bNorm)) {
                    return b;
                }
                if (bNorm.includes('catupiry') && norm.includes('catupiry')) return b;
                if (bNorm.includes('cheddar') && norm.includes('cheddar')) return b;
                if (bNorm.includes('requeijao') && norm.includes('requeijao')) return b;
                if (bNorm.includes('chocolate branco') && (norm.includes('chocolate branco') || norm.includes('choco branco'))) return b;
                if (bNorm.includes('chocolate preto') && (norm.includes('chocolate preto') || norm.includes('choco preto'))) return b;
                if (bNorm.includes('doce de leite') && norm.includes('doce de leite')) return b;
            }
            return null;
        },

        /**
         * Detecta bebidas no texto
         */
        detectBeveragesInText: function (input, catalog) {
            const norm = normalizeText(input);
            const rawBeverages = catalog.menu_items?.bebidas || [];
            const arr = Array.isArray(rawBeverages) ? rawBeverages : Object.values(rawBeverages);
            const matched = [];

            arr.forEach(bev => {
                if (!bev || !bev.name) return;
                const bNorm = normalizeText(bev.name);
                
                const isMatch = norm.includes(bNorm) || 
                                (bNorm.includes('coca') && norm.includes('coca')) ||
                                (bNorm.includes('guarana') && norm.includes('guarana')) ||
                                (bNorm.includes('agua') && norm.includes('agua')) ||
                                (bNorm.includes('heineken') && norm.includes('heineken')) ||
                                (bNorm.includes('chopp') && norm.includes('chopp')) ||
                                (bNorm.includes('cerveja') && norm.includes('cerveja')) ||
                                (bNorm.includes('vinho') && norm.includes('vinho')) ||
                                (bNorm.includes('elev') && (norm.includes('elev') || norm.includes('energetico')));

                if (isMatch) {
                    let volumeMatched = true;
                    if (bNorm.includes('2l') || bNorm.includes('2 litros')) {
                        volumeMatched = norm.includes('2l') || norm.includes('2 litros') || norm.includes('dois litros') || (!norm.includes('lata') && !norm.includes('600'));
                    } else if (bNorm.includes('600')) {
                        volumeMatched = norm.includes('600');
                    } else if (bNorm.includes('lata') || bNorm.includes('350')) {
                        volumeMatched = norm.includes('lata') || norm.includes('350');
                    }

                    if (volumeMatched && !matched.some(m => m.id === bev.id)) {
                        const qty = this.extractQuantityInText(norm) || 1;
                        matched.push({ ...bev, quantity: qty });
                    }
                }
            });

            return matched;
        },

        /**
         * Detecta outros produtos gerais (calzones, hambúrgueres, porções)
         */
        detectGeneralProductsInText: function (input, catalog) {
            const norm = normalizeText(input);
            const matched = [];

            // 1. Testa hambúrgueres
            const burgers = this.detectBurgersInText(norm, catalog);
            if (burgers.length > 0) return burgers;

            // 2. Testa calzones
            const calzones = this.detectCalzonesInText(norm, catalog);
            if (calzones.length > 0) return calzones;

            // 3. Outras categorias gerais (porções, sobremesas)
            const categories = ['porcoes', 'sobremesas', 'lanches'];
            categories.forEach(catKey => {
                const items = catalog.menu_items?.[catKey] || [];
                const arr = Array.isArray(items) ? items : Object.values(items);
                arr.forEach(item => {
                    if (!item || !item.name) return;
                    const iNorm = normalizeText(item.name);
                    if (norm.includes(iNorm) || this.fuzzyMatchWords(norm, iNorm)) {
                        if (!matched.some(m => m.id === item.id)) {
                            const qty = this.extractQuantityInText(norm) || 1;
                            matched.push({ ...item, quantity: qty, category: catKey });
                        }
                    }
                });
            });

            return matched;
        },

        /**
         * Extrai quantidade numérica (ex: "2 cocas", "dois hambúrgueres")
         */
        extractQuantityInText: function (norm) {
            if (norm.includes('duas') || norm.includes('dois') || norm.includes(' 2 ')) return 2;
            if (norm.includes('tres') || norm.includes(' 3 ')) return 3;
            if (norm.includes('quatro') || norm.includes(' 4 ')) return 4;
            if (norm.includes('cinco') || norm.includes(' 5 ')) return 5;
            const match = norm.match(/\b(\d+)\b/);
            if (match) return parseInt(match[1], 10);
            return 1;
        },

        /**
         * Casamento aproximado por palavras-chave
         */
        fuzzyMatchWords: function (text, target) {
            const targetWords = target.split(' ').filter(w => w.length > 3);
            if (targetWords.length === 0) return false;
            let hits = 0;
            targetWords.forEach(w => {
                if (text.includes(w)) hits++;
            });
            return hits >= Math.ceil(targetWords.length * 0.7);
        },

        /* ==========================================================================
           HELPERS DE CATÁLOGO MULTIEMPRESA
           ========================================================================== */

        /**
         * Retorna o catálogo isolado da empresa ativa
         */
        getCatalogData: function () {
            if (typeof menuData !== 'undefined' && menuData) {
                return menuData;
            }
            if (typeof DEFAULT_MENU_FALLBACK !== 'undefined') {
                return DEFAULT_MENU_FALLBACK;
            }
            return { menu_items: {}, settings: {}, pizza_config: {}, sharedOptionGroups: {} };
        },

        /**
         * Lista de tamanhos formatada
         */
        getAvailableSizesList: function (catalog) {
            const sizesConfig = catalog.pizza_config?.sizes || {
                media: { name: 'Média (8 fatias)' },
                grande: { name: 'Grande (12 fatias)' }
            };
            return Object.values(sizesConfig).filter(s => s && s.active !== false).map(s => s.name);
        },

        /**
         * Lista de bordas cadastradas no catálogo
         */
        getAvailableBordersList: function (catalog) {
            const borders = [];

            if (catalog.sharedOptionGroups?.crust?.options) {
                catalog.sharedOptionGroups.crust.options.forEach(opt => {
                    if (opt.id !== 'borda_tradicional' && opt.price > 0) {
                        let displayName = opt.name.replace(/^Massa Tradicional \+ Borda /i, '').replace(/^Borda /i, '').trim();
                        borders.push({
                            id: opt.id,
                            name: displayName,
                            price: opt.price
                        });
                    }
                });
            }

            if (borders.length === 0 && catalog.pizza_config?.borders) {
                const bordersData = catalog.pizza_config.borders;
                const arr = Array.isArray(bordersData) ? bordersData : Object.values(bordersData);
                arr.forEach(b => {
                    if (b && b.name && b.active !== false) {
                        borders.push(b);
                    }
                });
            }

            if (borders.length === 0) {
                borders.push(
                    { id: 'borda_requeijao', name: 'Requeijão', price: 17 },
                    { id: 'borda_catupiry', name: 'Catupiry', price: 21 },
                    { id: 'borda_cheddar', name: 'Cheddar', price: 17 }
                );
            }

            return borders;
        },

        /**
         * Atualiza barra inferior do carrinho no modal de voz
         */
        updateCartFooterUI: function () {
            const itemsCountEl = document.getElementById('voiceCartItemsCount');
            const totalEl = document.getElementById('voiceCartTotalValue');
            const currentCart = (typeof window.cart !== 'undefined') ? window.cart : (typeof cart !== 'undefined' ? cart : []);

            let totalItems = 0;
            let subtotal = 0;

            if (currentCart && Array.isArray(currentCart)) {
                currentCart.forEach(i => {
                    totalItems += (i.quantity || 1);
                    subtotal += (i.totalPrice || (i.singlePrice * i.quantity) || 0);
                });
            }

            if (itemsCountEl) {
                itemsCountEl.innerText = `${totalItems} ${totalItems === 1 ? 'item' : 'itens'}`;
            }
            if (totalEl) {
                totalEl.innerText = formatMoney(subtotal);
            }
        },

        /* ==========================================================================
           RENDERIZAÇÃO DA INTERFACE VISUAL (DOM INJECTION)
           ========================================================================== */

        /**
         * Constrói e injeta os botões e o modal de voz no HTML se não existirem
         */
        renderUI: function () {
            // 1. Botão Flutuante (Floating Action Button)
            if (!document.getElementById('jcVoiceFloatBtn')) {
                const floatBtn = document.createElement('button');
                floatBtn.type = 'button';
                floatBtn.id = 'jcVoiceFloatBtn';
                floatBtn.className = 'voice-float-btn';
                floatBtn.setAttribute('aria-label', 'Atendimento por Voz com IA');
                floatBtn.title = 'Fale seu pedido com nossa Inteligência Artificial';
                floatBtn.innerHTML = `
                    <span class="voice-pulse-ring"></span>
                    <span class="material-symbols-rounded mic-icon">mic</span>
                    <span>FALE SEU PEDIDO</span>
                `;
                floatBtn.onclick = () => this.toggle();
                document.body.appendChild(floatBtn);
            }

            // 2. Modal do Assistente de Voz
            if (!document.getElementById('jcVoiceModalBackdrop')) {
                const backdrop = document.createElement('div');
                backdrop.id = 'jcVoiceModalBackdrop';
                backdrop.className = 'voice-modal-backdrop';

                backdrop.innerHTML = `
                    <div class="voice-assistant-sheet" role="dialog" aria-modal="true" aria-label="Assistente de Voz JC Food">
                        <!-- Header -->
                        <div class="voice-sheet-header">
                            <div class="voice-brand-info">
                                <div class="voice-avatar-circle">
                                    <span class="material-symbols-rounded">mic</span>
                                </div>
                                <div>
                                    <h3 class="voice-sheet-title">
                                        <span id="voiceHeaderAssistantName">${this.escapeHTML(this.settings.assistantName)}</span>
                                        <span class="voice-badge-ai" style="background: rgba(255,107,0,0.2); color: var(--primary); font-size: 10px; padding: 2px 6px; border-radius: 4px;">IA</span>
                                    </h3>
                                    <p class="voice-sheet-status">
                                        <span class="voice-status-dot" id="voiceStatusDot"></span>
                                        <span id="voiceStatusText">Pronto para ouvir</span>
                                    </p>
                                </div>
                            </div>
                            <div class="voice-header-actions">
                                <button type="button" class="voice-btn-icon" id="voiceMuteBtn" title="Interromper fala do assistente" onclick="VoiceAssistant.stopSpeaking()">
                                    <span class="material-symbols-rounded">volume_off</span>
                                </button>
                                <button type="button" class="voice-btn-icon" title="Fechar Assistente" onclick="VoiceAssistant.close()">
                                    <span class="material-symbols-rounded">close</span>
                                </button>
                            </div>
                        </div>

                        <!-- Soundwaves visualizer -->
                        <div class="voice-wave-container" id="voiceWaveContainer">
                            <div class="voice-wave-bar"></div>
                            <div class="voice-wave-bar"></div>
                            <div class="voice-wave-bar"></div>
                            <div class="voice-wave-bar"></div>
                            <div class="voice-wave-bar"></div>
                            <div class="voice-wave-bar"></div>
                            <div class="voice-wave-bar"></div>
                            <div class="voice-wave-bar"></div>
                        </div>

                        <!-- Chat Messages -->
                        <div class="voice-chat-messages" id="voiceChatMessages"></div>

                        <!-- Cart Footer Bar -->
                        <div class="voice-cart-footer">
                            <div class="voice-cart-summary">
                                <span class="voice-cart-summary-items" id="voiceCartItemsCount">0 itens</span>
                                <span class="voice-cart-summary-total" id="voiceCartTotalValue">R$ 0,00</span>
                            </div>
                            <button type="button" class="voice-btn-checkout" onclick="VoiceAssistant.handleCheckoutIntent()">
                                <span class="material-symbols-rounded" style="font-size: 18px;">shopping_cart_checkout</span>
                                <span>Finalizar Pedido</span>
                            </button>
                        </div>

                        <!-- Audio & Input Controls -->
                        <div class="voice-sheet-controls">
                            <div class="voice-mic-action-row">
                                <button type="button" class="voice-secondary-btn" title="Limpar conversa" onclick="VoiceAssistant.resetConversation()">
                                    <span class="material-symbols-rounded">restart_alt</span>
                                </button>
                                
                                <button type="button" class="voice-main-mic-btn" id="voiceMainMicBtn" title="Toque para falar" onclick="VoiceAssistant.toggleListening()">
                                    <span class="material-symbols-rounded">mic</span>
                                </button>

                                <button type="button" class="voice-secondary-btn" title="Ver Carrinho" onclick="VoiceAssistant.handleReviewCartIntent()">
                                    <span class="material-symbols-rounded">shopping_bag</span>
                                </button>
                            </div>

                            <!-- Text Input Fallback -->
                            <div class="voice-text-input-row">
                                <input type="text" id="voiceTextInput" class="voice-text-input" placeholder="Ou digite o que você quer pedir..." autocomplete="off">
                                <button type="button" class="voice-send-btn" onclick="VoiceAssistant.sendTextMessage()" title="Enviar mensagem">
                                    <span class="material-symbols-rounded" style="font-size: 18px;">send</span>
                                </button>
                            </div>
                        </div>
                    </div>
                `;

                backdrop.addEventListener('click', (e) => {
                    if (e.target === backdrop) {
                        this.close();
                    }
                });

                document.body.appendChild(backdrop);
            }
        },

        /**
         * Alterna estado de escuta
         */
        toggleListening: function () {
            if (this.isListening) {
                this.stopListening();
            } else {
                this.startListening();
            }
        },

        /**
         * Conecta eventos de teclado e inputs
         */
        attachEventListeners: function () {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen) {
                    this.close();
                }
            });

            const input = document.getElementById('voiceTextInput');
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.sendTextMessage();
                    }
                });
            }
        },

        /**
         * Escapa strings para injeção segura no DOM
         */
        escapeHTML: function (str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        },

        /**
         * Formata marcações simples em negrito/itálico para balões
         */
        formatMarkdown: function (str) {
            if (!str) return '';
            return this.escapeHTML(str)
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\n/g, '<br>');
        }
    };

    // Inicialização automática ao carregar o DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => VoiceAssistant.init());
    } else {
        VoiceAssistant.init();
    }

    // Exportação no escopo global
    window.VoiceAssistant = VoiceAssistant;

})(typeof window !== 'undefined' ? window : this);
