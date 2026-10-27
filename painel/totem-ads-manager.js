/**
 * ==============================================================================
 * JC FOOD — GERENCIADOR DE PUBLICIDADE DO TOTEM / AUTOATENDIMENTO
 * ==============================================================================
 * Módulo administrativo para controle das mídias publicitárias (vídeos e imagens)
 * exibidas na tela de espera do totem físico na pizzaria.
 * ==============================================================================
 */

let allTotemMediaList = [];
let editingMediaId = null;

function totemMediaDbRef(relativePath) {
    if (typeof TenantContext !== 'undefined' && typeof TenantContext.ref === 'function') {
        return TenantContext.ref(relativePath ? 'totemMedia/' + relativePath : 'totemMedia');
    }
    return firebase.database().ref(relativePath ? 'totemMedia/' + relativePath : 'totemMedia');
}

/**
 * Inicializa sincronização em tempo real das mídias do Totem
 */
function initTotemAdsSync() {
    if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
        try {
            totemMediaDbRef().on('value', (snapshot) => {
                const val = snapshot.val();
                if (val && typeof val === 'object') {
                    allTotemMediaList = Array.isArray(val) ? val : Object.values(val);
                    allTotemMediaList.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
                } else {
                    allTotemMediaList = [];
                }

                if (typeof currentSection !== 'undefined' && currentSection === 'totemAds') {
                    renderTotemAdsManager();
                }
            }, (err) => {
                console.warn('[TotemAds] Falha ao sincronizar mídias do totem:', err);
                if (typeof currentSection !== 'undefined' && currentSection === 'totemAds') {
                    renderTotemAdsManager();
                }
            });
        } catch (e) {
            console.warn('[TotemAds] Erro no listener do Firebase:', e);
        }
    } else {
        renderTotemAdsManager();
    }
}

/**
 * Renderiza o painel do gerenciador de publicidade
 */
