// ============================================================================
// ANAMNESE — múltiplos modelos nomeados, tópicos, campos condicionais,
// impressão em branco e anexo de ficha escaneada.
// ============================================================================

let sigPad = { canvas: null, ctx: null, isDrawing: false };
let mapPad = { canvas: null, ctx: null, isDrawing: false, color: '#000000' };

let listaTemplates  = [];   // todos os modelos da profissional
let templateAtual   = null; // modelo da ficha aberta { id, nome, campos }
let camposAtuais    = [];   // campos usados na ficha aberta
let currentFichaId  = null;
let fichasDoCliente = [];
let anexosAtuais    = [];
let perfilCache     = null;

const BUCKET_ANEXOS = 'anamnese-anexos';

// ─── TIPOS DE CAMPO ─────────────────────────────────────────────────────────

const TIPOS_CAMPO = {
    titulo:         { nome: 'Tópico',          cor: '#D4AF37' },
    texto:          { nome: 'Texto curto',     cor: '#43A047' },
    textarea:       { nome: 'Texto longo',     cor: '#7B1FA2' },
    checkbox:       { nome: 'Sim / Não',       cor: '#1E88E5' },
    checkbox_texto: { nome: 'Sim + "quais?"',  cor: '#00897B' },
    select:         { nome: 'Escolha',         cor: '#C2185B' },
    data:           { nome: 'Data',            cor: '#FB8C00' },
    numero:         { nome: 'Número',          cor: '#6D4C41' },
};

// ─── MODELOS PRONTOS ────────────────────────────────────────────────────────

const MODELO_GERAL = [
    { id: 'sec_pessoais',    tipo: 'titulo',   label: 'Dados Pessoais' },
    { id: 'nome_completo',   tipo: 'texto',    label: 'Nome completo' },
    { id: 'nascimento',      tipo: 'data',     label: 'Data de nascimento' },
    { id: 'telefone',        tipo: 'texto',    label: 'Telefone / WhatsApp' },
    { id: 'profissao',       tipo: 'texto',    label: 'Profissão' },

    { id: 'sec_saude',       tipo: 'titulo',   label: 'Histórico de Saúde' },
    { id: 'gestante',        tipo: 'checkbox', label: 'Gestante ou lactante' },
    { id: 'diabetes',        tipo: 'checkbox', label: 'Diabetes' },
    { id: 'cardiaco',        tipo: 'checkbox', label: 'Problemas cardíacos' },
    { id: 'oncologico',      tipo: 'checkbox', label: 'Histórico oncológico' },
    { id: 'alergia_medic',   tipo: 'checkbox_texto', label: 'Alergia a algum medicamento', labelCondicional: 'Quais?' },
    { id: 'medic_continuo',  tipo: 'checkbox_texto', label: 'Usa medicamento contínuo',    labelCondicional: 'Quais?' },
    { id: 'cirurgia',        tipo: 'checkbox_texto', label: 'Já passou por cirurgia',      labelCondicional: 'Quais e quando?' },

    { id: 'sec_estetico',    tipo: 'titulo',   label: 'Histórico Estético' },
    { id: 'queixa',          tipo: 'textarea', label: 'Queixa principal' },
    { id: 'tipo_pele',       tipo: 'select',   label: 'Tipo de pele', opcoes: ['Normal', 'Seca', 'Oleosa', 'Mista', 'Sensível'] },
    { id: 'proc_anterior',   tipo: 'checkbox_texto', label: 'Já realizou procedimento estético', labelCondicional: 'Quais?' },
    { id: 'home_care',       tipo: 'texto',    label: 'Cuidados diários (home care)' },

    { id: 'sec_obs',         tipo: 'titulo',   label: 'Observações' },
    { id: 'observacoes',     tipo: 'textarea', label: 'Observações da profissional' },
];

const MODELOS_PRONTOS = [
    {
        nome: 'Ficha Geral',
        descricao: 'Modelo completo para primeira consulta',
        campos: MODELO_GERAL,
    },
    {
        nome: 'Limpeza de Pele / Facial',
        descricao: 'Focada em avaliação facial',
        campos: [
            { id: 'sec_pessoais', tipo: 'titulo',   label: 'Dados Pessoais' },
            { id: 'nome_completo', tipo: 'texto',   label: 'Nome completo' },
            { id: 'nascimento',   tipo: 'data',     label: 'Data de nascimento' },
            { id: 'sec_pele',     tipo: 'titulo',   label: 'Avaliação da Pele' },
            { id: 'tipo_pele',    tipo: 'select',   label: 'Tipo de pele', opcoes: ['Normal', 'Seca', 'Oleosa', 'Mista', 'Sensível'] },
            { id: 'acne',         tipo: 'checkbox', label: 'Acne ativa' },
            { id: 'melasma',      tipo: 'checkbox', label: 'Melasma / manchas' },
            { id: 'rosacea',      tipo: 'checkbox', label: 'Rosácea' },
            { id: 'sensibilidade', tipo: 'checkbox_texto', label: 'Sensibilidade a algum ativo', labelCondicional: 'Quais?' },
            { id: 'sec_habitos',  tipo: 'titulo',   label: 'Hábitos' },
            { id: 'protetor',     tipo: 'checkbox', label: 'Usa protetor solar diariamente' },
            { id: 'fumante',      tipo: 'checkbox', label: 'Fumante' },
            { id: 'agua',         tipo: 'texto',    label: 'Consumo de água por dia' },
            { id: 'home_care',    tipo: 'textarea', label: 'Produtos usados em casa' },
            { id: 'sec_saude',    tipo: 'titulo',   label: 'Saúde' },
            { id: 'gestante',     tipo: 'checkbox', label: 'Gestante ou lactante' },
            { id: 'alergia_medic', tipo: 'checkbox_texto', label: 'Alergia a algum medicamento', labelCondicional: 'Quais?' },
            { id: 'acido',        tipo: 'checkbox_texto', label: 'Usa ácido no rosto', labelCondicional: 'Qual e há quanto tempo?' },
        ],
    },
    {
        nome: 'Micropigmentação / Cílios',
        descricao: 'Procedimentos em sobrancelha, lábios e cílios',
        campos: [
            { id: 'sec_pessoais',  tipo: 'titulo',   label: 'Dados Pessoais' },
            { id: 'nome_completo', tipo: 'texto',    label: 'Nome completo' },
            { id: 'nascimento',    tipo: 'data',     label: 'Data de nascimento' },
            { id: 'sec_proc',      tipo: 'titulo',   label: 'Procedimento' },
            { id: 'area',          tipo: 'select',   label: 'Área', opcoes: ['Sobrancelha', 'Lábios', 'Olhos / delineado', 'Extensão de cílios', 'Lash lifting'] },
            { id: 'tecnica',       tipo: 'texto',    label: 'Técnica escolhida' },
            { id: 'cor_pigmento',  tipo: 'texto',    label: 'Cor / pigmento utilizado' },
            { id: 'proc_anterior', tipo: 'checkbox_texto', label: 'Já fez esse procedimento antes', labelCondicional: 'Quando e onde?' },
            { id: 'sec_saude',     tipo: 'titulo',   label: 'Contraindicações' },
            { id: 'gestante',      tipo: 'checkbox', label: 'Gestante ou lactante' },
            { id: 'diabetes',      tipo: 'checkbox', label: 'Diabetes' },
            { id: 'queloide',      tipo: 'checkbox', label: 'Tendência a queloide' },
            { id: 'herpes',        tipo: 'checkbox', label: 'Herpes labial recorrente' },
            { id: 'anticoagulante', tipo: 'checkbox_texto', label: 'Usa anticoagulante', labelCondicional: 'Qual?' },
            { id: 'alergia',       tipo: 'checkbox_texto', label: 'Alergia a anestésico, látex ou pigmento', labelCondicional: 'Quais?' },
            { id: 'sec_obs',       tipo: 'titulo',   label: 'Observações' },
            { id: 'observacoes',   tipo: 'textarea', label: 'Observações da profissional' },
        ],
    },
    {
        nome: 'Corporal / Massagem',
        descricao: 'Avaliação corporal e drenagem',
        campos: [
            { id: 'sec_pessoais',  tipo: 'titulo',   label: 'Dados Pessoais' },
            { id: 'nome_completo', tipo: 'texto',    label: 'Nome completo' },
            { id: 'nascimento',    tipo: 'data',     label: 'Data de nascimento' },
            { id: 'sec_medidas',   tipo: 'titulo',   label: 'Medidas' },
            { id: 'peso',          tipo: 'numero',   label: 'Peso (kg)' },
            { id: 'altura',        tipo: 'numero',   label: 'Altura (cm)' },
            { id: 'abdomen',       tipo: 'numero',   label: 'Abdômen (cm)' },
            { id: 'quadril',       tipo: 'numero',   label: 'Quadril (cm)' },
            { id: 'sec_queixa',    tipo: 'titulo',   label: 'Queixa e Objetivo' },
            { id: 'objetivo',      tipo: 'select',   label: 'Objetivo', opcoes: ['Redução de medidas', 'Celulite', 'Flacidez', 'Drenagem / pós-operatório', 'Relaxamento'] },
            { id: 'queixa',        tipo: 'textarea', label: 'Queixa principal' },
            { id: 'sec_saude',     tipo: 'titulo',   label: 'Saúde' },
            { id: 'gestante',      tipo: 'checkbox', label: 'Gestante ou lactante' },
            { id: 'varizes',       tipo: 'checkbox', label: 'Varizes / trombose' },
            { id: 'pressao',       tipo: 'checkbox', label: 'Pressão alta' },
            { id: 'cirurgia',      tipo: 'checkbox_texto', label: 'Cirurgia recente', labelCondicional: 'Qual e quando?' },
            { id: 'intestino',     tipo: 'select',   label: 'Funcionamento intestinal', opcoes: ['Diário', 'Dia sim, dia não', 'Irregular'] },
        ],
    },
    {
        nome: 'Modelo em branco',
        descricao: 'Comece do zero e monte a sua',
        campos: [],
    },
];

