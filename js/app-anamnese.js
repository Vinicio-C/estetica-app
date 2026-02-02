// ========================================
// ANAMNESE: TEXTO, ASSINATURA E MAPA FACIAL
// ========================================

// Variáveis globais para os canvas
let sigPad = { canvas: null, ctx: null, isDrawing: false };
let mapPad = { canvas: null, ctx: null, isDrawing: false, color: '#000000' };

document.addEventListener('DOMContentLoaded', () => {
    // 1. Configurar Assinatura
    setupCanvas('signatureCanvas', sigPad);

    // 2. Configurar Mapa Facial
    setupCanvas('mapaFacialCanvas', mapPad);

    // 3. Form Submit
    const form = document.getElementById('formAnamnese');
    if (form) form.addEventListener('submit', salvarAnamnese);
});

// --- Configuração Genérica de Canvas (Funciona pra assinatura e mapa) ---
function setupCanvas(id, padObj) {
    const canvas = document.getElementById(id);
    if (!canvas) return;

    padObj.canvas = canvas;
    padObj.ctx = canvas.getContext('2d');
    
    // Ajuste visual
    padObj.ctx.lineWidth = 2;
    padObj.ctx.lineCap = 'round';
    padObj.ctx.strokeStyle = padObj.color || '#000000';

    // Ajuste de Resolução (Evita ficar borrado em telas Retina/Celular)
    function resizeCanvas() {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        // Salva o desenho atual antes de redimensionar
        const imgData = padObj.ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        padObj.ctx.scale(ratio, ratio);
        
        // Se quiser restaurar (opcional, geralmente limpa no resize)
        // padObj.ctx.putImageData(imgData, 0, 0); 
        padObj.ctx.lineWidth = 2;
        padObj.ctx.lineCap = 'round';
        padObj.ctx.strokeStyle = padObj.color || '#000000';
    }
    // Chama resize uma vez (pode adicionar no window.resize se quiser)
    setTimeout(resizeCanvas, 500); // Delay pra garantir que o modal abriu

    // Eventos Mouse/Touch
    const start = (e) => {
        padObj.isDrawing = true;
        padObj.ctx.beginPath();
        draw(e);
    };
    
    const end = () => {
        padObj.isDrawing = false;
        padObj.ctx.beginPath();
    };

    const draw = (e) => {
        if (!padObj.isDrawing) return;
        e.preventDefault(); // Impede scroll

        // Coordenadas relativas ao canvas
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches ? e.touches[0].clientX : 0);
        const clientY = e.clientY || (e.touches ? e.touches[0].clientY : 0);
        
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        padObj.ctx.lineTo(x, y);
        padObj.ctx.stroke();
        padObj.ctx.beginPath();
        padObj.ctx.moveTo(x, y);
    };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseout', end);

    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', end);
}

// --- Funções Específicas ---

function setCorCaneta(cor, elemento) {
    if (mapPad.ctx) {
        mapPad.color = cor;
        mapPad.ctx.strokeStyle = cor;
    }
    // Atualiza visual dos botões
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
    elemento.classList.add('active');
}

function limparMapaFacial() {
    if (mapPad.canvas && mapPad.ctx) {
        mapPad.ctx.clearRect(0, 0, mapPad.canvas.width, mapPad.canvas.height);
    }
}

function limparAssinatura() {
    if (sigPad.canvas && sigPad.ctx) {
        sigPad.ctx.clearRect(0, 0, sigPad.canvas.width, sigPad.canvas.height);
    }
}

function trocarTabAnamnese(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.anamnese-tab-content').forEach(c => c.classList.remove('active'));

    // Botão que foi clicado (hack simples)
    const btnIndex = tab === 'texto' ? 0 : 1;
    document.querySelectorAll('.anamnese-tabs .tab-btn')[btnIndex].classList.add('active');

    // Conteúdo
    if (tab === 'texto') document.getElementById('tabAnamneseTexto').classList.add('active');
    if (tab === 'desenho') document.getElementById('tabAnamneseDesenho').classList.add('active');
}

function abrirAnamnese() {
    if (!appState.currentCliente) {
        showToast('Selecione um cliente primeiro.', 'warning');
        return;
    }
    
    document.getElementById('formAnamnese').reset();
    limparAssinatura();
    limparMapaFacial();
    trocarTabAnamnese('texto'); // Começa sempre no texto
    
    document.getElementById('modalAnamnese').classList.add('active');
    document.getElementById('overlay').classList.add('active');
}

async function salvarAnamnese(e) {
    e.preventDefault();
    if (!appState.currentCliente) return;

    // 1. Dados Texto
    const formData = new FormData(e.target);
    const respostas = Object.fromEntries(formData.entries());
    document.querySelectorAll('#formAnamnese input[type="checkbox"]').forEach(chk => {
        respostas[chk.name] = chk.checked;
    });

    // 2. Imagens (Base64)
    const assinaturaImg = sigPad.canvas.toDataURL();
    const mapaImg = mapPad.canvas.toDataURL(); // Salva o desenho do rosto

    // Adiciona o mapa ao JSON de respostas pra salvar tudo junto
    respostas['mapa_facial_img'] = mapaImg;

    try {
        const { error } = await _supabase.from('anamneses').insert({
            cliente_id: appState.currentCliente.id,
            respostas: respostas, // O mapa vai aqui dentro
            assinatura: assinaturaImg,
            profissional_nome: 'Dra. Estética'
        });

        if (error) throw error;

        showToast('Ficha salva com sucesso!', 'success');
        fecharModal('modalAnamnese');

    } catch (error) {
        console.error(error);
        showToast('Erro ao salvar ficha.', 'error');
    }
}

function imprimirAnamnese() {
    window.print();
}