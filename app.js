/* ==========================================================================
   Cardápio Data Structure
   ========================================================================== */
let MENU_ITEMS = {
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
};

let PIZZA_PRICES = {
    broto: { promocional: 65.00, tradicional: 70.00, especial: 75.00, camarao: 80.00 },
    media: { promocional: 75.00, tradicional: 80.00, especial: 85.00, camarao: 90.00 },
    grande: { promocional: 90.00, tradicional: 100.00, especial: 110.00, camarao: 115.00 },
    vulcao: { promocional: 90.00, tradicional: 100.00, especial: 110.00, camarao: 110.00 },
    trem: { promocional: 160.00, tradicional: 175.00, especial: 195.00, camarao: 210.00 }
};

const TAMANHO_NOMES = {
    'broto': 'Broto (4 fatias)',
    'media': 'Média (8 fatias)',
    'grande': 'Grande (12 pedaços)',
    'vulcao': 'Vulcão (12 pedaços)',
    'trem': 'Trem (24 pedaços)'
};

const TAMANHO_REGRAS = {
    'broto': { maxFlavors: 1, slices: 4, name: 'Broto' },
    'media': { maxFlavors: 2, slices: 8, name: 'Média' },
    'grande': { maxFlavors: 3, slices: 12, name: 'Grande' },
    'vulcao': { maxFlavors: 2, slices: 12, name: 'Vulcão' },
    'trem': { maxFlavors: 4, slices: 24, name: 'Trem' }
};

let BORDAS = {
    'sem-borda': { name: 'Sem Borda', price: 0.00 },
    'catupiry': { name: 'Borda de Catupiry', price: 8.00 },
    'cheddar': { name: 'Borda de Cheddar', price: 8.00 },
    'chocolate': { name: 'Borda de Chocolate Duo', price: 10.00 }
};


/* ==========================================================================
   Firebase Initialization
   ========================================================================== */
if (typeof firebase !== 'undefined' && typeof firebaseConfig !== 'undefined' && firebaseConfig.apiKey !== 'SUA_API_KEY') {
    firebase.initializeApp(firebaseConfig);
}

/* ==========================================================================
   State Variables
   ========================================================================== */
let cart = [];
let currentPizza = null;
let checkoutType = 'delivery'; // 'delivery' or 'pickup'
let PROMO_CONFIG = {
    show_popup: false,
    facebook_url: ""
};
let promoModalChecked = false;

let CONFIG_SETTINGS = {
    whatsapp: '5554996985724',
    whatsappFormatted: '(54) 99698-5724'
};

let TAXAS_ENTREGA = {
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
};

function getDeliveryFee() {
    if (checkoutType !== 'delivery') return 0;
    const select = document.getElementById('addressBairro');
    if (!select) return 10.00;
    const value = select.value;
    if (TAXAS_ENTREGA[value]) {
        return TAXAS_ENTREGA[value].fee;
    }
    return 10.00;
}

function onNeighborhoodChange() {
    updateCheckoutPrice();
    updateCartUI();
}

