// ========================================
// ANAMNESE: SISTEMA COM TEMPLATE PERSONALIZÁVEL
// ========================================

let sigPad = { canvas: null, ctx: null, isDrawing: false };
let mapPad = { canvas: null, ctx: null, isDrawing: false, color: '#000000' };
let currentFichaId = null;
let templateAtual = []; // campos do template da profissional logada

// Template padrão (usado quando a profissional não tem template personalizado)
const TEMPLATE_PADRAO = [
    { id: 'saude_gestante',   tipo: 'checkbox', label: 'Gestante / Lactante' },
    { id: 'saude_cardiaco',   tipo: 'checkbox', label: 'Problemas Cardíacos' },
    { id: 'saude_diabetes',   tipo: 'checkbox', label: 'Diabetes' },
    { id: 'saude_alergia',    tipo: 'checkbox', label: 'Alergias' },
    { id: 'saude_oncologico', tipo: 'checkbox', label: 'Histórico Oncológico' },
    { id: 'medicamentos',     tipo: 'texto',    label: 'Medicamentos em Uso Contínuo' },
    { id: 'alergias_obs',     tipo: 'texto',    label: 'Alergias Específicas' },
    { id: '_sep_estetico',    tipo: 'titulo',   label: 'Histórico Estético' },
    { id: 'queixa_principal', tipo: 'textarea', label: 'Queixa Principal' },
    { id: 'home_care',        tipo: 'texto',    label: 'Cuidados Diários (Home Care)' },
];

document.addEventListener('DOMContentLoaded', () => {
    setupCanvas('signatureCanvas', sigPad);
    setupCanvas('mapaFacialCanvas', mapPad);
    const form = document.getElementById('formAnamnese');
    if (form) form.addEventListener('submit', salvarAnamnese);
});

// ─── CANVAS ─────────────────────────────────────────────────────────────────

function setupCanvas(id, padObj) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    padObj.canvas = canvas;
    padObj.ctx = canvas.getContext('2d');

    function fixResolution() {
        const rect = canvas.getBoundingClientRect();
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        if (canvas.width !== rect.width * ratio || canvas.height !== rect.height * ratio) {
            canvas.width  = rect.width  * ratio;
            canvas.height = rect.height * ratio;
            padObj.ctx.scale(ratio, ratio);
        }
        padObj.ctx.lineWidth   = 3;
        padObj.ctx.lineCap     = 'round';
        padObj.ctx.lineJoin    = 'round';
        padObj.ctx.strokeStyle = padObj.color || '#000000';
    }
    setTimeout(fixResolution, 500);

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function start(e) {
        e.preventDefault();
        fixResolution();
        padObj.isDrawing = true;
        const pos = getPos(e);
        padObj.ctx.beginPath();
        padObj.ctx.moveTo(pos.x, pos.y);
        padObj.ctx.lineTo(pos.x, pos.y);
        padObj.ctx.stroke();
    }
    function move(e) {
        if (!padObj.isDrawing) return;
        e.preventDefault();
        const pos = getPos(e);
        padObj.ctx.lineTo(pos.x, pos.y);
        padObj.ctx.stroke();
    }
    function end(e) {
        if (padObj.isDrawing) { e.preventDefault(); padObj.isDrawing = false; padObj.ctx.closePath(); }
    }

    canvas.addEventListener('mousedown',  start);
    canvas.addEventListener('mousemove',  move);
    canvas.addEventListener('mouseup',    end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove',  move,  { passive: false });
    canvas.addEventListener('touchend',   end);
}

function setCorCaneta(cor, elemento) {
    if (mapPad.ctx) { mapPad.color = cor; mapPad.ctx.strokeStyle = cor; }
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
    if (elemento) elemento.classList.add('active');
}

function limparMapaFacial() {
    if (mapPad.canvas && mapPad.ctx) mapPad.ctx.clearRect(0, 0, 9999, 9999);
}
function limparAssinatura() {
    if (sigPad.canvas && sigPad.ctx) sigPad.ctx.clearRect(0, 0, 9999, 9999);
}

function trocarTabAnamnese(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.anamnese-tab-content').forEach(c => c.classList.remove('active'));
    const btnIndex = tab === 'texto' ? 0 : 1;
    document.querySelectorAll('.anamnese-tabs .tab-btn')[btnIndex]?.classList.add('active');
    if (tab === 'texto')  document.getElementById('tabAnamneseTexto')?.classList.add('active');
    if (tab === 'desenho') document.getElementById('tabAnamneseDesenho')?.classList.add('active');
}

function drawImageOnCanvas(ctx, dataUrl) {
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, 300, 150);
    img.src = dataUrl;
}

// ─── TEMPLATE ────────────────────────────────────────────────────────────────

