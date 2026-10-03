/**
 * ==============================================================================
 * JC FOOD — TENANT CONTEXT & MULTI-TENANT MANAGER
 * ==============================================================================
 * Gerenciador unificado de Tenant para isolamento total entre empresas.
 * Escopa leituras e gravações sob 'companies/{companyId}/'.
 * Determina a empresa dinamicamente por:
 *  1. Usuário autenticado no Firebase Auth (users/{uid}/companyId)
 *  2. Parâmetro de URL (?empresa= ou ?c= ou ?company=)
 *  3. Fallback seguro: 'jc-food'
 * ==============================================================================
 */

(function (window) {
    'use strict';

    const DEFAULT_COMPANY_ID = 'jc-food';
    const COMPANY_STORAGE_KEY = 'jc_food_active_tenant';

    const TenantContext = {
        _currentCompanyId: null,
        _activeUser: null,
        _listeners: [],

        /**
         * Retorna o ID da empresa ativa no contexto atual.
         * @returns {string}
         */
        getCompanyId: function () {
            if (this._currentCompanyId) {
                return this._currentCompanyId;
            }

            // 1. Tenta recuperar do sessionStorage/localStorage
            try {
                const stored = sessionStorage.getItem(COMPANY_STORAGE_KEY) || localStorage.getItem(COMPANY_STORAGE_KEY);
                if (stored && typeof stored === 'string' && stored.trim().length > 0) {
                    this._currentCompanyId = stored.trim();
                    return this._currentCompanyId;
                }
            } catch (e) {}

            // 2. Tenta recuperar via Parâmetro de URL (?empresa=, ?c=, ?company=)
            try {
                if (typeof window !== 'undefined' && window.location && window.location.search) {
                    const params = new URLSearchParams(window.location.search);
                    const urlTenant = params.get('empresa') || params.get('c') || params.get('company');
                    if (urlTenant && urlTenant.trim().length > 0) {
                        this._currentCompanyId = urlTenant.trim().toLowerCase();
                        return this._currentCompanyId;
                    }
                }
            } catch (e) {}

            // 3. Padrão oficial JC Food
            this._currentCompanyId = DEFAULT_COMPANY_ID;
            return this._currentCompanyId;
        },

        /**
         * Define manualmente a empresa ativa e notifica ouvintes registrados.
         * @param {string} companyId
         */
        setCompanyId: function (companyId) {
            if (!companyId || typeof companyId !== 'string') return;
            const cleanId = companyId.trim().toLowerCase();
            const changed = this._currentCompanyId !== cleanId;
            this._currentCompanyId = cleanId;

            try {
                sessionStorage.setItem(COMPANY_STORAGE_KEY, cleanId);
                localStorage.setItem(COMPANY_STORAGE_KEY, cleanId);
            } catch (e) {}

            if (changed) {
                this._listeners.forEach(fn => {
                    try { fn(cleanId); } catch (err) { console.warn('[TenantContext] Erro em ouvinte:', err); }
                });
            }
        },

        /**
         * Resolve dinamicamente a empresa associada ao usuário autenticado no Firebase Auth.
         * @param {object} user - Objeto retornado por firebase.auth().onAuthStateChanged
         * @returns {Promise<string>} - Retorna o companyId resolvido
         */
        resolveUserCompany: async function (user) {
            this._activeUser = user;
            if (!user || !user.uid) {
                const def = this.getCompanyId();
                return def;
            }

            if (typeof firebase === 'undefined' || !firebase.database) {
                return this.getCompanyId();
            }

            try {
                const db = firebase.database();
                const userSnap = await db.ref('users/' + user.uid).once('value');
                if (userSnap.exists()) {
                    const uData = userSnap.val() || {};
                    if (uData.companyId) {
                        const resolvedId = String(uData.companyId).trim().toLowerCase();
                        this.setCompanyId(resolvedId);
                        console.log(`[TenantContext] Usuário ${user.email || user.uid} vinculado à empresa:`, resolvedId);
                        return resolvedId;
                    }
                }

                // Usuário ainda não possui nó users/{uid}: vincula JC Food por padrão
                const initialCompanyId = 'jc-food';
                await db.ref('users/' + user.uid).set({
                    uid: user.uid,
                    email: user.email || '',
                    companyId: initialCompanyId,
                    role: 'admin',
                    updatedAt: (firebase.database.ServerValue && firebase.database.ServerValue.TIMESTAMP) || Date.now()
                });

                this.setCompanyId(initialCompanyId);
                console.log(`[TenantContext] Novo nó de usuário criado para ${user.email} com empresa: ${initialCompanyId}`);
                return initialCompanyId;
            } catch (err) {
                console.warn('[TenantContext] Falha ao consultar users/{uid}, mantendo empresa atual:', err);
                return this.getCompanyId();
            }
        },

        /**
         * Retorna a referência do Firebase Realtime Database isolada pelo companyId da empresa ativa.
         * Ex: TenantContext.ref('menu') -> ref('companies/jc-food/menu')
         * @param {string} relativePath
         * @returns {firebase.database.Reference}
         */
        ref: function (relativePath) {
            if (typeof firebase === 'undefined' || !firebase.database) {
                throw new Error('[TenantContext] Firebase Database não está inicializado.');
            }

            const cleanPath = (relativePath || '').toString().trim().replace(/^\/+/, '');
            
            // Nós globais especiais que não ficam sob companies (ex: users)
            if (cleanPath.startsWith('users') || cleanPath === 'users') {
                return firebase.database().ref(cleanPath);
            }

            const companyId = this.getCompanyId();
            const fullPath = `companies/${companyId}/${cleanPath}`.replace(/\/+$/, '');
            return firebase.database().ref(fullPath);
        },

        /**
         * Retorna a string do caminho completo no Firebase.
         * @param {string} relativePath
         * @returns {string}
         */
        path: function (relativePath) {
            const cleanPath = (relativePath || '').toString().trim().replace(/^\/+/, '');
            if (cleanPath.startsWith('users') || cleanPath === 'users') {
                return cleanPath;
            }
            return `companies/${this.getCompanyId()}/${cleanPath}`.replace(/\/+$/, '');
        },

        /**
         * Registra um ouvinte para quando o tenant for alterado.
         * @param {Function} callback
         */
        onCompanyChange: function (callback) {
            if (typeof callback === 'function') {
                this._listeners.push(callback);
            }
        }
    };

    // Exportação global no navegador
    window.TenantContext = TenantContext;

})(typeof window !== 'undefined' ? window : this);