function populateNeighborhoodDropdown() {
    const select = document.getElementById('addressBairro');
    if (!select) return;
    
    const currentVal = select.value;
    select.innerHTML = '<option value="" disabled selected>Selecione seu bairro</option>';
    
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

let PIZZA_TYPES = [];

/* ==========================================================================
   Initialization / DOM Loading
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    populateNeighborhoodDropdown();
    updateContactInfoUI();
    renderMenu();
    initMenuData();
    setupPizzaCustomizerEvents();
    loadCartFromLocalStorage();
    checkAndOpenPromoModal();
    initPWA();
});

/* ==========================================================================
   Render Catalog Functions
   ========================================================================== */
function renderMenu() {
    const pizzasGrid = document.getElementById('pizzasGrid');
    const bebidasGrid = document.getElementById('bebidasGrid');
    const sobremesasGrid = document.getElementById('sobremesasGrid');
    
    if (pizzasGrid) pizzasGrid.innerHTML = '';
    if (bebidasGrid) bebidasGrid.innerHTML = '';
    if (sobremesasGrid) sobremesasGrid.innerHTML = '';
    
    const searchVal = document.getElementById('searchInput') ? document.getElementById('searchInput').value.toLowerCase().trim() : '';
    
    // Render Pizza Size Cards in pizzasGrid
    if (pizzasGrid) {
        const sizesToRender = ['trem', 'broto', 'media', 'grande', 'vulcao'];
        let showPizzas = true;
        let matchedFlavorId = null;
        
        if (searchVal) {
            const matchesSize = sizesToRender.some(sizeId => {
                const name = TAMANHO_NOMES[sizeId] || '';
                return name.toLowerCase().includes(searchVal) || sizeId.includes(searchVal);
            });
            
            const matchedFlavor = (MENU_ITEMS.pizzas || []).find(pizza => {
                return pizza.name.toLowerCase() === searchVal;
            }) || (MENU_ITEMS.pizzas || []).find(pizza => {
                return pizza.name.toLowerCase().includes(searchVal) || pizza.description.toLowerCase().includes(searchVal);
            });
            
            if (matchedFlavor) {
                matchedFlavorId = matchedFlavor.id;
            }
            
            showPizzas = matchesSize || !!matchedFlavor;
        }
        
        if (showPizzas) {
            sizesToRender.forEach(sizeId => {
                pizzasGrid.appendChild(createSizeCard(sizeId, matchedFlavorId));
            });
        }
    }
    
    // Render Bebidas
    const bebidas = MENU_ITEMS.bebidas || [];
    bebidas.forEach(item => {
        if (searchVal && !item.name.toLowerCase().includes(searchVal) && !item.description.toLowerCase().includes(searchVal)) return;
        if (bebidasGrid) bebidasGrid.appendChild(createFlavorCard(item));
    });
    
    // Render Sobremesas
    const sobremesas = MENU_ITEMS.sobremesas || [];
    sobremesas.forEach(item => {
        if (searchVal && !item.name.toLowerCase().includes(searchVal) && !item.description.toLowerCase().includes(searchVal)) return;
        if (sobremesasGrid) sobremesasGrid.appendChild(createFlavorCard(item));
    });
    
    // Toggle empty states for sections
    toggleSectionVisibility('pizzas-section', pizzasGrid);
    toggleSectionVisibility('bebidas-section', bebidasGrid);
    toggleSectionVisibility('sobremesas-section', sobremesasGrid);
}

function createSizeCard(sizeId, matchedFlavorId = null) {
    let minPrice = 0;
    const defaults = {
        'broto': 65.0,
        'media': 75.0,
        'grande': 90.0,
        'vulcao': 90.0,
        'trem': 160.0
    };
    
    if (PIZZA_PRICES && PIZZA_PRICES[sizeId]) {
        const pricesObj = PIZZA_PRICES[sizeId];
        const activePrices = Object.values(pricesObj)
            .map(p => parseFloat(p))
            .filter(p => !isNaN(p) && p > 0);
            
        if (activePrices.length > 0) {
            minPrice = Math.min(...activePrices);
        } else {
            minPrice = defaults[sizeId] || 0;
        }
    } else {
        minPrice = defaults[sizeId] || 0;
    }
    const name = TAMANHO_NOMES[sizeId] || sizeId;
    
    const sizeImages = {
        'broto': 'assets/pizza_broto.jpg',
        'media': 'assets/pizza_media.jpg',
        'grande': 'assets/pizza_grande.jpg',
        'vulcao': 'assets/pizza_vulcao.jpg',
        'trem': 'assets/pizza_trem.jpg'
    };
    
    const sizeDescs = {
        'broto': 'Broto (4 fatias) - Selecione até 1 sabor.',
        'media': 'Média (8 fatias) - Selecione até 2 sabores.',
        'grande': 'Grande (12 pedaços) - Selecione até 3 sabores.',
        'vulcao': 'Vulcão (12 pedaços) - Borda vulcão de cheddar ou catupiry. Selecione até 2 sabores.',
        'trem': 'Trem (24 pedaços) - Gigante, até 4 sabores para toda a família.'
    };
    
    const image = sizeImages[sizeId] || 'assets/pizza_hero.png';
    const desc = sizeDescs[sizeId] || '';
    
    const card = document.createElement('div');
    card.className = 'item-card size-card';
    
    let badgeHTML = '';
    if (sizeId === 'trem') {
        card.classList.add('featured-size-card');
        badgeHTML = `<span class="item-card-badge featured">Nossa Especial ⭐</span>`;
    }
    
    const flavorParam = matchedFlavorId ? `'${matchedFlavorId}'` : 'null';
    
    card.innerHTML = `
        <div class="item-card-image-wrapper">
            <img src="${image}" alt="${name}" loading="lazy">
            ${badgeHTML}
        </div>
        <div class="item-card-content">
            <h3 class="item-card-title">${name}</h3>
            <p class="item-card-desc">${desc}</p>
            <div class="item-card-footer">
                <div class="item-card-price">
                    <span class="from-text">A partir de</span>
                    <span class="price-value">R$ ${minPrice.toFixed(2).replace('.', ',')}</span>
                </div>
                <button class="btn-add" onclick="openPizzaCustomizer('${sizeId}', ${flavorParam})" title="Escolher sabores e montar">
                    <span class="material-symbols-rounded">local_pizza</span>
                </button>
            </div>
        </div>
    `;
    
    return card;
}

function toggleSectionVisibility(sectionId, gridElement) {
    const section = document.getElementById(sectionId);
    if (!section || !gridElement) return;
    if (gridElement.children.length === 0) {
        section.style.display = 'none';
    } else {
        section.style.display = '';
    }
}

function createFlavorCard(item) {
    const card = document.createElement('div');
    card.className = 'item-card';
    if (item.available === false) {
        card.style.opacity = '0.5';
    }
    
    const badgeHTML = item.badge ? `<span class="item-card-badge">${item.badge}</span>` : '';
    
    let priceHTML = '';
    let actionButtonHTML = '';
    
    if (item.category === 'salgadas' || item.category === 'doces') {
        const type = item.categoryType || 'promocional';
        const minPrice = (PIZZA_PRICES.broto && PIZZA_PRICES.broto[type]) || 65.0;
        priceHTML = `
            <span class="from-text">A partir de</span>
            <span class="price-value">R$ ${minPrice.toFixed(2).replace('.', ',')}</span>
        `;
        actionButtonHTML = `
            <button class="btn-add" onclick="openPizzaCustomizer('broto', '${item.id}')" title="Escolher tamanho e montar" ${item.available === false ? 'disabled' : ''}>
                <span class="material-symbols-rounded">local_pizza</span>
            </button>
        `;
    } else {
        priceHTML = `
            <span class="from-text">Valor</span>
            <span class="price-value">R$ ${item.price.toFixed(2).replace('.', ',')}</span>
        `;
        actionButtonHTML = `
            <button class="btn-add" onclick="addSimpleItemToCart('${item.id}', '${item.category}')" title="Adicionar ao carrinho" ${item.available === false ? 'disabled' : ''}>
                <span class="material-symbols-rounded">add_shopping_cart</span>
            </button>
        `;
    }
    
    card.innerHTML = `
        <div class="item-card-image-wrapper">
            <img src="${item.image}" alt="${item.name}" loading="lazy">
            ${badgeHTML}
        </div>
        <div class="item-card-content">
            <h3 class="item-card-title">${item.name}</h3>
            <p class="item-card-desc">${item.description}</p>
            <div class="item-card-footer">
                <div class="item-card-price">
                    ${priceHTML}
                </div>
                ${actionButtonHTML}
            </div>
        </div>
    `;
    
    return card;
}

function setActiveCategoryTab(event, sectionId) {
    if (event) {
        event.preventDefault();
    }
    
    document.querySelectorAll('.categories-nav .nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    if (event && event.target) {
        event.target.classList.add('active');
    } else {
        const activeLink = document.querySelector(`.categories-nav a[href="#${sectionId}"]`);
        if (activeLink) activeLink.classList.add('active');
    }
    
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        const offset = 85; 
        const bodyRect = document.body.getBoundingClientRect().top;
        const elementRect = targetSection.getBoundingClientRect().top;
        const elementPosition = elementRect - bodyRect;
        const offsetPosition = elementPosition - offset;
        
        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
    }
}