async function carregarTemplate() {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return [...TEMPLATE_PADRAO];

        const { data } = await _supabase
            .from('anamnese_templates')
            .select('campos')
            .eq('user_id', user.id)
            .maybeSingle();

        if (data && data.campos && data.campos.length > 0) {
            return data.campos;
        }
    } catch (e) {
        console.warn('Erro ao carregar template, usando padrão:', e);
    }
    return [...TEMPLATE_PADRAO];
}

// ─── RENDERIZAÇÃO DINÂMICA DO FORM ──────────────────────────────────────────

function renderizarFormAnamnese(campos, respostas = {}) {
    const container = document.getElementById('camposDinamicos');
    if (!container) return;

    // Agrupa checkboxes consecutivos
    let html = '';
    let i = 0;
    while (i < campos.length) {
        const campo = campos[i];

        if (campo.tipo === 'titulo') {
            html += `<h3>${campo.label}</h3>`;
            i++;
            continue;
        }

        if (campo.tipo === 'checkbox') {
            // Coleta todos os checkboxes seguidos para renderizar em grupo
            html += '<div class="checkbox-group">';
            while (i < campos.length && campos[i].tipo === 'checkbox') {
                const c = campos[i];
                const checked = respostas[c.id] === true || respostas[c.id] === 'true' ? 'checked' : '';
                html += `<label><input type="checkbox" name="${c.id}" ${checked}> ${c.label}</label>`;
                i++;
            }
            html += '</div>';
            continue;
        }

        if (campo.tipo === 'texto') {
            const val = respostas[campo.id] ? String(respostas[campo.id]).replace(/"/g, '&quot;') : '';
            html += `<div class="form-group">
                <label>${campo.label}</label>
                <input type="text" name="${campo.id}" value="${val}">
            </div>`;
        } else if (campo.tipo === 'textarea') {
            const val = respostas[campo.id] ? String(respostas[campo.id]) : '';
            html += `<div class="form-group">
                <label>${campo.label}</label>
                <textarea name="${campo.id}" rows="2">${val}</textarea>
            </div>`;
        }

        i++;
    }

    container.innerHTML = html || '<p style="color:#888">Nenhum campo configurado.</p>';
}

// ─── ABRIR FICHA ────────────────────────────────────────────────────────────

async function abrirAnamnese() {
    if (!appState.currentCliente) {
        showToast('Selecione um cliente primeiro.', 'warning');
        return;
    }

    document.getElementById('formAnamnese').reset();
    limparAssinatura();
    limparMapaFacial();
    trocarTabAnamnese('texto');
    currentFichaId = null;

    // Mostra loading enquanto carrega template e ficha
    const container = document.getElementById('camposDinamicos');
    if (container) container.innerHTML = '<div style="color:#888; text-align:center; padding:20px;">Carregando...</div>';

    document.getElementById('modalAnamnese').classList.add('active');
    document.getElementById('overlay').classList.add('active');

    try {
        // Carrega template e ficha existente em paralelo
        const [campos, fichaResult] = await Promise.all([
            carregarTemplate(),
            _supabase
                .from('anamneses')
                .select('*')
                .eq('cliente_id', appState.currentCliente.id)
                .limit(1)
        ]);

        templateAtual = campos;
        const ficha = fichaResult.data?.[0] ?? null;
        const respostas = ficha?.respostas ?? {};

        renderizarFormAnamnese(templateAtual, respostas);

        if (ficha) {
            currentFichaId = ficha.id;
            if (respostas.mapa_facial_img) drawImageOnCanvas(mapPad.ctx, respostas.mapa_facial_img);
            if (ficha.assinatura)          drawImageOnCanvas(sigPad.ctx, ficha.assinatura);
        }
    } catch (err) {
        console.error('Erro ao abrir anamnese:', err);
        if (container) container.innerHTML = '<p style="color:#f44336">Erro ao carregar ficha.</p>';
    }
}

// ─── SALVAR FICHA ────────────────────────────────────────────────────────────

async function salvarAnamnese(e) {
    e.preventDefault();
    if (!appState.currentCliente) return;

    // Coleta todos os inputs do formulário dinâmico
    const respostas = {};
    document.querySelectorAll('#camposDinamicos input, #camposDinamicos textarea').forEach(el => {
        if (el.type === 'checkbox') {
            respostas[el.name] = el.checked;
        } else {
            respostas[el.name] = el.value;
        }
    });

    respostas['mapa_facial_img'] = mapPad.canvas?.toDataURL() ?? '';
    const assinaturaImg = sigPad.canvas?.toDataURL() ?? '';

    try {
        if (currentFichaId) {
            const { error } = await _supabase.from('anamneses').update({
                respostas,
                assinatura: assinaturaImg,
            }).eq('id', currentFichaId);
            if (error) throw error;
        } else {
            const { error } = await _supabase.from('anamneses').insert({
                cliente_id: appState.currentCliente.id,
                respostas,
                assinatura: assinaturaImg,
                profissional_nome: '',
            });
            if (error) throw error;
        }
        showToast('Ficha salva com sucesso!', 'success');
        fecharModal('modalAnamnese');
    } catch (error) {
        console.error(error);
        showToast('Erro ao salvar ficha.', 'error');
    }
}

// ─── IMPRESSÃO DINÂMICA ──────────────────────────────────────────────────────

async function buscarEImprimirFicha() {
    if (!appState.currentCliente) {
        showToast('Nenhum cliente selecionado.', 'error');
        return;
    }

    try {
        const [campos, fichaResult] = await Promise.all([
            carregarTemplate(),
            _supabase
                .from('anamneses')
                .select('*')
                .eq('cliente_id', appState.currentCliente.id)
                .order('created_at', { ascending: false })
                .limit(1)
        ]);

        if (!fichaResult.data || fichaResult.data.length === 0) {
            alert('Nenhuma ficha salva encontrada. Salve uma ficha primeiro!');
            return;
        }

        const ficha = fichaResult.data[0];
        const resp  = ficha.respostas || {};

        // Cabeçalho
        document.getElementById('printNomeCliente').textContent = appState.currentCliente.nome;
        const dataF = ficha.created_at ? new Date(ficha.created_at) : new Date();
        document.getElementById('printDataFicha').textContent =
            dataF.toLocaleDateString('pt-BR') + ' ' + dataF.toLocaleTimeString('pt-BR').slice(0, 5);

        // Gera o corpo dinamicamente
        const printBody = document.getElementById('printBodyDinamico');
        let html = '';
        let sectionAberta = false;

        const abrirSection = (titulo) => {
            if (sectionAberta) html += '</div>';
            html += `<div class="print-section"><h3>${titulo}</h3>`;
            sectionAberta = true;
        };

        // Detecta grupos de checkboxes para renderizar em grid
        let i = 0;
        while (i < campos.length) {
            const campo = campos[i];

            if (campo.tipo === 'titulo') {
                abrirSection(campo.label);
                i++;
                continue;
            }

            if (!sectionAberta) abrirSection('Dados da Ficha');

            if (campo.tipo === 'checkbox') {
                // Grupo de checkboxes em grid
                html += '<div class="print-grid">';
                while (i < campos.length && campos[i].tipo === 'checkbox') {
                    const c = campos[i];
                    const marcado = resp[c.id] === true || resp[c.id] === 'true';
                    html += `<div>${marcado ? '☒' : '☐'} ${c.label}</div>`;
                    i++;
                }
                html += '</div>';
                continue;
            }

            const valor = resp[campo.id] ? String(resp[campo.id]) : '________________________';
            if (campo.tipo === 'textarea') {
                html += `<p><strong>${campo.label}:</strong><br>${valor}</p>`;
            } else {
                html += `<p><strong>${campo.label}:</strong> ${valor}</p>`;
            }
            i++;
        }

        if (sectionAberta) html += '</div>';

        // Mapa facial
        if (resp.mapa_facial_img && resp.mapa_facial_img.length > 100) {
            html += `<div class="print-section keep-together">
                <h3>Mapeamento Facial</h3>
                <div class="print-map-container">
                    <img src="${resp.mapa_facial_img}" alt="Mapa Facial" style="max-height:300px; max-width:100%; display:block; margin:0 auto;">
                </div>
            </div>`;
        }

        // Assinatura
        html += `<div class="print-section keep-together">
            <h3>Termo de Responsabilidade</h3>
            <p class="legal-text-small">Declaro que as informações acima são verdadeiras e autorizo a realização dos procedimentos.</p>
            <div class="print-sig-container" style="text-align:center; margin-top:30px;">
                ${ficha.assinatura && ficha.assinatura.length > 100 ? `<img src="${ficha.assinatura}" alt="Assinatura" style="height:80px; display:block; margin:0 auto;">` : ''}
                <div style="border-top:1px solid #000; display:inline-block; width:300px; margin-top:5px;"></div>
                <div>Assinatura do Cliente</div>
            </div>
        </div>`;

        printBody.innerHTML = html;

        const fichaElement = document.getElementById('fichaImpressao');
        fichaElement.style.display  = 'block';
        fichaElement.style.visibility = 'visible';
        setTimeout(() => {
            window.print();
            fichaElement.style.display = 'none';
        }, 500);

    } catch (err) {
        console.error('Erro na impressão:', err);
        alert('Erro ao gerar documento: ' + (err.message || err));
    }
}

function imprimirAnamnese() { window.print(); }

// ─── EDITOR DE TEMPLATE ──────────────────────────────────────────────────────

let camposEditor = []; // cópia de trabalho durante a edição

window.abrirEditorTemplate = async function() {
    const campos = await carregarTemplate();
    camposEditor = JSON.parse(JSON.stringify(campos)); // deep copy
    renderizarListaEditor();
    document.getElementById('modalEditorTemplate').classList.add('active');
    document.getElementById('overlay').classList.add('active');
};

function renderizarListaEditor() {
    const lista = document.getElementById('listaEditorCampos');
    if (!lista) return;

    if (camposEditor.length === 0) {
        lista.innerHTML = '<p style="color:#666; text-align:center; padding:10px;">Nenhum campo. Adicione campos abaixo.</p>';
        return;
    }

    const tipoBadge = {
        checkbox: { cor: '#1E88E5', texto: 'Checkbox' },
        texto:    { cor: '#43A047', texto: 'Texto' },
        textarea: { cor: '#7B1FA2', texto: 'Área de texto' },
        titulo:   { cor: '#888',    texto: 'Título' },
    };

    lista.innerHTML = camposEditor.map((campo, idx) => {
        const badge = tipoBadge[campo.tipo] || { cor: '#555', texto: campo.tipo };
        return `<div style="display:flex; align-items:center; gap:8px; background:#1a1a1a; border:1px solid #333; border-radius:8px; padding:10px 12px;">
            <div style="display:flex; flex-direction:column; gap:2px;">
                <button type="button" onclick="moverCampoEditor(${idx}, -1)" ${idx === 0 ? 'disabled' : ''} style="background:none; border:none; color:${idx === 0 ? '#444' : '#aaa'}; cursor:pointer; padding:0; line-height:1; font-size:0.8rem;">▲</button>
                <button type="button" onclick="moverCampoEditor(${idx}, 1)" ${idx === camposEditor.length - 1 ? 'disabled' : ''} style="background:none; border:none; color:${idx === camposEditor.length - 1 ? '#444' : '#aaa'}; cursor:pointer; padding:0; line-height:1; font-size:0.8rem;">▼</button>
            </div>
            <span style="background:${badge.cor}22; color:${badge.cor}; border:1px solid ${badge.cor}55; border-radius:4px; padding:2px 8px; font-size:0.7rem; font-weight:700; white-space:nowrap;">${badge.texto}</span>
            <input type="text" value="${campo.label}" onchange="camposEditor[${idx}].label = this.value"
                style="flex:1; background:transparent; border:none; border-bottom:1px solid #444; color:#fff; font-size:0.9rem; padding:4px 2px; outline:none;">
            <button type="button" onclick="removerCampoEditor(${idx})" style="background:none; border:none; color:#f44336; cursor:pointer; font-size:1rem; padding:4px;">
                <i class="fas fa-trash"></i>
            </button>
        </div>`;
    }).join('');
}

window.adicionarCampoEditor = function() {
    const tipo  = document.getElementById('novoTipoCampo').value;
    const label = document.getElementById('novoLabelCampo').value.trim();
    if (!label) { showToast('Digite o nome do campo.', 'warning'); return; }

    const id = tipo + '_' + Date.now();
    camposEditor.push({ id, tipo, label });
    document.getElementById('novoLabelCampo').value = '';
    renderizarListaEditor();
};

window.removerCampoEditor = function(idx) {
    camposEditor.splice(idx, 1);
    renderizarListaEditor();
};

window.moverCampoEditor = function(idx, direcao) {
    const novoIdx = idx + direcao;
    if (novoIdx < 0 || novoIdx >= camposEditor.length) return;
    [camposEditor[idx], camposEditor[novoIdx]] = [camposEditor[novoIdx], camposEditor[idx]];
    renderizarListaEditor();
};

window.restaurarTempladePadrao = function() {
    if (!confirm('Restaurar o modelo padrão? Os campos personalizados serão perdidos.')) return;
    camposEditor = JSON.parse(JSON.stringify(TEMPLATE_PADRAO));
    renderizarListaEditor();
};

window.salvarTemplate = async function() {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado');

        const { error } = await _supabase
            .from('anamnese_templates')
            .upsert({ user_id: user.id, campos: camposEditor, updated_at: new Date().toISOString() });

        if (error) throw error;

        templateAtual = [...camposEditor];
        showToast('Modelo salvo com sucesso!', 'success');
        fecharModal('modalEditorTemplate');

        // Re-renderiza o form de anamnese se estiver aberto
        if (document.getElementById('modalAnamnese')?.classList.contains('active')) {
            renderizarFormAnamnese(templateAtual, {});
        }
    } catch (err) {
        console.error(err);
        showToast('Erro ao salvar modelo: ' + err.message, 'error');
    }
};
