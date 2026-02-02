// ========================================
// ANAMNESE: VERSÃO TABLET ROBUSTA v2
// ========================================

let sigPad = { canvas: null, ctx: null, isDrawing: false };
let mapPad = { canvas: null, ctx: null, isDrawing: false, color: '#000000' };

document.addEventListener('DOMContentLoaded', () => {
    setupCanvas('signatureCanvas', sigPad);
    setupCanvas('mapaFacialCanvas', mapPad);

    const form = document.getElementById('formAnamnese');
    if (form) form.addEventListener('submit', salvarAnamnese);
});

function setupCanvas(id, padObj) {
    const canvas = document.getElementById(id);
    if (!canvas) return;

    padObj.canvas = canvas;
    padObj.ctx = canvas.getContext('2d');

    // --- FUNÇÃO MÁGICA DE REDIMENSIONAMENTO ---
    // Ajusta a resolução interna do canvas para bater com o tamanho da tela
    function fixResolution() {
        const rect = canvas.getBoundingClientRect();
        // Se a tela for retina/alta resolução, aumenta os pixels
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        
        // Só redimensiona se mudou o tamanho, pra não limpar o desenho a toda hora
        if (canvas.width !== rect.width * ratio || canvas.height !== rect.height * ratio) {
            canvas.width = rect.width * ratio;
            canvas.height = rect.height * ratio;
            padObj.ctx.scale(ratio, ratio);
        }
        
        // IMPORTANTE: Resetar estilos após redimensionar
        padObj.ctx.lineWidth = 3; // Traço mais grosso pro tablet
        padObj.ctx.lineCap = 'round';
        padObj.ctx.lineJoin = 'round';
        padObj.ctx.strokeStyle = padObj.color || '#000000';
    }

    // Chama o fix logo de cara
    setTimeout(fixResolution, 500);

    // --- FUNÇÕES DE DESENHO ---
    
    // Pega a posição exata do dedo/mouse relativa ao canvas
    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    function startDrawing(e) {
        e.preventDefault(); // Mata o scroll
        fixResolution(); // Garante que o canvas está pronto e com tinta
        
        padObj.isDrawing = true;
        const pos = getPos(e);
        
        padObj.ctx.beginPath();
        padObj.ctx.moveTo(pos.x, pos.y);
        padObj.ctx.lineTo(pos.x, pos.y); // Ponto inicial
        padObj.ctx.stroke();
    }

    function draw(e) {
        if (!padObj.isDrawing) return;
        e.preventDefault(); // Mata o scroll

        const pos = getPos(e);
        padObj.ctx.lineTo(pos.x, pos.y);
        padObj.ctx.stroke();
    }

    function stopDrawing(e) {
        if (padObj.isDrawing) {
            e.preventDefault();
            padObj.isDrawing = false;
            padObj.ctx.closePath();
        }
    }

    // --- EVENTOS (Híbridos para garantir compatibilidade) ---
    
    // Mouse
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    // Touch (Tablet/Celular)
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
}

// --- OUTRAS FUNÇÕES (CORES, LIMPEZA, ABAS) ---

function setCorCaneta(cor, elemento) {
    if (mapPad.ctx) {
        mapPad.color = cor;
        mapPad.ctx.strokeStyle = cor;
    }
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
    if(elemento) elemento.classList.add('active');
}

function limparMapaFacial() {
    if (mapPad.canvas && mapPad.ctx) {
        // Limpa usando coordenadas gigantes pra garantir
        mapPad.ctx.clearRect(0, 0, 9999, 9999);
    }
}

function limparAssinatura() {
    if (sigPad.canvas && sigPad.ctx) {
        sigPad.ctx.clearRect(0, 0, 9999, 9999);
    }
}

function trocarTabAnamnese(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.anamnese-tab-content').forEach(c => c.classList.remove('active'));

    const btnIndex = tab === 'texto' ? 0 : 1;
    document.querySelectorAll('.anamnese-tabs .tab-btn')[btnIndex].classList.add('active');

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
    trocarTabAnamnese('texto');
    
    document.getElementById('modalAnamnese').classList.add('active');
    document.getElementById('overlay').classList.add('active');
}

async function salvarAnamnese(e) {
    e.preventDefault();
    if (!appState.currentCliente) return;

    const formData = new FormData(e.target);
    const respostas = Object.fromEntries(formData.entries());
    
    document.querySelectorAll('#formAnamnese input[type="checkbox"]').forEach(chk => {
        respostas[chk.name] = chk.checked;
    });

    // Salva imagens
    const assinaturaImg = sigPad.canvas.toDataURL();
    const mapaImg = mapPad.canvas.toDataURL();
    respostas['mapa_facial_img'] = mapaImg;

    try {
        const { error } = await _supabase.from('anamneses').insert({
            cliente_id: appState.currentCliente.id,
            respostas: respostas,
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

function imprimirAnamnese() { window.print(); }