// ========================================
// ANAMNESE: SISTEMA DE FICHA ÚNICA (EDITÁVEL)
// ========================================

let sigPad = { canvas: null, ctx: null, isDrawing: false };
let mapPad = { canvas: null, ctx: null, isDrawing: false, color: '#000000' };
let currentFichaId = null; // Guarda o ID se a ficha já existir

document.addEventListener('DOMContentLoaded', () => {
    setupCanvas('signatureCanvas', sigPad);
    setupCanvas('mapaFacialCanvas', mapPad);

    const form = document.getElementById('formAnamnese');
    if (form) form.addEventListener('submit', salvarAnamnese);
});

// --- CONFIGURAÇÃO DOS CANVAS ---
function setupCanvas(id, padObj) {
    const canvas = document.getElementById(id);
    if (!canvas) return;

    padObj.canvas = canvas;
    padObj.ctx = canvas.getContext('2d');

    function fixResolution() {
        const rect = canvas.getBoundingClientRect();
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        if (canvas.width !== rect.width * ratio || canvas.height !== rect.height * ratio) {
            canvas.width = rect.width * ratio;
            canvas.height = rect.height * ratio;
            padObj.ctx.scale(ratio, ratio);
        }
        padObj.ctx.lineWidth = 3;
        padObj.ctx.lineCap = 'round';
        padObj.ctx.lineJoin = 'round';
        padObj.ctx.strokeStyle = padObj.color || '#000000';
    }
    setTimeout(fixResolution, 500);

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        let clientX = e.touches ? e.touches[0].clientX : e.clientX;
        let clientY = e.touches ? e.touches[0].clientY : e.clientY;
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
        if(padObj.isDrawing) {
            e.preventDefault();
            padObj.isDrawing = false;
            padObj.ctx.closePath();
        }
    }

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);
}

// --- FUNÇÕES DE UTILIDADE ---

function setCorCaneta(cor, elemento) {
    if (mapPad.ctx) {
        mapPad.color = cor;
        mapPad.ctx.strokeStyle = cor;
    }
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
    if(elemento) elemento.classList.add('active');
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
    document.querySelectorAll('.anamnese-tabs .tab-btn')[btnIndex].classList.add('active');

    if (tab === 'texto') document.getElementById('tabAnamneseTexto').classList.add('active');
    if (tab === 'desenho') document.getElementById('tabAnamneseDesenho').classList.add('active');
}

// --- ABRIR FICHA (Carrega dados existentes) ---
async function abrirAnamnese() {
    if (!appState.currentCliente) {
        showToast('Selecione um cliente primeiro.', 'warning');
        return;
    }

    // 1. Reseta o formulário visualmente
    document.getElementById('formAnamnese').reset();
    limparAssinatura();
    limparMapaFacial();
    trocarTabAnamnese('texto');
    currentFichaId = null; // Reseta o ID

    // 2. Abre o modal
    document.getElementById('modalAnamnese').classList.add('active');
    document.getElementById('overlay').classList.add('active');

    // 3. Tenta buscar ficha existente no banco
    try {
        const { data, error } = await _supabase
            .from('anamneses')
            .select('*')
            .eq('cliente_id', appState.currentCliente.id)
            .limit(1); // Pega qualquer uma (idealmente a única)

        if (data && data.length > 0) {
            console.log("📂 Ficha encontrada! Carregando dados...");
            preencherFichaNaTela(data[0]);
        } else {
            console.log("🆕 Nenhuma ficha encontrada. Criando nova.");
        }
    } catch (err) {
        console.error("Erro ao carregar ficha:", err);
    }
}

// Função auxiliar para colocar os dados de volta na tela
function preencherFichaNaTela(ficha) {
    currentFichaId = ficha.id; // IMPORTANTE: Guarda o ID para atualizar depois
    const resp = ficha.respostas || {};

    // Inputs de Texto
    const form = document.getElementById('formAnamnese');
    if (resp.medicamentos) form.medicamentos.value = resp.medicamentos;
    if (resp.alergias_obs) form.alergias_obs.value = resp.alergias_obs;
    if (resp.queixa_principal) form.queixa_principal.value = resp.queixa_principal;
    if (resp.home_care) form.home_care.value = resp.home_care;

    // Checkboxes
    const keys = ['saude_gestante', 'saude_cardiaco', 'saude_diabetes', 'saude_alergia', 'saude_oncologico'];
    keys.forEach(k => {
        if (resp[k] === true || resp[k] === 'true') {
            const el = form.querySelector(`input[name="${k}"]`);
            if (el) el.checked = true;
        }
    });

    // Restaurar Desenhos (Canvas)
    // Precisamos criar uma imagem HTML e desenhá-la no canvas
    if (resp.mapa_facial_img) drawImageOnCanvas(mapPad.ctx, resp.mapa_facial_img);
    if (ficha.assinatura) drawImageOnCanvas(sigPad.ctx, ficha.assinatura);
}

function drawImageOnCanvas(ctx, dataUrl) {
    const img = new Image();
    img.onload = function() {
        // Desenha a imagem salva de volta no canvas editável
        // O tamanho 600x500 é uma referência base do canvas
        ctx.drawImage(img, 0, 0, 300, 150); // Ajuste simples para assinatura
        // Nota: Restaurar desenho perfeitamente em canvas responsivo é complexo,
        // mas isso deve carregar o visual básico.
    };
    img.src = dataUrl;
}

