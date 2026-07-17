// UI Shared Components and templates
const UIComponents = {
    createProductCard(product, priceText, emoji, type) {
        const imagePath = product.image || 'assets/pizza_hero.png';
        return `
            <div class="product-card">
                <div class="product-image-wrapper">
                    <img class="product-img" src="${imagePath}" alt="${product.name}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                    <div class="product-image-placeholder" style="display: none;">${emoji}</div>
                </div>
                <div class="product-body">
                    <h4 class="product-title">${product.name}</h4>
                    <p class="product-desc">${product.description || ''}</p>
                    <div class="product-footer">
                        <span class="product-price">${priceText}</span>
                        <button class="add-to-cart-btn" onclick="handleAddToCartClick('${product.id}', '${type}')">+</button>
                    </div>
                </div>
            </div>
        `;
    }
};
