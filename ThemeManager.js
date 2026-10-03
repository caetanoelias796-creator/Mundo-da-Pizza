/**
 * JC Food — Theme & Palette Manager (Studio de Cores para Apresentação)
 * Permite alternar paletas visuais e cores customizadas em tempo real
 * durante demonstrações comerciais para diferentes nichos.
 */
(function(window) {
    const STORAGE_KEY = 'jc_food_active_theme';
    const CUSTOM_COLOR_KEY = 'jc_food_custom_color';

    // Definição das Paletas Pré-configuradas por Nicho
    const PALETTES = {
        'jc-blue': {
            id: 'jc-blue',
            name: 'JC Informática (Oficial)',
            niche: 'Tecnologia & Geral',
            icon: 'fas fa-rocket',
            colors: {
                '--blue': '#0037FF',
                '--blue-light': '#2955FF',
                '--blue-dark': '#0029CC',
                '--blue-glow': 'rgba(0, 55, 255, 0.35)',
                '--primary': '#0037FF',
                '--primary-hover': '#2955FF',
                '--primary-dark': '#0029CC',
                '--primary-light': 'rgba(0, 55, 255, 0.15)',
                '--primary-gradient': 'linear-gradient(135deg, #0037FF 0%, #0022AA 100%)',
                '--dark': '#05080F',
                '--dark-2': '#080D1A',
                '--dark-3': '#0C1220',
                '--dark-4': '#101828',
                '--white': '#F5F5F5',
                '--gray': '#8A93A8',
                '--gray-light': '#BEC6D8',
                '--border': 'rgba(0, 55, 255, 0.2)',
                '--border-glow': 'rgba(0, 55, 255, 0.5)',
                '--shadow-blue': '0 4px 32px rgba(0, 55, 255, 0.35)'
            },
            badgeBg: '#0037FF'
        },
        'pizzeria-red': {
            id: 'pizzeria-red',
            name: 'Pizzaria & Trattoria',
            niche: 'Pizzas, Massas & Italiano',
            icon: 'fas fa-pizza-slice',
            colors: {
                '--blue': '#E63946',
                '--blue-light': '#FF4D5E',
                '--blue-dark': '#B81D2A',
                '--blue-glow': 'rgba(230, 57, 70, 0.35)',
                '--primary': '#E63946',
                '--primary-hover': '#FF4D5E',
                '--primary-dark': '#B81D2A',
                '--primary-light': 'rgba(230, 57, 70, 0.15)',
                '--primary-gradient': 'linear-gradient(135deg, #E63946 0%, #9B111E 100%)',
                '--dark': '#0D0506',
                '--dark-2': '#14080B',
                '--dark-3': '#1E0D11',
                '--dark-4': '#291218',
                '--white': '#FDF8F8',
                '--gray': '#A88D91',
                '--gray-light': '#D6C4C7',
                '--border': 'rgba(230, 57, 70, 0.22)',
                '--border-glow': 'rgba(230, 57, 70, 0.55)',
                '--shadow-blue': '0 4px 32px rgba(230, 57, 70, 0.35)'
            },
            badgeBg: '#E63946'
        },
        'burger-amber': {
            id: 'burger-amber',
            name: 'Hamburgueria & Pub',
            niche: 'Burgers, Steaks & Chope',
            icon: 'fas fa-hamburger',
            colors: {
                '--blue': '#FF9F1C',
                '--blue-light': '#FFB347',
                '--blue-dark': '#D47D00',
                '--blue-glow': 'rgba(255, 159, 28, 0.35)',
                '--primary': '#FF9F1C',
                '--primary-hover': '#FFB347',
                '--primary-dark': '#D47D00',
                '--primary-light': 'rgba(255, 159, 28, 0.15)',
                '--primary-gradient': 'linear-gradient(135deg, #FF9F1C 0%, #C86D00 100%)',
                '--dark': '#0B0906',
                '--dark-2': '#120F0B',
                '--dark-3': '#1C1610',
                '--dark-4': '#261F16',
                '--white': '#FFFDF8',
                '--gray': '#A3998D',
                '--gray-light': '#D4CCC2',
                '--border': 'rgba(255, 159, 28, 0.22)',
                '--border-glow': 'rgba(255, 159, 28, 0.55)',
                '--shadow-blue': '0 4px 32px rgba(255, 159, 28, 0.35)'
            },
            badgeBg: '#FF9F1C'
        },
        'sushi-green': {
            id: 'sushi-green',
            name: 'Sushi, Pokés & Fit',
            niche: 'Japonês, Saudável & Saladas',
            icon: 'fas fa-leaf',
            colors: {
                '--blue': '#00C896',
                '--blue-light': '#1AE6B0',
                '--blue-dark': '#009B73',
                '--blue-glow': 'rgba(0, 200, 150, 0.35)',
                '--primary': '#00C896',
                '--primary-hover': '#1AE6B0',
                '--primary-dark': '#009B73',
                '--primary-light': 'rgba(0, 200, 150, 0.15)',
                '--primary-gradient': 'linear-gradient(135deg, #00C896 0%, #007F5F 100%)',
                '--dark': '#040E0A',
                '--dark-2': '#071611',
                '--dark-3': '#0E211A',
                '--dark-4': '#142C23',
                '--white': '#F4FCF8',
                '--gray': '#879D94',
                '--gray-light': '#BFD4CB',
                '--border': 'rgba(0, 200, 150, 0.22)',
                '--border-glow': 'rgba(0, 200, 150, 0.55)',
                '--shadow-blue': '0 4px 32px rgba(0, 200, 150, 0.35)'
            },
            badgeBg: '#00C896'
        },
        'acai-purple': {
            id: 'acai-purple',
            name: 'Açaí, Doces & Sobremesas',
            niche: 'Açaíterias & Confeitarias',
            icon: 'fas fa-ice-cream',
            colors: {
                '--blue': '#9D4EDD',
                '--blue-light': '#B76EFF',
                '--blue-dark': '#7924BD',
                '--blue-glow': 'rgba(157, 78, 221, 0.35)',
                '--primary': '#9D4EDD',
                '--primary-hover': '#B76EFF',
                '--primary-dark': '#7924BD',
                '--primary-light': 'rgba(157, 78, 221, 0.15)',
                '--primary-gradient': 'linear-gradient(135deg, #9D4EDD 0%, #5A189A 100%)',
                '--dark': '#0A050F',
                '--dark-2': '#100918',
                '--dark-3': '#1A0F26',
                '--dark-4': '#251536',
                '--white': '#FBF6FE',
                '--gray': '#9F8FA8',
                '--gray-light': '#D3C7DA',
                '--border': 'rgba(157, 78, 221, 0.22)',
                '--border-glow': 'rgba(157, 78, 221, 0.55)',
                '--shadow-blue': '0 4px 32px rgba(157, 78, 221, 0.35)'
            },
            badgeBg: '#9D4EDD'
        },
        'light-clean': {
            id: 'light-clean',
            name: 'Clean Day (Modo Claro)',
            niche: 'Cafeterias, Padarias & Diurno',
            icon: 'fas fa-sun',
            colors: {
                '--blue': '#0037FF',
                '--blue-light': '#2955FF',
                '--blue-dark': '#0029CC',
                '--blue-glow': 'rgba(0, 55, 255, 0.25)',
                '--primary': '#0037FF',
                '--primary-hover': '#2955FF',
                '--primary-dark': '#0029CC',
                '--primary-light': 'rgba(0, 55, 255, 0.10)',
                '--primary-gradient': 'linear-gradient(135deg, #0037FF 0%, #0022AA 100%)',
                '--dark': '#F4F6FB',
                '--dark-2': '#FFFFFF',
                '--dark-3': '#FFFFFF',
                '--dark-4': '#EDF1FA',
                '--white': '#0D111A',
                '--gray': '#586278',
                '--gray-light': '#364057',
                '--border': 'rgba(0, 55, 255, 0.15)',
                '--border-glow': 'rgba(0, 55, 255, 0.4)',
                '--shadow-blue': '0 4px 24px rgba(0, 55, 255, 0.2)'
            },
            badgeBg: '#F4F6FB'
        }
    };

    const ThemeManager = {
        palettes: PALETTES,
        activeTheme: 'jc-blue',

        init() {
            this.renderDrawerMarkup();

            const savedTheme = localStorage.getItem(STORAGE_KEY);
            const savedCustom = localStorage.getItem(CUSTOM_COLOR_KEY);

            if (savedCustom) {
                this.applyCustomColor(savedCustom, false);
            } else if (savedTheme && PALETTES[savedTheme]) {
                this.applyTheme(savedTheme, false);
            } else {
                this.applyTheme('jc-blue', false);
            }
        },

        applyTheme(themeId, save = true) {
            const palette = PALETTES[themeId];
            if (!palette) return;

            const root = document.documentElement;
            for (const [prop, val] of Object.entries(palette.colors)) {
                root.style.setProperty(prop, val);
            }

            this.activeTheme = themeId;
            if (save) {
                localStorage.setItem(STORAGE_KEY, themeId);
                localStorage.removeItem(CUSTOM_COLOR_KEY);
            }

            this.updateActiveUI(themeId);
        },

        applyCustomColor(hex, save = true) {
            if (!hex || !/^#[0-9A-F]{6}$/i.test(hex)) return;

            const rgb = this.hexToRgb(hex);
            if (!rgb) return;

            const light = this.adjustBrightness(hex, 25);
            const dark = this.adjustBrightness(hex, -25);
            const glow = 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', 0.35)';
            const lightAlpha = 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', 0.15)';
            const borderAlpha = 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', 0.25)';
            const borderGlow = 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', 0.55)';

            const root = document.documentElement;
            root.style.setProperty('--blue', hex);
            root.style.setProperty('--blue-light', light);
            root.style.setProperty('--blue-dark', dark);
            root.style.setProperty('--blue-glow', glow);
            root.style.setProperty('--primary', hex);
            root.style.setProperty('--primary-hover', light);
            root.style.setProperty('--primary-dark', dark);
            root.style.setProperty('--primary-light', lightAlpha);
            root.style.setProperty('--primary-gradient', 'linear-gradient(135deg, ' + hex + ' 0%, ' + dark + ' 100%)');
            root.style.setProperty('--border', borderAlpha);
            root.style.setProperty('--border-glow', borderGlow);
            root.style.setProperty('--shadow-blue', '0 4px 32px ' + glow);

            this.activeTheme = 'custom';
            if (save) {
                localStorage.setItem(STORAGE_KEY, 'custom');
                localStorage.setItem(CUSTOM_COLOR_KEY, hex);
            }

            this.updateActiveUI('custom');
        },

        hexToRgb(hex) {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        },

        adjustBrightness(hex, percent) {
            const num = parseInt(hex.replace('#', ''), 16);
            const amt = Math.round(2.55 * percent);
            const R = (num >> 16) + amt;
            const G = (num >> 8 & 0x00FF) + amt;
            const B = (num & 0x0000FF) + amt;
            return '#' + (
                0x1000000 +
                (R < 255 ? (R < 0 ? 0 : R) : 255) * 0x10000 +
                (G < 255 ? (G < 0 ? 0 : G) : 255) * 0x100 +
                (B < 255 ? (B < 0 ? 0 : B) : 255)
            ).toString(16).slice(1);
        },

        resetToDefault() {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(CUSTOM_COLOR_KEY);
            this.applyTheme('jc-blue', true);
            const picker = document.getElementById('jcCustomColorInput');
            if (picker) picker.value = '#0037FF';
        },

        toggle() {
            const drawer = document.getElementById('jcThemeDrawer');
            const overlay = document.getElementById('jcThemeOverlay');
            if (!drawer) return;
            const isOpen = drawer.classList.contains('active');
            if (isOpen) {
                drawer.classList.remove('active');
                if (overlay) overlay.classList.remove('active');
            } else {
                drawer.classList.add('active');
                if (overlay) overlay.classList.add('active');
            }
        },

        close() {
            const drawer = document.getElementById('jcThemeDrawer');
            const overlay = document.getElementById('jcThemeOverlay');
            if (drawer) drawer.classList.remove('active');
            if (overlay) overlay.classList.remove('active');
        },

        updateActiveUI(themeId) {
            document.querySelectorAll('.jc-theme-card').forEach(card => {
                if (card.getAttribute('data-theme-id') === themeId) {
                    card.classList.add('active');
                } else {
                    card.classList.remove('active');
                }
            });
        },

        renderDrawerMarkup() {
            if (document.getElementById('jcThemeDrawer')) return;

            const cardsHTML = Object.values(PALETTES).map(p => `
                <div class="jc-theme-card ${p.id === this.activeTheme ? 'active' : ''}" 
                     data-theme-id="${p.id}" 
                     onclick="ThemeManager.applyTheme('${p.id}')">
                    <div class="jc-theme-swatches">
                        <span class="jc-swatch-main" style="background: ${p.colors['--blue']};"></span>
                        <span class="jc-swatch-bg" style="background: ${p.colors['--dark']};"></span>
                    </div>
                    <div class="jc-theme-info">
                        <div class="jc-theme-name"><i class="${p.icon}"></i> ${p.name}</div>
                        <div class="jc-theme-niche">${p.niche}</div>
                    </div>
                    <div class="jc-theme-check"><i class="fas fa-check"></i></div>
                </div>
            `).join('');

            const drawerHTML = `
                <div class="jc-theme-overlay" id="jcThemeOverlay" onclick="ThemeManager.close()"></div>
                <div class="jc-theme-drawer" id="jcThemeDrawer">
                    <div class="jc-theme-header">
                        <div class="jc-theme-header-title">
                            <i class="fas fa-palette"></i>
                            <div>
                                <h3>Studio de Cores</h3>
                                <p>Personalize a demonstração para o cliente</p>
                            </div>
                        </div>
                        <button class="jc-theme-close-btn" onclick="ThemeManager.close()" title="Fechar">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>

                    <div class="jc-theme-body">
                        <div class="jc-theme-section-title">Paletas por Nicho de Mercado</div>
                        <div class="jc-theme-grid">
                            ${cardsHTML}
                        </div>

                        <div class="jc-theme-divider"></div>

                        <div class="jc-theme-section-title">Cor da Marca do Cliente (Customizada)</div>
                        <div class="jc-theme-custom-box">
                            <p class="jc-theme-custom-hint">
                                Escolha a cor exata do logo do cliente para impressionar ao vivo:
                            </p>
                            <div class="jc-theme-picker-row">
                                <input type="color" id="jcCustomColorInput" value="${localStorage.getItem(CUSTOM_COLOR_KEY) || '#0037FF'}" 
                                       oninput="ThemeManager.applyCustomColor(this.value)">
                                <div class="jc-theme-picker-desc">
                                    <span>Selecione a cor principal</span>
                                    <small>Glows, botões e contrastes são gerados automaticamente</small>
                                </div>
                            </div>
                        </div>

                        <div class="jc-theme-footer-actions">
                            <button class="jc-btn-reset-theme" onclick="ThemeManager.resetToDefault()">
                                <i class="fas fa-undo"></i> Restaurar Padrão JC
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', drawerHTML);
        }
    };

    window.ThemeManager = ThemeManager;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => ThemeManager.init());
    } else {
        ThemeManager.init();
    }
})(window);
