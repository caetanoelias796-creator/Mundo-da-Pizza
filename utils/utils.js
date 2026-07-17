// General utility functions
function formatPrice(price) {
    if (typeof price !== 'number') return 'R$ 0,00';
    return `R$ ${price.toFixed(2).replace('.', ',')}`;
}

function slugify(text, separator = '_') {
    if (!text) return '';
    const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (separator === '-') {
        return normalized.replace(/\s+/g, '-').replace(/[^a-z0-9\-]+/g, '').replace(/^-+|-+$/g, '');
    }
    return normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function playNotificationSound() {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-84.wav');
    audio.play().catch(err => console.log("Notificação sonora bloqueada pelo navegador:", err));
}
