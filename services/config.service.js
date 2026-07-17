// Firestore Service for Configurations (settings, fees, shop status)
const ConfigService = {
    subscribeSettings(callback) {
        if (window.db) {
            return db.collection('config').doc('settings').onSnapshot(doc => {
                if (doc.exists) {
                    callback(doc.data());
                } else {
                    callback(null);
                }
            }, err => console.error("Erro ao assinar settings:", err));
        }
        return null;
    },

    subscribeDeliveryFees(callback) {
        if (window.db) {
            return db.collection('config').doc('delivery_fees').onSnapshot(doc => {
                if (doc.exists) {
                    callback(doc.data());
                } else {
                    callback(null);
                }
            }, err => console.error("Erro ao assinar taxas de entrega:", err));
        }
        return null;
    },

    subscribeShopStatus(callback) {
        if (window.db) {
            return db.collection('config').doc('status').onSnapshot(doc => {
                if (doc.exists) {
                    callback(doc.data());
                } else {
                    callback(null);
                }
            }, err => console.error("Erro ao assinar status da loja:", err));
        }
        return null;
    },

    saveSettings(settings) {
        if (window.db) {
            return db.collection('config').doc('settings').set(settings);
        }
        return Promise.reject("Firestore não inicializado");
    },

    saveDeliveryFees(fees) {
        if (window.db) {
            return db.collection('config').doc('delivery_fees').set(fees);
        }
        return Promise.reject("Firestore não inicializado");
    },

    saveShopStatus(isOpen) {
        if (window.db) {
            return db.collection('config').doc('status').set({ open: isOpen, isOpen: isOpen });
        }
        return Promise.reject("Firestore não inicializado");
    },

    saveOrder(id, order) {
        if (window.db) {
            return db.collection('pedidos').doc(String(id)).set(order);
        }
        return Promise.reject("Firestore não inicializado");
    },

    subscribeOrders(callback) {
        if (window.db) {
            return db.collection('pedidos').onSnapshot((querySnapshot) => {
                const list = [];
                querySnapshot.forEach(doc => {
                    list.push({ ...doc.data(), firebaseKey: doc.id });
                });
                callback(list);
            }, err => console.error("Erro ao assinar pedidos:", err));
        }
        return null;
    },

    updateOrderStatus(orderId, status) {
        if (window.db) {
            return db.collection('pedidos').doc(String(orderId)).update({ status });
        }
        return Promise.reject("Firestore não inicializado");
    },

    getOrders() {
        if (window.db) {
            return db.collection('pedidos').get().then(querySnapshot => {
                const list = [];
                querySnapshot.forEach(doc => list.push(doc.data()));
                return list;
            });
        }
        return Promise.reject("Firestore não inicializado");
    },

    clearAllOrders() {
        if (window.db) {
            return db.collection('pedidos').get()
            .then(snapshot => {
                const batch = db.batch();
                snapshot.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                return batch.commit();
            });
        }
        return Promise.reject("Firestore não inicializado");
    },

    subscribePizzaPrices(callback) {
        if (window.db) {
            return db.collection('config').doc('pizza_prices').onSnapshot(doc => {
                if (doc.exists) {
                    callback(doc.data());
                } else {
                    callback(null);
                }
            }, err => console.error("Erro ao assinar preços das pizzas:", err));
        }
        return null;
    },

    savePizzaPrices(prices) {
        if (window.db) {
            return db.collection('config').doc('pizza_prices').set(prices);
        }
        return Promise.reject("Firestore não inicializado");
    }
};
