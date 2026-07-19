/* ==========================================================================
   Cardápio Data Structure - Mundo da Pizza
   ========================================================================== */
let MENU_ITEMS = {
    pizzas: [],
    lanches: [],
    calzones: [],
    bebidas: [],
    acais: []
};
let BORDAS = {};

const SIZE_MAP = {
    'broto': 'B',
    'media': 'M',
    'grande': 'G',
    'vulcao': 'V',
    'trem': 'T'
};

const TAMANHO_NOMES = {
    'broto': 'Broto (20cm)',
    'media': 'Média (30cm)',
    'grande': 'Grande (35cm)',
    'vulcao': 'Vulcão (35cm)',
    'trem': 'Trem (50cm)'
};

const TAMANHO_REGRAS = {
    'broto': { maxFlavors: 1, slices: 4, name: 'Broto' },
    'media': { maxFlavors: 2, slices: 8, name: 'Média' },
    'grande': { maxFlavors: 3, slices: 12, name: 'Grande' },
    'vulcao': { maxFlavors: 2, slices: 12, name: 'Vulcão' },
    'trem': { maxFlavors: 4, slices: 24, name: 'Trem' }
};

let PIZZA_PRICES = {};

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
let cart = [];
let currentPizza = null;
let checkoutType = 'delivery'; // 'delivery' or 'pickup'
let isShopOpen = true; // Sincronizado do Firebase
const DELIVERY_FEE = 10.00;

let CONFIG_SETTINGS = {
    whatsapp: '5554996985724',
    whatsappFormatted: '(54) 99698-5724'
};

function isItemPromoToday(item) {
    if (!item) return false;
    if (!item.isPromo) return false;
    if (!item.promoDays || item.promoDays.length === 0) return true; // Se nenhum dia selecionado, vale todos os dias
    
    const diasSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const hoje = diasSemana[new Date().getDay()];
    return item.promoDays.includes(hoje);
}

function isPromoSize(sizeKey) {
    const promoSize = CONFIG_SETTINGS ? (CONFIG_SETTINGS.promoSize || 'G') : 'G';
    if (Array.isArray(promoSize)) {
        return promoSize.includes(sizeKey);
    }
    if (typeof promoSize === 'string') {
        return promoSize.split(',').map(s => s.trim()).includes(sizeKey);
    }
    return sizeKey === promoSize;
}

function isPromoEligibleForSize(item, sizeKey) {
    if (!CONFIG_SETTINGS || !CONFIG_SETTINGS.promoActive) return false;
    if (!isItemPromoToday(item)) return false;
    
    // Se desconto percentual estiver ativo, vale para qualquer tamanho!
    if (CONFIG_SETTINGS.promoDiscountActive) return true;
    
    // Caso contrário, vale apenas para os tamanhos configurados (ex: G ou G,M)
    return isPromoSize(sizeKey);
}

function getPromoPriceForProduct(product) {
    let priceVal = parseFloat(product.price) || 0;
    
    // Se o item tiver um preço promocional fixo definido, usa ele direto!
    if (product.promoPrice !== undefined && product.promoPrice !== null && product.promoPrice !== '') {
        return parseFloat(product.promoPrice);
    }
    
    // Caso contrário, calcula com base na porcentagem de desconto da categoria do item
    if (CONFIG_SETTINGS && CONFIG_SETTINGS.promoActive && CONFIG_SETTINGS.promoDiscountActive) {
        let discount = CONFIG_SETTINGS.promoDiscountPercent || 20; // fallback pizzas / global
        
        if (product.type === 'lanche') {
            discount = CONFIG_SETTINGS.promoLanchesDiscountPercent || discount;
        } else if (product.type === 'calzone') {
            discount = CONFIG_SETTINGS.promoCalzonesDiscountPercent || discount;
        } else if (product.type === 'bebida') {
            discount = CONFIG_SETTINGS.promoBebidasDiscountPercent || discount;
        }
        
        priceVal *= (1 - discount / 100);
    }
    
    return priceVal;
}

let TAXAS_ENTREGA = {};
function getDeliveryFeeForBairro(bairroName) {
    if (!bairroName) return 10.00;
    const key = bairroName.toLowerCase().trim().replace(/\s+/g, '-').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return TAXAS_ENTREGA[key] !== undefined ? TAXAS_ENTREGA[key].fee : 10.00;
}

function populateNeighborhoodDropdown() {
    const select = document.getElementById('addressBairro');
    if (!select) return;
    
    const currentVal = select.value;
    select.innerHTML = '<option value="" disabled selected>Selecione seu bairro...</option>';
    
    Object.keys(TAXAS_ENTREGA).forEach(key => {
        const item = TAXAS_ENTREGA[key];
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = `${item.name} - R$ ${item.fee.toFixed(2).replace('.', ',')}`;
        select.appendChild(opt);
    });
    
    if (currentVal && TAXAS_ENTREGA[currentVal]) {
        select.value = currentVal;
    }
}

function updateContactInfoUI() {
    const footerPhone = document.getElementById('footerCompanyPhone');
    if (footerPhone) {
        footerPhone.innerHTML = `<span class="material-symbols-rounded">phone</span> ${CONFIG_SETTINGS.whatsappFormatted || CONFIG_SETTINGS.whatsapp}`;
    }
}

/* ==========================================================================
   Açaí Customizer & State Operations
   ========================================================================== */
let currentAcai = {
    size: '300ml',
    freeAdditions: [],
    paidAdditions: [],
    notes: '',
    quantity: 1,
    totalPrice: 17
};

let ACAI_FREE_ADDITIONS = [];
let ACAI_PAID_5 = [];
let ACAI_PAID_2_5 = [];
function renderAcais() {
    const acaisGrid = document.getElementById('acaisGrid');
    if (!acaisGrid) return;
    acaisGrid.innerHTML = '';
    
    const acais = MENU_ITEMS.acais || [
        { id: "acai_300ml", name: "Açaí 300ml", description: "Escolha até 3 adicionais grátis inclusos no copo.", price: 17.00, image: "assets/acai_hero.png", size: "300ml", maxFree: 3 },
        { id: "acai_500ml", name: "Açaí 500ml", description: "Escolha até 4 adicionais grátis inclusos no copo.", price: 24.00, image: "assets/acai_hero.png", size: "500ml", maxFree: 4 },
        { id: "acai_700ml", name: "Açaí 700ml", description: "Escolha até 5 adicionais grátis inclusos no copo.", price: 30.00, image: "assets/acai_hero.png", size: "700ml", maxFree: 5 }
    ];
    
    acais.forEach(item => {
        const card = document.createElement('div');
        card.className = 'item-card';
        
        const imagePath = item.image || 'assets/acai_hero.png';
        const descHTML = item.description ? `<p class="item-card-desc">${item.description}</p>` : '';
        
        card.innerHTML = `
            <div class="item-card-image-wrapper">
                <img src="${imagePath}" alt="${item.name}" loading="lazy">
            </div>
            <div class="item-card-content">
                <h3 class="item-card-title">${item.name}</h3>
                ${descHTML}
                <div class="item-card-footer">
                    <div class="item-card-price">
                        <span class="price-value">R$ ${item.price.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <button class="btn-add" onclick="openAcaiCustomizer('${item.size}')" title="Personalizar Açaí" style="background: linear-gradient(135deg, #4a148c 0%, #6a1b9a 100%);">
                        <span class="material-symbols-rounded">edit_note</span>
                    </button>
                </div>
            </div>
        `;
        acaisGrid.appendChild(card);
    });
}

