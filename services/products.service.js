// Firestore Service for Products, Categories, and Banners
const ProductsService = {
    subscribeProducts(callback) {
        if (window.db) {
            return db.collection('produtos').onSnapshot(snapshot => {
                const list = [];
                snapshot.forEach(doc => list.push(doc.data()));
                callback(list);
            }, err => console.error("Erro ao assinar produtos:", err));
        }
        return null;
    },

    subscribeCategories(callback) {
        if (window.db) {
            return db.collection('categorias').orderBy('order').onSnapshot(snapshot => {
                const list = [];
                snapshot.forEach(doc => list.push(doc.data()));
                callback(list);
            }, err => console.error("Erro ao assinar categorias:", err));
        }
        return null;
    },

    subscribeBanners(callback) {
        if (window.db) {
            return db.collection('banners').onSnapshot(snapshot => {
                const list = [];
                snapshot.forEach(doc => list.push(doc.data()));
                callback(list);
            }, err => console.error("Erro ao assinar banners:", err));
        }
        return null;
    },

    saveProduct(id, product) {
        if (window.db) {
            return db.collection('produtos').doc(id).set(product);
        }
        return Promise.reject("Firestore não inicializado");
    },

    deleteProduct(id) {
        if (window.db) {
            return db.collection('produtos').doc(id).delete();
        }
        return Promise.reject("Firestore não inicializado");
    },

    updateProductAvailability(id, isAvailable) {
        return this.updateProduct(id, { available: isAvailable });
    },

    updateProduct(id, data) {
        if (window.db) {
            return db.collection('produtos').doc(id).update(data);
        }
        return Promise.reject("Firestore não inicializado");
    },

    saveCategory(id, category) {
        if (window.db) {
            return db.collection('categorias').doc(id).set(category);
        }
        return Promise.reject("Firestore não inicializado");
    },

    deleteCategory(id) {
        if (window.db) {
            return db.collection('categorias').doc(id).delete();
        }
        return Promise.reject("Firestore não inicializado");
    },

    saveBanner(id, banner) {
        if (window.db) {
            return db.collection('banners').doc(id).set(banner);
        }
        return Promise.reject("Firestore não inicializado");
    },

    deleteBanner(id) {
        if (window.db) {
            return db.collection('banners').doc(id).delete();
        }
        return Promise.reject("Firestore não inicializado");
    },

    subscribePromotions(callback) {
        if (window.db) {
            return db.collection('promocoes').onSnapshot(snapshot => {
                const list = [];
                snapshot.forEach(doc => list.push(doc.data()));
                callback(list);
            }, err => console.error("Erro ao assinar promocoes:", err));
        }
        return null;
    }
};
