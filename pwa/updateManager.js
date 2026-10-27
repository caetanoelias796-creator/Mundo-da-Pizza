/* ==========================================================================
   Update Manager - JC Food PWA
   Identidade Visual: Dark Premium (#121419) + Ouro Oficial (#F5A623)
   ========================================================================== */

window.PWAUpdateManager = {
  registration: null,
  isUpdating: false,
  refreshing: false,

  init: function (registration) {
    if (!registration) return;
    this.registration = registration;
    this.listenForUpdates();
    this.listenForControllerChange();
  },

  listenForUpdates: function () {
    const reg = this.registration;
    if (!reg) return;

    // Força verificação imediata de nova versão no servidor
    if (typeof reg.update === 'function') {
      reg.update().catch(() => {});
    }

    // Se já houver um Service Worker no estado waiting e houver um controlador ativo
    if (reg.waiting && navigator.serviceWorker && navigator.serviceWorker.controller) {
      this.showUpdateBanner(reg.waiting);
      return;
    }

    // Monitora quando uma nova versão for detectada e baixada
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        // Exibe o popup somente quando o novo worker estiver instalado (waiting)
        // e já existir um controller (garantindo que NÃO apareça no primeiro acesso)
        if (newWorker.state === 'installed' && navigator.serviceWorker && navigator.serviceWorker.controller) {
          this.showUpdateBanner(newWorker);
        }
      });
    });
  },

  listenForControllerChange: function () {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Recarrega SOMENTE se a atualização tiver sido iniciada explicitamente pelo usuário
      if (!this.isUpdating) {
        console.log('[UpdateManager] controllerchange detectado em background. Aguardando confirmação do usuário.');
        return;
      }
      if (this.refreshing) return;
      this.refreshing = true;
      console.log('[UpdateManager] Novo Service Worker ativo com sucesso. Recarregando aplicação...');
      window.location.reload();
    });
  },

  showUpdateBanner: function (worker) {
    if (document.getElementById('pwa-update-banner')) return;

    const bannerHtml = `
      <div id="pwa-update-banner" role="alert" aria-live="assertive" style="
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #121419;
        border: 1.5px solid #F5A623;
        color: #FFFFFF;
        padding: 14px 18px;
        border-radius: 16px;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.85), 0 0 20px rgba(245, 166, 35, 0.25);
        z-index: 9999999;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        max-width: calc(100% - 28px);
        width: 440px;
        font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: pwaSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      ">
        <style>
          @keyframes pwaSlideUp {
            from { opacity: 0; transform: translate(-50%, 40px); }
            to { opacity: 1; transform: translate(-50%, 0); }
          }
          #pwa-btn-update-now:hover {
            transform: scale(1.02);
            filter: brightness(1.1);
          }
          #pwa-btn-update-now:active {
            transform: scale(0.98);
          }
          @media (max-width: 380px) {
            #pwa-update-banner {
              flex-direction: column;
              text-align: center;
              padding: 16px;
            }
            #pwa-update-banner .pwa-banner-text {
              text-align: center;
            }
            #pwa-btn-update-now {
              width: 100%;
              justify-content: center;
            }
          }
        </style>
        <img src="assets/logo.png" alt="JC Food" style="
          width: 44px;
          height: 44px;
          border-radius: 50%;
          object-fit: contain;
          border: 2px solid #F5A623;
          box-shadow: 0 0 10px rgba(245, 166, 35, 0.35);
          flex-shrink: 0;
        " onerror="this.style.display='none'">
        <div class="pwa-banner-text" style="flex: 1; min-width: 0;">
          <div style="font-weight: 800; font-size: 14.5px; color: #FFFFFF; letter-spacing: 0.2px; margin-bottom: 2px;">Nova versão disponível!</div>
          <div style="font-size: 12px; color: #C7CAD1; line-height: 1.35;">Atualizamos o cardápio e melhorias do sistema.</div>
        </div>
        <div>
          <button type="button" id="pwa-btn-update-now" style="
            background: linear-gradient(135deg, #F5A623 0%, #D48810 100%);
            color: #0B0C0E;
            border: none;
            padding: 10px 18px;
            border-radius: 10px;
            font-size: 12px;
            font-weight: 800;
            cursor: pointer;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            box-shadow: 0 4px 14px rgba(245, 166, 35, 0.4);
            white-space: nowrap;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-family: 'Outfit', sans-serif;
            transition: transform 0.15s ease, filter 0.15s ease;
          ">🔄 ATUALIZAR AGORA</button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', bannerHtml);

    const updateBtn = document.getElementById('pwa-btn-update-now');
    if (updateBtn) {
      updateBtn.addEventListener('click', () => {
        if (this.isUpdating) return;
        this.isUpdating = true;

        updateBtn.disabled = true;
        updateBtn.style.opacity = '0.75';
        updateBtn.style.cursor = 'wait';
        updateBtn.innerHTML = '<span>🔄 ATUALIZANDO...</span>';

        const targetWorker = worker || (this.registration && this.registration.waiting) || (this.registration && this.registration.installing);

        // 1. Envia comando SKIP_WAITING ao Worker em espera
        if (targetWorker) {
          try {
            targetWorker.postMessage({ type: 'SKIP_WAITING' });
          } catch (e) {
            console.warn('[UpdateManager] Erro ao postar SKIP_WAITING:', e);
          }
        }

        // 2. Fallback de segurança: se controllerchange não disparar em 2.5s, recarrega uma única vez
        setTimeout(() => {
          if (!this.refreshing) {
            this.refreshing = true;
            console.log('[UpdateManager] Fallback de recarregamento acionado...');
            window.location.reload();
          }
        }, 2500);
      });
    }
  }
};