function onSearchInput() {
    renderMenu();
}

/* ==========================================================================
   Pizza Customizer State & Dialog Handlers
   ========================================================================== */
function setupPizzaCustomizerEvents() {
    const form = document.getElementById('pizzaCustomizerForm');
    
    // Listen for size changes to adjust rules/flavors
    form.addEventListener('change', (e) => {
        if (e.target.name === 'pizza-size') {
            onSizeChange();
        } else if (e.target.name === 'pizza-flavor' || e.target.name === 'pizza-border') {
            calculateCustomizerPrice();
        }
    });
}

function openPizzaCustomizer(preSelectedSizeId = 'broto', preSelectedFlavorId = null) {
    const modal = document.getElementById('customizerModal');
    
    // Reset Current Pizza State
    currentPizza = {
        size: preSelectedSizeId,
        maxFlavors: TAMANHO_REGRAS[preSelectedSizeId]?.maxFlavors || 1,
        selectedFlavors: preSelectedFlavorId ? [preSelectedFlavorId] : [],
        border: 'sem-borda',
        notes: '',
        quantity: 1,
        basePrice: 0,
        totalPrice: 0
    };
    
    document.getElementById('pizzaNotes').value = '';
    document.getElementById('customizerQty').innerText = '1';
    
    // Load flavors list in HTML
    renderCustomizerFlavors();
    // Load borders list in HTML
    renderCustomizerBorders();
    
    // Check pre-selected flavor checkbox if present
    if (preSelectedFlavorId) {
        const checkbox = document.querySelector(`.flavor-checkbox[value="${preSelectedFlavorId}"]`);
        if (checkbox) {
            checkbox.checked = true;
        }
    }
    
    // Pre-check size radio button
    const sizeRadio = document.querySelector(`input[name="pizza-size"][value="${preSelectedSizeId}"]`);
    if (sizeRadio) {
        sizeRadio.checked = true;
    }
    
    // Set border back to default sem-borda
    const defaultBorder = document.querySelector('input[name="pizza-border"][value="sem-borda"]');
    if (defaultBorder) {
        defaultBorder.checked = true;
    }

    onSizeChange(); // Trigger calculations
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Lock background scroll
}

function closePizzaCustomizer() {
    const modal = document.getElementById('customizerModal');
    modal.classList.remove('active');
    document.body.style.overflow = ''; // Unlock scroll
}

function renderCustomizerFlavors() {
    const container = document.getElementById('customizerFlavorsList');
    container.innerHTML = '';
    
    MENU_ITEMS.pizzas.forEach(pizza => {
        const label = document.createElement('label');
        label.className = 'flavor-item-label';
        
        const categoryLabel = {
            'promocional': 'Promocional',
            'tradicional': 'Tradicional',
            'especial': 'Especial',
            'camarao': 'Camarão'
        }[pizza.categoryType] || 'Tradicional';
        
        label.innerHTML = `
            <input type="checkbox" name="pizza-flavor" value="${pizza.id}" class="flavor-checkbox" onchange="onFlavorCheckChange(this)">
            <div class="flavor-item-info">
                <span class="flavor-name">${pizza.name}</span>
                <span class="flavor-desc">${pizza.description}</span>
            </div>
            <div class="flavor-item-category-badge ${pizza.categoryType}">${categoryLabel}</div>
        `;
        container.appendChild(label);
    });
}