function renderTotemAdsManager() {
    const container = document.getElementById('totemAdsContainer');
    if (!container) return;

    // Estatísticas rápidas
    const totalCount = allTotemMediaList.length;
    const activeCount = allTotemMediaList.filter(m => m.active !== false).length;
    const videoCount = allTotemMediaList.filter(m => m.type === 'video').length;
    const imageCount = totalCount - videoCount;

    const totalEl = document.getElementById('totemStatTotal');
    const activeEl = document.getElementById('totemStatActive');
    const videoEl = document.getElementById('totemStatVideos');
    const imageEl = document.getElementById('totemStatImages');

    if (totalEl) totalEl.textContent = totalCount;
    if (activeEl) activeEl.textContent = activeCount;
    if (videoEl) videoEl.textContent = videoCount;
    if (imageEl) imageEl.textContent = imageCount;

    const listTbody = document.getElementById('totemAdsTableBody');
    const emptyState = document.getElementById('totemAdsEmptyState');

    if (!listTbody) return;

    if (totalCount === 0) {
        listTbody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    listTbody.innerHTML = allTotemMediaList.map((media, idx) => {
        const isVideo = media.type === 'video';
        const isAct = media.active !== false;
        const dur = isVideo ? 'Vídeo (Duração Real)' : `${media.duration || 8}s`;
        const fitLabel = media.fit === 'contain' ? 'Conter (Contain)' : 'Preencher (Cover)';

        let previewHTML = '';
        if (isVideo) {
            previewHTML = `
                <div style="width: 72px; height: 50px; background: #000; border-radius: 6px; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.15); color: #00bcd4;">
                    <span class="material-symbols-rounded" style="font-size: 28px;">videocam</span>
                </div>
            `;
        } else {
            const imgSrc = media.url.startsWith('http') || media.url.startsWith('../') ? media.url : '../' + media.url;
            previewHTML = `
                <img src="${imgSrc}" alt="${media.title}" style="width: 72px; height: 50px; object-fit: cover; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15);" onerror="this.src='../assets/pizza_hero.png'">
            `;
        }

        return `
            <tr>
                <td style="text-align: center; font-weight: 700; color: var(--text-muted);">${media.order || (idx + 1)}</td>
                <td>${previewHTML}</td>
                <td>
                    <strong style="color: #ffffff; font-size: 14px;">${media.title || 'Sem Título'}</strong>
                    ${media.description ? `<div style="font-size: 12px; color: var(--text-muted);">${media.description}</div>` : ''}
                    <div style="font-size: 11px; color: #888; font-family: monospace; margin-top: 2px;">${media.url}</div>
                </td>
                <td>
                    <span class="status-badge" style="background: ${isVideo ? 'rgba(0, 188, 212, 0.2)' : 'rgba(245, 166, 35, 0.2)'}; color: ${isVideo ? '#00bcd4' : '#f5a623'}; border: 1px solid ${isVideo ? 'rgba(0, 188, 212, 0.4)' : 'rgba(245, 166, 35, 0.4)'};">
                        ${isVideo ? '🎥 VÍDEO' : '🖼️ IMAGEM'}
                    </span>
                </td>
                <td style="font-weight: 600;">${dur}</td>
                <td style="font-size: 12px; color: var(--text-muted);">${fitLabel}</td>
                <td>
                    <button type="button" onclick="toggleTotemMediaStatus('${media.id}')" style="background: ${isAct ? 'rgba(46, 125, 50, 0.2)' : 'rgba(239, 83, 80, 0.2)'}; color: ${isAct ? '#4caf50' : '#ef5350'}; border: 1px solid ${isAct ? 'rgba(76, 175, 80, 0.4)' : 'rgba(239, 83, 80, 0.4)'}; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; cursor: pointer;">
                        ${isAct ? '🟢 Ativo' : '⚪ Pausado'}
                    </button>
                </td>
                <td style="text-align: right;">
                    <div style="display: flex; gap: 6px; justify-content: flex-end;">
                        <button type="button" class="btn btn-sm btn-outline" onclick="editTotemMedia('${media.id}')" title="Editar Mídia" style="padding: 5px 10px;">
                            <span class="material-symbols-rounded" style="font-size: 16px;">edit</span>
                        </button>
                        <button type="button" class="btn btn-sm btn-outline" onclick="deleteTotemMedia('${media.id}')" title="Excluir Mídia" style="padding: 5px 10px; color: #ef5350; border-color: rgba(239, 83, 80, 0.4);">
                            <span class="material-symbols-rounded" style="font-size: 16px;">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Alterna status ativo/inativo de uma mídia
 */
function toggleTotemMediaStatus(mediaId) {
    const item = allTotemMediaList.find(m => String(m.id) === String(mediaId));
    if (!item) return;

    const newStatus = !(item.active !== false);
    totemMediaDbRef(item.id + '/active').set(newStatus)
        .then(() => {
            if (typeof showToast === 'function') {
                showToast(`Mídia ${newStatus ? 'ativada' : 'pausada'} no Totem!`, 'success');
            }
        })
        .catch(err => {
            console.warn('[TotemAds] Erro ao alternar status:', err);
            item.active = newStatus;
            renderTotemAdsManager();
        });
}

/**
 * Abre modal para adicionar nova mídia
 */
function openAddTotemMediaModal() {
    editingMediaId = null;
    const modal = document.getElementById('totemMediaModal');
    const modalTitle = document.getElementById('totemMediaModalTitle');

    if (modalTitle) modalTitle.textContent = 'Adicionar Mídia ao Totem';

    // Limpa campos
    document.getElementById('totemMediaTitle').value = '';
    document.getElementById('totemMediaDesc').value = '';
    document.getElementById('totemMediaType').value = 'image';
    document.getElementById('totemMediaUrl').value = '';
    document.getElementById('totemMediaDuration').value = '8';
    document.getElementById('totemMediaOrder').value = String(allTotemMediaList.length + 1);
    document.getElementById('totemMediaFit').value = 'cover';
    document.getElementById('totemMediaActive').checked = true;

    if (modal) modal.classList.add('active');
}

/**
 * Abre modal para editar mídia existente
 */
function editTotemMedia(mediaId) {
    const item = allTotemMediaList.find(m => String(m.id) === String(mediaId));
    if (!item) return;

    editingMediaId = item.id;
    const modal = document.getElementById('totemMediaModal');
    const modalTitle = document.getElementById('totemMediaModalTitle');

    if (modalTitle) modalTitle.textContent = 'Editar Mídia do Totem';

    document.getElementById('totemMediaTitle').value = item.title || '';
    document.getElementById('totemMediaDesc').value = item.description || '';
    document.getElementById('totemMediaType').value = item.type || 'image';
    document.getElementById('totemMediaUrl').value = item.url || '';
    document.getElementById('totemMediaDuration').value = item.duration || 8;
    document.getElementById('totemMediaOrder').value = item.order || 1;
    document.getElementById('totemMediaFit').value = item.fit || 'cover';
    document.getElementById('totemMediaActive').checked = item.active !== false;

    if (modal) modal.classList.add('active');
}

function closeTotemMediaModal() {
    const modal = document.getElementById('totemMediaModal');
    if (modal) modal.classList.remove('active');
}

/**
 * Seleciona atalho de imagem pré-cadastrada no projeto
 */
function selectPresetTotemAsset(url) {
    const input = document.getElementById('totemMediaUrl');
    if (input) input.value = url;
}

/**
 * Salva mídia no Firebase
 */
function saveTotemMedia(event) {
    if (event) event.preventDefault();

    const title = document.getElementById('totemMediaTitle').value.trim();
    const desc = document.getElementById('totemMediaDesc').value.trim();
    const type = document.getElementById('totemMediaType').value;
    const url = document.getElementById('totemMediaUrl').value.trim();
    const duration = parseInt(document.getElementById('totemMediaDuration').value, 10) || 8;
    const order = parseInt(document.getElementById('totemMediaOrder').value, 10) || 1;
    const fit = document.getElementById('totemMediaFit').value || 'cover';
    const active = document.getElementById('totemMediaActive').checked;

    if (!title || !url) {
        if (typeof showToast === 'function') showToast('Preencha o título e o caminho/URL da mídia!', 'warning');
        else alert('Preencha o título e o caminho/URL da mídia!');
        return;
    }

    const id = editingMediaId || ('media_' + Date.now());
    const mediaObj = {
        id: id,
        title: title,
        description: desc,
        type: type,
        url: url,
        duration: duration,
        order: order,
        fit: fit,
        active: active,
        updatedAt: Date.now()
    };

    totemMediaDbRef(id).set(mediaObj)
        .then(() => {
            closeTotemMediaModal();
            if (typeof showToast === 'function') {
                showToast(`Mídia "${title}" salva com sucesso!`, 'success');
            }
        })
        .catch(err => {
            console.error('[TotemAds] Falha ao salvar no Firebase:', err);
            closeTotemMediaModal();
            // Atualização local imediata
            const existingIdx = allTotemMediaList.findIndex(m => String(m.id) === String(id));
            if (existingIdx >= 0) allTotemMediaList[existingIdx] = mediaObj;
            else allTotemMediaList.push(mediaObj);
            renderTotemAdsManager();
        });
}

/**
 * Exclui mídia promocional com confirmação
 */
function deleteTotemMedia(mediaId) {
    const item = allTotemMediaList.find(m => String(m.id) === String(mediaId));
    const title = item ? item.title : 'esta mídia';

    if (!confirm(`Tem certeza que deseja excluir "${title}" da publicidade do totem?`)) {
        return;
    }

    totemMediaDbRef(mediaId).remove()
        .then(() => {
            if (typeof showToast === 'function') {
                showToast('Mídia excluída com sucesso!', 'success');
            }
        })
        .catch(err => {
            console.warn('[TotemAds] Erro ao excluir do Firebase:', err);
            allTotemMediaList = allTotemMediaList.filter(m => String(m.id) !== String(mediaId));
            renderTotemAdsManager();
        });
}

/**
 * Inicializa mídias padrão da JC Food no Firebase com 1 clique
 */
function populateDefaultTotemMedia() {
    if (!confirm('Deseja carregar a lista de mídias promocionais oficiais da JC Food?')) {
        return;
    }

    const defaults = {
        'promo-1': {
            id: 'promo-1',
            type: 'image',
            title: 'Pizzas Artesanais JC Food',
            description: 'Massa fina, bordas recheadas e os melhores ingredientes selecionados.',
            url: 'assets/gourmet_calabresa.png',
            fit: 'cover',
            duration: 8,
            active: true,
            order: 1
        },
        'promo-2': {
            id: 'promo-2',
            type: 'image',
            title: 'Pizzas Especiais & Nobres',
            description: 'Mais de 40 sabores tradicionais e especiais para você saborear.',
            url: 'assets/gourmet_margherita.png',
            fit: 'cover',
            duration: 8,
            active: true,
            order: 2
        },
        'promo-3': {
            id: 'promo-3',
            type: 'image',
            title: 'Quatro Queijos Nobres',
            description: 'A combinação perfeita de queijos artesanais derretidos no ponto.',
            url: 'assets/gourmet_quatro_queijos.png',
            fit: 'cover',
            duration: 8,
            active: true,
            order: 3
        },
        'promo-4': {
            id: 'promo-4',
            type: 'image',
            title: 'Sobremesas & Pizzas Doces',
            description: 'Finalize sua experiência com nossas irresistíveis pizzas doces artesanais.',
            url: 'assets/gourmet_doce_morango.png',
            fit: 'cover',
            duration: 8,
            active: true,
            order: 4
        }
    };

    totemMediaDbRef().set(defaults)
        .then(() => {
            if (typeof showToast === 'function') {
                showToast('Mídias oficiais da JC Food configuradas com sucesso!', 'success');
            }
        })
        .catch(err => {
            console.error('[TotemAds] Falha ao gravar defaults:', err);
        });
}

// Inicializa ouvinte quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    initTotemAdsSync();
});
