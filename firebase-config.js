/* ==========================================================================
   CONFIGURAÇÃO CENTRALIZADA DO FIREBASE — JC FOOD DEMO
   ==========================================================================
   Projeto Oficial: jc-food-dev
   Esta é a única fonte oficial de configuração do Firebase para todo o sistema
   (Cardápio Digital, Painel Administrativo e Módulo Garçom).
   ========================================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyDUvnOYbQ5cg_s49Y-9mqAwTlEuYBDCtO4",
  authDomain: "jc-food-dev.firebaseapp.com",
  databaseURL: "https://jc-food-dev-default-rtdb.firebaseio.com",
  projectId: "jc-food-dev",
  storageBucket: "jc-food-dev.firebasestorage.app",
  messagingSenderId: "310602754609",
  appId: "1:310602754609:web:484a7804782e01ceed0310"
};

/**
 * Validação para garantir que o sistema não tente inicializar com credenciais pendentes/placeholder
 */
function isFirebaseConfigured() {
    return typeof firebaseConfig !== 'undefined' &&
           firebaseConfig.apiKey &&
           !firebaseConfig.apiKey.includes('INSERIR_') &&
           !firebaseConfig.apiKey.includes('SUA_') &&
           firebaseConfig.projectId === 'jc-food-dev';
}

// Inicialização segura e centralizada do Firebase para JC Food
if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length === 0) {
    if (isFirebaseConfigured()) {
        try {
            firebase.initializeApp(firebaseConfig);
            console.log('[Firebase JC Food] Conectado com sucesso ao projeto:', firebaseConfig.projectId);
        } catch (e) {
            console.error('[Firebase JC Food] Erro ao inicializar:', e);
        }
    } else {
        console.info('[Firebase JC Food] Credenciais oficiais pendentes em firebase-config.js.');
    }
}