function onSizeChange() {
    const sizeRadio = document.querySelector('input[name="pizza-size"]:checked');
    if (!sizeRadio) return;
    
    const size = sizeRadio.value;
    const rules = TAMANHO_REGRAS[size];
    if (!rules) return;
    
    currentPizza.size = size;
    currentPizza.maxFlavors = rules.maxFlavors;
    
    const sizeNames = {
        'broto': 'Pizza Broto',
        'media': 'Pizza Média',
        'grande': 'Pizza Grande',
        'vulcao': 'Pizza Vulcão',
        'trem': 'Pizza Trem'
    };
    
    const sizeImages = {
        'broto': 'assets/pizza_broto.jpg',
        'media': 'assets/pizza_media.jpg',
        'grande': 'assets/pizza_grande.jpg',
        'vulcao': 'assets/pizza_vulcao.jpg',
        'trem': 'assets/pizza_trem.jpg'
    };
    
    const sizeDescs = {
        'broto': 'Broto (4 fatias) - Perfeita para consumo individual.',
        'media': 'Média (8 fatias) - Ideal para até 2 pessoas.',
        'grande': 'Grande (12 pedaços) - Serve até 3 pessoas.',
        'vulcao': 'Vulcão (12 pedaços) - Borda vulcão de cheddar ou catupiry.',
        'trem': 'Trem (24 pedaços) - Gigante, até 4 sabores para toda a família.'
    };
    
    document.getElementById('customizerHeaderImg').src = sizeImages[size] || 'assets/pizza_hero.png';
    document.getElementById('customizerTitle').innerText = `Monte sua ${sizeNames[size]}`;
    document.getElementById('customizerDesc').innerText = sizeDescs[size];
    
    // Update limit header label
    const limitText = document.getElementById('flavorSelectionLimitText');
    if (rules.maxFlavors === 1) {
        limitText.innerText = 'Selecione exatamente 1 sabor';
    } else {
        limitText.innerText = `Selecione até ${rules.maxFlavors} sabores`;
    }
    
    // Check if current selection violates new limits
    const checkboxes = document.querySelectorAll('.flavor-checkbox');
    let checkedCount = 0;
    
    checkboxes.forEach(cb => {
        if (cb.checked) {
            checkedCount++;
            if (checkedCount > rules.maxFlavors) {
                cb.checked = false; // Uncheck overflows
            }
        }
    });
    
    // Sync current state selected flavors array
    syncSelectedFlavors();
    
    // Apply checkboxes disabled states based on limits
    enforceFlavorCheckboxLimits();
    
    // Re-render borders to reflect size-based pricing (Trem costs R$ 10, others free)
    renderCustomizerBorders();
    
    calculateCustomizerPrice();
}

function onFlavorCheckChange(checkbox) {
    syncSelectedFlavors();
    enforceFlavorCheckboxLimits();
    calculateCustomizerPrice();
}

function syncSelectedFlavors() {
    const checkedBoxes = document.querySelectorAll('.flavor-checkbox:checked');
    currentPizza.selectedFlavors = Array.from(checkedBoxes).map(cb => cb.value);
}

