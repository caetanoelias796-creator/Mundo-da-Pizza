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
 * 4. Máquina de Estados Conversacional (atendimento guiado para pedidos e pizzas)
 * 5. Integração com o Catálogo Real e Isolamento Multiempresa (TenantContext)
 * 6. Integração com o Motor Oficial de Pizzas (PizzaEngine.js)
 * 7. Integração Oficial com o Carrinho e Checkout (app.js)
 * 8. Segurança estrita (sem chamadas arbitrárias ao banco, validação de preços)
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
        version: '1.0.0',
        activeTenant: null,
        isOpen: false,
        isListening: false,
        isSpeaking: false,
        speechSupported: false,
        recognition: null,
        activeUtterance: null,
        
        // Estado Conversacional da Sessão
        conversationState: {
            step: 'IDLE', // IDLE, GREETING, BUILDING_PIZZA_SIZE, BUILDING_PIZZA_FLAVORS, ASKING_BORDER, ASKING_BEVERAGE, CONFIRM_ADD, REVIEW_CART
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
            greeting: 'Olá! Sou o assistente de voz. O que você gostaria de pedir hoje?',
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
                this.settings.greeting = (vConf.greeting || 'Olá! Sou o assistente de voz do {companyName}. Posso anotar seu pedido! O que você gostaria de pedir hoje?')
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

            // Se o assistente estiver falando, para a fala antes de ouvir
            this.stopSpeaking();

            try {
                this.recognition.start();
            } catch (e) {
                // Se já estiver ouvindo, tenta reiniciar
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

            // Remove formatações Markdown/HTML do áudio falado
            const cleanText = text
                .replace(/\*+/g, '')
                .replace(/<[^>]*>/g, '')
                .replace(/R\$\s*(\d+)[,.](\d{2})/g, '$1 reais e $2 centavos')
                .replace(/R\$\s*(\d+)/g, '$1 reais');

            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.lang = 'pt-BR';
            utterance.rate = this.settings.voiceRate || 1.05;
            utterance.pitch = this.settings.voicePitch || 1.0;

            // Tenta selecionar uma voz pt-BR natural
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
                    // Se a conversa exigir resposta contínua, abre o microfone automaticamente após falar
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

            // Se for o início da sessão, envia a saudação oficial
            if (this.conversationState.history.length === 0) {
                this.addBotMessage(this.settings.greeting);
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
                            <span class="material-symbols-rounded" style="color: var(--primary); font-size: 18px;">local_pizza</span>
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

            // 5. NLU Geral: Detecta se é pedido de pizza, bebida, produto geral ou consulta
            this.interpretGeneralIntent(norm, text);
        },

        /**
         * Interpretador Geral de Intenções (NLU)
         */
        interpretGeneralIntent: function (norm, text) {
            const catalog = this.getCatalogData();

            // Identifica se mencionou "pizza" ou sabores conhecidos de pizza
            const identifiedSize = this.detectSizeInText(norm, catalog);
            const identifiedFlavors = this.detectFlavorsInText(norm, catalog);
            const identifiedBeverages = this.detectBeveragesInText(norm, catalog);
            const identifiedProducts = this.detectGeneralProductsInText(norm, catalog);

            // CASO A: Pedido de Pizza identificado
            if (norm.includes('pizza') || identifiedFlavors.length > 0 || (identifiedSize && !identifiedBeverages.length)) {
                this.startPizzaOrderFlow(identifiedSize, identifiedFlavors, norm);
                return;
            }

            // CASO B: Pedido de Bebida
            if (identifiedBeverages.length > 0) {
                this.addBeveragesToCart(identifiedBeverages);
                return;
            }

            // CASO C: Pedido de Outro Produto (Hambúrguer, Calzone, etc.)
            if (identifiedProducts.length > 0) {
                this.addGeneralProductsToCart(identifiedProducts);
                return;
            }

            // CASO D: Consulta de Cardápio / Ajuda
            if (norm.includes('cardapio') || norm.includes('sabores') || norm.includes('quais') || norm.includes('opcoes') || norm.includes('ajuda')) {
                this.handleMenuInquiry(norm);
                return;
            }

            // CASO E: Saudações
            if (norm.match(/^(oi|ola|bom dia|boa tarde|boa noite|opa|e ai)/)) {
                const reply = `Olá! Tudo bem? O que você gostaria de pedir hoje? Temos pizzas artesanais, lanches, calzones e bebidas geladas!`;
                this.addBotMessage(reply, null, ['Quero uma Pizza Grande', 'Ver Bebidas', 'Quais os Sabores?']);
                this.speak(reply);
                return;
            }

            // Fallback amigável
            const fallbackReply = `Não entendi completamente o que deseja. Você pode dizer, por exemplo: *"Quero uma pizza grande de calabresa"* ou *"Adicione uma Coca-Cola 2 litros"*!`;
            this.addBotMessage(fallbackReply, null, ['Pizza Grande Calabresa', 'Pizza Média 2 Sabores', 'Coca-Cola 2L', 'Ver Carrinho']);
            this.speak(fallbackReply);
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

            // Se não informou o tamanho, pergunta o tamanho
            if (!this.conversationState.pendingPizza.sizeObj) {
                this.conversationState.step = 'BUILDING_PIZZA_SIZE';
                const availableSizes = this.getAvailableSizesList(catalog);
                const reply = `Com certeza! Qual tamanho de pizza você prefere? Temos ${availableSizes.join(' e ')}.`;
                const chips = availableSizes.map(s => 'Tamanho ' + s);
                this.addBotMessage(reply, null, chips);
                this.speak(reply);
                return;
            }

            // Se tem o tamanho mas não tem sabores suficientes
            const maxFlavors = this.conversationState.pendingPizza.sizeObj.maxFlavors || 2;
            if (this.conversationState.pendingPizza.flavors.length === 0) {
                this.conversationState.step = 'BUILDING_PIZZA_FLAVORS';
                const reply = `Perfeito, tamanho ${this.conversationState.pendingPizza.sizeObj.name}! Esse tamanho permite até ${maxFlavors} sabores. Quais sabores você gostaria?`;
                this.addBotMessage(reply, null, ['Calabresa', 'Quatro Queijos', 'Frango com Catupiry', 'Marguerita']);
                this.speak(reply);
                return;
            }

            // Se informou 1 sabor mas o tamanho permite 2 ou 3 e o cliente não especificou que quer inteira
            if (this.conversationState.pendingPizza.flavors.length === 1 && maxFlavors > 1 && !norm.includes('so ') && !norm.includes('apenas') && !norm.includes('inteira')) {
                this.conversationState.step = 'BUILDING_PIZZA_FLAVORS';
                const flavorName = this.conversationState.pendingPizza.flavors[0].name;
                const reply = `Ótima escolha: ${flavorName}! A pizza ${this.conversationState.pendingPizza.sizeObj.name} aceita até ${maxFlavors} sabores. Gostaria de adicionar um segundo sabor meio a meio, ou prefere ela inteira de ${flavorName}?`;
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

            if (!size) {
                const availableSizes = this.getAvailableSizesList(catalog);
                const reply = `Por favor, escolha um dos tamanhos disponíveis: ${availableSizes.join(' ou ')}.`;
                this.addBotMessage(reply, null, availableSizes.map(s => 'Tamanho ' + s));
                this.speak(reply);
                return;
            }

            this.conversationState.pendingPizza.sizeId = size.id;
            this.conversationState.pendingPizza.sizeObj = size;

            // Se já tinha sabores anotados, segue
            if (this.conversationState.pendingPizza.flavors.length > 0) {
                this.proceedToBorderStep();
            } else {
                this.conversationState.step = 'BUILDING_PIZZA_FLAVORS';
                const maxFlavors = size.maxFlavors || 2;
                const reply = `Tamanho ${size.name} selecionado! Ela pode ter até ${maxFlavors} sabores. Qual sabor você gostaria?`;
                this.addBotMessage(reply, null, ['Calabresa', 'Quatro Queijos', 'Frango com Catupiry', 'Portuguesa']);
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

            // Se o cliente respondeu "só calabresa" ou "inteira"
            if (norm.includes('inteira') || norm.includes('so esse') || norm.includes('so essa') || norm.includes('apenas') || norm.includes('nao precisa outro')) {
                if (pending.flavors.length > 0) {
                    this.proceedToBorderStep();
                    return;
                }
            }

            const foundFlavors = this.detectFlavorsInText(norm, catalog);

            if (foundFlavors.length === 0) {
                const reply = `Não encontrei esse sabor no cardápio. Você pode escolher entre nossos sabores tradicionais como Calabresa, Quatro Queijos, Marguerita, Portuguesa ou Frango com Catupiry!`;
                this.addBotMessage(reply, null, ['Calabresa', 'Quatro Queijos', 'Marguerita', 'Portuguesa']);
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
                // Restaurante não tem bordas cadastradas
                this.commitPizzaToCart();
                return;
            }

            this.conversationState.step = 'ASKING_BORDER';
            const borderNames = borders.map(b => b.name);
            const reply = `Gostaria de adicionar borda recheada na sua pizza? Temos ${borderNames.join(', ')} ou sem borda.`;
            const chips = ['Sem Borda'].concat(borderNames.map(b => 'Borda ' + b));
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

            // Normaliza objeto de configuração para o PizzaEngine
            const sizeKey = pending.sizeObj.id;
            const flavors = pending.flavors.map(f => ({
                id: f.id,
                name: f.name,
                categoryType: f.categoryType || (f.category === 'pizzas_especiais' ? 'especial' : 'tradicional'),
                price: Number(f.price || 0)
            }));

            // Preços oficiais de pizza
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

            // Se o PizzaEngine não retornou ou cálculo direto
            if (unitPrice <= 0) {
                const maxFlavorPrice = Math.max(...flavors.map(f => f.price || 0));
                unitPrice = maxFlavorPrice > 0 ? maxFlavorPrice : 50.0;
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
                priceFormatted: formatMoney(totalPrice)
            };

            const confirmReply = `Prontinho! Adicionei ao seu pedido a **${fullTitle}** por **${formatMoney(totalPrice)}**. Gostaria de adicionar alguma bebida gelada para acompanhar?`;
            this.addBotMessage(confirmReply, cardData, ['Coca-Cola 2 Litros', 'Guaraná Lata', 'Água Mineral', 'Não, só isso']);
            this.speak(confirmReply);
        },

        /**
         * Passo de Bebida após a pizza
         */
        handleStepBeverage: function (norm, text) {
            if (norm.includes('nao') || norm.includes('so isso') || norm.includes('nao precisa') || norm.includes('fechar') || norm.includes('so a pizza')) {
                this.conversationState.step = 'IDLE';
                this.handleReviewCartIntent();
                return;
            }

            const catalog = this.getCatalogData();
            const drinks = this.detectBeveragesInText(norm, catalog);

            if (drinks.length > 0) {
                this.addBeveragesToCart(drinks);
            } else {
                const reply = `Não encontrei essa bebida. Deseja uma Coca-Cola, Guaraná, Cerveja, Suco ou podemos ir para a finalização?`;
                this.addBotMessage(reply, null, ['Coca-Cola 2L', 'Guaraná Lata', 'Ver Carrinho', 'Finalizar Pedido']);
                this.speak(reply);
            }
        },

        /* ==========================================================================
           BEBIDAS E OUTROS PRODUTOS
           ========================================================================== */

        /**
         * Adiciona bebidas ao carrinho
         */
        addBeveragesToCart: function (beverages) {
            beverages.forEach(b => {
                const unitPrice = Number(b.price || 0);
                const qty = b.quantity || 1;
                const totalPrice = unitPrice * qty;

                const cartItem = {
                    cartItemId: 'voice_bev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                    id: b.id,
                    name: b.name,
                    category: 'bebidas',
                    singlePrice: unitPrice,
                    basePrice: unitPrice,
                    quantity: qty,
                    totalPrice: totalPrice,
                    notes: 'Pedido por voz'
                };

                this.pushToOfficialCart(cartItem);

                const cardData = {
                    title: `${qty}x ${b.name}`,
                    desc: 'Bebida gelada',
                    priceFormatted: formatMoney(totalPrice)
                };

                const reply = `Adicionei **${qty}x ${b.name}** ao seu pedido por **${formatMoney(totalPrice)}**!`;
                this.addBotMessage(reply, cardData, ['Ver Carrinho', 'Pedir Outro Item', 'Finalizar Pedido']);
                this.speak(reply);
            });

            this.conversationState.step = 'IDLE';
        },

        /**
         * Adiciona produtos gerais (hambúrgueres, lanches, porções) ao carrinho
         */
        addGeneralProductsToCart: function (products) {
            products.forEach(p => {
                const unitPrice = Number(p.price || 0);
                const qty = p.quantity || 1;
                const totalPrice = unitPrice * qty;

                const cartItem = {
                    cartItemId: 'voice_prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                    id: p.id,
                    name: p.name,
                    category: p.category || 'lanches',
                    singlePrice: unitPrice,
                    basePrice: unitPrice,
                    quantity: qty,
                    totalPrice: totalPrice,
                    notes: 'Pedido por voz'
                };

                this.pushToOfficialCart(cartItem);

                const cardData = {
                    title: `${qty}x ${p.name}`,
                    desc: p.description || 'Produto oficial JC Food',
                    priceFormatted: formatMoney(totalPrice)
                };

                const reply = `Adicionei **${qty}x ${p.name}** ao seu pedido por **${formatMoney(totalPrice)}**! Deseja mais alguma coisa ou podemos finalizar?`;
                this.addBotMessage(reply, cardData, ['Adicionar Bebida', 'Ver Carrinho', 'Finalizar Pedido']);
                this.speak(reply);
            });

            this.conversationState.step = 'IDLE';
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

            // Aciona sincronização oficial do JC Food
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
                const emptyReply = `Seu carrinho está vazio no momento. Que tal escolher uma deliciosa pizza ou um lanche?`;
                this.addBotMessage(emptyReply, null, ['Pizza Grande', 'Ver Bebidas', 'Quais os Sabores?']);
                this.speak(emptyReply);
                return;
            }

            let subtotal = 0;
            const itemsList = currentCart.map(item => {
                subtotal += item.totalPrice;
                return `• ${item.quantity}x ${item.name} (${formatMoney(item.totalPrice)})`;
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
            this.addBotMessage(reply, null, ['Quero uma Pizza', 'Ver Cardápio']);
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
                this.addBotMessage(reply, null, ['Quero uma Pizza Grande', 'Ver Bebidas']);
                this.speak(reply);
                return;
            }

            const reply = `Excelente! Estou abrindo a tela de finalização para você conferir seu endereço e forma de pagamento com segurança.`;
            this.addBotMessage(reply);
            this.speak(reply, () => {
                this.close();
                // Aciona o checkout oficial do JC Food
                if (typeof openCheckoutModal === 'function') {
                    openCheckoutModal();
                } else if (typeof toggleCart === 'function') {
                    toggleCart(true);
                }
            });
        },

        /**
         * Consultas de cardápio / sabores
         */
        handleMenuInquiry: function (norm) {
            const catalog = this.getCatalogData();
            if (norm.includes('bebida') || norm.includes('refrigerante')) {
                const drinks = (catalog.menu_items?.bebidas || []).slice(0, 5).map(b => b.name);
                const reply = `Temos opções geladas como: ${drinks.join(', ')} e muito mais! Qual você prefere?`;
                this.addBotMessage(reply, null, drinks.slice(0, 4));
                this.speak(reply);
                return;
            }

            // Sabores de pizza
            const flavors = [];
            const cats = ['pizzas_salgadas', 'pizzas_tradicionais', 'pizzas_especiais', 'pizzas_doces'];
            cats.forEach(c => {
                if (catalog.menu_items && catalog.menu_items[c]) {
                    const arr = Array.isArray(catalog.menu_items[c]) ? catalog.menu_items[c] : Object.values(catalog.menu_items[c]);
                    arr.forEach(f => { if (f && f.name && !flavors.includes(f.name)) flavors.push(f.name); });
                }
            });

            const topFlavors = flavors.slice(0, 6);
            const reply = `Nossos sabores mais pedidos são: ${topFlavors.join(', ')}! Você pode pedir no tamanho Média ou Grande com até 3 sabores!`;
            this.addBotMessage(reply, null, topFlavors.slice(0, 4).map(f => 'Pizza ' + f));
            this.speak(reply);
        },

        /* ==========================================================================
           DETECÇÃO DE ENTIDADES (NLU ENGINE)
           ========================================================================== */

        /**
         * Detecta tamanho no texto
         */
        detectSizeInText: function (input, catalog) { const norm = normalizeText(input);
            const sizesConfig = catalog.pizza_config?.sizes || {
                media: { id: 'media', name: 'Média', maxFlavors: 2 },
                grande: { id: 'grande', name: 'Grande', maxFlavors: 3 }
            };

            const sizesArr = Object.values(sizesConfig);

            if (norm.includes('media') || norm.includes('medio') || norm.includes('8 fatias')) {
                return sizesArr.find(s => s.id === 'media' || normalizeText(s.name).includes('media')) || { id: 'media', name: 'Média', maxFlavors: 2 };
            }
            if (norm.includes('grande') || norm.includes('12 fatias')) {
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
        detectFlavorsInText: function (input, catalog) { const norm = normalizeText(input);
            const allFlavors = [];
            const cats = ['pizzas_salgadas', 'pizzas_tradicionais', 'pizzas_especiais', 'pizzas_doces'];

            cats.forEach(c => {
                if (catalog.menu_items && catalog.menu_items[c]) {
                    const arr = Array.isArray(catalog.menu_items[c]) ? catalog.menu_items[c] : Object.values(catalog.menu_items[c]);
                    arr.forEach(f => {
                        if (f && f.name) {
                            allFlavors.push({
                                id: f.id || normalizeText(f.name).replace(/\s+/g, '_'),
                                name: f.name,
                                category: c,
                                categoryType: c.includes('especial') ? 'especial' : (c.includes('doce') ? 'doce' : 'tradicional'),
                                price: Number(f.price || 0)
                            });
                        }
                    });
                }
            });

            // Também inclui pizza_config.flavors caso exista
            if (catalog.pizza_config?.flavors) {
                const pFlavors = Array.isArray(catalog.pizza_config.flavors) ? catalog.pizza_config.flavors : Object.values(catalog.pizza_config.flavors);
                pFlavors.forEach(f => {
                    if (f && f.name && !allFlavors.some(x => x.id === f.id)) {
                        allFlavors.push(f);
                    }
                });
            }

            const matched = [];
            allFlavors.forEach(flavor => {
                const fNorm = normalizeText(flavor.name);
                const idNorm = normalizeText((flavor.id || '').replace(/_/g, ' '));

                // 1. Match completo da frase ou ID
                let isMatch = norm.includes(fNorm) || (idNorm && norm.includes(idNorm));

                // 2. Match inteligente por palavras-chave principais (ex: 'calabresa' em 'Calabresa Especial', 'frango' em 'Frango com Catupiry')
                if (!isMatch) {
                    const stopWords = ['especial', 'tradicional', 'gourmet', 'pizza', 'com', 'ao', 'de', 'do', 'da'];
                    const keywords = fNorm.split(' ').filter(w => w.length >= 4 && !stopWords.includes(w));
                    for (const kw of keywords) {
                        if (norm.includes(kw)) {
                            isMatch = true;
                            break;
                        }
                    }
                }

                // 3. Fuzzy match de suporte
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
        detectBorderInText: function (input, catalog) { const norm = normalizeText(input);
            const borders = this.getAvailableBordersList(catalog);
            for (const b of borders) {
                const bNorm = normalizeText(b.name);
                if (norm.includes(bNorm) || norm.includes('borda de ' + bNorm) || norm.includes('borda ' + bNorm)) {
                    return b;
                }
            }
            return null;
        },

        /**
         * Detecta bebidas no texto
         */
        detectBeveragesInText: function (input, catalog) { const norm = normalizeText(input);
            const rawBeverages = catalog.menu_items?.bebidas || [];
            const arr = Array.isArray(rawBeverages) ? rawBeverages : Object.values(rawBeverages);
            const matched = [];

            arr.forEach(bev => {
                if (!bev || !bev.name) return;
                const bNorm = normalizeText(bev.name);
                
                // Mapeamentos comuns (coca, guarana, cerveja, agua, suco)
                const isMatch = norm.includes(bNorm) || 
                                (bNorm.includes('coca') && norm.includes('coca')) ||
                                (bNorm.includes('guarana') && norm.includes('guarana')) ||
                                (bNorm.includes('agua') && norm.includes('agua')) ||
                                (bNorm.includes('heineken') && norm.includes('heineken')) ||
                                (bNorm.includes('chopp') && norm.includes('chopp'));

                if (isMatch) {
                    // Detecta se especificou lata, 2 litros, etc.
                    let volumeMatched = true;
                    if (bNorm.includes('2l') || bNorm.includes('2 litros')) {
                        volumeMatched = norm.includes('2l') || norm.includes('2 litros') || norm.includes('dois litros') || !norm.includes('lata');
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
         * Detecta lanches, calzones, hambúrgueres no texto
         */
        detectGeneralProductsInText: function (input, catalog) { const norm = normalizeText(input);
            const matched = [];
            const categories = ['hamburgueres', 'burgers', 'calzones', 'porcoes', 'sobremesas'];

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
         * Extrai quantidade numérica (ex: "2 cocas", "duas pizzas")
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
            return { menu_items: {}, settings: {}, pizza_config: {} };
        },

        /**
         * Lista de tamanhos formatada
         */
        getAvailableSizesList: function (catalog) {
            const sizesConfig = catalog.pizza_config?.sizes || {
                media: { name: 'Média' },
                grande: { name: 'Grande' }
            };
            return Object.values(sizesConfig).filter(s => s && s.active !== false).map(s => s.name);
        },

        /**
         * Lista de bordas cadastradas
         */
        getAvailableBordersList: function (catalog) {
            const bordersData = catalog.pizza_config?.borders || catalog.borders || {};
            const arr = Array.isArray(bordersData) ? bordersData : Object.values(bordersData);
            return arr.filter(b => b && b.name && b.active !== false);
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
                    subtotal += (i.totalPrice || 0);
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

                // Fecha ao tocar fora no backdrop
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

            // Input Enter key
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
