# Guia Reutilizável: PWA Fullscreen & Auto-preenchimento (Dados do Cliente)

Este guia serve como um modelo completo e documentação técnica para replicar as melhorias de **Exibição em Tela Cheia (PWA)**, **Banner de Instalação Rápida** e **Salvar Dados do Cliente (Auto-preenchimento)** em qualquer outro cardápio digital estruturado em HTML, CSS e JavaScript.

---

## 1. Configurando o Manifesto PWA (`manifest.json`)
Crie um arquivo chamado `manifest.json` na pasta raiz do projeto.

```json
{
  "name": "Nome da Pizzaria",
  "short_name": "Pizzaria",
  "description": "Cardápio Digital Premium e Delivery",
  "start_url": ".",
  "display": "standalone",
  "background_color": "#0c0c0e",
  "theme_color": "#e53935",
  "orientation": "portrait",
  "icons": [
    {
      "src": "assets/logo.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "assets/logo.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

---

## 2. Configurando o Service Worker (`service-worker.js`)
Crie o arquivo `service-worker.js` na raiz do projeto com estratégia **Network First** para garantir dados sempre atualizados com fallback offline:

```javascript
const CACHE_NAME = 'pizzaria-pwa-v1';
const ASSETS = [
  './',
  './index.html',
  './index.css',
  './app.js',
  './assets/logo.png',
  './menu.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(err => {
        console.warn('Falha no cache inicial do PWA (será carregado via rede):', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200 && event.request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
```

---

## 3. Alterações no HTML (`index.html`)

### A. Adicione as tags de PWA no `<head>`:
```html
    <!-- PWA & Mobile App Settings -->
    <link rel="manifest" href="manifest.json">
    <meta name="theme-color" content="#e53935">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Nome do Aplicativo">
    <link rel="apple-touch-icon" href="assets/logo.png">
```

### B. Adicione a maracação do PWA Install Banner no final do `<body>`, logo acima do rodapé de navegação fixa:
```html
        <!-- PWA Install Banner -->
        <div id="pwaInstallBanner" class="pwa-install-banner hidden">
            <div class="pwa-banner-content">
                <span class="material-symbols-rounded pwa-icon">download_for_offline</span>
                <div class="pwa-banner-text">
                    <strong>Instalar Aplicativo</strong>
                    <span>Acesse mais rápido e faça pedidos em tela cheia!</span>
                </div>
                <button id="btnPwaInstall" class="btn-pwa-install">Instalar</button>
                <button id="btnPwaClose" class="btn-pwa-close">
                    <span class="material-symbols-rounded">close</span>
                </button>
            </div>
        </div>
```

---

## 4. Estilização no CSS (`index.css`)
Adicione estes estilos para exibir o banner flutuante de forma premium e responsiva (ajustando a distância do rodapé `bottom` conforme a altura da sua barra de navegação):

```css
/* ==========================================================================
   PWA Install Banner Component
   ========================================================================== */
.pwa-install-banner {
    position: absolute;
    bottom: 92px; /* Ajuste para ficar logo acima da sua barra de rodapé */
    left: 16px;
    right: 16px;
    background: rgba(21, 21, 24, 0.95);
    border: 1px solid var(--primary);
    border-radius: var(--radius-md);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 15px rgba(229, 57, 53, 0.15);
    z-index: 999;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease;
}

.pwa-install-banner.hidden {
    opacity: 0;
    pointer-events: none;
    transform: translateY(20px);
}

.pwa-banner-content {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    gap: 12px;
    position: relative;
}

.pwa-icon {
    font-size: 32px;
    color: var(--primary);
}

.pwa-banner-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding-right: 20px;
}

.pwa-banner-text strong {
    font-size: 13px;
    color: #ffffff;
    font-weight: 700;
}

.pwa-banner-text span {
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.3;
}

.btn-pwa-install {
    background-color: var(--primary);
    color: #ffffff;
    border: none;
    padding: 8px 16px;
    font-size: 12px;
    font-weight: 700;
    border-radius: 30px;
    cursor: pointer;
    transition: var(--transition);
}

.btn-pwa-install:hover {
    background-color: var(--primary-hover);
    transform: scale(1.05);
}

.btn-pwa-close {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    top: 8px;
    right: 8px;
    border-radius: 50%;
    transition: var(--transition);
}

.btn-pwa-close:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.05);
}