if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

document.addEventListener('DOMContentLoaded', () => {
    setupCanvas('signatureCanvas', sigPad);
    setupCanvas('mapaFacialCanvas', mapPad);
    const form = document.getElementById('formAnamnese');
    if (form) form.addEventListener('submit', salvarAnamnese);
});

// ─── UTILITÁRIOS ────────────────────────────────────────────────────────────

function esc(v) {
    return String(v ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function novoId(tipo) {
    return `${tipo}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function dataBR(valor) {
    if (!valor) return '';
    const txt = String(valor);
    // "1990-05-02" é data pura: converter via Date jogaria um dia para trás no fuso do Brasil
    const puro = txt.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (puro) return `${puro[3]}/${puro[2]}/${puro[1]}`;
    const d = new Date(txt);
    if (isNaN(d)) return txt;
    return d.toLocaleDateString('pt-BR');
}

function dataHoraBR(valor) {
    if (!valor) return '';
    const d = new Date(valor);
    if (isNaN(d)) return String(valor);
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR').slice(0, 5)}`;
}

async function getPerfil() {
    if (perfilCache) return perfilCache;
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return {};
        const { data } = await _supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
        perfilCache = data || {};
    } catch { perfilCache = {}; }
    return perfilCache;
}

// ─── CANVAS ─────────────────────────────────────────────────────────────────

function setupCanvas(id, padObj) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    padObj.canvas = canvas;
    padObj.ctx = canvas.getContext('2d');

    function fixResolution() {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return;
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
    padObj.fixResolution = fixResolution;
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
    canvas.addEventListener('mouseleave', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove',  move,  { passive: false });
    canvas.addEventListener('touchend',   end);
}

window.setCorCaneta = function(cor, elemento) {
    if (mapPad.ctx) { mapPad.color = cor; mapPad.ctx.strokeStyle = cor; }
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
    if (elemento) elemento.classList.add('active');
};

window.limparMapaFacial = function() {
    if (mapPad.canvas && mapPad.ctx) mapPad.ctx.clearRect(0, 0, mapPad.canvas.width, mapPad.canvas.height);
};
window.limparAssinatura = function() {
    if (sigPad.canvas && sigPad.ctx) sigPad.ctx.clearRect(0, 0, sigPad.canvas.width, sigPad.canvas.height);
};

window.trocarTabAnamnese = function(tab) {
    const abas = ['texto', 'desenho', 'anexos'];
    const idx = Math.max(0, abas.indexOf(tab));
    document.querySelectorAll('.anamnese-tabs .tab-btn').forEach((b, i) => b.classList.toggle('active', i === idx));
    document.querySelectorAll('.anamnese-tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('tabAnamnese' + tab.charAt(0).toUpperCase() + tab.slice(1))?.classList.add('active');
};

function desenharNoCanvas(padObj, dataUrl) {
    if (!padObj.canvas || !padObj.ctx || !dataUrl || dataUrl.length < 100) return;
    const img = new Image();
    img.onload = () => {
        const rect = padObj.canvas.getBoundingClientRect();
        const w = rect.width || padObj.canvas.width;
        const h = rect.height || padObj.canvas.height;
        padObj.ctx.drawImage(img, 0, 0, w, h);
    };
    img.src = dataUrl;
}

function canvasTemDesenho(padObj) {
    if (!padObj.canvas || !padObj.ctx) return false;
    try {
        const { width, height } = padObj.canvas;
        if (!width || !height) return false;
        const dados = padObj.ctx.getImageData(0, 0, width, height).data;
        for (let i = 3; i < dados.length; i += 4) if (dados[i] !== 0) return true;
    } catch { return true; }
    return false;
}

// ─── MODELOS (TEMPLATES) ────────────────────────────────────────────────────

async function carregarTemplates({ force = false } = {}) {
    if (!force && listaTemplates.length) return listaTemplates;

    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await _supabase
        .from('anamnese_templates')
        .select('*')
        .order('is_padrao', { ascending: false })
        .order('ordem', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) {
        // Primeira vez: cria o modelo geral para a profissional
        const { data: criado, error: erroCriar } = await _supabase
            .from('anamnese_templates')
            .insert({ user_id: user.id, nome: 'Ficha Geral', campos: MODELO_GERAL, is_padrao: true, ordem: 0 })
            .select()
            .single();
        if (erroCriar) throw erroCriar;
        listaTemplates = [criado];
    } else {
        listaTemplates = data;
    }
    return listaTemplates;
}

function templatePorId(id) {
    return listaTemplates.find(t => t.id === id) || null;
}

function templatePadrao() {
    return listaTemplates.find(t => t.is_padrao) || listaTemplates[0] || null;
}

// ─── LISTA DE FICHAS DO CLIENTE ─────────────────────────────────────────────

window.abrirAnamnese = async function() {
    if (!appState.currentCliente) {
        showToast('Selecione um cliente primeiro.', 'warning');
        return;
    }

    document.getElementById('nomeClienteFichas').textContent = appState.currentCliente.nome;
    document.getElementById('listaFichasCliente').innerHTML =
        '<div style="color:#888; text-align:center; padding:20px;">Carregando...</div>';
    document.getElementById('listaModelosFicha').innerHTML = '';

    document.getElementById('modalFichasCliente').classList.add('active');
    document.getElementById('overlay').classList.add('active');

    await recarregarPainelFichas();
};

async function recarregarPainelFichas() {
    try {
        const [templates, fichasResult] = await Promise.all([
            carregarTemplates({ force: true }),
            _supabase
                .from('anamneses')
                .select('*')
                .eq('cliente_id', appState.currentCliente.id)
                .order('created_at', { ascending: false })
        ]);

        if (fichasResult.error) throw fichasResult.error;
        fichasDoCliente = fichasResult.data || [];

        renderizarListaModelos(templates);
        renderizarListaFichas();
    } catch (err) {
        console.error('Erro ao carregar fichas:', err);
        document.getElementById('listaFichasCliente').innerHTML =
            '<p style="color:#f44336; text-align:center;">Erro ao carregar as fichas.</p>';
    }
}

function renderizarListaModelos(templates) {
    const box = document.getElementById('listaModelosFicha');
    if (!box) return;

    box.innerHTML = templates.map(t => `
        <div class="modelo-card">
            <div class="modelo-card-info">
                <strong>${esc(t.nome)}</strong>
                ${t.is_padrao ? '<span class="badge-padrao">padrão</span>' : ''}
                <small>${(t.campos || []).filter(c => c.tipo !== 'titulo').length} campo(s)</small>
            </div>
            <div class="modelo-card-acoes">
                <button type="button" class="btn-small" onclick="novaFichaComModelo('${t.id}')">
                    <i class="fas fa-pen"></i> Preencher
                </button>
                <button type="button" class="btn-small" onclick="imprimirModeloEmBranco('${t.id}')" title="Imprime a ficha vazia para preencher à mão">
                    <i class="fas fa-print"></i> Imprimir em branco
                </button>
            </div>
        </div>
    `).join('') || '<p style="color:#888">Nenhum modelo criado ainda.</p>';
}

function renderizarListaFichas() {
    const box = document.getElementById('listaFichasCliente');
    if (!box) return;

    if (!fichasDoCliente.length) {
        box.innerHTML = '<p style="color:#888; text-align:center; padding:14px;">Nenhuma ficha preenchida para esta cliente ainda.</p>';
        return;
    }

    box.innerHTML = fichasDoCliente.map(f => {
        const anexos = Array.isArray(f.anexos) ? f.anexos.length : 0;
        const assinada = f.assinatura && f.assinatura.length > 100;
        return `
        <div class="ficha-card">
            <div class="ficha-card-info">
                <strong>${esc(f.template_nome || 'Ficha de Anamnese')}</strong>
                <small>${dataHoraBR(f.created_at)}</small>
                <div class="ficha-card-badges">
                    ${assinada ? '<span class="badge-ok"><i class="fas fa-signature"></i> assinada</span>' : ''}
                    ${anexos ? `<span class="badge-ok"><i class="fas fa-paperclip"></i> ${anexos} anexo(s)</span>` : ''}
                </div>
            </div>
            <div class="ficha-card-acoes">
                <button type="button" class="btn-small" onclick="abrirFichaSalva('${f.id}')"><i class="fas fa-folder-open"></i> Abrir</button>
                <button type="button" class="btn-small" onclick="imprimirFichaSalva('${f.id}')"><i class="fas fa-print"></i> Imprimir</button>
                <button type="button" class="btn-small btn-small-danger" onclick="excluirFicha('${f.id}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
    }).join('');
}

// ─── ABRIR / CRIAR FICHA ────────────────────────────────────────────────────

function prepararModalFicha(nomeModelo) {
    document.getElementById('formAnamnese').reset();
    limparAssinatura();
    limparMapaFacial();
    trocarTabAnamnese('texto');
    document.getElementById('nomeModeloFicha').textContent = nomeModelo;
    const subtitulo = document.getElementById('printClienteFicha');
    if (subtitulo) subtitulo.textContent = appState.currentCliente?.nome || '';
    document.getElementById('modalAnamnese').classList.add('active');
    document.getElementById('overlay').classList.add('active');
    setTimeout(() => { mapPad.fixResolution?.(); sigPad.fixResolution?.(); }, 100);
}

// Ao fechar um modal empilhado, devolve o overlay para o que ficou aberto embaixo
function fecharModalEmpilhado(id, abaixo) {
    fecharModal(id);
    const restante = abaixo.some(m => document.getElementById(m)?.classList.contains('active'));
    if (restante) document.getElementById('overlay').classList.add('active');
}

window.fecharFichaAnamnese = function() {
    fecharModalEmpilhado('modalAnamnese', ['modalFichasCliente', 'modalDetalhesCliente']);
};

window.fecharPainelFichas = function() {
    fecharModalEmpilhado('modalFichasCliente', ['modalDetalhesCliente']);
};

window.novaFichaComModelo = async function(templateId) {
    const t = templatePorId(templateId);
    if (!t) { showToast('Modelo não encontrado.', 'error'); return; }

    currentFichaId = null;
    templateAtual  = t;
    camposAtuais   = JSON.parse(JSON.stringify(t.campos || []));
    anexosAtuais   = [];

    prepararModalFicha(t.nome);
    renderizarFormAnamnese(camposAtuais, prefillDoCliente(camposAtuais));
    renderizarAnexos();
};

// Preenche automaticamente campos óbvios com os dados já cadastrados da cliente
function prefillDoCliente(campos) {
    const c = appState.currentCliente || {};
    const respostas = {};
    campos.forEach(campo => {
        const l = (campo.label || '').toLowerCase();
        if (campo.tipo === 'texto' && /nome/.test(l) && c.nome) respostas[campo.id] = c.nome;
        if (campo.tipo === 'texto' && /(telefone|whatsapp|celular)/.test(l) && c.telefone) respostas[campo.id] = c.telefone;
        if (campo.tipo === 'texto' && /e-?mail/.test(l) && c.email) respostas[campo.id] = c.email;
        if (campo.tipo === 'texto' && /cpf/.test(l) && c.cpf) respostas[campo.id] = c.cpf;
        if (campo.tipo === 'data'  && /nascimento/.test(l) && c.data_nascimento) respostas[campo.id] = c.data_nascimento;
    });
    return respostas;
}

window.abrirFichaSalva = async function(fichaId) {
    const ficha = fichasDoCliente.find(f => f.id === fichaId);
    if (!ficha) { showToast('Ficha não encontrada.', 'error'); return; }

    currentFichaId = ficha.id;
    const respostas = ficha.respostas || {};

    // Usa a estrutura congelada na ficha; se não houver (fichas antigas),
    // cai para o modelo vinculado ou para o modelo padrão.
    camposAtuais = respostas.__campos
        || templatePorId(ficha.template_id)?.campos
        || templatePadrao()?.campos
        || MODELO_GERAL;
    camposAtuais = JSON.parse(JSON.stringify(camposAtuais));
    templateAtual = templatePorId(ficha.template_id);
    anexosAtuais  = Array.isArray(ficha.anexos) ? [...ficha.anexos] : [];

    prepararModalFicha(ficha.template_nome || templateAtual?.nome || 'Ficha de Anamnese');
    renderizarFormAnamnese(camposAtuais, respostas);
    renderizarAnexos();

    setTimeout(() => {
        desenharNoCanvas(mapPad, respostas.mapa_facial_img);
        desenharNoCanvas(sigPad, ficha.assinatura);
    }, 300);
};

window.excluirFicha = async function(fichaId) {
    if (!confirm('Excluir esta ficha? Os anexos escaneados também serão apagados.')) return;
    const ficha = fichasDoCliente.find(f => f.id === fichaId);

    try {
        const caminhos = (ficha?.anexos || []).map(a => a.path).filter(Boolean);
        if (caminhos.length) await _supabase.storage.from(BUCKET_ANEXOS).remove(caminhos);

        const { error } = await _supabase.from('anamneses').delete().eq('id', fichaId);
        if (error) throw error;

        showToast('Ficha excluída.', 'success');
        await recarregarPainelFichas();
    } catch (err) {
        console.error(err);
        showToast('Erro ao excluir ficha.', 'error');
    }
};

// ─── RENDERIZAÇÃO DO FORMULÁRIO ─────────────────────────────────────────────

function renderizarFormAnamnese(campos, respostas = {}) {
    const container = document.getElementById('camposDinamicos');
    if (!container) return;

    let html = '';
    let topicoAberto = false;

    const abrirTopico = (titulo) => {
        if (topicoAberto) html += '</div></div>';
        html += `<div class="anamnese-topico"><h3>${esc(titulo)}</h3><div class="anamnese-topico-corpo">`;
        topicoAberto = true;
    };

    let i = 0;
    while (i < campos.length) {
        const campo = campos[i];

        if (campo.tipo === 'titulo') {
            abrirTopico(campo.label);
            i++;
            continue;
        }

        if (!topicoAberto) abrirTopico('Ficha');

        // Agrupa checkboxes simples consecutivos em duas colunas
        if (campo.tipo === 'checkbox') {
            html += '<div class="checkbox-group">';
            while (i < campos.length && campos[i].tipo === 'checkbox') {
                const c = campos[i];
                const checked = ehVerdadeiro(respostas[c.id]) ? 'checked' : '';
                html += `<label><input type="checkbox" data-campo="${esc(c.id)}" ${checked}> ${esc(c.label)}</label>`;
                i++;
            }
            html += '</div>';
            continue;
        }

        html += renderizarCampo(campo, respostas);
        i++;
    }

    if (topicoAberto) html += '</div></div>';

    container.innerHTML = html || '<p style="color:#888">Este modelo não tem campos. Use "Personalizar Modelos" para montar a ficha.</p>';
}

function ehVerdadeiro(v) {
    return v === true || v === 'true' || v === 'on';
}

function renderizarCampo(campo, respostas) {
    const id  = esc(campo.id);
    const val = respostas[campo.id];

    switch (campo.tipo) {
        case 'checkbox_texto': {
            const marcado = ehVerdadeiro(val);
            const detalhe = respostas[campo.id + '__detalhe'] ?? '';
            const labelCond = campo.labelCondicional || 'Se sim, quais?';
            return `<div class="form-group campo-condicional">
                <label class="label-check">
                    <input type="checkbox" data-campo="${id}" ${marcado ? 'checked' : ''}
                           onchange="alternarCampoCondicional(this)"> ${esc(campo.label)}
                </label>
                <div class="condicional-box" style="display:${marcado ? 'block' : 'none'}">
                    <label>${esc(labelCond)}</label>
                    <input type="text" data-campo="${id}__detalhe" value="${esc(detalhe)}" placeholder="${esc(labelCond)}">
                </div>
            </div>`;
        }
        case 'textarea':
            return `<div class="form-group">
                <label>${esc(campo.label)}</label>
                <textarea data-campo="${id}" rows="3">${esc(val ?? '')}</textarea>
            </div>`;
        case 'select': {
            const opcoes = (campo.opcoes || []).map(o =>
                `<option value="${esc(o)}" ${String(val) === String(o) ? 'selected' : ''}>${esc(o)}</option>`).join('');
            return `<div class="form-group">
                <label>${esc(campo.label)}</label>
                <select data-campo="${id}"><option value="">Selecione...</option>${opcoes}</select>
            </div>`;
        }
        case 'data':
            return `<div class="form-group">
                <label>${esc(campo.label)}</label>
                <input type="date" data-campo="${id}" value="${esc(val ?? '')}">
            </div>`;
        case 'numero':
            return `<div class="form-group">
                <label>${esc(campo.label)}</label>
                <input type="number" step="any" data-campo="${id}" value="${esc(val ?? '')}">
            </div>`;
        default:
            return `<div class="form-group">
                <label>${esc(campo.label)}</label>
                <input type="text" data-campo="${id}" value="${esc(val ?? '')}">
            </div>`;
    }
}

window.alternarCampoCondicional = function(checkbox) {
    const box = checkbox.closest('.campo-condicional')?.querySelector('.condicional-box');
    if (box) box.style.display = checkbox.checked ? 'block' : 'none';
};

// ─── SALVAR FICHA ───────────────────────────────────────────────────────────

function coletarRespostas() {
    const respostas = {};
    document.querySelectorAll('#camposDinamicos [data-campo]').forEach(el => {
        const chave = el.dataset.campo;
        respostas[chave] = (el.type === 'checkbox') ? el.checked : el.value;
    });
    return respostas;
}

async function salvarAnamnese(e) {
    e.preventDefault();
    if (!appState.currentCliente) return;

    const botao = e.submitter || document.querySelector('#formAnamnese button[type="submit"]');
    if (botao) { botao.disabled = true; botao.dataset.txt = botao.innerHTML; botao.innerHTML = 'Salvando...'; }

    const respostas = coletarRespostas();
    respostas.__campos = camposAtuais;                       // congela a estrutura da ficha
    respostas.mapa_facial_img = canvasTemDesenho(mapPad) ? mapPad.canvas.toDataURL('image/png') : '';
    const assinaturaImg = canvasTemDesenho(sigPad) ? sigPad.canvas.toDataURL('image/png') : '';

    const perfil = await getPerfil();

    try {
        if (currentFichaId) {
            const { error } = await _supabase.from('anamneses').update({
                respostas,
                assinatura: assinaturaImg,
                anexos: anexosAtuais,
                template_id:   templateAtual?.id ?? null,
                template_nome: templateAtual?.nome ?? document.getElementById('nomeModeloFicha').textContent,
                atualizado_em: new Date().toISOString(),
            }).eq('id', currentFichaId);
            if (error) throw error;
        } else {
            const { data, error } = await _supabase.from('anamneses').insert({
                cliente_id: appState.currentCliente.id,
                respostas,
                assinatura: assinaturaImg,
                anexos: anexosAtuais,
                template_id:   templateAtual?.id ?? null,
                template_nome: templateAtual?.nome ?? 'Ficha de Anamnese',
                profissional_nome: perfil.nome || '',
            }).select('id').single();
            if (error) throw error;
            currentFichaId = data.id;
        }

        showToast('Ficha salva com sucesso!', 'success');
        fecharFichaAnamnese();
        if (document.getElementById('modalFichasCliente')?.classList.contains('active')) {
            await recarregarPainelFichas();
        }
    } catch (error) {
        console.error(error);
        showToast('Erro ao salvar ficha: ' + (error.message || ''), 'error');
    } finally {
        if (botao) { botao.disabled = false; botao.innerHTML = botao.dataset.txt || 'Salvar Ficha'; }
    }
}

// ─── ANEXOS (FICHA ESCANEADA) ───────────────────────────────────────────────

function renderizarAnexos() {
    const box = document.getElementById('listaAnexosFicha');
    if (!box) return;

    if (!anexosAtuais.length) {
        box.innerHTML = '<p style="color:#888; font-size:0.88rem;">Nenhum arquivo anexado. Use o botão acima para enviar a ficha preenchida à mão (foto ou PDF).</p>';
        return;
    }

    box.innerHTML = anexosAtuais.map((a, idx) => `
        <div class="anexo-item">
            <i class="fas ${(a.tipo || '').includes('pdf') ? 'fa-file-pdf' : 'fa-file-image'}"></i>
            <span class="anexo-nome">${esc(a.nome)}</span>
            <small>${dataBR(a.enviado_em)}</small>
            <button type="button" class="btn-small" onclick="abrirAnexo(${idx})"><i class="fas fa-eye"></i> Ver</button>
            <button type="button" class="btn-small btn-small-danger" onclick="removerAnexoFicha(${idx})"><i class="fas fa-trash"></i></button>
        </div>
    `).join('');
}

window.enviarAnexoFicha = async function(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    if (!appState.currentCliente) return;

    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) { showToast('Sessão expirada.', 'error'); return; }

    const status = document.getElementById('statusUploadAnexo');
    if (status) status.textContent = 'Enviando...';

    try {
        for (const file of files) {
            if (file.size > 10 * 1024 * 1024) {
                showToast(`"${file.name}" passa de 10MB e não foi enviado.`, 'warning');
                continue;
            }
            const ext  = (file.name.split('.').pop() || 'jpg').toLowerCase();
            const path = `${user.id}/${appState.currentCliente.id}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;

            const { error } = await _supabase.storage.from(BUCKET_ANEXOS)
                .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
            if (error) throw error;

            anexosAtuais.push({ path, nome: file.name, tipo: file.type, enviado_em: new Date().toISOString() });
        }

        renderizarAnexos();

        // Se a ficha já existe, persiste o anexo imediatamente
        if (currentFichaId) {
            await _supabase.from('anamneses').update({ anexos: anexosAtuais }).eq('id', currentFichaId);
        }
        showToast('Arquivo anexado!' + (currentFichaId ? '' : ' Salve a ficha para concluir.'), 'success');
    } catch (err) {
        console.error(err);
        showToast('Erro ao enviar arquivo: ' + (err.message || ''), 'error');
    } finally {
        if (status) status.textContent = '';
    }
};

window.abrirAnexo = async function(idx) {
    const anexo = anexosAtuais[idx];
    if (!anexo) return;
    try {
        const { data, error } = await _supabase.storage.from(BUCKET_ANEXOS).createSignedUrl(anexo.path, 3600);
        if (error) throw error;
        window.open(data.signedUrl, '_blank');
    } catch (err) {
        console.error(err);
        showToast('Não foi possível abrir o arquivo.', 'error');
    }
};

window.removerAnexoFicha = async function(idx) {
    const anexo = anexosAtuais[idx];
    if (!anexo || !confirm(`Remover "${anexo.nome}"?`)) return;
    try {
        await _supabase.storage.from(BUCKET_ANEXOS).remove([anexo.path]);
        anexosAtuais.splice(idx, 1);
        renderizarAnexos();
        if (currentFichaId) {
            await _supabase.from('anamneses').update({ anexos: anexosAtuais }).eq('id', currentFichaId);
        }
        showToast('Anexo removido.', 'success');
    } catch (err) {
        console.error(err);
        showToast('Erro ao remover anexo.', 'error');
    }
};

// ─── IMPRESSÃO ──────────────────────────────────────────────────────────────

// Monta o corpo da ficha para impressão.
// respostas === null  →  ficha em branco (linhas para preencher à mão)
function montarCorpoImpressao(campos, respostas) {
    const emBranco = respostas === null;
    const linha = (n = 1) => '<div class="print-linha"></div>'.repeat(n);

    let html = '';
    let secaoAberta = false;

    const abrirSecao = (titulo) => {
        if (secaoAberta) html += '</div>';
        html += `<div class="print-section"><h3>${esc(titulo)}</h3>`;
        secaoAberta = true;
    };

    let i = 0;
    while (i < campos.length) {
        const campo = campos[i];

        if (campo.tipo === 'titulo') { abrirSecao(campo.label); i++; continue; }
        if (!secaoAberta) abrirSecao('Dados da Ficha');

        if (campo.tipo === 'checkbox') {
            html += '<div class="print-grid">';
            while (i < campos.length && campos[i].tipo === 'checkbox') {
                const c = campos[i];
                const marcado = !emBranco && ehVerdadeiro(respostas[c.id]);
                html += `<div><span class="print-check">${marcado ? '☒' : '☐'}</span> ${esc(c.label)}</div>`;
                i++;
            }
            html += '</div>';
            continue;
        }

        if (campo.tipo === 'checkbox_texto') {
            const marcado  = !emBranco && ehVerdadeiro(respostas[campo.id]);
            const detalhe  = emBranco ? '' : (respostas[campo.id + '__detalhe'] || '');
            const labelCond = campo.labelCondicional || 'Se sim, quais?';
            html += `<div class="print-condicional">
                <div><span class="print-check">${marcado ? '☒' : '☐'}</span> <strong>${esc(campo.label)}</strong></div>
                <div class="print-condicional-detalhe">
                    <em>${esc(labelCond)}</em> ${emBranco || !detalhe ? linha() : esc(detalhe)}
                </div>
            </div>`;
            i++;
            continue;
        }

        if (campo.tipo === 'select') {
            if (emBranco) {
                html += `<div class="print-escolha"><strong>${esc(campo.label)}:</strong> ` +
                    (campo.opcoes || []).map(o => `<span class="print-opcao"><span class="print-check">☐</span> ${esc(o)}</span>`).join(' ') +
                    '</div>';
            } else {
                html += `<div class="print-escolha"><strong>${esc(campo.label)}:</strong> ` +
                    ((campo.opcoes || []).length
                        ? campo.opcoes.map(o => `<span class="print-opcao"><span class="print-check">${String(respostas[campo.id]) === String(o) ? '☒' : '☐'}</span> ${esc(o)}</span>`).join(' ')
                        : esc(respostas[campo.id] || '')) +
                    '</div>';
            }
            i++;
            continue;
        }

        const bruto = emBranco ? '' : respostas[campo.id];
        const valor = campo.tipo === 'data' && bruto ? dataBR(bruto) : bruto;

        if (campo.tipo === 'textarea') {
            html += `<p class="print-campo"><strong>${esc(campo.label)}:</strong></p>` +
                    (valor ? `<p class="print-valor">${esc(valor)}</p>` : linha(3));
        } else {
            html += `<p class="print-campo"><strong>${esc(campo.label)}:</strong> ` +
                    (valor ? `<span class="print-valor">${esc(valor)}</span>` : '<span class="print-linha-inline"></span>') +
                    '</p>';
        }
        i++;
    }

    if (secaoAberta) html += '</div>';
    return html;
}

function blocoAssinatura(assinaturaImg) {
    return `<div class="print-section keep-together">
        <h3>Termo de Responsabilidade</h3>
        <p class="legal-text-small">Declaro que as informações prestadas acima são verdadeiras e autorizo a realização dos procedimentos indicados.</p>
        <div class="print-sig-container" style="text-align:center; margin-top:34px;">
            ${assinaturaImg && assinaturaImg.length > 100
                ? `<img src="${assinaturaImg}" alt="Assinatura" style="height:70px; display:block; margin:0 auto;">` : ''}
            <div style="border-top:1px solid #000; display:inline-block; width:320px; margin-top:4px;"></div>
            <div>Assinatura da Cliente</div>
        </div>
    </div>`;
}

async function montarCabecalhoImpressao({ titulo, cliente, data }) {
    const perfil = await getPerfil();
    document.getElementById('printTituloClinica').textContent = perfil.nome || 'Estética Premium';
    document.getElementById('printSubtitulo').textContent = titulo;
    document.getElementById('printNomeCliente').textContent = cliente;
    document.getElementById('printDataFicha').textContent = data;
}

function dispararImpressao() {
    const ficha = document.getElementById('fichaImpressao');
    ficha.style.display = 'block';
    ficha.style.visibility = 'visible';

    const esconder = () => { ficha.style.display = 'none'; window.removeEventListener('afterprint', esconder); };
    window.addEventListener('afterprint', esconder);

    setTimeout(() => {
        window.print();
        setTimeout(esconder, 1500); // rede de segurança p/ navegadores sem afterprint
    }, 400);
}

window.imprimirFichaSalva = async function(fichaId) {
    const ficha = fichasDoCliente.find(f => f.id === fichaId);
    if (!ficha) { showToast('Ficha não encontrada.', 'error'); return; }

    const respostas = ficha.respostas || {};
    const campos = respostas.__campos
        || templatePorId(ficha.template_id)?.campos
        || templatePadrao()?.campos
        || MODELO_GERAL;

    await montarCabecalhoImpressao({
        titulo: ficha.template_nome || 'Ficha de Avaliação e Anamnese',
        cliente: appState.currentCliente?.nome || '',
        data: dataHoraBR(ficha.created_at),
    });

    let html = montarCorpoImpressao(campos, respostas);

    if (respostas.mapa_facial_img && respostas.mapa_facial_img.length > 100) {
        html += `<div class="print-section keep-together">
            <h3>Mapeamento</h3>
            <div class="print-map-container">
                <img src="${respostas.mapa_facial_img}" alt="Mapa" style="max-height:300px; max-width:100%; display:block; margin:0 auto;">
            </div>
        </div>`;
    }

    const anexos = Array.isArray(ficha.anexos) ? ficha.anexos : [];
    if (anexos.length) {
        html += `<div class="print-section"><h3>Anexos</h3><ul>` +
            anexos.map(a => `<li>${esc(a.nome)} — enviado em ${dataBR(a.enviado_em)}</li>`).join('') +
            '</ul></div>';
    }

    html += blocoAssinatura(ficha.assinatura);
    document.getElementById('printBodyDinamico').innerHTML = html;
    dispararImpressao();
};

// Imprime a ficha vazia para a profissional preencher à mão
window.imprimirModeloEmBranco = async function(templateId) {
    const t = templatePorId(templateId) || { nome: 'Ficha de Anamnese', campos: camposEditor };
    const campos = t.campos || [];
    if (!campos.length) { showToast('Este modelo não tem campos.', 'warning'); return; }

    await montarCabecalhoImpressao({
        titulo: t.nome,
        cliente: '_______________________________________',
        data: '______ / ______ / __________',
    });

    const html = montarCorpoImpressao(campos, null) + blocoAssinatura(null);
    document.getElementById('printBodyDinamico').innerHTML = html;
    dispararImpressao();
};

// Botão do editor: imprime em branco o que está sendo editado (inclui alterações não salvas)
window.imprimirEditorEmBranco = async function() {
    if (!camposEditor.length) { showToast('Adicione campos ao modelo primeiro.', 'warning'); return; }
    const nome = document.getElementById('nomeModeloEditor')?.value.trim() || 'Ficha de Anamnese';

    await montarCabecalhoImpressao({
        titulo: nome,
        cliente: '_______________________________________',
        data: '______ / ______ / __________',
    });

    document.getElementById('printBodyDinamico').innerHTML =
        montarCorpoImpressao(camposEditor, null) + blocoAssinatura(null);
    dispararImpressao();
};

// Botão dentro da ficha aberta: imprime o que está na tela
window.imprimirFichaAberta = async function() {
    const respostas = coletarRespostas();
    await montarCabecalhoImpressao({
        titulo: document.getElementById('nomeModeloFicha').textContent || 'Ficha de Anamnese',
        cliente: appState.currentCliente?.nome || '',
        data: dataHoraBR(new Date()),
    });
    let html = montarCorpoImpressao(camposAtuais, respostas);
    if (canvasTemDesenho(mapPad)) {
        html += `<div class="print-section keep-together"><h3>Mapeamento</h3>
            <div class="print-map-container"><img src="${mapPad.canvas.toDataURL('image/png')}" style="max-height:300px; max-width:100%; display:block; margin:0 auto;"></div></div>`;
    }
    html += blocoAssinatura(canvasTemDesenho(sigPad) ? sigPad.canvas.toDataURL('image/png') : null);
    document.getElementById('printBodyDinamico').innerHTML = html;
    dispararImpressao();
};

// ============================================================================
// EDITOR DE MODELOS
// ============================================================================

let camposEditor = [];
let modeloEditandoId = null;
let modeloEditandoNome = '';

window.abrirEditorTemplate = async function(templateId = null) {
    try {
        const templates = await carregarTemplates({ force: true });
        const alvo = templateId ? templatePorId(templateId) : (templateAtual || templatePadrao());
        if (!alvo) { showToast('Nenhum modelo disponível.', 'error'); return; }

        selecionarModeloNoEditor(alvo);
        document.getElementById('modalEditorTemplate').classList.add('active');
        document.getElementById('overlay').classList.add('active');
        renderizarSeletorModelos(templates);
    } catch (err) {
        console.error(err);
        showToast('Erro ao abrir os modelos.', 'error');
    }
};

// Fecha o editor devolvendo o overlay para o modal que estava por baixo
window.fecharEditorModelos = function() {
    fecharModalEmpilhado('modalEditorTemplate', ['modalAnamnese', 'modalFichasCliente', 'modalDetalhesCliente']);
};

function selecionarModeloNoEditor(t) {
    modeloEditandoId   = t.id;
    modeloEditandoNome = t.nome;
    camposEditor = JSON.parse(JSON.stringify(t.campos || []));
    document.getElementById('nomeModeloEditor').value = t.nome;
    document.getElementById('checkModeloPadrao').checked = !!t.is_padrao;
    renderizarListaEditor();
}

function renderizarSeletorModelos(templates) {
    const sel = document.getElementById('seletorModeloEditor');
    if (!sel) return;
    sel.innerHTML = templates.map(t =>
        `<option value="${t.id}" ${t.id === modeloEditandoId ? 'selected' : ''}>${esc(t.nome)}${t.is_padrao ? ' (padrão)' : ''}</option>`
    ).join('');
}

window.trocarModeloEditor = async function(id) {
    if (temAlteracoesNaoSalvas() && !confirm('As alterações não salvas neste modelo serão perdidas. Continuar?')) {
        renderizarSeletorModelos(listaTemplates);
        return;
    }
    const t = templatePorId(id);
    if (t) selecionarModeloNoEditor(t);
};

function temAlteracoesNaoSalvas() {
    const original = templatePorId(modeloEditandoId);
    if (!original) return camposEditor.length > 0;
    return JSON.stringify(original.campos || []) !== JSON.stringify(camposEditor)
        || (original.nome !== document.getElementById('nomeModeloEditor').value.trim());
}

window.novoModelo = async function() {
    const opcoes = MODELOS_PRONTOS.map((m, i) => `${i + 1}) ${m.nome} — ${m.descricao}`).join('\n');
    const escolha = prompt(`Qual modelo pronto quer usar como base?\n\n${opcoes}\n\nDigite o número:`, '1');
    if (escolha === null) return;

    const base = MODELOS_PRONTOS[parseInt(escolha, 10) - 1];
    if (!base) { showToast('Opção inválida.', 'warning'); return; }

    const nome = prompt('Nome do novo modelo (ex: "Botox", "Peeling Facial"):', base.nome === 'Modelo em branco' ? '' : base.nome);
    if (!nome || !nome.trim()) return;

    try {
        const { data: { user } } = await _supabase.auth.getUser();
        const { data, error } = await _supabase.from('anamnese_templates').insert({
            user_id: user.id,
            nome: nome.trim(),
            campos: JSON.parse(JSON.stringify(base.campos)),
            ordem: listaTemplates.length,
        }).select().single();

        if (error) {
            if (error.code === '23505') { showToast('Já existe um modelo com esse nome.', 'warning'); return; }
            throw error;
        }

        await carregarTemplates({ force: true });
        selecionarModeloNoEditor(data);
        renderizarSeletorModelos(listaTemplates);
        showToast(`Modelo "${data.nome}" criado!`, 'success');
    } catch (err) {
        console.error(err);
        showToast('Erro ao criar modelo: ' + (err.message || ''), 'error');
    }
};

window.duplicarModelo = async function() {
    const nome = prompt('Nome da cópia:', `${modeloEditandoNome} (cópia)`);
    if (!nome || !nome.trim()) return;
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        const { data, error } = await _supabase.from('anamnese_templates').insert({
            user_id: user.id,
            nome: nome.trim(),
            campos: JSON.parse(JSON.stringify(camposEditor)),
            ordem: listaTemplates.length,
        }).select().single();
        if (error) {
            if (error.code === '23505') { showToast('Já existe um modelo com esse nome.', 'warning'); return; }
            throw error;
        }
        await carregarTemplates({ force: true });
        selecionarModeloNoEditor(data);
        renderizarSeletorModelos(listaTemplates);
        showToast('Modelo duplicado!', 'success');
    } catch (err) {
        console.error(err);
        showToast('Erro ao duplicar modelo.', 'error');
    }
};

window.excluirModelo = async function() {
    if (listaTemplates.length <= 1) { showToast('Você precisa ter ao menos um modelo.', 'warning'); return; }
    if (!confirm(`Excluir o modelo "${modeloEditandoNome}"?\n\nAs fichas já preenchidas com ele continuam salvas.`)) return;

    try {
        const { error } = await _supabase.from('anamnese_templates').delete().eq('id', modeloEditandoId);
        if (error) throw error;
        await carregarTemplates({ force: true });
        selecionarModeloNoEditor(templatePadrao());
        renderizarSeletorModelos(listaTemplates);
        showToast('Modelo excluído.', 'success');
    } catch (err) {
        console.error(err);
        showToast('Erro ao excluir modelo.', 'error');
    }
};

// ─── EDIÇÃO DOS CAMPOS ──────────────────────────────────────────────────────

function renderizarListaEditor() {
    const lista = document.getElementById('listaEditorCampos');
    if (!lista) return;

    if (camposEditor.length === 0) {
        lista.innerHTML = '<p style="color:#666; text-align:center; padding:14px;">Nenhum campo ainda. Adicione o primeiro abaixo — comece por um <strong>Tópico</strong> (ex: "Dados Pessoais").</p>';
        return;
    }

    const opcoesTipo = (atual) => Object.entries(TIPOS_CAMPO)
        .map(([k, v]) => `<option value="${k}" ${k === atual ? 'selected' : ''}>${v.nome}</option>`).join('');

    lista.innerHTML = camposEditor.map((campo, idx) => {
        const meta = TIPOS_CAMPO[campo.tipo] || { nome: campo.tipo, cor: '#555' };
        const ehTitulo = campo.tipo === 'titulo';

        let extra = '';
        if (campo.tipo === 'checkbox_texto') {
            extra = `<div class="editor-campo-extra">
                <label>Pergunta que aparece ao marcar "sim":</label>
                <input type="text" value="${esc(campo.labelCondicional || 'Se sim, quais?')}"
                       onchange="camposEditor[${idx}].labelCondicional = this.value"
                       placeholder="Ex: Quais medicamentos?">
            </div>`;
        } else if (campo.tipo === 'select') {
            extra = `<div class="editor-campo-extra">
                <label>Opções (separadas por vírgula):</label>
                <input type="text" value="${esc((campo.opcoes || []).join(', '))}"
                       onchange="definirOpcoesCampo(${idx}, this.value)"
                       placeholder="Ex: Seca, Oleosa, Mista">
            </div>`;
        }

        return `<div class="editor-campo-row ${ehTitulo ? 'is-topico' : ''}">
            <div class="editor-campo-linha">
                <div class="editor-campo-mover">
                    <button type="button" onclick="moverCampoEditor(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>▲</button>
                    <button type="button" onclick="moverCampoEditor(${idx}, 1)" ${idx === camposEditor.length - 1 ? 'disabled' : ''}>▼</button>
                </div>
                <select class="editor-campo-tipo" style="border-color:${meta.cor}66; color:${meta.cor}"
                        onchange="mudarTipoCampoEditor(${idx}, this.value)">${opcoesTipo(campo.tipo)}</select>
                <input type="text" class="editor-campo-label" value="${esc(campo.label)}"
                       onchange="camposEditor[${idx}].label = this.value"
                       placeholder="${ehTitulo ? 'Nome do tópico' : 'Pergunta'}">
                <button type="button" class="editor-campo-del" onclick="removerCampoEditor(${idx})" title="Remover">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            ${extra}
        </div>`;
    }).join('');
}

window.definirOpcoesCampo = function(idx, valor) {
    camposEditor[idx].opcoes = valor.split(',').map(o => o.trim()).filter(Boolean);
};

window.mudarTipoCampoEditor = function(idx, tipo) {
    camposEditor[idx].tipo = tipo;
    if (tipo === 'checkbox_texto' && !camposEditor[idx].labelCondicional) camposEditor[idx].labelCondicional = 'Se sim, quais?';
    if (tipo === 'select' && !camposEditor[idx].opcoes) camposEditor[idx].opcoes = ['Opção 1', 'Opção 2'];
    renderizarListaEditor();
};

window.adicionarCampoEditor = function() {
    const tipo  = document.getElementById('novoTipoCampo').value;
    const label = document.getElementById('novoLabelCampo').value.trim();
    if (!label) { showToast('Digite o nome do campo.', 'warning'); return; }

    const campo = { id: novoId(tipo), tipo, label };
    if (tipo === 'checkbox_texto') campo.labelCondicional = 'Se sim, quais?';
    if (tipo === 'select') campo.opcoes = ['Opção 1', 'Opção 2'];

    camposEditor.push(campo);
    document.getElementById('novoLabelCampo').value = '';
    document.getElementById('novoLabelCampo').focus();
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

window.salvarTemplate = async function() {
    const nome = document.getElementById('nomeModeloEditor').value.trim();
    if (!nome) { showToast('Dê um nome ao modelo.', 'warning'); return; }

    const virarPadrao = document.getElementById('checkModeloPadrao').checked;

    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado');

        if (virarPadrao) {
            await _supabase.from('anamnese_templates')
                .update({ is_padrao: false }).eq('user_id', user.id).neq('id', modeloEditandoId);
        }

        const { error } = await _supabase.from('anamnese_templates').update({
            nome,
            campos: camposEditor,
            is_padrao: virarPadrao,
            updated_at: new Date().toISOString(),
        }).eq('id', modeloEditandoId);

        if (error) {
            if (error.code === '23505') { showToast('Já existe um modelo com esse nome.', 'warning'); return; }
            throw error;
        }

        await carregarTemplates({ force: true });
        modeloEditandoNome = nome;
        renderizarSeletorModelos(listaTemplates);
        showToast('Modelo salvo com sucesso!', 'success');

        // Ficha aberta usando este modelo: aplica os campos novos sem perder o que já foi digitado
        const fichaAberta = document.getElementById('modalAnamnese')?.classList.contains('active');
        if (fichaAberta && templateAtual?.id === modeloEditandoId) {
            const respostas = coletarRespostas();
            templateAtual = templatePorId(modeloEditandoId);
            camposAtuais  = JSON.parse(JSON.stringify(camposEditor));
            document.getElementById('nomeModeloFicha').textContent = nome;
            renderizarFormAnamnese(camposAtuais, respostas);
        }

        if (document.getElementById('modalFichasCliente')?.classList.contains('active')) {
            renderizarListaModelos(listaTemplates);
        }
        fecharEditorModelos();
    } catch (err) {
        console.error(err);
        showToast('Erro ao salvar modelo: ' + err.message, 'error');
    }
};

window.aplicarModeloPronto = function() {
    const opcoes = MODELOS_PRONTOS.map((m, i) => `${i + 1}) ${m.nome} — ${m.descricao}`).join('\n');
    const escolha = prompt(`Substituir os campos deste modelo por um modelo pronto?\n\n${opcoes}\n\nDigite o número:`, '1');
    if (escolha === null) return;
    const base = MODELOS_PRONTOS[parseInt(escolha, 10) - 1];
    if (!base) { showToast('Opção inválida.', 'warning'); return; }
    if (!confirm(`Os campos atuais serão substituídos pelos de "${base.nome}". Continuar?`)) return;
    camposEditor = JSON.parse(JSON.stringify(base.campos));
    renderizarListaEditor();
    showToast('Campos aplicados — revise e salve.', 'success');
};

// ============================================================================
// IMPORTAR / EXPORTAR MODELO
// ============================================================================

// HTML do modelo em branco, pronto para PDF/Word (mesmo layout da impressão)
async function gerarHtmlModelo(nomeModelo, campos) {
    const perfil = await getPerfil();
    const corpo  = montarCorpoImpressao(campos, null);

    return `<div class="doc-modelo" style="font-family:Arial,Helvetica,sans-serif; color:#000; font-size:11pt; line-height:1.45;">
    <style>
        .doc-modelo h1 { font-size:19pt; text-align:center; margin:0 0 4px; text-transform:uppercase; }
        .doc-modelo .sub { text-align:center; font-style:italic; margin:0 0 10px; }
        .doc-modelo .meta { border-top:1px solid #999; border-bottom:1px solid #999; padding:7px 0; margin-bottom:16px; font-size:10.5pt; }
        .doc-modelo .print-section { margin-bottom:16px; page-break-inside:avoid; }
        .doc-modelo .print-section h3 { font-size:12pt; text-transform:uppercase; background:#eee; padding:4px 8px; border-left:4px solid #333; margin:0 0 8px; }
        .doc-modelo .print-campo { margin:0 0 7px; }
        .doc-modelo .print-linha { border-bottom:1px solid #888; height:17px; margin:5px 0; }
        .doc-modelo .print-linha-inline { display:inline-block; border-bottom:1px solid #888; width:58%; height:13px; }
        .doc-modelo .print-grid div { display:inline-block; min-width:47%; margin:3px 0; }
        .doc-modelo .print-check { font-family:"Courier New",monospace; font-size:13pt; font-weight:bold; }
        .doc-modelo .print-condicional { margin:7px 0; }
        .doc-modelo .print-condicional-detalhe { margin-left:22px; font-size:10pt; }
        .doc-modelo .print-opcao { margin-right:14px; white-space:nowrap; }
        .doc-modelo .legal-text-small { font-size:9pt; font-style:italic; }
    </style>
    <h1>${esc(perfil.nome || 'Estética Premium')}</h1>
    <p class="sub">${esc(nomeModelo)}</p>
    <div class="meta">
        <strong>Cliente:</strong> ______________________________________________
        &nbsp;&nbsp;<strong>Data:</strong> ______ / ______ / __________
    </div>
    ${corpo}
    ${blocoAssinatura(null)}
</div>`;
}

function camposParaExportar() {
    return (camposEditor && camposEditor.length) ? camposEditor : (templatePadrao()?.campos || []);
}

window.exportarModeloPDF = async function() {
    const campos = camposParaExportar();
    if (!campos.length) { showToast('Nenhum campo no modelo para exportar.', 'warning'); return; }

    const nome = document.getElementById('nomeModeloEditor')?.value.trim() || 'Ficha de Anamnese';
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:fixed; left:-9999px; top:0; width:190mm; background:#fff;';
    wrapper.innerHTML = await gerarHtmlModelo(nome, campos);
    document.body.appendChild(wrapper);

    showToast('Gerando PDF...', 'info');
    try {
        await html2pdf().from(wrapper).set({
            filename: `${nome.replace(/[^\w\sÀ-ú-]/g, '')}.pdf`,
            margin: [12, 10, 12, 10],
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'], avoid: '.print-section' },
        }).save();
        showToast('PDF exportado!', 'success');
    } catch (err) {
        console.error(err);
        showToast('Erro ao gerar PDF.', 'error');
    } finally {
        wrapper.remove();
    }
};

window.exportarModeloWord = async function() {
    const campos = camposParaExportar();
    if (!campos.length) { showToast('Nenhum campo no modelo para exportar.', 'warning'); return; }

    const nome  = document.getElementById('nomeModeloEditor')?.value.trim() || 'Ficha de Anamnese';
    const corpo = await gerarHtmlModelo(nome, campos);

    const doc = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>${esc(nome)}</title>
<style>@page { size: A4; margin: 2cm; } body { font-family: Arial, sans-serif; }</style>
</head><body>${corpo}</body></html>`;

    baixarArquivo(new Blob(['﻿', doc], { type: 'application/msword' }), `${nome}.doc`);
    showToast('Word exportado!', 'success');
};

// Exportação fiel: permite reimportar sem perder nada (backup / compartilhar)
window.exportarModeloJSON = function() {
    const campos = camposParaExportar();
    if (!campos.length) { showToast('Nenhum campo no modelo para exportar.', 'warning'); return; }

    const nome = document.getElementById('nomeModeloEditor')?.value.trim() || 'Ficha de Anamnese';
    const pacote = { formato: 'anamnese-modelo', versao: 1, nome, campos, exportado_em: new Date().toISOString() };

    baixarArquivo(new Blob([JSON.stringify(pacote, null, 2)], { type: 'application/json' }), `${nome}.json`);
    showToast('Backup do modelo exportado!', 'success');
};

function baixarArquivo(blob, nomeArquivo) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo.replace(/[\\/:*?"<>|]/g, '-');
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── LEITURA DE ARQUIVOS ────────────────────────────────────────────────────

// pdf.js devolve fragmentos soltos; reagrupa por posição vertical para
// reconstruir as linhas reais do documento.
async function extrairTextoPdf(arrayBuffer) {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const linhas = [];

    for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const porLinha = [];

        content.items.forEach(item => {
            if (!item.str || !item.str.trim()) return;
            const y = item.transform[5];
            const x = item.transform[4];
            let grupo = porLinha.find(g => Math.abs(g.y - y) <= 3);
            if (!grupo) { grupo = { y, itens: [] }; porLinha.push(grupo); }
            grupo.itens.push({ x, str: item.str });
        });

        porLinha
            .sort((a, b) => b.y - a.y)
            .forEach(g => {
                const texto = g.itens.sort((a, b) => a.x - b.x).map(i => i.str).join(' ')
                    .replace(/\s+/g, ' ').trim();
                if (texto) linhas.push(texto);
            });
    }
    return linhas.join('\n');
}

async function lerArquivoComoTexto(file) {
    const nome = file.name.toLowerCase();

    if (nome.endsWith('.pdf')) {
        if (typeof pdfjsLib === 'undefined') throw new Error('Leitor de PDF não carregou.');
        return await extrairTextoPdf(await file.arrayBuffer());
    }
    if (nome.endsWith('.docx')) {
        if (typeof mammoth === 'undefined') throw new Error('Leitor de Word não carregou.');
        const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        return r.value || '';
    }
    if (nome.endsWith('.txt') || nome.endsWith('.csv')) {
        return await file.text();
    }
    throw new Error('Formato não suportado. Use .json, .pdf, .docx ou .txt.');
}

// ─── HEURÍSTICA DE CONVERSÃO ────────────────────────────────────────────────

const SECOES_CONHECIDAS = /^(dados\s+pessoais|identifica[çc][ãa]o|dados\s+cadastrais|anamnese|hist[óo]rico|hist[óo]rico\s+de\s+sa[úu]de|sa[úu]de|h[áa]bitos|estilo\s+de\s+vida|queixa|avalia[çc][ãa]o|exame\s+f[íi]sico|procedimento|contraindica[çc][õo]es|observa[çc][õo]es|termo|medidas|objetivo)/i;

const LIXO = /^(p[áa]gina\s*\d+|\d+\s*\/\s*\d+|[-_.=•*\s]+|\d+)$/i;

function limparLinha(linha) {
    return linha
        .replace(/^[\s\-•*·▪o]+/, '')          // marcadores de lista
        .replace(/[_.]{3,}/g, ' ')             // espaços de preenchimento (___ ou ...)
        .replace(/\s+[/\\|]\s+/g, ' ')         // sobras de "____/____/____"
        .replace(/\s{2,}/g, ' ')
        .replace(/[\s:/.\-]+$/, '')            // pontuação solta no fim
        .trim();
}

function converterTextoEmCampos(texto) {
    const brutas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const campos = [];
    let anterior = '';

    const marcadorCheck = /(\[\s*[xX]?\s*\]|☐|☒|◻|✓|\(\s*[xX]?\s*\))/;
    const simNao        = /\bsim\s*[\/(]?\s*n[ãa]o\b|\bn[ãa]o\s*[\/(]?\s*sim\b/i;
    const pedeDetalhe   = /\b(se\s+sim|qual|quais|quando|especifi(que|car)|descreva\s+qual)\b/i;

    brutas.forEach(bruta => {
        if (LIXO.test(bruta)) return;

        let linha = limparLinha(bruta);
        if (linha.length < 2 || linha.length > 220) return;
        if (linha.toLowerCase() === anterior.toLowerCase()) return; // repetição de cabeçalho
        anterior = linha;

        // "Alergia a medicamento? Se sim, quais?" → checkbox + campo de texto
        if (pedeDetalhe.test(linha) && (marcadorCheck.test(bruta) || simNao.test(bruta) || /\?/.test(linha))) {
            const partes = linha.split(pedeDetalhe);
            const pergunta = limparLinha(partes[0] || linha)
                .replace(marcadorCheck, '').replace(simNao, '').replace(/[?:,.\-\s]+$/, '').trim();
            const condicional = limparLinha(linha.slice((partes[0] || '').length)).replace(/^[,\-:\s]+/, '').trim();

            if (pergunta.length >= 3) {
                campos.push({
                    id: novoId('cond'),
                    tipo: 'checkbox_texto',
                    label: pergunta,
                    labelCondicional: condicional ? condicional.charAt(0).toUpperCase() + condicional.slice(1) : 'Se sim, quais?',
                });
                return;
            }
        }

        // Marcador de caixa ou "( ) Sim ( ) Não" → checkbox
        if (marcadorCheck.test(bruta) || simNao.test(bruta)) {
            const label = limparLinha(linha.replace(new RegExp(marcadorCheck, 'g'), '').replace(simNao, ''))
                .replace(/[?:.\-\s]+$/, '').trim();
            if (label.length >= 3) {
                campos.push({ id: novoId('check'), tipo: 'checkbox', label });
                return;
            }
        }

        const semPontuacao = linha.replace(/[:?]+$/, '').trim();

        // Tópicos: nomes de seção conhecidos ou linha inteira em maiúsculas
        const ehMaiuscula = semPontuacao === semPontuacao.toUpperCase()
            && /[A-ZÀ-Ú]/.test(semPontuacao) && semPontuacao.length <= 45;
        if (SECOES_CONHECIDAS.test(semPontuacao) && semPontuacao.length <= 45 || ehMaiuscula) {
            campos.push({ id: novoId('titulo'), tipo: 'titulo', label: capitalizar(semPontuacao) });
            return;
        }

        if (semPontuacao.length < 2) return;

        // Datas
        if (/\b(data\s+de\s+nascimento|nascimento|data)\b/i.test(semPontuacao) && semPontuacao.length <= 40) {
            campos.push({ id: novoId('data'), tipo: 'data', label: capitalizar(semPontuacao) });
            return;
        }

        // Perguntas longas ou pedidos de descrição → texto longo
        const tipo = (semPontuacao.length > 55 || /\b(descreva|relate|explique|detalhe|observa[çc][õo]es|queixa)\b/i.test(semPontuacao))
            ? 'textarea' : 'texto';

        campos.push({ id: novoId(tipo), tipo, label: capitalizar(semPontuacao) });
    });

    return campos;
}

function capitalizar(txt) {
    if (!txt) return txt;
    // Mantém como está se já tiver mistura de maiúscula/minúscula
    if (txt !== txt.toUpperCase()) return txt;
    return txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase();
}

window.importarModelo = async function(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;

    showToast('Lendo documento...', 'info');

    try {
        let sugestoes;
        let nomeSugerido = null;

        if (file.name.toLowerCase().endsWith('.json')) {
            const pacote = JSON.parse(await file.text());
            const campos = Array.isArray(pacote) ? pacote : pacote.campos;
            if (!Array.isArray(campos)) throw new Error('Arquivo JSON não é um modelo de anamnese válido.');
            sugestoes = campos
                .filter(c => c && c.label && TIPOS_CAMPO[c.tipo])
                .map(c => ({ ...c, id: c.id || novoId(c.tipo) }));
            nomeSugerido = pacote.nome || null;
        } else {
            const texto = await lerArquivoComoTexto(file);
            sugestoes = converterTextoEmCampos(texto);
        }

        if (!sugestoes.length) {
            showToast('Nenhum campo reconhecido no documento.', 'warning');
            return;
        }

        const resumo = Object.entries(
            sugestoes.reduce((acc, c) => { acc[TIPOS_CAMPO[c.tipo]?.nome || c.tipo] = (acc[TIPOS_CAMPO[c.tipo]?.nome || c.tipo] || 0) + 1; return acc; }, {})
        ).map(([k, v]) => `  • ${v} ${k}`).join('\n');

        let acao = 'substituir';
        if (camposEditor.length > 0) {
            acao = confirm(
                `Encontramos ${sugestoes.length} campo(s):\n\n${resumo}\n\n` +
                `OK = ADICIONAR ao final do modelo atual\n` +
                `Cancelar = SUBSTITUIR todos os campos atuais`
            ) ? 'adicionar' : 'substituir';
        }

        camposEditor = acao === 'adicionar' ? camposEditor.concat(sugestoes) : sugestoes;

        if (nomeSugerido && acao === 'substituir') {
            const inputNome = document.getElementById('nomeModeloEditor');
            if (inputNome && confirm(`Renomear este modelo para "${nomeSugerido}"?`)) inputNome.value = nomeSugerido;
        }

        renderizarListaEditor();
        showToast(`${sugestoes.length} campo(s) importados — confira os tipos e salve.`, 'success');
    } catch (err) {
        console.error('Erro ao importar modelo:', err);
        showToast('Erro ao ler o documento: ' + (err.message || ''), 'error');
    }
};