function openAcaiCustomizer(sizeId) {
    const modal = document.getElementById('acaiCustomizerModal');
    if (!modal) return;
    
    currentAcai = {
        size: sizeId || '300ml',
        freeAdditions: [],
        paidAdditions: [],
        notes: '',
        quantity: 1,
        totalPrice: 0
    };
    
    const radio = document.querySelector(`input[name="acai-size"][value="${currentAcai.size}"]`);
    if (radio) radio.checked = true;
    
    const acaiNotesEl = document.getElementById('acaiNotes'); if (acaiNotesEl) acaiNotesEl.value = '';
    document.getElementById('acaiCustomizerQty').innerText = '1';
    
    renderAcaiAdditionsLists();
    onAcaiSizeChange();
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeAcaiCustomizer() {
    const modal = document.getElementById('acaiCustomizerModal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
}

function onAcaiSizeChange() {
    const checkedRadio = document.querySelector('input[name="acai-size"]:checked');
    if (!checkedRadio) return;
    
    const size = checkedRadio ? checkedRadio.value : '300ml';
    const maxFree = parseInt(checkedRadio.getAttribute('data-max-free'));
    
    currentAcai.size = size;
    
    const badge = document.getElementById('acaiCustomizerHeaderBadge');
    if (badge) badge.innerText = size;
    
    const helperText = document.getElementById('acaiFreeLimitText');
    if (helperText) {
        helperText.innerText = `Selecione até ${maxFree} adicionais grátis`;
    }
    
    if (currentAcai.freeAdditions.length > maxFree) {
        currentAcai.freeAdditions = currentAcai.freeAdditions.slice(0, maxFree);
    }
    
    updateAcaiCheckboxesState();
    calculateAcaiPrice();
}

function renderAcaiAdditionsLists() {
    const freeContainer = document.getElementById('acaiFreeAdditionsContainer');
    const paid5Container = document.getElementById('acaiPaid5AdditionsContainer');
    const paid25Container = document.getElementById('acaiPaid25AdditionsContainer');
    
    if (!freeContainer || !paid5Container || !paid25Container) return;
    
    freeContainer.innerHTML = '';
    ACAI_FREE_ADDITIONS.forEach(item => {
        const name = typeof item === 'string' ? item : item.name;
        const checked = currentAcai.freeAdditions.includes(name) ? 'checked' : '';
        const label = document.createElement('label');
        label.className = 'border-card';
        label.innerHTML = `
            <input type="checkbox" name="acai-free-add" value="${name}" onchange="handleAcaiFreeClick(this)" ${checked}>
            <div class="border-card-content">
                <span>${name}</span>
                <span class="border-price">Grátis</span>
            </div>
        `;
        freeContainer.appendChild(label);
    });
    
    paid5Container.innerHTML = '';
    ACAI_PAID_5.forEach(item => {
        const name = typeof item === 'string' ? item : item.name;
        const price = typeof item === 'string' ? 5 : (item.price !== undefined ? item.price : 5);
        const checked = currentAcai.paidAdditions.some(a => a.name === name) ? 'checked' : '';
        const label = document.createElement('label');
        label.className = 'border-card';
        label.innerHTML = `
            <input type="checkbox" name="acai-paid-add" value="${name}" data-price="${price}" onchange="handleAcaiPaidClick(this)" ${checked}>
            <div class="border-card-content">
                <span>${name}</span>
                <span class="border-price">+ R$ ${price.toFixed(2).replace('.', ',')}</span>
            </div>
        `;
        paid5Container.appendChild(label);
    });
    
    paid25Container.innerHTML = '';
    ACAI_PAID_2_5.forEach(item => {
        const name = typeof item === 'string' ? item : item.name;
        const price = typeof item === 'string' ? 2.5 : (item.price !== undefined ? item.price : 2.5);
        const checked = currentAcai.paidAdditions.some(a => a.name === name) ? 'checked' : '';
        const label = document.createElement('label');
        label.className = 'border-card';
        label.innerHTML = `
            <input type="checkbox" name="acai-paid-add" value="${name}" data-price="${price}" onchange="handleAcaiPaidClick(this)" ${checked}>
            <div class="border-card-content">
                <span>${name}</span>
                <span class="border-price">+ R$ ${price.toFixed(2).replace('.', ',')}</span>
            </div>
        `;
        paid25Container.appendChild(label);
    });
}

function handleAcaiFreeClick(checkbox) {
    const value = checkbox.value;
    const checkedRadio = document.querySelector('input[name="acai-size"]:checked');
    const maxFree = checkedRadio ? parseInt(checkedRadio.getAttribute('data-max-free')) : 3;
    
    if (checkbox.checked) {
        if (currentAcai.freeAdditions.length >= maxFree) {
            checkbox.checked = false;
            alert(`Você pode escolher no máximo ${maxFree} adicionais grátis para este tamanho.`);
            return;
        }
        currentAcai.freeAdditions.push(value);
    } else {
        const idx = currentAcai.freeAdditions.indexOf(value);
        if (idx !== -1) currentAcai.freeAdditions.splice(idx, 1);
    }
    
    updateAcaiVisualPills();
    calculateAcaiPrice();
}

function handleAcaiPaidClick(checkbox) {
    const value = checkbox.value;
    const price = parseFloat(checkbox.getAttribute('data-price'));
    
    if (checkbox.checked) {
        if (!currentAcai.paidAdditions.some(a => a.name === value)) {
            currentAcai.paidAdditions.push({ name: value, price: price });
        }
    } else {
        const idx = currentAcai.paidAdditions.findIndex(a => a.name === value);
        if (idx !== -1) currentAcai.paidAdditions.splice(idx, 1);
    }
    
    updateAcaiVisualPills();
    calculateAcaiPrice();
}

function updateAcaiCheckboxesState() {
    const checkboxes = document.querySelectorAll('input[name="acai-free-add"]');
    checkboxes.forEach(cb => {
        cb.checked = currentAcai.freeAdditions.includes(cb.value);
    });
    
    const paidCbs = document.querySelectorAll('input[name="acai-paid-add"]');
    paidCbs.forEach(cb => {
        cb.checked = currentAcai.paidAdditions.some(a => a.name === cb.value);
    });
    
    updateAcaiVisualPills();
}

function updateAcaiVisualPills() {
    const container = document.getElementById('activeAcaiAdditionsPills');
    if (!container) return;
    container.innerHTML = '';
    
    currentAcai.freeAdditions.forEach(name => {
        const pill = document.createElement('span');
        pill.className = 'flavor-pill';
        pill.style.background = 'rgba(74, 20, 140, 0.08)';
        pill.style.color = '#4a148c';
        pill.style.border = '1px solid rgba(74, 20, 140, 0.2)';
        pill.innerHTML = `${name} <span class="pill-remove" onclick="removeAcaiPill('free', '${name}')">×</span>`;
        container.appendChild(pill);
    });
    
    currentAcai.paidAdditions.forEach(item => {
        const pill = document.createElement('span');
        pill.className = 'flavor-pill';
        pill.style.background = '#e1bee7';
        pill.style.color = '#4a148c';
        pill.style.border = '1px solid #4a148c';
        pill.innerHTML = `${item.name} (+R$ ${item.price.toFixed(2)}) <span class="pill-remove" onclick="removeAcaiPill('paid', '${item.name}')">×</span>`;
        container.appendChild(pill);
    });
}

function removeAcaiPill(type, name) {
    if (type === 'free') {
        const idx = currentAcai.freeAdditions.indexOf(name);
        if (idx !== -1) currentAcai.freeAdditions.splice(idx, 1);
    } else {
        const idx = currentAcai.paidAdditions.findIndex(a => a.name === name);
        if (idx !== -1) currentAcai.paidAdditions.splice(idx, 1);
    }
    
    updateAcaiCheckboxesState();
    calculateAcaiPrice();
}

function adjustAcaiQty(delta) {
    let newQty = currentAcai.quantity + delta;
    if (newQty < 1) newQty = 1;
    currentAcai.quantity = newQty;
    document.getElementById('acaiCustomizerQty').innerText = newQty;
    calculateAcaiPrice();
}

function calculateAcaiPrice() {
    const checkedRadio = document.querySelector('input[name="acai-size"]:checked');
    if (!checkedRadio) return;
    
    const basePrice = parseFloat(checkedRadio.getAttribute('data-price'));
    const paidSum = currentAcai.paidAdditions.reduce((sum, item) => sum + item.price, 0);
    
    const singlePrice = basePrice + paidSum;
    currentAcai.totalPrice = singlePrice * currentAcai.quantity;
    
    const btn = document.getElementById('btnAddToOrderAcai');
    if (btn) {
        btn.innerText = `Adicionar ao Pedido — R$ ${currentAcai.totalPrice.toFixed(2).replace('.', ',')}`;
    }
}

function addAcaiToOrder() {
    const acaiNotesEl = document.getElementById('acaiNotes'); currentAcai.notes = acaiNotesEl ? acaiNotesEl.value.trim() : '';
    
    const cartItem = {
        type: 'acai',
        id: 'acai_' + currentAcai.size,
        name: `Açaí ${currentAcai.size}`,
        size: currentAcai.size,
        freeAdditions: [...currentAcai.freeAdditions],
        paidAdditions: currentAcai.paidAdditions.map(a => ({ name: a.name, price: a.price })),
        notes: currentAcai.notes,
        quantity: currentAcai.quantity,
        singlePrice: currentAcai.totalPrice / currentAcai.quantity,
        totalPrice: currentAcai.totalPrice
    };
    
    cart = CartService.addToCart(cartItem);
    updateCartUI();
    closeAcaiCustomizer();
    toggleCart(true);
    
    const badge = document.getElementById('cartBadgeCount');
    if (badge) {
        badge.classList.remove('animate-bounce');
        void badge.offsetWidth;
        badge.classList.add('animate-bounce');
    }
}

/* ==========================================================================
   Cart State Operations & Layout Rendering
   ========================================================================== */
let PIZZA_TYPES = [];

/* ==========================================================================
   Initialization / DOM Loading
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    // Register Service Worker for PWA fullscreen/offline support
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('Service Worker registered successfully:', reg.scope))
            .catch(err => console.warn('Service Worker registration failed:', err));
    }

    populateNeighborhoodDropdown();
    updateContactInfoUI();
    
    // Render default menu immediately as a fallback
    PIZZA_TYPES = getPizzaTypesDynamic();
    renderMenu();

    initMenuData();
    initShopStatusListener();
    setupPizzaCustomizerEvents();
    setupNavigationTabs();
    setupSubcategoryTabs();
    loadCartFromLocalStorage();
    initGSAPAnimations();
    initDragToScroll();
});

function initGSAPAnimations() {
    if (typeof gsap !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);

        // Header animations
        gsap.from('.pizzeria-brand-wrapper', { opacity: 0, y: -50, duration: 1, ease: 'power3.out' });
        gsap.from('.pizzeria-subtitle, .hero-slogan', { opacity: 0, y: 30, duration: 1, delay: 0.3, ease: 'power3.out' });
        gsap.from('.hero-pizza-image', { opacity: 0, scale: 0.8, duration: 1.2, delay: 0.5, ease: 'back.out(1.7)' });

        // Category Cards Scroll Animation
        gsap.from('.size-intro-card', {
            scrollTrigger: {
                trigger: '.pizza-size-selector-intro',
                start: 'top 90%',
                once: true
            },
            opacity: 0,
            y: 40,
            stagger: 0.15,
            duration: 0.8,
            ease: 'power2.out'
        });
    }
}

/* ==========================================================================
   Tab Navigation & Category Switching
   ========================================================================== */
function setupNavigationTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const targetId = tab.getAttribute('data-target');
            const sections = document.querySelectorAll('.menu-category-section');
            sections.forEach(sec => sec.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');
            
            // Trigger scroll trigger refresh to adjust animations
            if (typeof ScrollTrigger !== 'undefined') {
                ScrollTrigger.refresh();
            }
        });
    });
}

function setupSubcategoryTabs() {
    // Pizza Subcategory Tabs
    const pizzaSubtabs = document.querySelectorAll('.pizza-subtabs .sub-tab');
    if (pizzaSubtabs.length > 0) {
        pizzaSubtabs.forEach(tab => {
            tab.addEventListener('click', () => {
                pizzaSubtabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const sub = tab.getAttribute('data-sub');
                if (typeof renderPizzasFlavorsGrid === 'function') renderPizzasFlavorsGrid(sub);
            });
        });
    } else {
        // Fallback para caso não tenha a classe pizza-subtabs
        const subtabs = document.querySelectorAll('.sub-tab:not(.lanches-subtabs .sub-tab)');
        subtabs.forEach(tab => {
            tab.addEventListener('click', () => {
                subtabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const sub = tab.getAttribute('data-sub');
                if (typeof renderPizzasFlavorsGrid === 'function') renderPizzasFlavorsGrid(sub);
            });
        });
    }
    
    // Lanches Subcategory Tabs
    const lanchesSubtabs = document.querySelectorAll('.lanches-subtabs .sub-tab');
    lanchesSubtabs.forEach(tab => {
        tab.addEventListener('click', () => {
            lanchesSubtabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const sub = tab.getAttribute('data-sub');
            if (typeof renderMenu === 'function') renderMenu();
        });
    });
}

/* ==========================================================================
   Render Catalog Functions
   ========================================================================== */
function renderMenu() {
    renderPromoSection();
    renderRecommendedGrid(currentCategory || 'todos');
    setupHeaderScrollEffect();
}

let currentCategory = 'todos';

function filterCategory(category, buttonElement) {
    const originalCategory = category;
    
    // Normalize category for internal logic
    if (category === 'acais') category = 'acai';
    
    currentCategory = category;
    
    // Remove active class from all category chips
    const chips = document.querySelectorAll(".category-chip");
    chips.forEach(chip => chip.classList.remove("active"));
    
    // Add active class to selected chip
    if (buttonElement) {
        buttonElement.classList.add("active");
    } else {
        const targetChip = document.querySelector(`.category-chip[onclick*="'${originalCategory}'"]`);
        if (targetChip) targetChip.classList.add("active");
    }
    
    // Update the recommended title
    const sectionTitle = document.querySelector("#recommendedSection .section-title");
    if (sectionTitle) {
        if (category === "todos") {
            sectionTitle.innerHTML = "⭐ Recomendadas para você";
        } else if (category === "mais-pedidos") {
            sectionTitle.innerHTML = "🔥 Mais Pedidos do Cardápio";
        } else if (category === "promocoes") {
            sectionTitle.innerHTML = "🔥 Promoções Selecionadas";
        } else {
            const catNames = {
                pizzas: "Pizzas Salgadas",
                lanches: "Lanches",
                calzones: "Pizzas Doces",
                bebidas: "Bebidas",
                acai: "Açaís",
                acais: "Açaís"
            };
            sectionTitle.innerHTML = `⭐ Principais ${catNames[category] || category}`;
        }
    }
    
    renderRecommendedGrid(category);
}

function handleAddToCartClick(itemId, type, size) {
    if (type === 'pizza') {
        openPizzaCustomizerWithFlavor(itemId);
    } else if (type === 'acai') {
        openAcaiCustomizer(size || '500ml');
    } else if (type === 'lanche') {
        addSimpleItemToCart(itemId, 'lanches');
    } else if (type === 'calzone') {
        addSimpleItemToCart(itemId, 'calzones');
    } else if (type === 'bebida') {
        addSimpleItemToCart(itemId, 'bebidas');
    }
}

function openPizzaCustomizerWithFlavor(flavorId) {
    openPizzaCustomizer('grande');
    handleFlavorSelection(flavorId);
}

function openPizzaCustomizerWithPromoFilter() {
    openPizzaCustomizer('grande');
    filterFlavorsCarousel('promo');
}

let promoCarouselIndex = 0;
let promoCarouselInterval = null;

function startPromoSectionCarousel() {
    if (promoCarouselInterval) clearInterval(promoCarouselInterval);
    
    const track = document.getElementById('promoSectionTrack');
    const slides = document.querySelectorAll('#promoSectionTrack .promo-section-slide');
    const dots = document.querySelectorAll('.promo-section-dots .promo-section-dot');
    
    if (slides.length <= 1 || !track) return;
    
    promoCarouselIndex = 0;
    
    promoCarouselInterval = setInterval(() => {
        promoCarouselIndex = (promoCarouselIndex + 1) % slides.length;
        updatePromoCarouselPosition(track, slides.length, dots);
    }, 4000);
}

function updatePromoCarouselPosition(track, totalSlides, dots) {
    if (!track) return;
    track.style.transform = `translateX(-${promoCarouselIndex * 100}%)`;
    
    dots.forEach((dot, idx) => {
        if (idx === promoCarouselIndex) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });
}

function setPromoCarouselSlide(index) {
    const track = document.getElementById('promoSectionTrack');
    const slides = document.querySelectorAll('#promoSectionTrack .promo-section-slide');
    const dots = document.querySelectorAll('.promo-section-dots .promo-section-dot');
    
    if (slides.length <= 1 || !track) return;
    
    promoCarouselIndex = index;
    updatePromoCarouselPosition(track, slides.length, dots);
    
    startPromoSectionCarousel();
}