// --- SALVAR (Atualiza ou Cria) ---
async function salvarAnamnese(e) {
    e.preventDefault();
    if (!appState.currentCliente) return;

    const formData = new FormData(e.target);
    const respostas = Object.fromEntries(formData.entries());
    
    document.querySelectorAll('#formAnamnese input[type="checkbox"]').forEach(chk => {
        respostas[chk.name] = chk.checked;
    });

    // Captura imagens atuais
    const assinaturaImg = sigPad.canvas.toDataURL();
    const mapaImg = mapPad.canvas.toDataURL();
    respostas['mapa_facial_img'] = mapaImg;

    try {
        let result;
        
        // LÓGICA DE FICHA ÚNICA:
        if (currentFichaId) {
            // SE JÁ EXISTE ID -> UPDATE (ATUALIZAR)
            console.log("🔄 Atualizando ficha existente ID:", currentFichaId);
            result = await _supabase.from('anamneses').update({
                respostas: respostas,
                assinatura: assinaturaImg,
                // created_at geralmente não muda no update, mas você pode ter um updated_at
            }).eq('id', currentFichaId);
        } else {
            // SE NÃO EXISTE -> INSERT (CRIAR NOVA)
            console.log("✨ Criando nova ficha");
            result = await _supabase.from('anamneses').insert({
                cliente_id: appState.currentCliente.id,
                respostas: respostas,
                assinatura: assinaturaImg,
                profissional_nome: 'Dra. Estética'
            });
        }

        if (result.error) throw result.error;

        showToast('Ficha salva com sucesso!', 'success');
        fecharModal('modalAnamnese');

    } catch (error) {
        console.error(error);
        showToast('Erro ao salvar ficha.', 'error');
    }
}

async function buscarEImprimirFicha() {
    if (!appState.currentCliente) {
        showToast('Nenhum cliente selecionado.', 'error');
        return;
    }

    const clienteId = appState.currentCliente.id;
    console.log("🔍 Buscando ficha para impressão...");

    try {
        const { data, error } = await _supabase
            .from('anamneses')
            .select('*')
            .eq('cliente_id', clienteId)
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) throw error;

        if (!data || data.length === 0) {
            alert('Nenhuma ficha salva encontrada. Salve uma ficha primeiro!');
            return;
        }

        const ficha = data[0];
        const resp = ficha.respostas || {};

        // --- PREENCHIMENTO DOS DADOS ---
        document.getElementById('printNomeCliente').textContent = appState.currentCliente.nome;
        
        // Data formatada
        const dataF = ficha.created_at ? new Date(ficha.created_at) : new Date();
        document.getElementById('printDataFicha').textContent = dataF.toLocaleDateString('pt-BR') + ' ' + dataF.toLocaleTimeString('pt-BR').slice(0,5);

        // Checkboxes
        const check = (v) => (v === true || v === 'true') ? '☒' : '☐';
        const txt = (t) => t ? t : '_________________________';

        document.getElementById('checkGestante').textContent = check(resp.saude_gestante);
        document.getElementById('checkCardiaco').textContent = check(resp.saude_cardiaco);
        document.getElementById('checkDiabetes').textContent = check(resp.saude_diabetes);
        document.getElementById('checkAlergia').textContent = check(resp.saude_alergia);
        document.getElementById('checkOnco').textContent = check(resp.saude_oncologico);

        document.getElementById('printMedicamentos').textContent = txt(resp.medicamentos);
        document.getElementById('printAlergias').textContent = txt(resp.alergias_obs);
        document.getElementById('printQueixa').textContent = txt(resp.queixa_principal);
        document.getElementById('printHomeCare').textContent = txt(resp.home_care);

        // Imagens
        const imgMapa = document.getElementById('printMapaImg');
        const imgAss = document.getElementById('printAssinaturaImg');
        
        if (resp.mapa_facial_img && resp.mapa_facial_img.length > 100) {
            imgMapa.src = resp.mapa_facial_img;
            imgMapa.style.display = 'block';
        } else {
            imgMapa.style.display = 'none';
        }

        if (ficha.assinatura && ficha.assinatura.length > 100) {
            imgAss.src = ficha.assinatura;
            imgAss.style.display = 'block';
        } else {
            imgAss.style.display = 'none';
        }

        // ==================================================
        // ⚡ FIX NUCLEAR: FORÇA A EXIBIÇÃO ANTES DE IMPRIMIR
        // ==================================================
        const fichaElement = document.getElementById('fichaImpressao');
        
        // 1. Remove o bloqueio do HTML (o style="display:none")
        fichaElement.style.display = 'block'; 
        fichaElement.style.visibility = 'visible';

        // 2. Aguarda meio segundo para o navegador desenhar
        setTimeout(() => {
            window.print();
            
            // 3. (Opcional) Esconde de novo depois de imprimir para não atrapalhar o uso
            // Você pode comentar a linha abaixo se quiser ver a ficha na tela pra testar
            fichaElement.style.display = 'none'; 
        }, 500);

    } catch (err) {
        console.error("Erro na impressão:", err);
        alert('Erro ao gerar documento: ' + (err.message || err));
    }
}

function imprimirAnamnese() { window.print(); }