.btn-pwa-close .material-symbols-rounded {
    font-size: 16px;
}
```

---

## 5. Implementação no JavaScript (`app.js`)

### A. Registro do Service Worker:
Adicione dentro do evento `DOMContentLoaded` principal do app:
```javascript
    // Registra o Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('PWA registrado no escopo:', reg.scope))
            .catch(err => console.warn('PWA registro falhou:', err));
    }
    
    // ... Chame a função de recuperar dados (B) ...
    loadClientInfoFromLocalStorage();
```

### B. Lógica do Prompt do PWA & Auto-preenchimento:
Adicione este bloco de código no final do arquivo JavaScript do projeto:

```javascript
/* ==========================================================================
   PWA Custom Install Prompt Logic
   ========================================================================== */
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const dismissed = localStorage.getItem('pwa_prompt_dismissed') === 'true';
    if (!dismissed) {
        showPwaInstallBanner();
    }
});

function showPwaInstallBanner() {
    const installBanner = document.getElementById('pwaInstallBanner');
    if (installBanner) {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        if (!isStandalone) {
            installBanner.classList.remove('hidden');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const installBanner = document.getElementById('pwaInstallBanner');
    const installBtn = document.getElementById('btnPwaInstall');
    const closeBtn = document.getElementById('btnPwaClose');
    
    if (!installBanner) return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const dismissed = localStorage.getItem('pwa_prompt_dismissed') === 'true';

    // Suporte e instruções exclusivas para iOS Safari
    if (isIOS && !isStandalone && !dismissed) {
        const bannerText = installBanner.querySelector('.pwa-banner-text span');
        if (bannerText) {
            bannerText.innerHTML = 'Toque em compartilhar (ícone <span style="font-size: 16px;">⎋</span>) e depois em "Adicionar à Tela de Início"';
        }
        if (installBtn) {
            installBtn.style.display = 'none';
        }
        setTimeout(showPwaInstallBanner, 1500);
    }

    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`PWA Escolha de instalação: ${outcome}`);
            deferredPrompt = null;
            installBanner.classList.add('hidden');
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            installBanner.classList.add('hidden');
            localStorage.setItem('pwa_prompt_dismissed', 'true');
        });
    }
});

/* ==========================================================================
   PWA Client Info Auto-Save & Auto-Fill
   ========================================================================== */
function saveClientInfoToLocalStorage(info) {
    try {
        const existingData = localStorage.getItem('pwa_client_info');
        let finalInfo = { ...info };
        if (existingData) {
            const existing = JSON.parse(existingData);
            // Preserva o endereço de entrega anterior caso o pedido atual seja Retirada
            if (info.checkoutType === 'pickup' && existing.address) {
                finalInfo.address = existing.address;
            }
        }
        localStorage.setItem('pwa_client_info', JSON.stringify(finalInfo));
    } catch (e) {
        console.error("Erro ao salvar dados no localStorage:", e);
    }
}

function loadClientInfoFromLocalStorage() {
    try {
        const data = localStorage.getItem('pwa_client_info');
        if (!data) return;
        const info = JSON.parse(data);
        
        const clientNameEl = document.getElementById('clientName');
        const clientPhoneEl = document.getElementById('clientPhone');
        
        if (clientNameEl && info.clientName) clientNameEl.value = info.clientName;
        if (clientPhoneEl && info.clientPhone) clientPhoneEl.value = info.clientPhone;
        
        if (info.address) {
            const streetEl = document.getElementById('addressStreet');
            const numberEl = document.getElementById('addressNumber');
            const neighborhoodEl = document.getElementById('addressBairro');
            const refEl = document.getElementById('addressRef');
            
            if (streetEl && info.address.street) streetEl.value = info.address.street;
            if (numberEl && info.address.number) numberEl.value = info.address.number;
            if (neighborhoodEl && info.address.neighborhood) {
                neighborhoodEl.value = info.address.neighborhood;
                if (typeof updateCheckoutPrice === 'function') {
                    updateCheckoutPrice(); // Recalcula a taxa de entrega automaticamente
                }
            }
            if (refEl && info.address.reference) refEl.value = info.address.reference;
        }
    } catch (e) {
        console.error("Erro ao carregar dados do localStorage:", e);
    }
}
```

### C. Salvando os Dados no Envio do Pedido:
Adicione dentro da função final de envio de pedido (ex: `submitOrder()`), logo após capturar os dados do formulário:
```javascript
    // Salva dados no localStorage para próximas compras
    saveClientInfoToLocalStorage({
        clientName: orderData.clientName,
        clientPhone: orderData.clientPhone,
        checkoutType: orderData.checkoutType,
        address: orderData.address
    });
```
