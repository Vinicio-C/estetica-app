// js/tour.js — Tour guiado de boas-vindas para novos usuários

const _TOUR_PASSOS = [
    {
        seletor: '[data-page="dashboard"]',
        titulo: '🏠 Dashboard',
        texto: 'Seu painel central. Veja o resumo do dia, os próximos agendamentos e os números do seu negócio em tempo real.',
    },
    {
        seletor: '[data-page="agenda"]',
        titulo: '📅 Agenda',
        texto: 'Aqui você gerencia todos os seus horários. Veja o calendário completo, adicione e confirme agendamentos com facilidade.',
    },
    {
        seletor: '[data-page="clientes"]',
        titulo: '👥 Clientes',
        texto: 'Cadastre e gerencie seus clientes. Acesse o histórico de atendimentos, fichas de anamnese e muito mais.',
    },
    {
        seletor: '[data-page="servicos"]',
        titulo: '💅 Serviços',
        texto: 'Configure os serviços que você oferece com nome, preço e duração. Eles aparecem no link de agendamento dos seus clientes.',
    },
    {
        seletor: '[data-page="estoque"]',
        titulo: '📦 Estoque',
        texto: 'Controle os produtos que você usa. Gerencie quantidades e receba alertas quando o estoque estiver acabando.',
    },
    {
        seletor: '[data-page="relatorios"]',
        titulo: '📊 Relatórios',
        texto: 'Acompanhe seu faturamento com gráficos detalhados. Descubra quais serviços rendem mais e os melhores períodos.',
    },
    {
        seletor: '[data-page="automacoes"]',
        titulo: '🤖 Automações',
        texto: 'Configure mensagens automáticas de confirmação e lembrete via WhatsApp ou e-mail. Seus clientes sempre serão avisados.',
    },
    {
        seletor: '[data-page="perfil"]',
        titulo: '👤 Meu Perfil',
        texto: 'Configure seu perfil e compartilhe seu link exclusivo de agendamento. Seus clientes agendam por lá, sem precisar ligar!',
    },
];

let _tourPasso = 0;
let _tourAbrioSidebar = false;

function _chaveStorage(userId) {
    return `tour_visto_${userId}`;
}

// Verifica se o sidebar está oculto (mobile com menu fechado)
function _sidebarOculto() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return false;
    return sidebar.getBoundingClientRect().left < 0;
}

// Abre o sidebar se estiver oculto no mobile
function _abrirSidebarParaTour() {
    if (_sidebarOculto()) {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.add('active');
        // Não ativamos o overlay do sidebar pois o tour tem o seu próprio overlay
        _tourAbrioSidebar = true;
    }
}

// Fecha o sidebar somente se o tour o tiver aberto
function _fecharSidebarDoTour() {
    if (_tourAbrioSidebar) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('active');
        _tourAbrioSidebar = false;
    }
}

window.verificarEIniciarTour = async function () {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return;
        if (localStorage.getItem(_chaveStorage(user.id))) return;

        // Aguarda o app terminar de renderizar antes de mostrar o modal
        setTimeout(() => {
            const modal = document.getElementById('modalBoasVindasTour');
            if (modal) modal.style.display = 'flex';
        }, 900);
    } catch (e) {
        console.warn('Tour: erro ao verificar usuário', e);
    }
};

window.iniciarTour = function () {
    document.getElementById('modalBoasVindasTour').style.display = 'none';
    _iniciarTourInterno();
};

// Chamado pelo botão manual no dashboard (não exige primeiro acesso)
window.iniciarTourManual = function () {
    _iniciarTourInterno();
};

function _iniciarTourInterno() {
    // Abre o sidebar para que os itens do menu fiquem visíveis no mobile
    _abrirSidebarParaTour();

    // Pequeno delay para o sidebar terminar a animação de abertura (200ms)
    setTimeout(() => {
        _tourPasso = 0;
        _mostrarPassoTour(0);
    }, 220);
};

window.pularTour = async function () {
    document.getElementById('modalBoasVindasTour').style.display = 'none';
    await _marcarTourVisto();
};

window.proximoPassoTour = function () {
    _tourPasso++;
    if (_tourPasso >= _TOUR_PASSOS.length) {
        encerrarTour();
    } else {
        _mostrarPassoTour(_tourPasso);
    }
};

window.anteriorPassoTour = function () {
    if (_tourPasso > 0) {
        _tourPasso--;
        _mostrarPassoTour(_tourPasso);
    }
};

window.encerrarTour = async function () {
    document.getElementById('tourOverlay').style.display  = 'none';
    document.getElementById('tourDestaque').style.display = 'none';
    document.getElementById('tourTooltip').style.display  = 'none';

    // Fecha o sidebar se o tour o abriu
    _fecharSidebarDoTour();

    await _marcarTourVisto();
    if (typeof showToast === 'function') showToast('Tour concluído! Bom trabalho ✨', 'success');
};

async function _marcarTourVisto() {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (user) localStorage.setItem(_chaveStorage(user.id), '1');
    } catch (e) {}
}

function _mostrarPassoTour(indice) {
    const passo    = _TOUR_PASSOS[indice];
    const el       = document.querySelector(passo.seletor);
    const overlay  = document.getElementById('tourOverlay');
    const destaque = document.getElementById('tourDestaque');
    const tooltip  = document.getElementById('tourTooltip');

    if (!el || !overlay || !destaque || !tooltip) return;

    overlay.style.display  = 'block';
    destaque.style.display = 'block';
    tooltip.style.display  = 'block';

    // Posiciona o destaque sobre o elemento-alvo
    const rect = el.getBoundingClientRect();
    const pad  = 6;
    destaque.style.top    = (rect.top    - pad) + 'px';
    destaque.style.left   = (rect.left   - pad) + 'px';
    destaque.style.width  = (rect.width  + pad * 2) + 'px';
    destaque.style.height = (rect.height + pad * 2) + 'px';

    // Preenche o conteúdo do tooltip
    document.getElementById('tourTitulo').textContent   = passo.titulo;
    document.getElementById('tourTexto').textContent    = passo.texto;
    document.getElementById('tourContador').textContent = `Passo ${indice + 1} de ${_TOUR_PASSOS.length}`;

    const btnAnterior = document.getElementById('tourBtnAnterior');
    const btnProximo  = document.getElementById('tourBtnProximo');
    btnAnterior.style.display = indice === 0 ? 'none' : 'inline-flex';
    btnProximo.textContent    = indice === _TOUR_PASSOS.length - 1 ? 'Finalizar ✓' : 'Próximo →';

    // Posiciona o tooltip à direita do destaque; se não couber, coloca abaixo
    const tw = 300, th = 190;
    let top  = rect.top;
    let left = rect.right + 18;

    if (left + tw > window.innerWidth - 8) {
        left = rect.left;
        top  = rect.bottom + 14;
    }
    if (top + th > window.innerHeight - 8) {
        top = Math.max(8, rect.top - th - 14);
    }

    tooltip.style.top  = Math.max(8, top)  + 'px';
    tooltip.style.left = Math.max(8, left) + 'px';
}