function enforceFlavorCheckboxLimits() {
    const checkboxes = document.querySelectorAll('.flavor-checkbox');
    const checkedCount = currentPizza.selectedFlavors.length;
    
    checkboxes.forEach(cb => {
        const parentLabel = cb.closest('.flavor-item-label');
        if (!cb.checked && checkedCount >= currentPizza.maxFlavors) {
            cb.disabled = true;
            if (parentLabel) parentLabel.classList.add('disabled');
        } else {
            cb.disabled = false;
            if (parentLabel) parentLabel.classList.remove('disabled');
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
        // Enforce R$ 0 if no flavor selected
        document.getElementById('btnAddToOrder').disabled = true;
        document.getElementById('btnAddToOrder').innerText = 'Escolha pelo menos 1 sabor';
        return;
    }
    
    document.getElementById('btnAddToOrder').disabled = false;
    
    // Find the category of the most expensive flavor selected
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
    
    // Price for the selected size and max category
    let maxFlavorPrice = 0;
    if (PIZZA_PRICES[currentPizza.size]) {
        maxFlavorPrice = PIZZA_PRICES[currentPizza.size][maxCategory];
    }
    if (typeof maxFlavorPrice !== 'number' || isNaN(maxFlavorPrice)) {
        const defaults = {
            'broto': { promocional: 65, tradicional: 70, especial: 75, camarao: 80 },
            'media': { promocional: 75, tradicional: 80, especial: 85, camarao: 90 },
            'grande': { promocional: 90, tradicional: 100, especial: 110, camarao: 115 },
            'vulcao': { promocional: 90, tradicional: 100, especial: 110, camarao: 110 },
            'trem': { promocional: 160, tradicional: 175, especial: 195, camarao: 210 }
        };
        maxFlavorPrice = (defaults[currentPizza.size] && defaults[currentPizza.size][maxCategory]) || 0;
    }
    
    // Border price
    const borderRadio = document.querySelector('input[name="pizza-border"]:checked');
    const borderPrice = borderRadio ? parseFloat(borderRadio.getAttribute('data-price')) : 0;
    
    currentPizza.border = borderRadio ? borderRadio.value : 'sem-borda';
    currentPizza.borderPrice = borderPrice;
    
    const singlePrice = maxFlavorPrice + borderPrice;
    currentPizza.totalPrice = singlePrice * currentPizza.quantity;
    
    document.getElementById('btnAddToOrder').innerText = `Adicionar ao Pedido — R$ ${currentPizza.totalPrice.toFixed(2)}`;
}

function addPizzaToOrder() {
    if (currentPizza.selectedFlavors.length === 0) return;
    
    currentPizza.notes = document.getElementById('pizzaNotes').value.trim();
    
    // Add custom pizza details to cart
    const cartItem = {
        type: 'pizza',
        size: currentPizza.size,
        sizeName: TAMANHO_NOMES[currentPizza.size],
        border: currentPizza.border,
        borderName: BORDAS[currentPizza.border] ? (currentPizza.borderPrice === 0 ? BORDAS[currentPizza.border].name : `${BORDAS[currentPizza.border].name} (+ R$ ${currentPizza.borderPrice.toFixed(2).replace('.', ',')})`) : 'Sem Borda',
        flavors: [...currentPizza.selectedFlavors],
        flavorNames: currentPizza.selectedFlavors.map(fId => {
            return MENU_ITEMS.pizzas.find(p => p.id === fId).name;
        }),
        notes: currentPizza.notes,
        quantity: currentPizza.quantity,
        singlePrice: currentPizza.totalPrice / currentPizza.quantity,
        totalPrice: currentPizza.totalPrice
    };
    
    cart.push(cartItem);
    saveCartToLocalStorage();
    updateCartUI();
    closePizzaCustomizer();
    toggleCart(true); // Open cart sidebar to show additions
    
    // Soft bounce animation on cart floating badge
    const badge = document.getElementById('cartCountBadge');
    badge.classList.remove('animate-bounce');
    void badge.offsetWidth; // trigger reflow
    badge.classList.add('animate-bounce');
}

/* ==========================================================================
   Add Simple Items (Drinks & Desserts)
   ========================================================================== */
function addSimpleItemToCart(itemId, category) {
    const list = category === 'bebidas' ? MENU_ITEMS.bebidas : (MENU_ITEMS.sobremesas || []);
    const itemData = list.find(item => item.id === itemId);
    
    if (!itemData) return;
    
    // Check if item already exists in cart to increment qty
    const existingIndex = cart.findIndex(cItem => cItem.type === 'simple' && cItem.id === itemId);
    
    if (existingIndex > -1) {
        cart[existingIndex].quantity += 1;
        cart[existingIndex].totalPrice = cart[existingIndex].quantity * cart[existingIndex].singlePrice;
    } else {
        cart.push({
            type: 'simple',
            id: itemId,
            name: itemData.name,
            category: category,
            quantity: 1,
            singlePrice: itemData.price,
            totalPrice: itemData.price
        });
    }
    
    saveCartToLocalStorage();
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
    if (index >= cart.length) return;
    
    cart[index].quantity += delta;
    
    if (cart[index].quantity <= 0) {
        cart.splice(index, 1); // remove
    } else {
        cart[index].totalPrice = cart[index].quantity * cart[index].singlePrice;
    }
    
    saveCartToLocalStorage();
    updateCartUI();
}

function updateCartUI() {
    const emptyState = document.getElementById('cartEmptyState');
    const content = document.getElementById('cartContent');
    const itemsList = document.getElementById('cartItemsList');
    
    let totalItems = 0;
    let subtotal = 0;
    
    itemsList.innerHTML = '';
    
    if (cart.length === 0) {
        emptyState.classList.remove('display-none');
        content.classList.add('display-none');
        document.getElementById('cartCountBadge').innerText = '0';
        return;
    }
    
    emptyState.classList.add('display-none');
    content.classList.remove('display-none');
    
    cart.forEach((item, index) => {
        totalItems += item.quantity;
        subtotal += item.totalPrice;
        
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
        } else {
            titleHTML = item.name;
        }
        
        itemRow.innerHTML = `
            <div class="cart-item-details">
                <h4 class="cart-item-title">${titleHTML}</h4>
                ${detailsHTML}
                <div class="cart-item-action">
                    <span class="cart-item-price">R$ ${item.totalPrice.toFixed(2)}</span>
                    <div class="item-qty-adjuster">
                        <button onclick="updateCartQty(${index}, -1)"><span class="material-symbols-rounded">remove</span></button>
                        <span>${item.quantity}</span>
                        <button onclick="updateCartQty(${index}, 1)"><span class="material-symbols-rounded">add</span></button>
                    </div>
                </div>
            </div>
        `;
        
        itemsList.appendChild(itemRow);
    });
    
    // Values Summary
    const deliveryFee = checkoutType === 'delivery' ? getDeliveryFee() : 0;
    const finalTotal = subtotal + deliveryFee;
    
    document.getElementById('cartSubtotal').innerText = `R$ ${subtotal.toFixed(2)}`;
    document.getElementById('cartDeliveryFee').innerText = deliveryFee === 0 ? 'Grátis' : `R$ ${deliveryFee.toFixed(2)}`;
    document.getElementById('cartTotal').innerText = `R$ ${finalTotal.toFixed(2)}`;
    document.getElementById('cartCountBadge').innerText = totalItems;
    
    // Disable checkout button if shop is closed
    const checkoutBtn = document.querySelector('.checkout-btn');
    if (checkoutBtn) {
        if (typeof isShopOpen !== 'undefined' && !isShopOpen) {
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
    localStorage.setItem('bella_vista_cart', JSON.stringify(cart));
}

function loadCartFromLocalStorage() {
    const stored = localStorage.getItem('bella_vista_cart');
    if (stored) {
        try {
            cart = JSON.parse(stored);
            updateCartUI();
        } catch (e) {
            cart = [];
        }
    }
}

/* ==========================================================================
   Checkout Modal Handlers
   ========================================================================== */
function openCheckoutModal() {
    toggleCart(false); // Close cart sidebar
    const modal = document.getElementById('checkoutModal');
    
    let subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
    let fee = checkoutType === 'delivery' ? getDeliveryFee() : 0;
    
    let total = subtotal + fee;
    
    document.getElementById('checkoutTotalValue').innerText = `R$ ${total.toFixed(2)}`;
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
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
    const selectedMethod = document.querySelector('input[name="payment-method"]:checked').value;
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
    let subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
    let fee = checkoutType === 'delivery' ? getDeliveryFee() : 0;
    
    let total = subtotal + fee;
    
    document.getElementById('checkoutTotalValue').innerText = `R$ ${total.toFixed(2)}`;
}

/* ==========================================================================
   Submit Order and WhatsApp Link Creation
   ========================================================================== */
function submitOrder() {
    if (typeof isShopOpen !== 'undefined' && !isShopOpen) {
        alert('Desculpe, a pizzaria está fechada para novos pedidos no momento.');
        return;
    }

    const form = document.getElementById('checkoutForm');
    
    // Check validation manually to avoid full page reload
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const clientName = document.getElementById('clientName').value.trim();
    const clientPhone = document.getElementById('clientPhone').value.trim();
    const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;
    
    let subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
    let fee = checkoutType === 'delivery' ? getDeliveryFee() : 0;
    
    let total = subtotal + fee;
    let discountMsg = '';
    
    // Building WhatsApp Message
    let msg = `🍕 *NOVO PEDIDO - MUNDO DA PIZZA* 🍕\n`;
    msg += `----------------------------------------\n\n`;
    msg += `👤 *Cliente:* ${clientName}\n`;
    msg += `📞 *WhatsApp:* ${clientPhone}\n`;
    msg += `📦 *Tipo:* ${checkoutType === 'delivery' ? '🚗 Entrega (Delivery)' : '🏪 Retirada no Balcão'}\n\n`;
    
    if (checkoutType === 'delivery') {
        const street = document.getElementById('addressStreet').value.trim();
        const number = document.getElementById('addressNumber').value.trim();
        const neighborhoodSelect = document.getElementById('addressBairro');
        const neighborhoodKey = neighborhoodSelect.value;
        const neighborhood = TAXAS_ENTREGA[neighborhoodKey] ? TAXAS_ENTREGA[neighborhoodKey].name : neighborhoodKey;
        const ref = document.getElementById('addressRef').value.trim();
        
        msg += `📍 *Endereço de Entrega:*\n`;
        msg += `${street}, nº ${number}\n`;
        msg += `Bairro: ${neighborhood}\n`;
        if (ref) msg += `Ref/Complemento: ${ref}\n`;
        msg += `\n`;
    } else {
        msg += `📍 *Retirada em:* R. Cel. Alfredo Steglich, 28 - sala 4 - Centro, Nova Petrópolis\n\n`;
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
        msg += `Pix\n*(Chave CNPJ: 46.564.697/0001-24)*`;
    } else if (paymentMethod === 'card') {
        msg += `Cartão (Levar Maquininha)`;
    } else {
        const change = document.getElementById('cashChange').value.trim();
        msg += `Dinheiro`;
        if (change) msg += ` (Troco para ${change})`;
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
            street: document.getElementById('addressStreet').value.trim(),
            number: document.getElementById('addressNumber').value.trim(),
            neighborhood: TAXAS_ENTREGA[document.getElementById('addressBairro').value] ? TAXAS_ENTREGA[document.getElementById('addressBairro').value].name : document.getElementById('addressBairro').value,
            reference: document.getElementById('addressRef').value.trim()
        } : null,
        paymentMethod: paymentMethod,
        cashChange: paymentMethod === 'cash' ? document.getElementById('cashChange').value.trim() : null,
        cart: cart,
        subtotal: subtotal,
        deliveryFee: fee,
        total: total
    };

    showLoading('Enviando pedido ao servidor...');

    function finalizeOrderSuccess() {
        hideLoading();
        cart = [];
        saveCartToLocalStorage();
        updateCartUI();
        closeCheckoutModal();
        window.open(whatsappLink, '_blank');
        alert('Pedido enviado com sucesso! Você será redirecionado para o WhatsApp para confirmar.');
    }

    function handleOrderError(err) {
        hideLoading();
        console.error("Erro ao enviar pedido para o servidor:", err);
        showToast('Não foi possível enviar o pedido para o servidor. Verifique sua conexão e tente novamente.', 'error', 6000);
    }

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

        firebase.database().ref('orders/' + orderId).set(firebaseOrder)
        .then(() => {
            finalizeOrderSuccess();
        })
        .catch(err => {
            handleOrderError(err);
        });
    } else {
        fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        })
        .then(res => {
            if (!res.ok) throw new Error("Erro na gravação do pedido local");
            return res.json();
        })
        .then(() => {
            finalizeOrderSuccess();
        })
        .catch(err => {
            handleOrderError(err);
        });
    }
}

