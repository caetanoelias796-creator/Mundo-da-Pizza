// Cart state management and storage persistence service
const CartService = {
    cart: [],
    
    getCart() {
        return this.cart;
    },
    
    setCart(newCart) {
        this.cart = newCart || [];
        this.saveCartToLocalStorage();
    },

    loadCartFromLocalStorage() {
        let stored = localStorage.getItem('drill_pizza_cart');
        if (!stored) {
            stored = localStorage.getItem('fina_massa_cart');
        }
        if (stored) {
            try {
                this.cart = JSON.parse(stored);
            } catch (e) {
                this.cart = [];
            }
        } else {
            this.cart = [];
        }
        return this.cart;
    },

    saveCartToLocalStorage() {
        localStorage.setItem('drill_pizza_cart', JSON.stringify(this.cart));
    },

    addToCart(item) {
        if (!item.quantity) item.quantity = 1;
        if (item.totalPrice === undefined) {
            item.totalPrice = item.singlePrice * item.quantity;
        }
        
        let existingIndex = -1;
        
        if (item.type === 'simple') {
            existingIndex = this.cart.findIndex(cItem => cItem.type === 'simple' && cItem.id === item.id);
        } else if (item.type === 'pizza') {
            existingIndex = this.cart.findIndex(cItem => {
                if (cItem.type !== 'pizza' || cItem.size !== item.size || cItem.border !== item.border || (cItem.notes || '').trim() !== (item.notes || '').trim()) {
                    return false;
                }
                if (!cItem.flavors || !item.flavors || cItem.flavors.length !== item.flavors.length) return false;
                const f1 = [...cItem.flavors].sort();
                const f2 = [...item.flavors].sort();
                return f1.every((val, index) => val === f2[index]);
            });
        } else if (item.type === 'acai') {
            existingIndex = this.cart.findIndex(cItem => {
                if (cItem.type !== 'acai' || cItem.size !== item.size || (cItem.notes || '').trim() !== (item.notes || '').trim()) {
                    return false;
                }
                
                const free1 = cItem.freeAdditions || [];
                const free2 = item.freeAdditions || [];
                if (free1.length !== free2.length) return false;
                const sFree1 = [...free1].sort();
                const sFree2 = [...free2].sort();
                if (!sFree1.every((val, index) => val === sFree2[index])) return false;
                
                const paid1 = cItem.paidAdditions || [];
                const paid2 = item.paidAdditions || [];
                if (paid1.length !== paid2.length) return false;
                const sPaid1 = paid1.map(p => p.name).sort();
                const sPaid2 = paid2.map(p => p.name).sort();
                return sPaid1.every((val, index) => val === sPaid2[index]);
            });
        }
        
        if (existingIndex > -1) {
            this.cart[existingIndex].quantity += item.quantity;
            this.cart[existingIndex].totalPrice = this.cart[existingIndex].quantity * this.cart[existingIndex].singlePrice;
        } else {
            this.cart.push(item);
        }
        this.saveCartToLocalStorage();
        return this.cart;
    },

    updateCartQty(index, delta) {
        if (index >= this.cart.length || index < 0) return this.cart;
        
        this.cart[index].quantity += delta;
        if (this.cart[index].quantity <= 0) {
            this.cart.splice(index, 1);
        } else {
            this.cart[index].totalPrice = this.cart[index].quantity * this.cart[index].singlePrice;
        }
        this.saveCartToLocalStorage();
        return this.cart;
    },

    clearCart() {
        this.cart = [];
        this.saveCartToLocalStorage();
        return this.cart;
    },

    calculateSubtotal() {
        return this.cart.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    },

    calculateTotal(deliveryFee, isCash = false) {
        const subtotal = this.calculateSubtotal();
        let total = subtotal + (deliveryFee || 0);
        if (isCash) {
            total = (subtotal * 0.95) + (deliveryFee || 0);
        }
        return total;
    }
};