function openCategoryPromo(category) {
    switchTab('menu');
    filterCategory(category);
    const recommendedSection = document.getElementById("recommendedSection");
    if (recommendedSection) {
        recommendedSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function renderPromoSection() {
    const promoGrid = document.getElementById("promoGrid");
    if (!promoGrid) return;
    promoGrid.innerHTML = '';
    
    // Obter itens promocionais de hoje por categoria
    const promoPizzas = (MENU_ITEMS.pizzas || []).filter(p => isItemPromoToday(p) && p.available !== false);
    const promoLanches = (MENU_ITEMS.lanches || []).filter(l => isItemPromoToday(l) && l.available !== false);
    const promoCalzones = (MENU_ITEMS.calzones || []).filter(c => isItemPromoToday(c) && c.available !== false);
    const promoBebidas = (MENU_ITEMS.bebidas || []).filter(b => isItemPromoToday(b) && b.available !== false);

    const totalPromos = promoPizzas.length + promoLanches.length + promoCalzones.length + promoBebidas.length;
    
    const promoSection = document.getElementById("promoSection");
    if (totalPromos === 0) {
        if (promoSection) promoSection.style.display = 'none';
        return;
    } else {
        if (promoSection) promoSection.style.display = 'block';
    }
    
    // Criar o container do carrossel
    const carouselWrapper = document.createElement("div");
    carouselWrapper.className = "promo-section-carousel";
    
    const track = document.createElement("div");
    track.className = "promo-section-track";
    track.id = "promoSectionTrack";
    
    let activeCategoriesCount = 0;
    
    // 1. Banner de Pizzas
    if (promoPizzas.length > 0) {
        activeCategoriesCount++;
        const slide = document.createElement("div");
        slide.className = "promo-section-slide";
        
        let discountText = '';
        if (CONFIG_SETTINGS && CONFIG_SETTINGS.promoActive && CONFIG_SETTINGS.promoDiscountActive) {
            discountText = `${CONFIG_SETTINGS.promoDiscountPercent || 20}% OFF`;
        } else {
            discountText = `R$ ${(parseFloat(CONFIG_SETTINGS.promoPrice) || 95.00).toFixed(0)}`;
        }
        
        const flavorNames = promoPizzas.map(p => p.name);
        
        slide.innerHTML = `
            <div class="promo-banner-single" style="background: linear-gradient(135deg, #b71c1c 0%, #1a0a0a 100%);">
                <div class="promo-banner-single-header">
                    <span class="promo-banner-single-tag">🍕 Promoção de Pizzas</span>
                    <span class="promo-banner-single-discount">${discountText}</span>
                </div>
                <h3 class="promo-banner-single-title">Pizzas com Preço Especial Hoje!</h3>
                <p class="promo-banner-single-flavors"><strong>Sabores:</strong> ${flavorNames.join(', ')}</p>
                <div class="promo-banner-single-footer">
                    <span>Toque para montar a sua pizza</span>
                    <span class="material-symbols-rounded" style="font-size: 18px;">arrow_forward</span>
                </div>
            </div>
        `;
        slide.querySelector('.promo-banner-single').onclick = () => openPizzaCustomizerWithPromoFilter();
        track.appendChild(slide);
    }
    
    // 2. Banner de Lanches
    if (promoLanches.length > 0) {
        activeCategoriesCount++;
        const slide = document.createElement("div");
        slide.className = "promo-section-slide";
        
        let discountText = 'PROMO';
        if (CONFIG_SETTINGS && CONFIG_SETTINGS.promoActive && CONFIG_SETTINGS.promoDiscountActive) {
            discountText = `${CONFIG_SETTINGS.promoDiscountPercent || 20}% OFF`;
        }
        
        const lancheNames = promoLanches.map(l => l.name);
        
        slide.innerHTML = `
            <div class="promo-banner-single" style="background: linear-gradient(135deg, #e65100 0%, #1a0a00 100%);">
                <div class="promo-banner-single-header">
                    <span class="promo-banner-single-tag">🍔 Promoção de Lanches</span>
                    <span class="promo-banner-single-discount">${discountText}</span>
                </div>
                <h3 class="promo-banner-single-title">Lanches Especiais do Dia!</h3>
                <p class="promo-banner-single-flavors"><strong>Opções:</strong> ${lancheNames.join(', ')}</p>
                <div class="promo-banner-single-footer">
                    <span>Toque para ver os lanches</span>
                    <span class="material-symbols-rounded" style="font-size: 18px;">arrow_forward</span>
                </div>
            </div>
        `;
        slide.querySelector('.promo-banner-single').onclick = () => openCategoryPromo('lanches');
        track.appendChild(slide);
    }
    
    // 3. Banner de Calzones
    if (promoCalzones.length > 0) {
        activeCategoriesCount++;
        const slide = document.createElement("div");
        slide.className = "promo-section-slide";
        
        let discountText = 'PROMO';
        if (CONFIG_SETTINGS && CONFIG_SETTINGS.promoActive && CONFIG_SETTINGS.promoDiscountActive) {
            discountText = `${CONFIG_SETTINGS.promoDiscountPercent || 20}% OFF`;
        }
        
        const calzoneNames = promoCalzones.map(c => c.name);
        
        slide.innerHTML = `
            <div class="promo-banner-single" style="background: linear-gradient(135deg, #ffd600 0%, #3e2723 100%);">
                <div class="promo-banner-single-header">
                    <span class="promo-banner-single-tag" style="color: #3e2723;">🥟 Calzones da Promo</span>
                    <span class="promo-banner-single-discount">${discountText}</span>
                </div>
                <h3 class="promo-banner-single-title" style="color: #fff;">Calzones Recheados na Promoção!</h3>
                <p class="promo-banner-single-flavors" style="color: rgba(255,255,255,0.7);"><strong>Opções:</strong> ${calzoneNames.join(', ')}</p>
                <div class="promo-banner-single-footer" style="color: #ffd600;">
                    <span>Toque para ver os calzones</span>
                    <span class="material-symbols-rounded" style="font-size: 18px;">arrow_forward</span>
                </div>
            </div>
        `;
        slide.querySelector('.promo-banner-single').onclick = () => openCategoryPromo('calzones');
        track.appendChild(slide);
    }
    
    // 4. Banner de Bebidas
    if (promoBebidas.length > 0) {
        activeCategoriesCount++;
        const slide = document.createElement("div");
        slide.className = "promo-section-slide";
        
        let discountText = 'PROMO';
        if (CONFIG_SETTINGS && CONFIG_SETTINGS.promoActive && CONFIG_SETTINGS.promoDiscountActive) {
            discountText = `${CONFIG_SETTINGS.promoDiscountPercent || 20}% OFF`;
        }
        
        const bebidaNames = promoBebidas.map(b => b.name);
        
        slide.innerHTML = `
            <div class="promo-banner-single" style="background: linear-gradient(135deg, #0d47a1 0%, #0a0a1a 100%);">
                <div class="promo-banner-single-header">
                    <span class="promo-banner-single-tag">🥤 Bebidas da Promo</span>
                    <span class="promo-banner-single-discount">${discountText}</span>
                </div>
                <h3 class="promo-banner-single-title">Bebidas com Desconto!</h3>
                <p class="promo-banner-single-flavors"><strong>Opções:</strong> ${bebidaNames.join(', ')}</p>
                <div class="promo-banner-single-footer">
                    <span>Toque para ver as bebidas</span>
                    <span class="material-symbols-rounded" style="font-size: 18px;">arrow_forward</span>
                </div>
            </div>
        `;
        slide.querySelector('.promo-banner-single').onclick = () => openCategoryPromo('bebidas');
        track.appendChild(slide);
    }
    
    carouselWrapper.appendChild(track);
    
    // Criar as bolinhas (dots) se houver mais de uma categoria em promoção
    if (activeCategoriesCount > 1) {
        const dotsContainer = document.createElement("div");
        dotsContainer.className = "promo-section-dots";
        
        for (let i = 0; i < activeCategoriesCount; i++) {
            const dot = document.createElement("div");
            dot.className = `promo-section-dot ${i === 0 ? 'active' : ''}`;
            dot.onclick = () => setPromoCarouselSlide(i);
            dotsContainer.appendChild(dot);
        }
        carouselWrapper.appendChild(dotsContainer);
    }
    
    promoGrid.appendChild(carouselWrapper);
    
    // Iniciar a animação automática do carrossel se houver mais de uma categoria ativa
    if (activeCategoriesCount > 1) {
        startPromoSectionCarousel();
    } else {
        if (promoCarouselInterval) clearInterval(promoCarouselInterval);
    }
}

function renderBestSellers() {
    const bestSellersScroll = document.getElementById("bestSellersScroll");
    if (!bestSellersScroll) return;
    bestSellersScroll.innerHTML = '';
    
    const bests = [];
    
    const pizzas = MENU_ITEMS.pizzas || [];
    pizzas.forEach(p => {
        if (p.bestSeller || (p.badge && p.badge.toLowerCase().includes('pedido'))) {
            bests.push({ ...p, type: 'pizza', emoji: '🍕' });
        }
    });
    
    const lanches = MENU_ITEMS.lanches || [];
    lanches.forEach(l => {
        if (l.bestSeller || (l.badge && l.badge.toLowerCase().includes('pedido'))) {
            bests.push({ ...l, type: 'lanche', emoji: '🍔' });
        }
    });
    
    if (bests.length === 0) {
        if (pizzas.length > 0) bests.push({ ...pizzas[0], type: 'pizza', emoji: '🍕' });
        if (lanches.length > 0) bests.push({ ...lanches[0], type: 'lanche', emoji: '🍔' });
        const calzones = MENU_ITEMS.calzones || [];
        if (calzones.length > 0) bests.push({ ...calzones[0], type: 'calzone', emoji: '🥟' });
        const acais = MENU_ITEMS.acais || [];
        if (acais.length > 0) bests.push({ ...acais[0], type: 'acai', emoji: '🍧' });
    }
    
    bests.forEach(product => {
        const itemContainer = document.createElement("div");
        itemContainer.className = "scroll-item-lg";
        
        let priceText = "";
        if (product.type === 'pizza') {
            let pB = product.prices?.B || 0;
            let pM = product.prices?.M || 0;
            let pG = product.prices?.G || 0;
            let pF = product.prices?.F || 0;
            
            const isEligiblePromo = CONFIG_SETTINGS && CONFIG_SETTINGS.promoActive && isItemPromoToday(product);
            
            if (isEligiblePromo && CONFIG_SETTINGS.promoDiscountActive) {
                const factor = 1 - (CONFIG_SETTINGS.promoDiscountPercent || 20) / 100;
                if (pB > 0) pB *= factor;
                if (pM > 0) pM *= factor;
                if (pG > 0) pG *= factor;
                if (pF > 0) pF *= factor;
            }
            
            const nonZero = [pB, pM, pG, pF].filter(p => p > 0);
            const priceMin = nonZero.length > 0 ? Math.min(...nonZero) : 0;
            const priceMax = nonZero.length > 0 ? Math.max(...nonZero) : 0;
            
            if (isEligiblePromo && !CONFIG_SETTINGS.promoDiscountActive) {
                const promoPrice = parseFloat(CONFIG_SETTINGS.promoPrice) || 95.00;
                priceText = `R$ ${promoPrice.toFixed(0)} (Promo)`;
            } else if (priceMin === priceMax) {
                priceText = `R$ ${priceMin.toFixed(0)}${isEligiblePromo ? ' (Promo)' : ''}`;
            } else {
                priceText = `R$ ${priceMin.toFixed(0)} a R$ ${priceMax.toFixed(0)}${isEligiblePromo ? ' (Promo)' : ''}`;
            }
        } else {
            const isEligiblePromo = CONFIG_SETTINGS && CONFIG_SETTINGS.promoActive && isItemPromoToday(product);
            const priceVal = isEligiblePromo ? getPromoPriceForProduct(product) : (parseFloat(product.price) || 0);
            priceText = `R$ ${priceVal.toFixed(2).replace('.', ',')}${isEligiblePromo ? ' (Promo)' : ''}`;
        }
        
        const imagePath = product.image || 'assets/pizza_hero.png';
        
        itemContainer.innerHTML = `
            <div class="product-card">
                <div class="product-image-wrapper">
                    <img class="product-img" src="${imagePath}" alt="${product.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                    <div class="product-image-placeholder" style="display: none;">${product.emoji}</div>
                </div>
                <div class="product-body">
                    <h4 class="product-title">${product.name}</h4>
                    <p class="product-desc">${product.description || ''}</p>
                    <div class="product-footer">
                        <span class="product-price">${priceText}</span>
                        <button class="add-to-cart-btn" onclick="handleAddToCartClick('${product.id}', '${product.type}')">+</button>
                    </div>
                </div>
            </div>
        `;
        bestSellersScroll.appendChild(itemContainer);
    });
}

function renderRecommendedGrid(categoryFilter) {
    const recommendedGrid = document.getElementById("recommendedGrid");
    if (!recommendedGrid) return;
    recommendedGrid.innerHTML = '';
    
    let list = [];
    
    // Normalize categoryFilter
    if (categoryFilter === 'acais') categoryFilter = 'acai';
    
    if (categoryFilter === 'todos') {
        const pizzas = (MENU_ITEMS.pizzas || []).filter(p => p.available !== false).map(p => ({ ...p, type: 'pizza', emoji: '🍕' }));
        const lanches = (MENU_ITEMS.lanches || []).filter(l => l.available !== false).map(l => ({ ...l, type: 'lanche', emoji: '🍔' }));
        const calzones = (MENU_ITEMS.calzones || []).filter(c => c.available !== false).map(c => ({ ...c, type: 'calzone', emoji: '🥟' }));
        const bebidas = (MENU_ITEMS.bebidas || []).filter(b => b.available !== false).map(b => ({ ...b, type: 'bebida', emoji: '🥤' }));
        const acais = (MENU_ITEMS.acais || []).filter(a => a.available !== false).map(a => ({ ...a, type: 'acai', emoji: '🍧', size: '500ml' }));
        
        const maxLen = Math.max(pizzas.length, lanches.length, calzones.length, bebidas.length, acais.length);
        for (let i = 0; i < maxLen; i++) {
            if (i < pizzas.length) list.push(pizzas[i]);
            if (i < lanches.length) list.push(lanches[i]);
            if (i < calzones.length) list.push(calzones[i]);
            if (i < acais.length) list.push(acais[i]);
            if (i < bebidas.length) list.push(bebidas[i]);
        }
    } else if (categoryFilter === 'mais-pedidos') {
        const pizzas = (MENU_ITEMS.pizzas || []).filter(p => p.available !== false && (p.bestSeller || (p.badge && p.badge.toLowerCase().includes('pedido')))).map(p => ({ ...p, type: 'pizza', emoji: '🍕' }));
        const lanches = (MENU_ITEMS.lanches || []).filter(l => l.available !== false && (l.bestSeller || (l.badge && l.badge.toLowerCase().includes('pedido')))).map(l => ({ ...l, type: 'lanche', emoji: '🍔' }));
        const calzones = (MENU_ITEMS.calzones || []).filter(c => c.available !== false && (c.bestSeller || (c.badge && c.badge.toLowerCase().includes('pedido')))).map(c => ({ ...c, type: 'calzone', emoji: '🥟' }));
        const acais = (MENU_ITEMS.acais || []).filter(a => a.available !== false && (a.bestSeller || (a.badge && a.badge.toLowerCase().includes('pedido')))).map(a => ({ ...a, type: 'acai', emoji: '🍧', size: '500ml' }));
        list = [...pizzas, ...lanches, ...calzones, ...acais];
        if (list.length === 0) {
            const firstPizzas = (MENU_ITEMS.pizzas || []).slice(0, 3).map(p => ({ ...p, type: 'pizza', emoji: '🍕' }));
            const firstLanches = (MENU_ITEMS.lanches || []).slice(0, 2).map(l => ({ ...l, type: 'lanche', emoji: '🍔' }));
            list = [...firstPizzas, ...firstLanches];
        }
    } else if (categoryFilter === 'pizzas') {
        list = (MENU_ITEMS.pizzas || []).filter(p => p.available !== false && p.category !== 'doces').map(p => ({ ...p, type: 'pizza', emoji: '🍕' }));
    } else if (categoryFilter === 'lanches') {
        list = (MENU_ITEMS.lanches || []).filter(l => l.available !== false).map(l => ({ ...l, type: 'lanche', emoji: '🍔' }));
    } else if (categoryFilter === 'calzones' || categoryFilter === 'doces') {
        const sweetPizzas = (MENU_ITEMS.pizzas || []).filter(p => p.available !== false && p.category === 'doces').map(p => ({ ...p, type: 'pizza', emoji: '🍕' }));
        const simpleCalzones = (MENU_ITEMS.calzones || []).filter(c => c.available !== false).map(c => ({ ...c, type: 'calzone', emoji: '🍫' }));
        list = [...sweetPizzas, ...simpleCalzones];
    } else if (categoryFilter === 'bebidas') {
        list = (MENU_ITEMS.bebidas || []).filter(b => b.available !== false).map(b => ({ ...b, type: 'bebida', emoji: '🥤' }));
    } else if (categoryFilter === 'acai') {
        list = (MENU_ITEMS.acais || []).filter(a => a.available !== false).map(a => ({ ...a, type: 'acai', emoji: '🍧', size: '500ml' }));
    }
    
    list.forEach(product => {
        const card = document.createElement("div");
        card.className = "product-card";
        
        let priceText = "";
        if (product.type === 'pizza') {
            let pB = product.prices?.B || 0;
            let pM = product.prices?.M || 0;
            let pG = product.prices?.G || 0;
            let pF = product.prices?.F || 0;
            
            const isEligiblePromo = CONFIG_SETTINGS && CONFIG_SETTINGS.promoActive && isItemPromoToday(product);
            
            if (isEligiblePromo && CONFIG_SETTINGS.promoDiscountActive) {
                const factor = 1 - (CONFIG_SETTINGS.promoDiscountPercent || 20) / 100;
                if (pB > 0) pB *= factor;
                if (pM > 0) pM *= factor;
                if (pG > 0) pG *= factor;
                if (pF > 0) pF *= factor;
            }
            
            const nonZero = [pB, pM, pG, pF].filter(p => p > 0);
            const priceMin = nonZero.length > 0 ? Math.min(...nonZero) : 0;
            const priceMax = nonZero.length > 0 ? Math.max(...nonZero) : 0;
            
            if (isEligiblePromo && !CONFIG_SETTINGS.promoDiscountActive) {
                const promoPrice = parseFloat(CONFIG_SETTINGS.promoPrice) || 95.00;
                priceText = `R$ ${promoPrice.toFixed(0)} (Promo)`;
            } else if (priceMin === priceMax) {
                priceText = `R$ ${priceMin.toFixed(0)}${isEligiblePromo ? ' (Promo)' : ''}`;
            } else {
                priceText = `R$ ${priceMin.toFixed(0)} a R$ ${priceMax.toFixed(0)}${isEligiblePromo ? ' (Promo)' : ''}`;
            }
        } else {
            const isEligiblePromo = CONFIG_SETTINGS && CONFIG_SETTINGS.promoActive && isItemPromoToday(product);
            const priceVal = isEligiblePromo ? getPromoPriceForProduct(product) : (parseFloat(product.price) || 0);
            priceText = `R$ ${priceVal.toFixed(2).replace('.', ',')}${isEligiblePromo ? ' (Promo)' : ''}`;
        }
        
        const imagePath = product.image || 'assets/pizza_hero.png';
        const badgeHTML = product.badge ? `<span class="item-card-badge">${product.badge}</span>` : '';
        const btnText = (product.type === 'pizza' || product.type === 'acai') ? 'Montar' : 'Comprar';
        const btnIcon = (product.type === 'pizza') ? 'local_pizza' : ((product.type === 'acai') ? 'icecream' : 'shopping_basket');
        
        card.className = "item-card";
        card.innerHTML = `
            <div class="item-card-image-wrapper">
                ${badgeHTML}
                <img src="${imagePath}" alt="${product.name}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                <div class="product-image-placeholder" style="display: none;">${product.emoji}</div>
            </div>
            <div class="item-card-content">
                <h3 class="item-card-title">${product.name}</h3>
                <p class="item-card-desc">${product.description || ''}</p>
                <div class="item-card-footer">
                    <div class="item-card-price">
                        <span class="price-value" style="font-size: 15px; font-weight: 700; color: #ffffff;">${priceText}</span>
                    </div>
                    <button class="btn-add" onclick="handleAddToCartClick('${product.id}', '${product.type}', '${product.size || ''}')" title="${btnText}">
                        <span class="material-symbols-rounded">${btnIcon}</span>
                        <span>${btnText}</span>
                    </button>
                </div>
            </div>
        `;
        recommendedGrid.appendChild(card);
    });
}

function switchTab(tabId, tabElement) {
    const navItems = document.querySelectorAll(".navbar-item");
    navItems.forEach(item => item.classList.remove("active"));
    
    if (tabElement) {
        tabElement.classList.add("active");
    } else {
        const targetNav = document.querySelector(`.navbar-item[onclick*="'${tabId}'"]`);
        if (targetNav) targetNav.classList.add("active");
    }
    
    if (tabId === 'home') {
        const mainContent = document.getElementById("mainContent");
        if (mainContent) mainContent.scrollTo({ top: 0, behavior: "smooth" });
        filterCategory('todos');
    } else if (tabId === 'menu') {
        filterCategory('pizzas');
        const categoriesScroll = document.getElementById("categoriesScroll");
        if (categoriesScroll) categoriesScroll.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (tabId === 'cart') {
        toggleCart(true);
        setTimeout(() => {
            const navHome = document.querySelector(`.navbar-item[onclick*="'home'"]`);
            if (navHome) {
                navItems.forEach(item => item.classList.remove("active"));
                navHome.classList.add("active");
            }
        }, 300);
    } else if (tabId === 'orders') {
        if (CONFIG_SETTINGS && CONFIG_SETTINGS.whatsapp) {
            window.open(`https://wa.me/${CONFIG_SETTINGS.whatsapp}`, '_blank');
        } else {
            window.open('https://wa.me/5554996704189', '_blank');
        }
        setTimeout(() => {
            const navHome = document.querySelector(`.navbar-item[onclick*="'home'"]`);
            if (navHome) {
                navItems.forEach(item => item.classList.remove("active"));
                navHome.classList.add("active");
            }
        }, 300);
    }
}

function openAddressModal() {
    const modal = document.getElementById("addressModal");
    if (modal) {
        modal.classList.add("active");
    }
}

function closeAddressModal() {
    const modal = document.getElementById("addressModal");
    if (modal) {
        modal.classList.remove("active");
    }
}

function saveAddress() {
    const input = document.getElementById("addressInput");
    const display = document.getElementById("addressDisplay");
    
    if (input && display && input.value.trim() !== '') {
        const val = input.value.trim();
        display.innerText = val;
        
        const checkoutAddressInput = document.getElementById("addressStreet");
        if (checkoutAddressInput) {
            checkoutAddressInput.value = val;
        }
        
        alert("Endereço de entrega atualizado!");
        closeAddressModal();
    }
}

function setupHeaderScrollEffect() {
    const mainContent = document.getElementById("mainContent");
    const header = document.getElementById("appHeader");
    
    if (mainContent && header) {
        mainContent.addEventListener("scroll", () => {
            if (mainContent.scrollTop > 10) {
                header.classList.add("scrolled");
            } else {
                header.classList.remove("scrolled");
            }
        });
    }
}

// Bind to window to allow HTML onclick access
window.filterCategory = filterCategory;
window.handleAddToCartClick = handleAddToCartClick;
window.switchTab = switchTab;
window.openAddressModal = openAddressModal;
window.closeAddressModal = closeAddressModal;
window.saveAddress = saveAddress;

function setupPizzaCustomizerEvents() {
    const form = document.getElementById('pizzaCustomizerForm');
    if (!form) return;
    
    // Listen for size changes to adjust rules/flavors
    form.addEventListener('change', (e) => {
        if (e.target.name === 'pizza-size') {
            onSizeChange();
        } else if (e.target.name === 'pizza-flavor' || e.target.name === 'pizza-border') {
            calculateCustomizerPrice();
        }
    });
}

function openPizzaCustomizer(sizeId) {
    const modal = document.getElementById('customizerModal');
    
    // Set customizer initial pizza state
    currentPizza = {
        size: sizeId,
        selectedFlavors: [],
        border: 'sem-borda',
        notes: '',
        quantity: 1,
        totalPrice: 0
    };
    
    // Update radio select size
    const radio = document.querySelector(`input[name="pizza-size"][value="${sizeId}"]`);
    if (radio) radio.checked = true;
    
    // Reset inputs
    const pizzaNotesEl = document.getElementById('pizzaNotes'); if (pizzaNotesEl) pizzaNotesEl.value = '';
    document.getElementById('customizerQty').innerText = '1';
    
    // Reset carousel filter
    currentFlavorsFilter = 'todas';
    
    // Check if there are active promos today
    const hasPromosToday = CONFIG_SETTINGS && CONFIG_SETTINGS.promoActive && (MENU_ITEMS.pizzas || []).some(p => isItemPromoToday(p));
    const tabPromo = document.getElementById('tabFilterPromo');
    if (tabPromo) {
        tabPromo.style.display = hasPromosToday ? 'inline-block' : 'none';
    }
    
    onSizeChange();
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closePizzaCustomizer() {
    const modal = document.getElementById('customizerModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function onSizeChange() {
    const sizeRadio = document.querySelector('input[name="pizza-size"]:checked'); const size = sizeRadio ? sizeRadio.value : 'media';
    currentPizza.size = size;
    
    // Clear selected flavors when size changes
    currentPizza.selectedFlavors = [];
    
    // Update header size badge
    const headerBadge = document.getElementById('customizerHeaderBadge');
    if (headerBadge) {
        headerBadge.innerText = TAMANHO_REGRAS[size].name;
    }
    
    // Set flavor rules
    const rules = TAMANHO_REGRAS[size];
    document.getElementById('flavorSelectionLimitText').innerText = `Selecione até ${rules.maxFlavors} sabores (Cobrado pelo maior valor)`;
    
    // Re-render carousel and borders
    renderCustomizerFlavors();
    renderCustomizerBorders();
    calculateCustomizerPrice();
    updateVisualPizza();
}

let currentFlavorsFilter = 'todas';

function filterFlavorsCarousel(category) {
    currentFlavorsFilter = category;
    
    // Update active tab styling
    const tabs = document.querySelectorAll('#carouselFilterTabs .filter-tab');
    tabs.forEach(tab => {
        const action = tab.getAttribute('onclick');
        if (action && action.includes(`'${category}'`)) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    renderCustomizerFlavors();
}

function updateCarouselFilterTabs(hasSalty, hasSweet) {
    const tabs = document.querySelectorAll('#carouselFilterTabs .filter-tab');
    tabs.forEach(tab => {
        const action = tab.getAttribute('onclick');
        if (!action) return;
        const match = action.match(/'([^']+)'/);
        if (!match) return;
        const category = match[1];
        if (hasSweet && category === 'salgadas') {
            tab.style.opacity = '0.3';
            tab.style.pointerEvents = 'none';
        } else if (hasSalty && category === 'doces') {
            tab.style.opacity = '0.3';
            tab.style.pointerEvents = 'none';
        } else {
            tab.style.opacity = '1';
            tab.style.pointerEvents = 'auto';
        }
    });
}

function renderCustomizerFlavors() {
    const container = document.getElementById('customizerFlavorsList');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Check if the current selection contains sweet or salty flavors
    let hasSalty = false;
    let hasSweet = false;
    
    if (currentPizza && currentPizza.selectedFlavors) {
        currentPizza.selectedFlavors.forEach(flavorId => {
            const flavorData = MENU_ITEMS.pizzas.find(p => p.id === flavorId);
            if (flavorData) {
                if (flavorData.category === 'doces') {
                    hasSweet = true;
                } else {
                    hasSalty = true;
                }
            }
        });
    }
    
    // Update tabs compatibility
    updateCarouselFilterTabs(hasSalty, hasSweet);
    
    // Filter flavors based on category selection AND sweet/salty restrictions
    let items = MENU_ITEMS.pizzas.filter(p => p.available !== false);
    
    if (hasSweet) {
        items = items.filter(p => p.category === 'doces');
    } else if (hasSalty) {
        items = items.filter(p => p.category === 'salgadas');
    } else {
        // Apply tab filter
        if (currentFlavorsFilter === 'salgadas') {
            items = items.filter(p => p.category === 'salgadas');
        } else if (currentFlavorsFilter === 'doces') {
            items = items.filter(p => p.category === 'doces');
        }
    }
    
    if (items.length === 0) {
        container.innerHTML = '<p class="text-muted" style="padding: 20px; font-size: 13px;">Nenhum sabor disponível.</p>';
        return;
    }
    
    items.forEach(item => {
        const card = document.createElement('div');
        const isActive = currentPizza.selectedFlavors.includes(item.id);
        const flavorIndex = currentPizza.selectedFlavors.indexOf(item.id);
        
        card.className = `flavor-carousel-card ${isActive ? 'active' : ''}`;
        card.onclick = () => handleFlavorSelection(item.id);
        
        let selectNumberHTML = '';
        if (isActive) {
            selectNumberHTML = `<span class="flavor-selection-number">${flavorIndex + 1}º</span>`;
        }
        
        const catLabel = item.category === 'doces' ? 'Doce' : 'Salgada';
        const sizeKey = SIZE_MAP[currentPizza.size] || 'M';
        const isEligiblePromo = isPromoEligibleForSize(item, sizeKey);
        
        let priceVal = parseFloat((item.prices && item.prices[sizeKey]) || 0);
        if (isEligiblePromo) {
            if (CONFIG_SETTINGS.promoDiscountActive) {
                priceVal *= (1 - (CONFIG_SETTINGS.promoDiscountPercent || 20) / 100);
            } else {
                priceVal = parseFloat(CONFIG_SETTINGS.promoPrice) || 95.00;
            }
        }
            
        const priceLabel = `R$ ${priceVal.toFixed(0)}`;
        const promoLabel = isEligiblePromo ? ' <span style="color:#ffc107; font-weight:bold;">(Promo)</span>' : '';
        
        card.innerHTML = `
            ${selectNumberHTML}
            <div class="flavor-circle-wrapper">
                <img src="${item.image}" alt="${item.name}" loading="lazy" onerror="this.src='assets/pizza_hero.png'">
            </div>
            <span class="flavor-name">${item.name}</span>
            <span class="flavor-category-badge">${catLabel} • ${priceLabel}${promoLabel}</span>
        `;
        container.appendChild(card);
    });
}

function handleFlavorSelection(flavorId) {
    const size = currentPizza.size;
    const rules = TAMANHO_REGRAS[size];
    const index = currentPizza.selectedFlavors.indexOf(flavorId);
    
    if (index > -1) {
        // Remove flavor
        currentPizza.selectedFlavors.splice(index, 1);
    } else {
        // Add flavor
        if (currentPizza.selectedFlavors.length >= rules.maxFlavors) {
            alert(`Para pizza ${TAMANHO_NOMES[size]}, o limite é de no máximo ${rules.maxFlavors} sabores.`);
            return;
        }
        currentPizza.selectedFlavors.push(flavorId);
        
        // Trigger entrance animation for this flavor slice
        animateSliceAddition(flavorId);
    }
    
    renderCustomizerFlavors();
    renderCustomizerBorders();
    calculateCustomizerPrice();
    updateVisualPizza();
}

function animateSliceAddition(flavorId) {
    if (typeof gsap !== 'undefined') {
        setTimeout(() => {
            const sliceEl = document.querySelector(`.pizza-slice-overlay[data-flavor-id="${flavorId}"]`);
            if (sliceEl) {
                gsap.fromTo(sliceEl, 
                    { scale: 1.5, rotation: -20, opacity: 0, y: -50 },
                    { scale: 1, rotation: 0, opacity: 1, y: 0, duration: 0.6, ease: 'back.out(1.2)' }
                );
            }
        }, 50);
    }
}

function updateVisualPizza() {
    const display = document.getElementById('visualPizzaDisplay');
    const activePills = document.getElementById('activeFlavorsPills');
    if (!display) return;
    
    display.innerHTML = '';
    if (activePills) activePills.innerHTML = '';
    
    const size = currentPizza.size;
    const selected = currentPizza.selectedFlavors;
    
    // 1. Render Base Crust Background
    const baseImg = document.createElement('div');
    baseImg.className = 'pizza-crust-base';
    
    let sizeBaseImage = 'assets/pizza_grande.jpg';
    if (size === 'broto') {
        sizeBaseImage = 'assets/pizza_broto.jpg';
    } else if (size === 'media') {
        sizeBaseImage = 'assets/pizza_media.jpg';
    } else if (size === 'trem') {
        sizeBaseImage = 'assets/pizza_trem.jpg';
    } else if (size === 'vulcao') {
        sizeBaseImage = 'assets/pizza_vulcao.jpg';
    }
    
    baseImg.style.backgroundImage = `url('${sizeBaseImage}')`;
    display.appendChild(baseImg);
    
    // 2. Render Overlay Slices
    if (selected.length === 0) {
        const slice = document.createElement('img');
        slice.className = 'pizza-slice-overlay';
        slice.src = 'assets/pizza_hero.png';
        slice.style.filter = 'saturate(0.7) brightness(0.95)';
        display.appendChild(slice);
        
        if (activePills) {
            activePills.innerHTML = `<span style="color: var(--text-muted); font-size: 11px; font-style: italic;">Toque nos sabores abaixo para montar</span>`;
        }
        return;
    }
    
    let clips = [];
    if (selected.length === 1) {
        clips = ['none'];
    } else if (selected.length === 2) {
        clips = [
            'polygon(0 0, 50% 0, 50% 100%, 0 100%)', // Left half
            'polygon(50% 0, 100% 0, 100% 100%, 50% 100%)' // Right half
        ];
    } else if (selected.length === 3) {
        clips = [
            'polygon(50% 50%, 50% 0%, 100% 0%, 100% 75%, 93.3% 75%)',
            'polygon(50% 50%, 93.3% 75%, 100% 75%, 100% 100%, 0% 100%, 0% 75%, 6.7% 75%)',
            'polygon(50% 50%, 6.7% 75%, 0% 75%, 0% 0%, 50% 0%)'
        ];
    } else if (selected.length === 4) {
        clips = [
            'polygon(0 0, 50% 0, 50% 50%, 0 50%)', // Top-left quarter
            'polygon(50% 0, 100% 0, 100% 50%, 50% 50%)', // Top-right quarter
            'polygon(50% 50%, 100% 50%, 100% 100%, 50% 100%)', // Bottom-right quarter
            'polygon(0 50%, 50% 50%, 50% 100%, 0 100%)' // Bottom-left quarter
        ];
    }
    
    selected.forEach((flavorId, index) => {
        const flavorData = MENU_ITEMS.pizzas.find(p => p.id === flavorId);
        if (!flavorData) return;
        const flavorImage = flavorData.image || 'assets/pizza_hero.png';
        
        const slice = document.createElement('img');
        slice.className = 'pizza-slice-overlay';
        slice.src = flavorImage;
        slice.style.clipPath = clips[index];
        slice.setAttribute('data-flavor-id', flavorId);
        display.appendChild(slice);
        
        // Add visual lines for dividers
        if (selected.length > 1) {
            if (selected.length === 2 && index === 0) {
                const divider = document.createElement('div');
                divider.className = 'pizza-slice-divider';
                divider.style.position = 'absolute';
                divider.style.left = '50%';
                divider.style.top = '0';
                divider.style.width = '2px';
                divider.style.height = '100%';
                divider.style.backgroundColor = 'rgba(229, 57, 53, 0.4)';
                divider.style.boxShadow = '0 0 8px var(--primary)';
                divider.style.transform = 'translateX(-50%)';
                divider.style.zIndex = '3';
                display.appendChild(divider);
            } else if (selected.length === 3 && index === 0) {
                // Line 1: Top vertical
                const d1 = document.createElement('div');
                d1.className = 'pizza-slice-divider';
                d1.style.position = 'absolute';
                d1.style.left = '50%';
                d1.style.top = '0';
                d1.style.width = '2px';
                d1.style.height = '50%';
                d1.style.backgroundColor = 'rgba(229, 57, 53, 0.4)';
                d1.style.boxShadow = '0 0 8px var(--primary)';
                d1.style.transform = 'translateX(-50%)';
                d1.style.zIndex = '3';
                display.appendChild(d1);
                
                // Line 2: Down-right at 120deg
                const d2 = document.createElement('div');
                d2.className = 'pizza-slice-divider';
                d2.style.position = 'absolute';
                d2.style.left = '50%';
                d2.style.top = '50%';
                d2.style.width = '2px';
                d2.style.height = '50%';
                d2.style.backgroundColor = 'rgba(229, 57, 53, 0.4)';
                d2.style.boxShadow = '0 0 8px var(--primary)';
                d2.style.transformOrigin = 'top center';
                d2.style.transform = 'translateX(-50%) rotate(120deg)';
                d2.style.zIndex = '3';
                display.appendChild(d2);
                
                // Line 3: Down-left at 240deg
                const d3 = document.createElement('div');
                d3.className = 'pizza-slice-divider';
                d3.style.position = 'absolute';
                d3.style.left = '50%';
                d3.style.top = '50%';
                d3.style.width = '2px';
                d3.style.height = '50%';
                d3.style.backgroundColor = 'rgba(229, 57, 53, 0.4)';
                d3.style.boxShadow = '0 0 8px var(--primary)';
                d3.style.transformOrigin = 'top center';
                d3.style.transform = 'translateX(-50%) rotate(240deg)';
                d3.style.zIndex = '3';
                display.appendChild(d3);
            } else if (selected.length === 4 && index === 0) {
                // Line 1: Horizontal divider
                const dh = document.createElement('div');
                dh.className = 'pizza-slice-divider';
                dh.style.position = 'absolute';
                dh.style.left = '0';
                dh.style.top = '50%';
                dh.style.width = '100%';
                dh.style.height = '2px';
                dh.style.backgroundColor = 'rgba(229, 57, 53, 0.4)';
                dh.style.boxShadow = '0 0 8px var(--primary)';
                dh.style.transform = 'translateY(-50%)';
                dh.style.zIndex = '3';
                display.appendChild(dh);

                // Line 2: Vertical divider
                const dv = document.createElement('div');
                dv.className = 'pizza-slice-divider';
                dv.style.position = 'absolute';
                dv.style.left = '50%';
                dv.style.top = '0';
                dv.style.width = '2px';
                dv.style.height = '100%';
                dv.style.backgroundColor = 'rgba(229, 57, 53, 0.4)';
                dv.style.boxShadow = '0 0 8px var(--primary)';
                dv.style.transform = 'translateX(-50%)';
                dv.style.zIndex = '3';
                display.appendChild(dv);
            }
        }
        
        // Pills
        if (activePills) {
            const pill = document.createElement('div');
            pill.className = 'flavor-pill';
            
            let label = '';
            if (selected.length === 1) label = 'Inteira';
            else if (selected.length === 2) label = `Metade ${index + 1}`;
            else if (selected.length === 3) label = `1/3 Fatia ${index + 1}`;
            else label = `1/4 Fatia ${index + 1}`;
            
            pill.innerHTML = `
                <span class="slice-num">${index + 1}</span>
                <span><strong>${label}:</strong> ${flavorData.name}</span>
                <button type="button" class="btn-remove-pill" onclick="handleFlavorSelection('${flavorId}')" title="Remover sabor">
                    <span class="material-symbols-rounded">close</span>
                </button>
            `;
            activePills.appendChild(pill);
        }
    });
}

function adjustCustomizerQty(delta) {
    let qty = currentPizza.quantity + delta;
    if (qty < 1) qty = 1;
    currentPizza.quantity = qty;
    document.getElementById('customizerQty').innerText = qty;
    calculateCustomizerPrice();
}

function calculateCustomizerPrice() {
    if (currentPizza.selectedFlavors.length === 0) {
        document.getElementById('btnAddToOrder').disabled = true;
        document.getElementById('btnAddToOrder').innerText = 'Escolha pelo menos 1 sabor';
        return;
    }
    
    document.getElementById('btnAddToOrder').disabled = false;
    
    // Calcula o preço cobrado pelo maior valor entre os sabores selecionados para o tamanho atual
    let maxFlavorPrice = 0;
    const sizeKey = SIZE_MAP[currentPizza.size] || 'M'; // 'B', 'M', 'G', 'F'
    
    // Verifica se todos os sabores selecionados são promocionais
    let allFlavorsArePromo = currentPizza.selectedFlavors.length > 0;
    currentPizza.selectedFlavors.forEach(flavorId => {
        const flavorData = MENU_ITEMS.pizzas.find(p => p.id === flavorId);
        if (!flavorData || !isItemPromoToday(flavorData)) {
            allFlavorsArePromo = false;
        }
    });
    
    const isPromoActiveForSize = CONFIG_SETTINGS && CONFIG_SETTINGS.promoActive && (CONFIG_SETTINGS.promoDiscountActive || isPromoSize(sizeKey));
    
    if (isPromoActiveForSize && allFlavorsArePromo) {
        if (CONFIG_SETTINGS.promoDiscountActive) {
            // Aplica desconto percentual ao preço normal de cada sabor selecionado e pega o maior
            currentPizza.selectedFlavors.forEach(flavorId => {
                const flavorData = MENU_ITEMS.pizzas.find(p => p.id === flavorId);
                if (flavorData && flavorData.prices) {
                    const price = (parseFloat(flavorData.prices[sizeKey]) || 0) * (1 - (CONFIG_SETTINGS.promoDiscountPercent || 20) / 100);
                    if (price > maxFlavorPrice) {
                        maxFlavorPrice = price;
                    }
                }
            });
        } else {
            // Usa o preço promocional fixo
            maxFlavorPrice = parseFloat(CONFIG_SETTINGS.promoPrice) || 95.00;
        }
    } else {
        currentPizza.selectedFlavors.forEach(flavorId => {
            const flavorData = MENU_ITEMS.pizzas.find(p => p.id === flavorId);
            if (flavorData && flavorData.prices) {
                const price = parseFloat(flavorData.prices[sizeKey]) || 0;
                if (price > maxFlavorPrice) {
                    maxFlavorPrice = price;
                }
            }
        });
    }
    
    // Se por algum motivo o preço não puder ser calculado individualmente, usa o fallback da matriz anterior
    if (maxFlavorPrice === 0 && PIZZA_PRICES && PIZZA_PRICES[currentPizza.size]) {
        const CATEGORY_VALUES = {
            'promocional': 1,
            'tradicional': 2,
            'especial': 3,
            'camarao': 4
        };
        let maxCategory = 'promocional';
        let maxVal = 0;
        currentPizza.selectedFlavors.forEach(flavorId => {
            const flavorData = MENU_ITEMS.pizzas.find(p => p.id === flavorId);
            if (flavorData) {
                const catType = flavorData.categoryType || 'promocional';
                const val = CATEGORY_VALUES[catType] || 1;
                if (val > maxVal) {
                    maxVal = val;
                    maxCategory = catType;
                }
            }
        });
        maxFlavorPrice = PIZZA_PRICES[currentPizza.size][maxCategory] || 0;
    }
    
    const borderRadio = document.querySelector('input[name="pizza-border"]:checked');
    const borderPrice = borderRadio ? parseFloat(borderRadio.getAttribute('data-price')) : 0;
    
    currentPizza.border = borderRadio ? borderRadio.value : 'sem-borda';
    
    const singlePrice = maxFlavorPrice + borderPrice;
    currentPizza.totalPrice = singlePrice * currentPizza.quantity;
    
    document.getElementById('btnAddToOrder').innerText = `Adicionar ao Pedido — R$ ${currentPizza.totalPrice.toFixed(2).replace('.', ',')}`;
}

function addPizzaToOrder() {
    if (currentPizza.selectedFlavors.length === 0) return;
    
    const pizzaNotesEl = document.getElementById('pizzaNotes'); currentPizza.notes = pizzaNotesEl ? pizzaNotesEl.value.trim() : '';
    
    const cartItem = {
        type: 'pizza',
        size: currentPizza.size,
        sizeName: TAMANHO_NOMES[currentPizza.size],
        border: currentPizza.border,
        borderName: BORDAS[currentPizza.border] ? (BORDAS[currentPizza.border].price === 0 ? BORDAS[currentPizza.border].name : `${BORDAS[currentPizza.border].name} (+ R$ ${BORDAS[currentPizza.border].price.toFixed(2).replace('.', ',')})`) : 'Sem Borda',
        flavors: [...currentPizza.selectedFlavors],
        flavorNames: currentPizza.selectedFlavors.map(fId => {
            const pizzaObj = (MENU_ITEMS.pizzas || []).find(p => p.id === fId);
            return pizzaObj ? pizzaObj.name : fId;
        }),
        notes: currentPizza.notes,
        quantity: currentPizza.quantity,
        singlePrice: currentPizza.totalPrice / currentPizza.quantity,
        totalPrice: currentPizza.totalPrice
    };
    
    cart = CartService.addToCart(cartItem);
    updateCartUI();
    closePizzaCustomizer();
    toggleCart(true);
    
    const badge = document.getElementById('cartBadgeCount');
    if (badge) {
        badge.classList.remove('animate-bounce');
        void badge.offsetWidth;
        badge.classList.add('animate-bounce');
    }
}

/* ==========================================================================
   Add Simple Items (Drinks)
   ========================================================================== */
function addSimpleItemToCart(itemId, category) {
    let list = [];
    if (category === 'bebidas') {
        list = MENU_ITEMS.bebidas || [];
    } else if (category === 'lanches') {
        list = MENU_ITEMS.lanches || [];
    } else if (category === 'calzones') {
        list = MENU_ITEMS.calzones || [];
    }
    const itemData = list.find(item => item.id === itemId);
    
    if (!itemData) return;
    
    const isPromoActive = CONFIG_SETTINGS && CONFIG_SETTINGS.promoActive && isItemPromoToday(itemData);
    let priceVal = parseFloat(itemData.price) || 0;
    
    if (isPromoActive) {
        priceVal = getPromoPriceForProduct({
            ...itemData,
            type: category === 'lanches' ? 'lanche' : (category === 'calzones' ? 'calzone' : 'bebida')
        });
    }
    
    const cartItem = {
        type: 'simple',
        id: itemId,
        name: itemData.name,
        category: category,
        quantity: 1,
        singlePrice: priceVal,
        totalPrice: priceVal
    };
    
    cart = CartService.addToCart(cartItem);
    updateCartUI();
    toggleCart(true);
}

/* ==========================================================================
   Cart State Operations & Layout Rendering
   ========================================================================== */
function toggleCart(isOpen) {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartOverlay');
    
    if (isOpen) {
        drawer.classList.add('active');
        overlay.classList.add('active');
    } else {
        drawer.classList.remove('active');
        overlay.classList.remove('active');
    }
}

function updateCartQty(index, delta) {
    cart = CartService.updateCartQty(index, delta);
    updateCartUI();
}

function updateCartUI() {
    const emptyState = document.getElementById('cartEmptyState');
    const contentDiv = document.getElementById('cartContent');
    const itemsList = document.getElementById('cartItemsList');
    
    let totalItems = 0;
    let subtotal = 0;
    
    if (itemsList) itemsList.innerHTML = '';
    
    if (cart.length === 0) {
        if (emptyState) emptyState.classList.remove('display-none');
        if (contentDiv) contentDiv.classList.add('display-none');
        const badgeCount = document.getElementById('cartBadgeCount');
        if (badgeCount) {
            badgeCount.innerText = '0';
            badgeCount.style.display = 'none';
        }
        return;
    }
    
    if (emptyState) emptyState.classList.add('display-none');
    if (contentDiv) contentDiv.classList.remove('display-none');
    
    cart.forEach((item, index) => {
        totalItems += item.quantity;
        subtotal += item.totalPrice;
        
        if (itemsList) {
            const itemRow = document.createElement('div');
            itemRow.className = 'cart-item';
            
            let detailsHTML = '';
            let titleHTML = '';
            
            if (item.type === 'pizza') {
                titleHTML = `Pizza ${item.sizeName}`;
                detailsHTML = `
                    <div class="cart-item-subtitle">
                        <strong>Sabores:</strong> ${item.flavorNames.join(' / ')}<br>
                        <strong>Borda:</strong> ${item.borderName}
                    </div>
                `;
                if (item.notes) {
                    detailsHTML += `<div class="cart-item-notes">Obs: ${item.notes}</div>`;
                }
            } else if (item.type === 'acai') {
                titleHTML = `Açaí ${item.size}`;
                let adds = [];
                if (item.freeAdditions && item.freeAdditions.length > 0) {
                    adds.push(`Grátis: ${item.freeAdditions.join(', ')}`);
                }
                if (item.paidAdditions && item.paidAdditions.length > 0) {
                    adds.push(`Pagos: ${item.paidAdditions.map(a => a.name).join(', ')}`);
                }
                detailsHTML = `
                    <div class="cart-item-subtitle">
                        ${adds.length > 0 ? `<strong>Adicionais:</strong> ${adds.join('<br>')}` : 'Sem adicionais'}
                    </div>
                `;
                if (item.notes) {
                    detailsHTML += `<div class="cart-item-notes">Obs: ${item.notes}</div>`;
                }
            } else {
                titleHTML = item.name;
            }
            
            itemRow.innerHTML = `
                <div class="cart-item-details">
                    <h4 class="cart-item-title">${titleHTML}</h4>
                    ${detailsHTML}
                    <div class="cart-item-action">
                        <span class="cart-item-price">R$ ${item.totalPrice.toFixed(2).replace('.', ',')}</span>
                        <div class="item-qty-adjuster">
                            <button onclick="updateCartQty(${index}, -1)"><span class="material-symbols-rounded">remove</span></button>
                            <span>${item.quantity}</span>
                            <button onclick="updateCartQty(${index}, 1)"><span class="material-symbols-rounded">add</span></button>
                        </div>
                    </div>
                </div>
            `;
            
            itemsList.appendChild(itemRow);
        }
    });
    
    // Values Summary
    let deliveryFee = 0;
    if (checkoutType === 'delivery') {
        const bairroSelect = document.getElementById('addressBairro');
        const selectedBairro = bairroSelect ? bairroSelect.value : '';
        deliveryFee = selectedBairro ? getDeliveryFeeForBairro(selectedBairro) : 10.00;
    }
    const finalTotal = subtotal + deliveryFee;
    
    const subtotalEl = document.getElementById('cartSubtotal');
    if (subtotalEl) subtotalEl.innerText = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
    
    const deliveryFeeEl = document.getElementById('cartDeliveryFee');
    if (deliveryFeeEl) deliveryFeeEl.innerText = deliveryFee === 0 ? 'Grátis' : `R$ ${deliveryFee.toFixed(2).replace('.', ',')}`;
    
    const totalEl = document.getElementById('cartTotal');
    if (totalEl) totalEl.innerText = `R$ ${finalTotal.toFixed(2).replace('.', ',')}`;
    
    const badgeCount = document.getElementById('cartBadgeCount');
    if (badgeCount) {
        badgeCount.innerText = totalItems;
        badgeCount.style.display = totalItems > 0 ? 'flex' : 'none';
    }
    
    // Desabilitar botão de checkout se a pizzaria estiver fechada
    const checkoutBtn = document.querySelector('.checkout-btn');
    if (checkoutBtn) {
        if (!isShopOpen) {
            checkoutBtn.disabled = true;
            checkoutBtn.style.opacity = '0.5';
            checkoutBtn.style.cursor = 'not-allowed';
            checkoutBtn.style.pointerEvents = 'none';
            const spanText = checkoutBtn.querySelector('span');
            if (spanText) spanText.innerText = 'Pizzaria Fechada';
        } else {
            checkoutBtn.disabled = false;
            checkoutBtn.style.opacity = '';
            checkoutBtn.style.cursor = '';
            checkoutBtn.style.pointerEvents = '';
            const spanText = checkoutBtn.querySelector('span');
            if (spanText) spanText.innerText = 'Finalizar Pedido';
        }
    }
}

function saveCartToLocalStorage() {
    CartService.setCart(cart);
}

function loadCartFromLocalStorage() {
    cart = CartService.loadCartFromLocalStorage();
    updateCartUI();
}

/* ==========================================================================
   Checkout Modal Handlers
   ========================================================================== */
function openCheckoutModal() {
    if (!isShopOpen) {
        alert("A Pizzaria Drill está fechada para pedidos no momento. Agradecemos a compreensão!");
        return;
    }
    toggleCart(false); // Close cart sidebar
    const modal = document.getElementById('checkoutModal');
    
    let subtotal = CartService.calculateSubtotal();
    let fee = 0;
    if (checkoutType === 'delivery') {
        const bairroSelect = document.getElementById('addressBairro');
        const selectedBairro = bairroSelect ? bairroSelect.value : '';
        fee = selectedBairro ? getDeliveryFeeForBairro(selectedBairro) : DELIVERY_FEE;
    }
    
    // Handle Cash 5% discount
    const payMethodRadio = document.querySelector('input[name="payment-method"]:checked'); const isCash = payMethodRadio ? payMethodRadio.value === 'cash' : false;
    let total = subtotal + fee;
    if (isCash) {
        total = (subtotal * 0.95) + fee;
    }
    
    const checkoutTotalValueEl = document.getElementById('checkoutTotalValue'); if (checkoutTotalValueEl) checkoutTotalValueEl.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Subcategory Switcher inside Customizer (visual sub-tabs)
function renderPizzasFlavorsGrid(subcategory) {
    // In this premium site, we render all categories stacked, so sub-tab filters can scroll to the subcategory
    const container = document.getElementById('customizerFlavorsList');
    if (!container) return;
    
    // Encontrar todos os títulos de categorias e rolar para eles ou ocultar
    const headers = container.querySelectorAll('.customizer-flavor-category-title');
    const blocks = [];
    let currentBlock = null;
    
    container.childNodes.forEach(node => {
        if (node.className === 'customizer-flavor-category-title') {
            currentBlock = { header: node, items: [] };
            blocks.push(currentBlock);
        } else if (currentBlock) {
            currentBlock.items.push(node);
        }
    });
    
    blocks.forEach(block => {
        const text = block.header.innerText.toLowerCase();
        let show = false;
        
        if (subcategory === 'salgadas' && text.includes('salgadas')) {
            show = true;
        } else if (subcategory === 'doces' && text.includes('doces')) {
            show = true;
        }
        
        block.header.style.display = show ? 'block' : 'none';
        block.items.forEach(item => item.style.display = show ? 'flex' : 'none');
    });
}

function closeCheckoutModal() {
    const modal = document.getElementById('checkoutModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function setCheckoutType(type) {
    checkoutType = type;
    const deliveryTab = document.getElementById('deliveryTab');
    const pickupTab = document.getElementById('pickupTab');
    const addressSection = document.getElementById('addressSection');
    
    const street = document.getElementById('addressStreet');
    const number = document.getElementById('addressNumber');
    const neighborhood = document.getElementById('addressBairro');
    
    if (type === 'delivery') {
        deliveryTab.classList.add('active');
        pickupTab.classList.remove('active');
        addressSection.classList.remove('display-none');
        
        street.required = true;
        number.required = true;
        neighborhood.required = true;
    } else {
        deliveryTab.classList.remove('active');
        pickupTab.classList.add('active');
        addressSection.classList.add('display-none');
        
        street.required = false;
        number.required = false;
        neighborhood.required = false;
    }
    
    // Update summary price
    updateCheckoutPrice();
}

function togglePaymentFields() {
    const payMethodRadio = document.querySelector('input[name="payment-method"]:checked'); const selectedMethod = payMethodRadio ? payMethodRadio.value : 'pix';
    const cashChangeGroup = document.getElementById('cashChangeGroup');
    const pixInstructions = document.getElementById('pixInstructions');
    
    if (selectedMethod === 'cash') {
        cashChangeGroup.classList.remove('display-none');
        pixInstructions.classList.add('display-none');
    } else if (selectedMethod === 'pix') {
        cashChangeGroup.classList.add('display-none');
        pixInstructions.classList.remove('display-none');
    } else {
        cashChangeGroup.classList.add('display-none');
        pixInstructions.classList.add('display-none');
    }
    
    updateCheckoutPrice();
}

function updateCheckoutPrice() {
    let subtotal = CartService.calculateSubtotal();
    let fee = 0;
    if (checkoutType === 'delivery') {
        const bairroSelect = document.getElementById('addressBairro');
        const selectedBairro = bairroSelect ? bairroSelect.value : '';
        fee = selectedBairro ? getDeliveryFeeForBairro(selectedBairro) : DELIVERY_FEE;
    }
    
    // 5% discount on subtotal if payment is Cash
    const payMethodRadio = document.querySelector('input[name="payment-method"]:checked'); const selectedMethod = payMethodRadio ? payMethodRadio.value : 'pix';
    let total = subtotal + fee;
    if (selectedMethod === 'cash') {
        total = (subtotal * 0.95) + fee;
    }
    
    const checkoutTotalValueEl = document.getElementById('checkoutTotalValue'); if (checkoutTotalValueEl) checkoutTotalValueEl.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

function submitOrder() {
    const form = document.getElementById('checkoutForm');
    
    // Check validation manually to avoid full page reload
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const clientNameEl = document.getElementById('clientName'); const clientName = clientNameEl ? clientNameEl.value.trim() : '';
    const clientPhoneEl = document.getElementById('clientPhone'); const clientPhone = clientPhoneEl ? clientPhoneEl.value.trim() : '';
    const payMethodRadio = document.querySelector('input[name="payment-method"]:checked'); const paymentMethod = payMethodRadio ? payMethodRadio.value : 'pix';
    
    let subtotal = CartService.calculateSubtotal();
    let fee = 0;
    if (checkoutType === 'delivery') {
        const bairroSelect = document.getElementById('addressBairro');
        const selectedBairro = bairroSelect ? bairroSelect.value : '';
        fee = selectedBairro ? getDeliveryFeeForBairro(selectedBairro) : DELIVERY_FEE;
    }
    
    let total = subtotal + fee;
    let discountMsg = '';
    
    if (paymentMethod === 'cash') {
        total = (subtotal * 0.95) + fee;
        discountMsg = `\n*(Desconto Dinheiro de 5% aplicado no subtotal!)*`;
    }
    
    // Building WhatsApp Message
    let msg = `🍕 *NOVO PEDIDO - PIZZARIA DRILL* 🍕\n`;
    msg += `----------------------------------------\n\n`;
    msg += `👤 *Cliente:* ${clientName}\n`;
    msg += `📞 *WhatsApp:* ${clientPhone}\n`;
    msg += `📦 *Tipo:* ${checkoutType === 'delivery' ? '🚗 Entrega (Delivery)' : '🏪 Retirada no Balcão'}\n\n`;
    
    if (checkoutType === 'delivery') {
        const streetEl = document.getElementById('addressStreet'); const street = streetEl ? streetEl.value.trim() : '';
        const numberEl = document.getElementById('addressNumber'); const number = numberEl ? numberEl.value.trim() : '';
        const neighborhoodEl = document.getElementById('addressBairro'); const neighborhood = neighborhoodEl ? neighborhoodEl.value.trim() : '';
        const refEl = document.getElementById('addressRef'); const ref = refEl ? refEl.value.trim() : '';
        
        msg += `📍 *Endereço de Entrega:*\n`;
        msg += `${street}, nº ${number}\n`;
        msg += `Bairro: ${neighborhood}\n`;
        if (ref) msg += `Ref/Complemento: ${ref}\n`;
        msg += `\n`;
    } else {
        msg += `📍 *Retirada em:* Rua das Quaresmeiras, Nº 30 - Vale Verde, Nova Petrópolis\n\n`;
    }
    
    msg += `🛒 *Itens do Pedido:*\n`;
    msg += `----------------------------------------\n`;
    
    cart.forEach(item => {
        if (item.type === 'pizza') {
            msg += `• *1x Pizza ${item.sizeName}*\n`;
            msg += `  Sabores: ${item.flavorNames.join(' e ')}\n`;
            msg += `  Borda: ${item.borderName}\n`;
            if (item.notes) msg += `  Observação: _"${item.notes}"_\n`;
            msg += `  *Subtotal:* R$ ${item.totalPrice.toFixed(2)}\n\n`;
        } else if (item.type === 'acai') {
            msg += `• *${item.quantity}x Açaí ${item.size}*\n`;
            if (item.freeAdditions && item.freeAdditions.length > 0) {
                msg += `  Adicionais Grátis: ${item.freeAdditions.join(', ')}\n`;
            }
            if (item.paidAdditions && item.paidAdditions.length > 0) {
                msg += `  Adicionais Pagos: ${item.paidAdditions.map(a => `${a.name} (+R$ ${a.price.toFixed(2)})`).join(', ')}\n`;
            }
            if (item.notes) msg += `  Observação: _"${item.notes}"_\n`;
            msg += `  *Subtotal:* R$ ${item.totalPrice.toFixed(2)}\n\n`;
        } else {
            msg += `• *${item.quantity}x ${item.name}*\n`;
            msg += `  *Subtotal:* R$ ${item.totalPrice.toFixed(2)}\n\n`;
        }
    });
    
    msg += `----------------------------------------\n`;
    msg += `💵 *Subtotal:* R$ ${subtotal.toFixed(2)}\n`;
    msg += `🚗 *Taxa de Entrega:* ${fee === 0 ? 'Grátis' : `R$ ${fee.toFixed(2)}`}\n`;
    msg += `💰 *Total a pagar:* R$ ${total.toFixed(2)}${discountMsg}\n\n`;
    
    msg += `💳 *Forma de Pagamento:* `;
    if (paymentMethod === 'pix') {
        msg += `Pix\n*(Chave Pix: 658101070000140)*`;
    } else if (paymentMethod === 'card') {
        msg += `Cartão (Levar Maquininha)`;
    } else {
        const changeEl = document.getElementById('cashChange'); const change = changeEl ? changeEl.value.trim() : '';
        msg += `Dinheiro`;
        if (change) msg += ` (Troco para R$ ${change})`;
    }
    
    // Format URL
    const whatsappNumber = CONFIG_SETTINGS.whatsapp;
    const encodedMsg = encodeURIComponent(msg);
    const whatsappLink = `https://api.whatsapp.com/send?phone=${whatsappNumber}&text=${encodedMsg}`;
    
    // Envia o pedido para o painel da revenda (Firebase ou Servidor Local)
    const orderData = {
        clientName: clientName,
        clientPhone: clientPhone,
        checkoutType: checkoutType,
        address: checkoutType === 'delivery' ? {
            street: (document.getElementById('addressStreet') ? document.getElementById('addressStreet').value.trim() : ''),
            number: (document.getElementById('addressNumber') ? document.getElementById('addressNumber').value.trim() : ''),
            neighborhood: (document.getElementById('addressBairro') ? document.getElementById('addressBairro').value.trim() : ''),
            reference: (document.getElementById('addressRef') ? document.getElementById('addressRef').value.trim() : '')
        } : null,
        paymentMethod: paymentMethod,
        cashChange: paymentMethod === 'cash' ? (document.getElementById('cashChange') ? document.getElementById('cashChange').value.trim() : '') : null,
        cart: cart,
        subtotal: subtotal,
        deliveryFee: fee,
        total: total
    };

    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        const orderId = Date.now();
        const timeFormatted = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const dateFormatted = new Date().toLocaleDateString('pt-BR');
        
        const firebaseOrder = {
            ...orderData,
            id: orderId,
            status: 'Pendente',
            timestamp: orderId,
            time: timeFormatted,
            date: dateFormatted
        };

        ConfigService.saveOrder(orderId, firebaseOrder)
        .catch(err => {
            console.error("Erro ao enviar para o Firebase, enviando para o servidor local:", err);
            fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            })
            .catch(localErr => console.error("Erro ao enviar pedido para o painel local:", localErr));
        });
    } else {
        fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        })
        .catch(err => console.error("Erro ao enviar pedido para o painel local:", err));
    }

    // Clear cart and close modals
    cart = [];
    saveCartToLocalStorage();
    updateCartUI();
    closeCheckoutModal();
    
    // Open WhatsApp link in new tab
    window.open(whatsappLink, '_blank');
    
    // Show success dialog
    alert('Pedido enviado com sucesso! Você será redirecionado para o WhatsApp para confirmar.');
}

function initMenuData() {
    // 1. Listen to config/settings
    ConfigService.subscribeSettings((data) => {
        if (data) {
            CONFIG_SETTINGS = { ...CONFIG_SETTINGS, ...data };
            updateContactInfoUI();
        }
    });
    
    // 2. Listen to config/delivery_fees
    ConfigService.subscribeDeliveryFees((data) => {
        if (data) {
            TAXAS_ENTREGA = data;
            populateNeighborhoodDropdown();
            updateCartUI();
        }
    });

    // 6. Listen to config/pizza_prices
    if (ConfigService.subscribePizzaPrices) {
        ConfigService.subscribePizzaPrices((data) => {
            if (data) {
                PIZZA_PRICES = data;
                updateCartUI();
            }
        });
    }
    
    // 3. Listen to categorias
    ProductsService.subscribeCategories((categoriesList) => {
        if (categoriesList && categoriesList.length > 0) {
            renderCategoriesUI(categoriesList);
        }
    });
    
    // 4. Listen to banners
    ProductsService.subscribeBanners((bannersList) => {
        if (bannersList && bannersList.length > 0) {
            renderBannersUI(bannersList);
        }
    });
    
    // 5. Listen to produtos (all items)
    ProductsService.subscribeProducts((productsList) => {
        MENU_ITEMS = { pizzas: [], lanches: [], calzones: [], bebidas: [], acais: [] };
        BORDAS = {};
        const freeAdds = [];
        const paid5 = [];
        const paid25 = [];
        
        productsList.forEach((item) => {
            if (item.category === 'pizzas') {
                if (item.subcategory) {
                    item.category = item.subcategory;
                }
                MENU_ITEMS.pizzas.push(item);
            } else if (item.category === 'bordas') {
                const key = item.id.replace('borda_', '');
                BORDAS[key] = { name: item.name, price: item.price, category: item.subcategory || 'ambas' };
            } else if (item.category === 'acai_adicionais') {
                if (item.available !== false) {
                    if (item.type === 'free' || item.price === 0) {
                        freeAdds.push(item);
                    } else if (item.type === 'paid_5' || item.price === 5) {
                        paid5.push(item);
                    } else if (item.type === 'paid_2.5' || item.price === 2.5) {
                        paid25.push(item);
                    } else {
                        if ((item.price || 0) > 3) {
                            paid5.push(item);
                        } else {
                            paid25.push(item);
                        }
                    }
                }
            } else if (item.category) {
                if (!MENU_ITEMS[item.category]) {
                    MENU_ITEMS[item.category] = [];
                }
                MENU_ITEMS[item.category].push(item);
            }
        });
        
        ACAI_FREE_ADDITIONS = freeAdds;
        ACAI_PAID_5 = paid5;
        ACAI_PAID_2_5 = paid25;
        
        PIZZA_TYPES = getPizzaTypesDynamic();
        renderMenu();
        
        const customizerModal = document.getElementById('customizerModal');
        if (customizerModal && customizerModal.classList.contains('active')) {
            renderCustomizerFlavors();
            renderCustomizerBorders();
            calculateCustomizerPrice();
        }
        
        const acaiCustomizerModal = document.getElementById('acaiCustomizerModal');
        if (acaiCustomizerModal && acaiCustomizerModal.classList.contains('active')) {
            renderAcaiAdditionsLists();
            calculateAcaiPrice();
        }
        
        updateCartUI();
    });
}

function renderCategoriesUI(categories) {
    const scrollContainer = document.getElementById('categoriesScroll');
    if (!scrollContainer) return;
    
    const activeCat = typeof currentCategory !== 'undefined' ? currentCategory : 'todos';
    scrollContainer.innerHTML = '';
    
    categories.forEach(cat => {
        const btn = document.createElement('button');
        const isActive = cat.id === activeCat;
        btn.className = `category-chip${isActive ? ' active' : ''}`;
        btn.onclick = () => filterCategory(cat.id, btn);
        
        btn.innerHTML = `
            <div class="category-icon-circle">${cat.icon || '🍽️'}</div>
            <span class="category-name">${cat.name}</span>
        `;
        scrollContainer.appendChild(btn);
    });
}

function renderBannersUI(banners) {
    const bannerTrack = document.getElementById('bannerTrack');
    if (!bannerTrack) return;
    
    bannerTrack.innerHTML = '';
    
    banners.forEach(banner => {
        const slide = document.createElement('div');
        slide.className = 'promo-banner';
        slide.style.background = banner.gradient || 'linear-gradient(135deg, #b71c1c 0%, #1a0a0a 100%)';
        
        slide.innerHTML = `
            <div class="banner-overlay"></div>
            <div class="banner-content">
                <span class="banner-tag" ${banner.tagBg ? `style="background-color: ${banner.tagBg}; color: #fff;"` : ''}>${banner.tag}</span>
                <h2 class="banner-title">${banner.title}</h2>
                <p class="banner-subtitle">${banner.subtitle}</p>
            </div>
            ${banner.image ? `<img src="${banner.image}" alt="${banner.title}" class="banner-image">` : ''}
        `;
        bannerTrack.appendChild(slide);
    });
}

function initShopStatusListener() {
    ConfigService.subscribeShopStatus((data) => {
        isShopOpen = data ? (data.isOpen !== undefined ? data.isOpen : (data.open !== undefined ? data.open : true)) : true;
        updateShopStatusUI();
    });
}

function updateShopStatusUI() {
    const statusBadge = document.getElementById('statusBadge');
    if (statusBadge) {
        if (isShopOpen) {
            statusBadge.className = 'status-badge open';
            statusBadge.innerHTML = '<span class="dot animate-pulse"></span> Aberto agora para pedidos';
        } else {
            statusBadge.className = 'status-badge closed';
            statusBadge.innerHTML = '<span class="dot"></span> Fechado no momento';
        }
    }
    
    // Disable/enable checkout button and update text in cart UI
    updateCartUI();
}

function seedFirebaseMenu() {}
function getMinPriceForSize(sizeKey) {
    let min = Infinity;
    const pizzas = MENU_ITEMS.pizzas || [];
    pizzas.forEach(p => {
        if (p.prices && p.prices[sizeKey] && p.prices[sizeKey] > 0) {
            if (p.prices[sizeKey] < min) min = p.prices[sizeKey];
        }
    });
    return min === Infinity ? 0 : min;
}

function getPizzaTypesDynamic() {
    const minB = getMinPriceForSize('B');
    const minM = getMinPriceForSize('M');
    const minG = getMinPriceForSize('G');
    const minF = getMinPriceForSize('F');
    
    return [
        {
            id: 'brotinho',
            name: 'Pizza Brotinho',
            description: `Brotinho (20cm) • 4 fatias • 1 sabor • A partir de R$ ${minB.toFixed(2).replace('.', ',')}`,
            image: 'assets/pizza_media.jpg',
            priceMin: minB,
            priceMax: minB
        },
        {
            id: 'media',
            name: 'Pizza Média',
            description: `Média (25cm) • 6 fatias • Até 2 sabores • A partir de R$ ${minM.toFixed(2).replace('.', ',')}`,
            image: 'assets/pizza_media.jpg',
            priceMin: minM,
            priceMax: minM
        },
        {
            id: 'grande',
            name: 'Pizza Grande',
            description: `Grande (35cm) • 12 fatias • Até 3 sabores • A partir de R$ ${minG.toFixed(2).replace('.', ',')}`,
            image: 'assets/pizza_grande.jpg',
            priceMin: minG,
            priceMax: minG
        },
        {
            id: 'familia',
            name: 'Pizza Família',
            description: `Família (40cm) • 16 fatias • Até 4 sabores • A partir de R$ ${minF.toFixed(2).replace('.', ',')}`,
            image: 'assets/pizza_grande.jpg',
            priceMin: minF,
            priceMax: minF
        }
    ];
}

function renderCustomizerBorders() {
    const container = document.getElementById('bordersContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Check if the current selection contains only sweet flavors
    let hasSalty = false;
    let hasSweet = false;
    
    currentPizza.selectedFlavors.forEach(flavorId => {
        const flavorData = MENU_ITEMS.pizzas.find(p => p.id === flavorId);
        if (flavorData) {
            if (flavorData.category === 'doces') {
                hasSweet = true;
            } else {
                hasSalty = true;
            }
        }
    });
    
    // Determine target category
    const targetCategory = hasSweet ? 'doces' : 'salgadas';
    
    // Render borders based on category
    Object.keys(BORDAS).forEach(key => {
        const border = BORDAS[key];
        
        // Determinar se a borda pertence à categoria desejada
        let borderCat = border.category;
        if (!borderCat) {
            // Fallback para dados legados no Firebase
            if (key === 'sem-borda') {
                borderCat = 'ambas';
            } else {
                const cleanKey = key.toLowerCase();
                if (cleanKey.includes('choco') || cleanKey.includes('doce') || cleanKey.includes('leite') || cleanKey.includes('misto')) {
                    borderCat = 'doces';
                } else {
                    borderCat = 'salgadas';
                }
            }
        }
        
        // Se a pizza é doce (hasSweet = true), mostramos apenas as doces e 'ambas'
        // Se a pizza é salgada (targetCategory === 'salgadas'), mostramos salgadas, doces e 'ambas' (todas)
        if (targetCategory === 'doces' && borderCat !== 'ambas' && borderCat !== 'doces') {
            return;
        }
        
        const isChecked = currentPizza.border === key ? 'checked' : '';
        const priceLabel = border.price === 0 ? 'Grátis' : `+ R$ ${border.price.toFixed(2).replace('.', ',')}`;
        
        const label = document.createElement('label');
        label.className = 'border-card';
        label.innerHTML = `
            <input type="radio" name="pizza-border" value="${key}" data-price="${border.price}" ${isChecked}>
            <div class="border-card-content">
                <span>${border.name}</span>
                <span class="border-price">${priceLabel}</span>
            </div>
        `;
        container.appendChild(label);
    });
    
    // Ensure one radio is checked if selection was reset
    const checkedRadio = container.querySelector('input[name="pizza-border"]:checked');
    if (!checkedRadio) {
        const defaultRadio = container.querySelector('input[name="pizza-border"][value="sem-borda"]');
        if (defaultRadio) {
            defaultRadio.checked = true;
            currentPizza.border = 'sem-borda';
        }
    }
}

function initDragToScroll() {
    const selectors = ['.flavors-carousel', '.categories-nav', '.banner-track', '.scroll-x-container', '.nav-tabs-wrapper'];
    selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(slider => {
            let isDown = false;
            let startX;
            let scrollLeft;
            let hasMoved = false;

            slider.addEventListener('mousedown', (e) => {
                isDown = true;
                hasMoved = false;
                slider.style.cursor = 'grabbing';
                startX = e.pageX - slider.offsetLeft;
                scrollLeft = slider.scrollLeft;
            });

            slider.addEventListener('mouseleave', () => {
                isDown = false;
                slider.style.cursor = 'grab';
            });

            slider.addEventListener('mouseup', (e) => {
                isDown = false;
                slider.style.cursor = 'grab';
                if (hasMoved) {
                    e.preventDefault();
                }
            });

            slider.addEventListener('mousemove', (e) => {
                if (!isDown) return;
                const x = e.pageX - slider.offsetLeft;
                const walk = (x - startX) * 2; // scroll-fast multiplier
                if (Math.abs(x - startX) > 5) {
                    hasMoved = true;
                }
                e.preventDefault();
                slider.scrollLeft = scrollLeft - walk;
            });

            // Prevent clicks on child elements when dragging
            slider.addEventListener('click', (e) => {
                if (hasMoved) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }, true);

            // Set grab cursor
            slider.style.cursor = 'grab';
        });
    });
}