/* ==========================================================================
   Dynamic Menu Synchronization (Firebase)
   ========================================================================== */
let isShopOpen = true;

function initMenuData() {
    // Fetch shop status first
    fetchShopStatus();
    
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        const menuRef = firebase.database().ref('menu');
        menuRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                if (data.promo_config) PROMO_CONFIG = data.promo_config;
                if (data.menu_items) MENU_ITEMS = data.menu_items;
                if (data.pizza_prices) {
                    Object.keys(data.pizza_prices).forEach(sizeKey => {
                        if (!PIZZA_PRICES[sizeKey]) {
                            PIZZA_PRICES[sizeKey] = {};
                        }
                        Object.assign(PIZZA_PRICES[sizeKey], data.pizza_prices[sizeKey]);
                    });
                }
                if (data.borders) BORDAS = data.borders;
                if (data.settings) {
                    if (data.settings.whatsapp) CONFIG_SETTINGS.whatsapp = data.settings.whatsapp;
                    if (data.settings.whatsappFormatted) CONFIG_SETTINGS.whatsappFormatted = data.settings.whatsappFormatted;
                    if (data.settings.deliveryFees) TAXAS_ENTREGA = data.settings.deliveryFees;
                    populateNeighborhoodDropdown();
                    updateContactInfoUI();
                }
                
                renderMenu();
                checkAndOpenPromoModal();
                
                // If customizer is open, update it
                if (document.getElementById('customizerModal').classList.contains('active')) {
                    renderCustomizerFlavors();
                    renderCustomizerBorders();
                    calculateCustomizerPrice();
                }
            } else {
                seedFirebaseMenu();
            }
        });

        // Listen for status in Firebase
        const statusRef = firebase.database().ref('status/isOpen');
        statusRef.on('value', (snapshot) => {
            const isOpen = snapshot.val();
            if (isOpen !== null) {
                updateShopStatusUI(isOpen);
            }
        });
    } else {
        // Fallback for local dev server
        fetch('/api/menu')
            .then(res => res.json())
            .then(data => {
                if (data.promo_config) PROMO_CONFIG = data.promo_config;
                if (data.menu_items) MENU_ITEMS = data.menu_items;
                if (data.pizza_prices) {
                    Object.keys(data.pizza_prices).forEach(sizeKey => {
                        if (!PIZZA_PRICES[sizeKey]) {
                            PIZZA_PRICES[sizeKey] = {};
                        }
                        Object.assign(PIZZA_PRICES[sizeKey], data.pizza_prices[sizeKey]);
                    });
                }
                if (data.borders) BORDAS = data.borders;
                if (data.settings) {
                    if (data.settings.whatsapp) CONFIG_SETTINGS.whatsapp = data.settings.whatsapp;
                    if (data.settings.whatsappFormatted) CONFIG_SETTINGS.whatsappFormatted = data.settings.whatsappFormatted;
                    if (data.settings.deliveryFees) TAXAS_ENTREGA = data.settings.deliveryFees;
                    populateNeighborhoodDropdown();
                    updateContactInfoUI();
                }
                renderMenu();
                checkAndOpenPromoModal();
            })
            .catch(err => {
                console.error("Erro ao carregar cardápio local:", err);
                renderMenu();
            });
    }
}

function fetchShopStatus() {
    if (!(typeof firebase !== 'undefined' && firebase.apps.length > 0)) {
        fetch('/api/status')
            .then(res => res.json())
            .then(data => {
                if (data && typeof data.isOpen === 'boolean') {
                    updateShopStatusUI(data.isOpen);
                }
            })
            .catch(err => console.error("Erro ao buscar status do servidor local:", err));
    }
}

function updateShopStatusUI(isOpen) {
    isShopOpen = isOpen;
    updateCartUI(); // Refresh cart buttons
    
    const badge = document.getElementById('statusBadge');
    if (!badge) return;
    
    if (isOpen) {
        badge.className = 'status-badge open';
        badge.innerHTML = '<span class="dot animate-pulse"></span> Aberto agora para pedidos';
    } else {
        badge.className = 'status-badge closed';
        badge.innerHTML = '<span class="dot" style="background-color: #ef5350;"></span> Fechado no momento';
    }
}

function seedFirebaseMenu() {
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        firebase.database().ref('menu').set({
            menu_items: MENU_ITEMS,
            pizza_prices: PIZZA_PRICES,
            borders: BORDAS
        })
        .then(() => console.log("Cardápio semeado no Firebase com sucesso."))
        .catch(err => console.error("Erro ao semear o cardápio no Firebase:", err));
    }
}

function renderCustomizerBorders() {
    const container = document.getElementById('bordersContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    const isTrem = currentPizza.size === 'trem';
    
    Object.keys(BORDAS).forEach(key => {
        const border = BORDAS[key];
        const isChecked = currentPizza.border === key ? 'checked' : (key === 'sem-borda' ? 'checked' : '');
        
        let actualPrice = 0;
        if (isTrem && key !== 'sem-borda') {
            actualPrice = 10.00;
        }
        
        const priceLabel = actualPrice === 0 ? 'Grátis' : `+ R$ ${actualPrice.toFixed(2).replace('.', ',')}`;
        
        const label = document.createElement('label');
        label.className = 'border-card';
        label.innerHTML = `
            <input type="radio" name="pizza-border" value="${key}" data-price="${actualPrice}" ${isChecked}>
            <div class="border-card-content">
                <span>${border.name}</span>
                <span class="border-price">${priceLabel}</span>
            </div>
        `;
        container.appendChild(label);
    });
}

/* ==========================================================================
   Weekly Promotions Pop-up Logic
   ========================================================================== */
function updatePromoBtnVisibility() {
    const promoBtn = document.getElementById('promoBtn');
    if (promoBtn) {
        if (PROMO_CONFIG && PROMO_CONFIG.show_popup) {
            promoBtn.style.display = 'inline-flex';
        } else {
            promoBtn.style.display = 'none';
        }
    }
}

function openPromoModal(force = false) {
    if (!PROMO_CONFIG) return;
    
    // Toggle popup layout based on Facebook URL config
    const header = document.querySelector('.promo-modal-header');
    const textBody = document.getElementById('promoTextBody');
    const fbContainer = document.getElementById('promoFbContainer');
    const card = document.querySelector('.promo-modal-card');
    
    if (PROMO_CONFIG.facebook_url && PROMO_CONFIG.facebook_url.trim() !== '') {
        // Facebook Embed mode
        if (header) header.style.display = 'none';
        if (textBody) textBody.style.display = 'none';
        if (fbContainer) {
            fbContainer.style.display = 'flex';
            fbContainer.innerHTML = `
                <iframe src="https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(PROMO_CONFIG.facebook_url)}&show_text=true&width=500" width="100%" height="480" style="border:none;overflow:hidden;border-radius:8px;background:#ffffff;" scrolling="no" frameborder="0" allowfullscreen="true" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"></iframe>
            `;
        }
        if (card) {
            card.style.maxWidth = '550px';
            card.style.padding = '30px 20px 20px 20px';
        }
    } else {
        // Default text-based mode
        if (header) header.style.display = '';
        if (textBody) textBody.style.display = '';
        if (fbContainer) {
            fbContainer.style.display = 'none';
            fbContainer.innerHTML = '';
        }
        if (card) {
            card.style.maxWidth = '480px';
            card.style.padding = '24px';
        }
    }
    
    // Open modal
    const modal = document.getElementById('promoModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Lock scrolling
    }
}

function checkAndOpenPromoModal() {
    // Dynamically update the flashy promo button visibility
    updatePromoBtnVisibility();

    if (promoModalChecked) return;
    if (!PROMO_CONFIG || !PROMO_CONFIG.show_popup) {
        return; // Pop-up is disabled, do not show
    }

    const dontShow = localStorage.getItem('dontShowPromoToday');
    if (dontShow) {
        const today = new Date().toDateString();
        if (dontShow === today) {
            return; // Already seen today, don't show
        }
    }
    
    promoModalChecked = true;
    
    // Open modal with smooth delay
    setTimeout(() => {
        if (PROMO_CONFIG && PROMO_CONFIG.show_popup) {
            openPromoModal(false);
        }
    }, 1500);
}

function closePromoModal() {
    const modal = document.getElementById('promoModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = ''; // Unlock scrolling
    }
    
    // Save to localStorage if checked
    const dontShowCheckbox = document.getElementById('dontShowPromoToday');
    if (dontShowCheckbox && dontShowCheckbox.checked) {
        const today = new Date().toDateString();
        localStorage.setItem('dontShowPromoToday', today);
    }
}

// Close modal if user clicks outside card
window.addEventListener('click', (e) => {
    const promoModal = document.getElementById('promoModal');
    if (e.target === promoModal) {
        closePromoModal();
    }
});

/* ==========================================================================
   PWA & Service Worker Registration & Controlled Update Mechanism
   ========================================================================== */
let swRegistration = null;

function initPWA() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').then(reg => {
            swRegistration = reg;
            
            // Listen for waiting SW (new version downloaded)
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
            console.warn('Service Worker registration failed:', err);
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
    // If cart has items or customizer modal is open, defer update to avoid interrupting order
    if (cart.length > 0) return;
    
    const banner = document.getElementById('updateBanner');
    if (banner) {
        banner.classList.remove('display-none');
    }
}

function applyAppUpdate() {
    if (swRegistration && swRegistration.waiting) {
        swRegistration.waiting.postMessage({ action: 'skipWaiting' });
    } else {
        window.location.reload();
    }
}

/* ==========================================================================
   Standardized Toast & Loading Indicator Helpers
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

function showLoading(message = 'Carregando...') {
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

