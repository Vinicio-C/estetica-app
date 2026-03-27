// ========================================
// Agendamento Premium - App JavaScript
// ========================================

// ==========================================
// 🔌 INICIALIZAÇÃO DO GOOGLE (ATUALIZADA)
// ==========================================
const API_KEY = 'AIzaSyDnpUtzu2QnkWSPvl2c-7tvy95BPioBB_g'; // Apenas a API Key é necessária

// Inicia o carregamento assim que o script roda
// Se o gapi já estiver na página (pelo script do HTML), ele carrega.
if (typeof gapi !== 'undefined') {
    handleClientLoad();
} else {
    // Se ainda não carregou, espera a janela carregar
    window.onload = function() {
        if (typeof gapi !== 'undefined') handleClientLoad();
    }
}

// =========================================================
// 🚨 FISCAL DE RECUPERAÇÃO DE SENHA (Coloque no TOPO do app.js)
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
    // Verifica se o Supabase já carregou
    const supabaseCheck = setInterval(() => {
        if (window._supabase) {
            clearInterval(supabaseCheck);
            
            // Ouve as mudanças de estado (Login, Logout, Recuperação)
            window._supabase.auth.onAuthStateChange((event, session) => {
                console.log("🔔 Evento de Auth Detectado:", event);

                // O GRANDE SEGREDO: Se o evento for 'PASSWORD_RECOVERY'
                if (event === 'PASSWORD_RECOVERY') {
                    console.log("🛑 É recuperação de senha! Redirecionando...");
                    // Impede o app de carregar o dashboard normal
                    document.body.innerHTML = '<div style="color:white; text-align:center; padding:50px;">Redirecionando para troca de senha...</div>';
                    // Manda para a página certa
                    window.location.href = 'nova-senha.html'; 
                }
            });
        }
    }, 100); // Checa a cada 100ms se o Supabase carregou
});

if (window._supabase) {
    window._supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
            console.log("🔄 Recuperação de senha detectada! Redirecionando...");
            window.location.href = 'nova-senha.html';
        }
    });
}

// Estado global da aplicação
const appState = {
    currentPage: 'dashboard',
    currentCliente: null,
    currentAgendaView: 'dia',
    currentAgendaDate: new Date(),
    clientes: [],
    servicos: [],
    estoque: [],
    agendamentos: [],
    pagamentos: []
};

// ========================================
// Inicialização
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🌟 Inicializando Agendamento Premium...');

    // --- 🚨 TRAVA DE SEGURANÇA (WATCHDOG) ---
    // Se o banco travar ou a internet cair, isso garante que o app abre em 3 segundos
    setTimeout(() => {
        const loader = document.getElementById('loadingScreen');
        if (loader && !loader.classList.contains('hidden')) {
            console.warn('⚠️ Watchdog: O banco demorou, forçando abertura do app.');
            loader.classList.add('hidden');
        }
    }, 3000); // 3000ms = 3 segundos
    
    // Registrar Service Worker para PWA
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('./service-worker.js');
            console.log('✅ Service Worker registrado');
        } catch (err) {
            console.log('⚠️ Service Worker não registrado:', err);
        }
    }
    
    try {

        const lastDate = localStorage.getItem('lastAgendaDate');
        if (lastDate) {
            appState.currentAgendaDate = new Date(lastDate);
            // Atualiza também a displayDate do calendário para o mês certo
            if (typeof displayDate !== 'undefined') {
                displayDate = new Date(lastDate);
            }
        }
        // Configurar event listeners (com proteção)
        setupEventListeners();
        
        // Carregar dados iniciais
        await carregarDadosIniciais();
        
        // Inicializar página
        if (typeof carregarDashboard === 'function') {
            carregarDashboard();
        }

    } catch (error) {
        console.error("Erro fatal na inicialização:", error);
    } finally {
        // --- O SEGREDO: Ocultar loading screen SEMPRE, mesmo com erro ---
        setTimeout(() => {
            const loader = document.getElementById('loadingScreen');
            if (loader) loader.classList.add('hidden');
        }, 1000);
    }
});

function setupEventListeners() {
    // Menu sidebar
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            navigateTo(page);
        });
    });
    
    // Menu toggle (mobile)
    const menuToggle = document.getElementById('menuToggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('active');
            document.getElementById('overlay').classList.toggle('active');
        });
    }
    
    // Overlay (fechar sidebar mobile)
    const overlay = document.getElementById('overlay');
    if (overlay) {
        overlay.addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('active');
            overlay.classList.remove('active');
        });
    }
    
    // Forms - Só adiciona se o form existir
    const fCliente = document.getElementById('formCliente');
    if (fCliente) fCliente.addEventListener('submit', salvarCliente);

    const fAgenda = document.getElementById('formAgendamento');
    if (fAgenda) fAgenda.addEventListener('submit', salvarAgendamento);

    const fServico = document.getElementById('formServico');
    if (fServico) fServico.addEventListener('submit', salvarServico);

    const fEstoque = document.getElementById('formEstoque');
    if (fEstoque) fEstoque.addEventListener('submit', salvarEstoque);
    
    // Search bars
    const sCliente = document.getElementById('searchClientes');
    if (sCliente) sCliente.addEventListener('input', (e) => filtrarClientes(e.target.value));

    const sServico = document.getElementById('searchServicos');
    if (sServico) sServico.addEventListener('input', (e) => filtrarServicos(e.target.value));

    const sEstoque = document.getElementById('searchEstoque');
    if (sEstoque) sEstoque.addEventListener('input', (e) => filtrarEstoque(e.target.value));

    // Botão de Notificações
    const btnNotif = document.getElementById('notificationsBtn');
    if (btnNotif) {
        btnNotif.addEventListener('click', async () => {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                showToast('Notificações ativadas!', 'success');
            } else {
                showToast('Habilite notificações no seu celular.', 'warning');
            }
        });
    }
    
}

function navigateTo(page) {
    appState.currentPage = page;
    
    // Atualizar menu
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) {
            item.classList.add('active');
        }
    });
    
    // Atualizar páginas
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });
    
    const targetPage = document.getElementById(page + 'Page');
    if (targetPage) targetPage.classList.add('active');
    
    // Atualizar título
    const titles = {
        dashboard: 'Dashboard',
        clientes: 'Clientes',
        agenda: 'Agenda',
        servicos: 'Serviços',
        estoque: 'Estoque',
        relatorios: 'Relatórios',
        automacoes: 'Automações'
    };
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) pageTitle.textContent = titles[page];
    
    // Carregar dados da página
    switch(page) {
        case 'dashboard': if(typeof carregarDashboard === 'function') carregarDashboard(); break;
        case 'clientes': if(typeof carregarClientes === 'function') carregarClientes(); break;
        case 'agenda': if(typeof carregarAgenda === 'function') carregarAgenda(); break;
        case 'servicos': if(typeof carregarServicos === 'function') carregarServicos(); break;
        case 'estoque': if(typeof carregarEstoque === 'function') carregarEstoque(); break;
        case 'relatorios': if(typeof carregarRelatorios === 'function') carregarRelatorios(); break;
        case 'automacoes': if(typeof carregarAutomacoes === 'function') carregarAutomacoes(); break;
        case 'perfil': if(typeof carregarDadosPerfil === 'function') carregarDadosPerfil(); break;
    }
    
    // Fechar sidebar mobile
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
}

async function carregarDadosIniciais() {
    try {
        const [clientes, servicos, estoque, agendamentos, pagamentos] = await Promise.all([
            fetchAPI('tables/clientes?limit=1000'),
            fetchAPI('tables/servicos?limit=1000'),
            fetchAPI('tables/estoque?limit=1000'),
            fetchAPI('tables/agendamentos?limit=1000'),
            fetchAPI('tables/pagamentos?limit=1000')
        ]);
        
        appState.clientes = clientes.data || [];
        appState.servicos = servicos.data || [];
        appState.estoque = estoque.data || [];
        appState.agendamentos = agendamentos.data || [];
        appState.pagamentos = pagamentos.data || [];

        await autoConcluirPassados();
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
    }
}

async function carregarDashboard() {
    await carregarDadosIniciais();
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    
    // --- CÁLCULOS DOS CARDS ---
    
    // 1. Agendamentos HOJE (Só conta dia 02/02 se for hoje)
    const agendamentosHoje = appState.agendamentos.filter(a => {
        const d = new Date(a.data);
        return d >= hoje && d < amanha && a.status !== 'cancelado';
    });
    
    // 2. Faturamento (Só o que já está PAGO hoje)
    const faturamentoHoje = agendamentosHoje
        .filter(a => a.status_pagamento === 'pago')
        .reduce((sum, a) => sum + (Number(a.valor) || 0), 0);
    
    // 3. Total Clientes (Contagem simples)
    const totalClientes = appState.clientes.length;

    // 4. Débitos / A Receber (MUDEI AQUI: Pega tudo que é 'devendo', futuro ou passado)
    const debitosTotal = appState.agendamentos
        .filter(a => a.status_pagamento === 'devendo' && a.status !== 'cancelado')
        .reduce((sum, a) => sum + (Number(a.valor) || 0), 0);
    
    // --- ATUALIZAR HTML ---
    
    // Verifica se os elementos existem antes de tentar escrever (Evita erros)
    const elAgend = document.getElementById('statAgendamentosHoje');
    if (elAgend) elAgend.textContent = agendamentosHoje.length;

    const elFat = document.getElementById('statFaturamentoHoje');
    if (elFat) elFat.textContent = formatCurrency(faturamentoHoje);

    const elCli = document.getElementById('statTotalClientes');
    if (elCli) elCli.textContent = totalClientes; // Aqui vai aparecer o "1"

    const elDeb = document.getElementById('statDebitosTotal');
    if (elDeb) elDeb.textContent = formatCurrency(debitosTotal); // Aqui vai somar o valor pendente

    // Renderiza as listas
    renderizarListasDashboard();
    
    // Atualiza notificações
    if (typeof atualizarNotificacoes === 'function') atualizarNotificacoes();
}
function renderizarListasDashboard() {
    console.log('🔄 Iniciando renderização das listas do Dashboard...');
    
    // Data de hoje (sem horas) para comparação segura
    const hojeStr = new Date().toISOString().split('T')[0];

    // 1. PRÓXIMOS AGENDAMENTOS
    const listaAgenda = document.getElementById('dashAgendamentosList');
    
    if (listaAgenda) {
        // Filtra futuros ou hoje
        const proximos = appState.agendamentos
            .filter(a => {
                // Compara strings: "2026-02-12" >= "2026-02-04"
                return a.data >= hojeStr && a.status !== 'cancelado';
            })
            .sort((a, b) => {
                // Ordena por Data e depois por Hora
                if (a.data === b.data) return a.hora.localeCompare(b.hora);
                return a.data.localeCompare(b.data);
            })
            .slice(0, 5);

        if (proximos.length === 0) {
            listaAgenda.innerHTML = `
                <div class="empty-state-small" style="padding: 20px; text-align: center;">
                    <i class="far fa-calendar-check" style="font-size: 2rem; color: #333; margin-bottom: 10px;"></i>
                    <p style="color: #888;">Agenda livre por enquanto!</p>
                </div>`;
        } else {
            listaAgenda.innerHTML = proximos.map(a => {
                const [ano, mes, dia] = a.data.split('-');
                const meses = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
                const nomeMes = meses[parseInt(mes) - 1];

                // LÓGICA INTELIGENTE PARA O NOME
                // Prioriza o nome do Serviço. Se não tiver, tenta o Cliente. Se for evento, usa o nome do evento.
                let titulo = a.cliente_nome || 'Cliente';
                if (a.tipo === 'evento') titulo = a.evento_nome || 'Evento';

                let descricao = 'Agendamento';
                if (a.servico_nome) descricao = a.servico_nome; // Mostra "Peeling Químico" se existir
                else if (a.evento_nome) descricao = a.evento_nome;
                else if (a.tipo === 'bloqueio') descricao = 'Bloqueio de Agenda';

                return `
                <div class="dash-list-item" onclick="abrirModalAgendamento('${a.id}')">
                    <div class="dash-item-time">
                        <span class="day">${dia}</span>
                        <span class="month">${nomeMes}</span>
                    </div>
                    <div class="dash-item-info">
                        <h4>${titulo}</h4>
                        <p style="color: #bbb;">${descricao} • ${formatTime(a.hora)}</p>
                    </div>
                    <div class="dash-item-action">
                        <span class="status-badge ${a.status_pagamento || 'pendente'}">${a.status_pagamento || 'Pendente'}</span>
                    </div>
                </div>
            `}).join('');
        }
    }

    // 2. ALERTAS DE ESTOQUE
    const listaEstoque = document.getElementById('dashEstoqueList');
    if (!listaEstoque) {
        console.error('❌ ERRO: Não achei a div "dashEstoqueList" no HTML!');
    } else {
        // Lógica de Estoque
        const criticos = appState.estoque
            .filter(item => item.quantidade <= item.quantidade_minima)
            .slice(0, 5);

        if (criticos.length === 0) {
            listaEstoque.innerHTML = '<div class="empty-state-small success" style="padding:15px; text-align:center; color:#888;">Estoque abastecido.</div>';
        } else {
            listaEstoque.innerHTML = criticos.map(item => `
                <div class="dash-list-item warning" onclick="navigateTo('estoque')">
                    <div class="dash-item-icon"><i class="fas fa-box-open"></i></div>
                    <div class="dash-item-info">
                        <h4>${item.nome}</h4>
                        <p>Restam: <strong>${item.quantidade}</strong></p>
                    </div>
                </div>
            `).join('');
        }
    }

    // 3. CONTAS A RECEBER
    const listaContas = document.getElementById('dashContasReceberList');
    if (!listaContas) {
        console.error('❌ ERRO: Não achei a div "dashContasReceberList" no HTML!');
    } else {
        const devedores = appState.agendamentos
            .filter(a => a.status === 'concluido' && a.status_pagamento === 'devendo')
            .slice(0, 5);

        if (devedores.length === 0) {
            listaContas.innerHTML = '<div class="empty-state-small success" style="padding:15px; text-align:center; color:#888;">Nenhum débito.</div>';
        } else {
            listaContas.innerHTML = devedores.map(a => `
                <div class="dash-list-item danger" onclick="abrirDetalhesCliente('${a.cliente_id}')">
                    <div class="dash-item-icon"><i class="fas fa-exclamation-circle"></i></div>
                    <div class="dash-item-info">
                        <h4>${a.cliente_nome}</h4>
                        <p>${formatDate(a.data)}</p>
                    </div>
                    <div class="dash-item-value">${formatCurrency(a.valor)}</div>
                </div>
            `).join('');
        }
    }
}

// ========================================
// CLIENTES
// ========================================
async function carregarClientes() {
    const container = document.getElementById('clientesGrid');
    if (container) container.innerHTML = '<div class="loading-skeleton"><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div></div>';
    await carregarDadosIniciais();
    renderizarClientes(appState.clientes);
}

const CLIENTES_POR_PAGINA = 12;
let paginaAtualClientes = 1;
let clientesFiltradosGlobal = [];

function renderizarClientes(clientes) {
    clientesFiltradosGlobal = clientes;
    paginaAtualClientes = 1;
    renderizarPaginaClientes();
}

function renderizarPaginaClientes() {
    const container = document.getElementById('clientesGrid');
    const clientes = clientesFiltradosGlobal;

    if (clientes.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <i class="fas fa-users"></i>
                <p>Nenhum cliente cadastrado</p>
            </div>
        `;
        const pag = document.getElementById('clientesPaginacao');
        if (pag) pag.innerHTML = '';
        return;
    }

    const total = clientes.length;
    const totalPaginas = Math.ceil(total / CLIENTES_POR_PAGINA);
    const inicio = (paginaAtualClientes - 1) * CLIENTES_POR_PAGINA;
    const fim = inicio + CLIENTES_POR_PAGINA;
    const clientesPagina = clientes.slice(inicio, fim);

    container.innerHTML = clientesPagina.map(cliente => {
        // Calcular estatísticas do cliente
        const servicosCliente = appState.agendamentos.filter(a => 
            a.cliente_id === cliente.id && a.status === 'concluido'
        );
        
        const totalServicos = servicosCliente.length;
        
        const debitosCliente = appState.agendamentos
            .filter(a => a.cliente_id === cliente.id && a.status_pagamento === 'devendo' && a.status === 'concluido')
            .reduce((sum, a) => sum + (a.valor || 0), 0);
        
        const totalGasto = servicosCliente.reduce((sum, a) => sum + (a.valor || 0), 0);
        
        return `
            <div class="cliente-card" onclick="abrirDetalhesCliente('${cliente.id}')">
                <div class="cliente-header">
                    <div class="cliente-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="cliente-info">
                        <h3>${cliente.nome}</h3>
                        <p><i class="fas fa-phone"></i> ${cliente.telefone}</p>
                    </div>
                </div>
                <div class="cliente-stats">
                    <div class="cliente-stat">
                        <span>Total de Serviços</span>
                        <strong>${totalServicos}</strong>
                    </div>
                    <div class="cliente-stat">
                        <span>Total Gasto</span>
                        <strong>${formatCurrency(totalGasto)}</strong>
                    </div>
                </div>
                ${debitosCliente > 0 ? `
                    <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #E5E5E5; color: #E53935; font-weight: 600; text-align: center;">
                        <i class="fas fa-exclamation-circle"></i> Débito: ${formatCurrency(debitosCliente)}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    // Renderizar paginação
    const pag = document.getElementById('clientesPaginacao');
    if (pag && totalPaginas > 1) {
        let btns = '';
        if (paginaAtualClientes > 1) btns += `<button class="pag-btn" onclick="mudarPaginaClientes(${paginaAtualClientes - 1})"><i class="fas fa-chevron-left"></i></button>`;
        for (let i = 1; i <= totalPaginas; i++) {
            btns += `<button class="pag-btn ${i === paginaAtualClientes ? 'active' : ''}" onclick="mudarPaginaClientes(${i})">${i}</button>`;
        }
        if (paginaAtualClientes < totalPaginas) btns += `<button class="pag-btn" onclick="mudarPaginaClientes(${paginaAtualClientes + 1})"><i class="fas fa-chevron-right"></i></button>`;
        pag.innerHTML = `<div class="paginacao-container">${btns}<span class="pag-info">${total} clientes • Página ${paginaAtualClientes} de ${totalPaginas}</span></div>`;
    } else if (pag) {
        pag.innerHTML = total > 0 ? `<div class="paginacao-container"><span class="pag-info">${total} cliente${total !== 1 ? 's' : ''}</span></div>` : '';
    }
}

window.mudarPaginaClientes = function(pagina) {
    paginaAtualClientes = pagina;
    renderizarPaginaClientes();
    document.getElementById('clientesPage')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

function filtrarClientes(termo) {
    const clientesFiltrados = appState.clientes.filter(c => 
        c.nome.toLowerCase().includes(termo.toLowerCase()) ||
        c.telefone.includes(termo) ||
        c.email.toLowerCase().includes(termo.toLowerCase())
    );
    renderizarClientes(clientesFiltrados);
}

function abrirModalCliente(clienteId = null) {
    const modal = document.getElementById('modalCliente');
    const form = document.getElementById('formCliente');
    
    form.reset();
    
    if (clienteId) {
        const cliente = appState.clientes.find(c => c.id === clienteId);
        if (cliente) {
            document.getElementById('modalClienteTitle').textContent = 'Editar Cliente';
            document.getElementById('clienteId').value = cliente.id;
            
            // Campos básicos
            document.getElementById('clienteNome').value = cliente.nome;
            document.getElementById('clienteTelefone').value = cliente.telefone;
            document.getElementById('clienteEmail').value = cliente.email;
            
            // Campos novos (Preenche ou deixa vazio)
            document.getElementById('clienteCpf').value = cliente.cpf || '';
            document.getElementById('clienteNascimento').value = cliente.data_nascimento || '';
            document.getElementById('clienteCep').value = cliente.cep || '';
            document.getElementById('clienteEndereco').value = cliente.endereco || '';
            document.getElementById('clienteNumero').value = cliente.numero || '';
            document.getElementById('clienteBairro').value = cliente.bairro || '';
            document.getElementById('clienteCidade').value = cliente.cidade || '';
            document.getElementById('clienteEstado').value = cliente.estado || '';
        }
    } else {
        document.getElementById('modalClienteTitle').textContent = 'Novo Cliente';
        document.getElementById('clienteId').value = '';
    }
    
    modal.classList.add('active');
    document.getElementById('overlay').classList.add('active');
}

async function buscarCep() {
    let cep = document.getElementById('clienteCep').value;
    cep = cep.replace(/\D/g, ''); // Limpa caracteres não numéricos

    if (cep.length === 8) {
        const campoEndereco = document.getElementById('clienteEndereco');
        const valorOriginal = campoEndereco.value;
        campoEndereco.value = 'Buscando...';
        
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await response.json();

            if (!data.erro) {
                document.getElementById('clienteEndereco').value = data.logradouro;
                document.getElementById('clienteBairro').value = data.bairro;
                document.getElementById('clienteCidade').value = data.localidade;
                document.getElementById('clienteEstado').value = data.uf;
                document.getElementById('clienteNumero').focus(); // Pula pro número
            } else {
                showToast('CEP não encontrado.', 'warning');
                campoEndereco.value = '';
            }
        } catch (error) {
            console.error('Erro CEP:', error);
            campoEndereco.value = valorOriginal;
        }
    }
}

async function salvarCliente(e) {
    e.preventDefault();
    
    const id = document.getElementById('clienteId').value;
    
    // Objeto com TODOS os dados novos
    const data = {
        nome: document.getElementById('clienteNome').value,
        telefone: document.getElementById('clienteTelefone').value.replace(/\D/g, ''),
        email: document.getElementById('clienteEmail').value,
        // Novos campos (com proteção para vazios)
        cpf: document.getElementById('clienteCpf').value || null,
        data_nascimento: document.getElementById('clienteNascimento').value || null,
        cep: document.getElementById('clienteCep').value || null,
        endereco: document.getElementById('clienteEndereco').value || null,
        numero: document.getElementById('clienteNumero').value || null,
        bairro: document.getElementById('clienteBairro').value || null,
        cidade: document.getElementById('clienteCidade').value || null,
        estado: document.getElementById('clienteEstado').value || null,
        // Mantém a data de cadastro se for novo, senão o banco ignora
        data_cadastro: id ? undefined : new Date().toISOString()
    };

    // Remove campos undefined para não dar erro no update
    if (id) delete data.data_cadastro; 
    
    try {
        if (id) {
            // ATUALIZAR (PUT)
            const { error } = await _supabase
                .from('clientes')
                .update(data)
                .eq('id', id);
                
            if (error) throw error;
            showToast('Cliente atualizado com sucesso!', 'success');
        } else {
            // CRIAR (POST)
            const { error } = await _supabase
                .from('clientes')
                .insert([data]);
                
            if (error) throw error;
            showToast('Cliente cadastrado com sucesso!', 'success');
        }
        
        fecharModal('modalCliente');
        await carregarClientes();
    } catch (error) {
        console.error('Erro ao salvar:', error);
        showToast('Erro ao salvar cliente: ' + error.message, 'error');
    }
}

async function abrirDetalhesCliente(clienteId) {
    // 1. Pega dados básicos do cliente (do estado local ou busca se precisar)
    let cliente = appState.clientes.find(c => c.id === clienteId);
    
    // Se não achar no estado local, busca no banco (segurança)
    if (!cliente) {
        const { data } = await _supabase.from('clientes').select('*').eq('id', clienteId).single();
        cliente = data;
    }
    
    if (!cliente) return;
    appState.currentCliente = cliente; // Guarda para uso no botão excluir/editar

    // 2. CONFIGURA A UI (Preenche nome, email, etc)
    document.getElementById('detalhesClienteNome').textContent = cliente.nome;
    document.getElementById('detalhesClienteTelefone').textContent = cliente.telefone || '-';
    document.getElementById('detalhesClienteEmail').textContent = cliente.email || 'Não informado';
    
    // Endereço
    const boxEndereco = document.getElementById('boxEndereco');
    const spanEndereco = document.getElementById('detalhesClienteEndereco');
    if (cliente.endereco) {
        spanEndereco.textContent = `${cliente.endereco}, ${cliente.numero || ''} - ${cliente.bairro || ''}`;
        boxEndereco.style.display = 'block';
    } else {
        boxEndereco.style.display = 'none';
    }

    // 3. BUSCA AGENDAMENTOS FRESCOS NO BANCO
    const containerHist = document.getElementById('detalhesHistorico');
    const containerFuturo = document.getElementById('detalhesAgendados');
    
    containerFuturo.innerHTML = '<div style="padding:10px; color:#888;">Buscando agendamentos...</div>';
    
    try {
        // 👇 A MÁGICA: Tiramos o .neq('status', 'cancelado') para ele puxar os estornos!
        const { data: agendamentosReais, error } = await _supabase
            .from('agendamentos')
            .select('*')
            .eq('cliente_id', clienteId)
            .order('data', { ascending: false }); 

        if (error) throw error;

        // --- 4. SEPARAÇÃO E CÁLCULOS ---
        const hoje = new Date().toISOString().split('T')[0]; 

        // Histórico recebe: passados OU concluídos OU cancelados
        const historicoList = agendamentosReais.filter(a => a.data < hoje || a.status === 'concluido' || a.status === 'cancelado');
        
        // Futuros recebe: hoje ou futuro E que não sejam concluídos nem cancelados
        const agendadosList = agendamentosReais.filter(a => a.data >= hoje && a.status !== 'concluido' && a.status !== 'cancelado');

        // Totais (Protegemos para o cancelado/estornado não somar no ganho)
        const totalServicos = historicoList.filter(a => a.status === 'concluido').length;
        const valorTotal = historicoList
            .filter(a => a.status === 'concluido')
            .reduce((sum, a) => sum + (Number(a.valor) || 0), 0);
        
        const debitos = agendamentosReais
            .filter(a => a.status_pagamento === 'devendo' && a.status !== 'cancelado')
            .reduce((sum, a) => sum + (Number(a.valor) || 0), 0);

        // Atualiza números na tela
        document.getElementById('detalhesTotalServicos').textContent = totalServicos;
        document.getElementById('detalhesValorTotal').textContent = formatCurrency(valorTotal);
        document.getElementById('detalhesDebitos').textContent = formatCurrency(debitos);

        // --- 5. RENDERIZA LISTA: HISTÓRICO ---
        if (historicoList.length === 0) {
            containerHist.innerHTML = '<div class="empty-state" style="padding:10px"><p>Sem histórico anterior</p></div>';
        } else {
            containerHist.innerHTML = historicoList.map(a => {
                // Formatação Bonita do Status
                const statusStr = a.status === 'concluido' ? 'Concluído' : (a.status === 'pendente' ? 'Pendente' : 'Cancelado');
                const corStatus = a.status === 'concluido' ? '#4CAF50' : (a.status === 'pendente' ? '#FFA726' : '#ff4444');

                return `
                <div class="agendamento-item" onclick="fecharModal('modalDetalhesCliente'); abrirModalAgendamento('${a.id}')" style="margin-bottom: 10px; padding: 12px; opacity: 0.9; border: 1px solid #333; border-radius: 8px; cursor: pointer; transition: 0.3s;" onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='#333'">
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                        <strong style="color:#fff">${a.servico_nome || a.evento_nome || 'Serviço'}</strong>
                        <span style="color:var(--gold)">${formatCurrency(a.valor)}</span>
                    </div>
                    <div style="font-size:0.8rem; color:#888; display:flex; justify-content:space-between; align-items:center;">
                        
                        <span>${formatDate(a.data)} • <span style="color: ${corStatus}; font-weight: bold;">${statusStr}</span></span>
                        
                        <div style="display:flex; gap: 5px;">
                            ${a.status === 'concluido' ? `
                                <button onclick="event.stopPropagation(); reverterConclusao('${a.id}')" style="background:transparent; border:1px solid #ff4444; color:#ff4444; padding:4px 8px; border-radius:4px; cursor:pointer; font-size: 0.75rem;" title="Desfazer e devolver estoque">
                                    <i class="fas fa-undo"></i> Estornar
                                </button>
                            ` : ''}
                            
                            ${a.status === 'pendente' ? `
                                <button onclick="event.stopPropagation(); concluirAgendamento('${a.id}')" style="background:transparent; border:1px solid #4CAF50; color:#4CAF50; padding:4px 8px; border-radius:4px; cursor:pointer; font-size: 0.75rem;" title="Baixar Estoque">
                                    <i class="fas fa-check"></i> Concluir
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
                `
            }).join('');
        }

        // --- 6. RENDERIZA LISTA: AGENDADOS (FUTURO) ---
        if (agendadosList.length === 0) {
            containerFuturo.innerHTML = '<div class="empty-state" style="padding:10px"><p>Nenhum agendamento futuro</p></div>';
        } else {
            agendadosList.sort((a, b) => new Date(a.data) - new Date(b.data));

            containerFuturo.innerHTML = agendadosList.map(a => `
                <div class="agendamento-item" onclick="fecharModal('modalDetalhesCliente'); abrirModalAgendamento('${a.id}')" style="margin-bottom: 10px; padding: 12px; border-left: 3px solid var(--gold); background: rgba(212, 175, 55, 0.05); border-radius: 4px; cursor: pointer; transition: 0.3s;" onmouseover="this.style.background='rgba(212, 175, 55, 0.1)'" onmouseout="this.style.background='rgba(212, 175, 55, 0.05)'">
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;"> 
                        <strong style="color:#fff">${a.servico_nome || 'Agendamento Online'}</strong>
                        <span style="color:var(--gold)">${formatDate(a.data)}</span>
                    </div>
                    <div style="font-size:0.8rem; color:#ccc; display:flex; justify-content:space-between; align-items:center;">
                        <span>Às ${formatTime(a.hora)}</span>
                        
                        <div style="display:flex; gap: 10px;">
                            <button class="icon-btn-small" onclick="event.stopPropagation(); concluirAgendamento('${a.id}')" style="background:transparent; border:1px solid #4CAF50; color: #4CAF50; cursor: pointer;" title="Concluir e Baixar Estoque">
                                <i class="fas fa-check"></i>
                            </button>
                            
                            <button class="icon-btn-small" style="background:transparent; border:1px solid #25D366; color: #25D366; cursor: pointer;" onclick="event.stopPropagation(); dispararWhatsAppManual('${cliente.telefone}', '${cliente.nome}', '${formatDate(a.data)} às ${formatTime(a.hora)}', '${a.servico_nome}')" title="Enviar WhatsApp">
                                <i class="fab fa-whatsapp"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        }

    } catch (err) {
        console.error("Erro ao buscar detalhes:", err);
        containerFuturo.innerHTML = '<p style="color:red">Erro ao carregar.</p>';
    }

    // Abre o modal
    document.getElementById('modalDetalhesCliente').classList.add('active');
    document.getElementById('overlay').classList.add('active');
    
    // Reseta para a primeira aba
    trocarTab('historico');
}

// Função auxiliar para o botão de excluir dentro do modal
function deletarClienteAtual() {
    if (appState.currentCliente) {
        excluirCliente(appState.currentCliente.id);
    }
}

function editarCliente() {
    if (!appState.currentCliente) return;
    fecharModal('modalDetalhesCliente');
    abrirModalCliente(appState.currentCliente.id);
}

async function excluirCliente(id) {
    // 1. Lógica do ID
    let idParaExcluir = id;
    if (!idParaExcluir || idParaExcluir === 'undefined') {
        if (appState.currentCliente && appState.currentCliente.id) {
            idParaExcluir = appState.currentCliente.id;
        }
    }

    if (!idParaExcluir || idParaExcluir === 'undefined') {
        showToast('Erro: ID do cliente não encontrado.', 'error');
        return;
    }

    if (!confirm('Tem certeza? Isso apagará tudo deste cliente.')) return;

    try {
        console.log(`🗑️ Excluindo Cliente ID: ${idParaExcluir}`);

        // 2. Limpar Google Agenda
        const { data: agendamentosDoCliente } = await _supabase
            .from('agendamentos')
            .select('google_event_id')
            .eq('cliente_id', idParaExcluir);

        if (agendamentosDoCliente && agendamentosDoCliente.length > 0) {
            for (const agenda of agendamentosDoCliente) {
                if (agenda.google_event_id && typeof deletarDoGoogleCalendar === 'function') {
                    await deletarDoGoogleCalendar(agenda.google_event_id);
                }
            }
        }

        // 3. Deletar do Banco (Usando _supabase direto)
        const { error } = await _supabase
            .from('clientes')
            .delete()
            .eq('id', idParaExcluir);

        if (error) throw error;

        showToast('Cliente excluído com sucesso!', 'success');
        
        // ========================================================
        // CORREÇÃO AQUI 👇 (Nome da função em português)
        // ========================================================
        if (typeof fecharModal === 'function') {
            fecharModal('modalDetalhesCliente');
        } else {
            // Caso de emergência: remove a classe na mão se a função não for achada
            document.getElementById('modalDetalhesCliente')?.classList.remove('active');
            document.getElementById('overlay')?.classList.remove('active');
        }
        
        // Atualizar telas
        if (typeof carregarDadosIniciais === 'function') await carregarDadosIniciais();
        if (typeof carregarDashboard === 'function') await carregarDashboard();
        if (appState.currentPage === 'clientes') carregarClientes();

    } catch (error) {
        console.error('Erro ao excluir:', error);
        const msg = error.message || 'Erro desconhecido';
        showToast(`Erro ao excluir: ${msg}`, 'error');
    }
}

// =======================================================
// FUNÇÕES DE SERVIÇOS E ESTOQUE (MIGRADAS PARA O APP.JS)
// =======================================================

// =======================================================
// MÓDULO DE SERVIÇOS (Migrado e com Visual Dark)
// =======================================================

async function carregarServicos() {
    const container = document.getElementById('servicosGrid');
    if (container) container.innerHTML = '<div class="loading-skeleton"><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div></div>';
    if (typeof carregarDadosIniciais === 'function') await carregarDadosIniciais();
    renderizarServicos(appState.servicos);
}

function renderizarServicos(servicos) {
    const container = document.getElementById('servicosGrid');
    if (!container) return;

    if (servicos.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>Nenhum serviço cadastrado</p></div>`;
        return;
    }

    container.innerHTML = servicos.map(s => `
        <div class="servico-card" style="padding: 1.5rem; border-radius: 12px; background: #1E1E1E;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h4 style="color: #fff; margin: 0; font-size: 1.2rem;">${s.nome}</h4>
                <strong style="color: var(--gold); font-size: 1.2rem;">${formatCurrency(s.valor)}</strong>
            </div>
            
            <div style="color: #888; font-size: 0.9rem; margin-bottom: 20px; display: flex; gap: 10px;">
                <span><i class="fas fa-clock"></i> ${s.duracao} min</span>
            </div>
            
            <div style="display: flex; gap: 10px;">
                <button onclick="abrirModalServico('${s.id}')" class="action-btn btn-edit">
                    <i class="fas fa-edit"></i> Editar
                </button>

                <button onclick="excluirServico('${s.id}')" class="action-btn btn-delete">
                    <i class="fas fa-trash"></i> Excluir
                </button>
            </div>
        </div>
    `).join('');
}

function filtrarServicos(termo) {
    const servicosFiltrados = appState.servicos.filter(s => 
        s.nome.toLowerCase().includes(termo.toLowerCase())
    );
    renderizarServicos(servicosFiltrados);
}

window.produtosServicoAtual = [];

window.abrirModalServico = function(id = null) {
    const modal = document.getElementById('modalServico');
    const form = document.getElementById('formServico');
    if (form) form.reset();
    
    let hiddenInput = document.getElementById('servicoId');
    if (hiddenInput) hiddenInput.value = '';

    // 1. Limpa a lista atual e preenche o dropdown com o que tem no estoque
    produtosServicoAtual = [];
    const selectProduto = document.getElementById('selectProdutoServico');
    if (selectProduto) {
        selectProduto.innerHTML = '<option value="">Selecione um produto do estoque...</option>' + 
            appState.estoque.map(p => `<option value="${p.id}">${p.nome} (Estoque atual: ${p.quantidade})</option>`).join('');
    }

    if (id) {
        // --- EDIÇÃO ---
        const servico = appState.servicos.find(s => s.id === id);
        if (servico) {
            document.getElementById('modalServicoTitle').textContent = 'Editar Serviço';
            if (hiddenInput) hiddenInput.value = servico.id;
            
            document.getElementById('servicoNome').value = servico.nome || '';
            
            // Os campos extras caso você use
            if(document.getElementById('servicoTipo')) document.getElementById('servicoTipo').value = servico.tipo || '';
            if(document.getElementById('servicoDuracao')) document.getElementById('servicoDuracao').value = servico.duracao || '';
            if(document.getElementById('servicoValor')) document.getElementById('servicoValor').value = servico.valor || '';
            if(document.getElementById('servicoDescricao')) document.getElementById('servicoDescricao').value = servico.descricao || '';
            
            // Carrega os produtos vinculados que vieram do banco
            if (servico.produtos_vinculados) {
                produtosServicoAtual = JSON.parse(JSON.stringify(servico.produtos_vinculados));
            }
        }
    } else {
        // --- NOVO ---
        document.getElementById('modalServicoTitle').textContent = 'Novo Serviço';
    }
    
    // Desenha a lista na tela
    renderizarProdutosVinculados();
    
    modal.classList.add('active');
    document.getElementById('overlay').classList.add('active');
}

// LÓGICA DE MANIPULAÇÃO DA LISTINHA DENTRO DO MODAL
window.adicionarProdutoAoServico = function() {
    const select = document.getElementById('selectProdutoServico');
    const qtdInput = document.getElementById('qtdProdutoServico');
    
    const produtoId = select.value;
    const qtd = parseFloat(qtdInput.value);

    if (!produtoId) return showToast("Selecione um produto do estoque.", "warning");
    if (!qtd || qtd <= 0) return showToast("A quantidade deve ser maior que zero.", "warning");

    const produtoInfo = appState.estoque.find(p => p.id === produtoId);
    if (!produtoInfo) return;

    // Verifica se já existe na listinha, se sim, só soma a qtd
    const existeIndex = produtosServicoAtual.findIndex(p => p.estoque_id === produtoId);
    if (existeIndex >= 0) {
        produtosServicoAtual[existeIndex].quantidade += qtd;
    } else {
        produtosServicoAtual.push({
            estoque_id: produtoId,
            nome: produtoInfo.nome,
            quantidade: qtd
        });
    }

    // Reseta pro próximo
    select.value = '';
    qtdInput.value = '1';
    
    renderizarProdutosVinculados();
}

window.removerProdutoDoServico = function(index) {
    produtosServicoAtual.splice(index, 1);
    renderizarProdutosVinculados();
}

window.renderizarProdutosVinculados = function() {
    const container = document.getElementById('listaProdutosVinculados');
    if (!container) return;

    if (produtosServicoAtual.length === 0) {
        container.innerHTML = '<div style="color: #666; font-size: 0.85rem; text-align: center; padding: 10px;">Nenhum produto vinculado ainda.</div>';
        return;
    }

    container.innerHTML = produtosServicoAtual.map((p, index) => `
        <div style="display: flex; justify-content: space-between; align-items: center; background: #1a1a1a; padding: 8px 12px; margin-bottom: 5px; border-radius: 4px; border: 1px solid #333;">
            <span style="color: #fff; font-size: 0.9rem;"><i class="fas fa-box" style="color: #888; font-size: 0.8rem; margin-right: 5px;"></i> ${p.nome}</span>
            <div style="display: flex; align-items: center; gap: 15px;">
                <span style="color: var(--gold); font-weight: bold; font-size: 0.9rem;">${p.quantidade} un.</span>
                <button type="button" onclick="removerProdutoDoServico(${index})" style="background: transparent; border: none; color: #ff4444; cursor: pointer;" title="Remover Vínculo">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// SALVAR SERVIÇO COM OS PRODUTOS VINCULADOS
window.salvarServico = async function(e) {
    e.preventDefault();
    const id = document.getElementById('servicoId').value;
    
    // Monta o objeto pra enviar pro Supabase
    const dados = {
        nome: document.getElementById('servicoNome').value,
        valor: parseFloat(document.getElementById('servicoValor').value),
        duracao: parseInt(document.getElementById('servicoDuracao').value),
        produtos_vinculados: produtosServicoAtual // Envia nossa listinha como JSON
    };

    // Pega dados opcionais caso você use na sua UI
    if(document.getElementById('servicoTipo')) dados.tipo = document.getElementById('servicoTipo').value;
    if(document.getElementById('servicoDescricao')) dados.descricao = document.getElementById('servicoDescricao').value;

    const btn = e.target.querySelector('button[type="submit"]');
    const txtOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    btn.disabled = true;

    try {
        if (id) {
            const { error } = await _supabase.from('servicos').update(dados).eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await _supabase.from('servicos').insert([dados]);
            if (error) throw error;
        }
        
        showToast('Serviço salvo com sucesso!', 'success');
        fecharModal('modalServico');
        
        // Recarrega tudo para atualizar o front
        if (typeof carregarDadosIniciais === 'function') await carregarDadosIniciais();
        if (typeof carregarServicos === 'function') carregarServicos();
        
    } catch (err) {
        console.error(err);
        showToast('Erro ao salvar serviço.', 'error');
    } finally {
        btn.innerHTML = txtOriginal;
        btn.disabled = false;
    }
}

// =======================================================
// MÓDULO DE ESTOQUE (Migrado e com Visual Dark)
// =======================================================

async function carregarEstoque() {
    const container = document.getElementById('estoqueGrid');
    if (container) container.innerHTML = '<div class="loading-skeleton"><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div></div>';
    if (typeof carregarDadosIniciais === 'function') await carregarDadosIniciais();
    renderizarEstoque(appState.estoque);
}

function renderizarEstoque(produtos) {
    const container = document.getElementById('estoqueGrid');
    if (!container) return;

    if (produtos.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>Estoque vazio</p></div>`;
        return;
    }

    container.innerHTML = produtos.map(p => {
        let corStatus = '#66BB6A'; // Verde
        if (p.quantidade <= p.quantidade_minima) corStatus = '#FFA726'; // Laranja
        if (p.quantidade === 0) corStatus = '#EF5350'; // Vermelho

        return `
            <div class="estoque-card" style="border-left: 4px solid ${corStatus}; padding: 1.5rem; border-radius: 12px; background: #1E1E1E; margin-bottom: 0;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                    <h4 style="color: #fff; margin: 0; font-size: 1.1rem;">${p.nome}</h4>
                    <span style="background: ${corStatus}20; color: ${corStatus}; padding: 4px 8px; border-radius: 6px; font-weight: bold; font-size: 0.9rem;">
                        ${p.quantidade} un.
                    </span>
                </div>
                
                <div style="color: #888; font-size: 0.9rem; margin-bottom: 15px;">
                    Mínimo ideal: ${p.quantidade_minima}
                </div>
                
                <div style="display: flex; gap: 10px;">
                    <button onclick="abrirModalEstoque('${p.id}')" class="action-btn btn-edit">
                        <i class="fas fa-edit"></i> Editar
                    </button>

                    <button onclick="excluirProduto('${p.id}')" class="action-btn btn-delete">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function filtrarEstoque(termo) {
    const produtosFiltrados = appState.estoque.filter(p => 
        p.nome.toLowerCase().includes(termo.toLowerCase())
    );
    renderizarEstoque(produtosFiltrados);
}

function abrirModalEstoque(produtoId = null) {
    const modal = document.getElementById('modalEstoque');
    const form = document.getElementById('formEstoque');
    form.reset();
    
    let hiddenInput = document.getElementById('estoqueId');
    hiddenInput.value = '';

    if (produtoId) {
        const produto = appState.estoque.find(p => p.id === produtoId);
        if (produto) {
            document.getElementById('modalEstoqueTitle').textContent = 'Editar Produto';
            hiddenInput.value = produto.id;
            document.getElementById('estoqueNome').value = produto.nome;
            document.getElementById('estoqueDescricao').value = produto.descricao || '';
            document.getElementById('estoqueValor').value = produto.valor_unitario;
            document.getElementById('estoqueQuantidade').value = produto.quantidade;
            document.getElementById('estoqueQuantidadeMinima').value = produto.quantidade_minima;
        }
    } else {
        document.getElementById('modalEstoqueTitle').textContent = 'Novo Produto';
    }
    
    modal.classList.add('active');
    document.getElementById('overlay').classList.add('active');
}

async function salvarEstoque(e) {
    e.preventDefault();
    const id = document.getElementById('estoqueId').value;
    const dados = {
        nome: document.getElementById('estoqueNome').value,
        descricao: document.getElementById('estoqueDescricao').value,
        valor_unitario: parseFloat(document.getElementById('estoqueValor').value),
        quantidade: parseInt(document.getElementById('estoqueQuantidade').value),
        quantidade_minima: parseInt(document.getElementById('estoqueQuantidadeMinima').value)
    };

    try {
        if (id) {
            const { error } = await _supabase.from('estoque').update(dados).eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await _supabase.from('estoque').insert([dados]);
            if (error) throw error;
        }
        showToast('Produto salvo com sucesso!', 'success');
        fecharModal('modalEstoque');
        await carregarEstoque();
    } catch (err) {
        console.error(err);
        showToast('Erro ao salvar produto.', 'error');
    }
}

async function excluirProduto(id) {
    if (!id || id === 'undefined') return showToast('Erro: ID inválido', 'error');
    if (!confirm('Tem certeza que deseja excluir?')) return;

    try {
        const { error } = await _supabase.from('estoque').delete().eq('id', id);
        if (error) throw error;
        showToast('Produto excluído!', 'success');
        await carregarEstoque();
        if (typeof atualizarNotificacoes === 'function') atualizarNotificacoes();
    } catch (err) {
        console.error(err);
        showToast('Erro ao excluir.', 'error');
    }
}

// --- LIMPAR NOTIFICAÇÕES (Aquela função que faltava) ---
function limparNotificacoes(e) {
    if (e) e.stopPropagation(); 
    
    const lista = document.getElementById('notifList');
    const badge = document.getElementById('notifCount');
    
    if (lista) {
        lista.innerHTML = '<div class="notif-empty"><i class="fas fa-check-circle"></i><br>Notificações limpas!</div>';
    }
    
    if (badge) {
        badge.style.display = 'none';
        badge.textContent = '0';
    }
    
    showToast('Notificações limpas.', 'info');
}

function trocarTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        }
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`).classList.add('active');
}

// --- SISTEMA DE NOTIFICAÇÕES INTELIGENTE ---

function toggleNotifications() {
    const dropdown = document.getElementById('notificationsDropdown');
    dropdown.classList.toggle('active');
    
    // Se abriu, calcula as notificações na hora
    if (dropdown.classList.contains('active')) {
        atualizarNotificacoes();
    }
}

// Fecha o menu se clicar fora
document.addEventListener('click', (e) => {
    const wrapper = document.querySelector('.notifications-wrapper');
    const dropdown = document.getElementById('notificationsDropdown');
    if (wrapper && !wrapper.contains(e.target)) {
        dropdown.classList.remove('active');
    }
});

async function atualizarNotificacoes() {
    // Busca dados frescos
    const estoque = appState.estoque || [];
    const agendamentos = appState.agendamentos || [];
    const clientes = appState.clientes || [];
    
    const lista = document.getElementById('notifList');
    const badge = document.getElementById('notifCount');
    if (!lista || !badge) return;

    lista.innerHTML = '';
    
    let count = 0;
    let html = '';
    const hoje = new Date();

    // --- 1. ANIVERSARIANTES DO DIA (NOVO) ---
    clientes.forEach(c => {
        if (c.data_nascimento) {
            // O input date salva como YYYY-MM-DD. Vamos quebrar a string para não ter erro de fuso horário.
            const partes = c.data_nascimento.split('-'); // [2000, 05, 20]
            const diaNasc = parseInt(partes[2]);
            const mesNasc = parseInt(partes[1]) - 1; // Mês no JS começa em 0 (Janeiro)

            if (hoje.getDate() === diaNasc && hoje.getMonth() === mesNasc) {
                count++;
                html += `
                    <div class="notif-item" style="border-left: 4px solid #E91E63;" onclick="abrirDetalhesCliente('${c.id}')">
                        <div class="notif-icon" style="color: #E91E63;"><i class="fas fa-birthday-cake"></i></div>
                        <div class="notif-content">
                            <h4 style="color: #E91E63;">Aniversário Hoje! 🎉</h4>
                            <p><strong>${c.nome}</strong> está completando mais um ano.</p>
                        </div>
                    </div>
                `;
            }
        }
    });

    // --- 2. Alerta de Estoque Baixo ---
    estoque.forEach(item => {
        if (item.quantidade <= item.quantidade_minima) {
            count++;
            const isCritico = item.quantidade === 0;
            html += `
                <div class="notif-item ${isCritico ? 'critical' : 'warning'}" onclick="navigateTo('estoque')">
                    <div class="notif-icon"><i class="fas fa-box-open"></i></div>
                    <div class="notif-content">
                        <h4>${item.nome}</h4>
                        <p>${isCritico ? 'Esgotado!' : 'Estoque baixo'}: Restam ${item.quantidade}</p>
                    </div>
                </div>
            `;
        }
    });

    // --- 3. Alerta de Contas a Receber (Atrasadas) ---
    agendamentos.forEach(a => {
        const dataServico = new Date(a.data);
        // Se já passou (ontem pra trás), foi concluído e ainda deve
        if (dataServico < hoje && a.status === 'concluido' && a.status_pagamento === 'devendo') {
            count++;
            html += `
                <div class="notif-item critical" onclick="abrirDetalhesCliente('${a.cliente_id}')">
                    <div class="notif-icon"><i class="fas fa-exclamation-circle"></i></div>
                    <div class="notif-content">
                        <h4>Débito: ${a.cliente_nome}</h4>
                        <p>Venceu em ${formatDate(a.data)}</p>
                    </div>
                </div>
            `;
        }
    });

    // Atualiza a UI
    if (count > 0) {
        lista.innerHTML = html;
        badge.style.display = 'flex';
        badge.textContent = count;
    } else {
        lista.innerHTML = '<div class="notif-empty"><i class="fas fa-check-circle"></i><br>Tudo em dia!</div>';
        badge.style.display = 'none';
    }
}

async function limparAgendaGoogleDoDia(dataString) {
    // Exemplo de uso: limparAgendaGoogleDoDia('2026-01-30')
    const start = new Date(dataString);
    start.setHours(0,0,0,0);
    const end = new Date(dataString);
    end.setHours(23,59,59,999);

    const { data: { session } } = await _supabase.auth.getSession();
    const token = session?.provider_token;
    if (!token) { showToast('Conecte a agenda Google primeiro!', 'warning'); return; }

    // 1. Listar eventos do dia
    const resp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${start.toISOString()}&timeMax=${end.toISOString()}&singleEvents=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const lista = await resp.json();
    
    if (!lista.items || lista.items.length === 0) { showToast('Nenhum evento encontrado neste dia.', 'info'); return; }

    if (!confirm(`Encontrei ${lista.items.length} eventos no dia ${dataString}. Apagar TODOS do Google?`)) return;

    // 2. Apagar tudo
    let apagados = 0;
    for (const item of lista.items) {
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${item.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        apagados++;
        console.log('🗑️ Apagado:', item.summary);
    }
    showToast(`Faxina concluída! ${apagados} eventos apagados.`, 'success');
}

// ========================================
// HELPER FUNCTIONS (Funções Auxiliares)
// ========================================

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

// Formata data e hora para exibição (DD/MM/YYYY HH:mm)
function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

// Formata Data (DD/MM/YYYY) usando split (seguro)
function formatDate(dateString) {
    if (!dateString) return '-';
    // Se vier YYYY-MM-DD
    if (dateString.includes('-')) {
        const partes = dateString.split('-');
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return dateString;
}

// Formata Hora (HH:mm) pegando direto da coluna HORA
function formatTime(timeString) {
    if (!timeString) return '-';
    // Pega apenas os 5 primeiros caracteres (ex: "13:00:00" vira "13:00")
    return timeString.slice(0, 5);
}

// Mostra notificações (Toast)
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return; // Proteção se o container não existir

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'warning') icon = 'exclamation-triangle';
    if (type === 'info') icon = 'info-circle';

    toast.innerHTML = `<i class="fas fa-${icon}"></i> <span>${message}</span>`;
    
    container.appendChild(toast);
    
    // Remove após 3 segundos
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// =======================================================
// FUNÇÕES AUXILIARES ESSENCIAIS (RECUPERADAS)
// =======================================================

// 1. Fechar Modal (Essencial para o botão X e Cancelar)
function fecharModal(modalId) {
    const modal = document.getElementById(modalId);
    const overlay = document.getElementById('overlay');
    
    if (modal) modal.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
}

// 2. Formatar Hora para Input (Necessário para editar agendamentos)
function formatTimeInput(date) {
    if (!date) return '';
    const d = new Date(date);
    // Garante formato HH:mm
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

// 3. Formatar Data para Input (Necessário para abrir o modal Novo)
function formatDateInput(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 4. Alternar Tipo (Serviço vs Evento) - Garantia para o Modal
function toggleTipoAgendamento() {
    // Tenta pegar o rádio marcado
    const radio = document.querySelector('input[name="tipoAgendamento"]:checked');
    if (!radio) return; // Proteção

    const tipo = radio.value;
    
    const camposServico = document.getElementById('camposServico');
    const camposEvento = document.getElementById('camposEvento');
    
    // Elementos obrigatórios
    const cliente = document.getElementById('agendamentoCliente');
    const servico = document.getElementById('agendamentoServico');
    const evento = document.getElementById('eventoNome');

    if (tipo === 'servico') {
        if(camposServico) camposServico.style.display = 'block';
        if(camposEvento) camposEvento.style.display = 'none';
        
        if(cliente) cliente.required = true;
        if(servico) servico.required = true;
        if(evento) evento.required = false;
    } else {
        if(camposServico) camposServico.style.display = 'none';
        if(camposEvento) camposEvento.style.display = 'block';
        
        if(cliente) cliente.required = false;
        if(servico) servico.required = false;
        if(evento) evento.required = true;
    }
}

// --- VERIFICA SE JÁ EXISTE AGENDAMENTO NO MESMO HORÁRIO ---
async function verificarConflitoHorario(data, hora, agendamentoIdExcluir = null) {
    const userId = appState.user?.id;
    if (!userId) return null;

    let query = _supabase
        .from('agendamentos')
        .select('id, cliente_nome, evento_nome, hora')
        .eq('data', data)
        .eq('hora', hora)
        .eq('user_id', userId)
        .neq('status', 'cancelado');

    if (agendamentoIdExcluir) {
        query = query.neq('id', agendamentoIdExcluir);
    }

    const { data: conflitos } = await query;
    return conflitos && conflitos.length > 0 ? conflitos[0] : null;
}

// --- FUNÇÃO DE SALVAR AGENDAMENTO (ATUALIZADA COM WHATSAPP) ---
async function salvarAgendamento(e) {
    e.preventDefault();
    
    const id = document.getElementById('agendamentoId').value;
    const clienteId = document.getElementById('agendamentoCliente').value;
    const servicoId = document.getElementById('agendamentoServico').value;
    const data = document.getElementById('agendamentoData').value;
    const hora = document.getElementById('agendamentoHora').value;
    const statusPagamento = document.getElementById('agendamentoStatusPagamento').value;
    const obs = document.getElementById('agendamentoObservacoes').value;
    
    // Check type (Service vs Event)
    const tipo = document.querySelector('input[name="tipoAgendamento"]:checked').value;
    const eventoNome = document.getElementById('eventoNome').value;

    // Validation
    if (tipo === 'servico' && (!clienteId || !servicoId)) {
        showToast('Selecione o Cliente e o Serviço.', 'warning');
        return;
    }
    if (tipo === 'evento' && !eventoNome) {
        showToast('Digite o nome do evento.', 'warning');
        return;
    }
    if (!data || !hora) {
        showToast('Data e Hora são obrigatórios.', 'warning');
        return;
    }

    try {
        // 1. Get Names & Data
        let clienteNome = null;
        let servicoNome = null;
        let valor = 0;
        
        // --- NOVO: Variável declarada fora para ser usada no final ---
        let clienteObj = null; 

        if (tipo === 'servico') {
            // Find client name in the global list
            // --- MODIFICADO: Guardamos na variável externa ---
            clienteObj = appState.clientes.find(c => c.id == clienteId);
            if (clienteObj) clienteNome = clienteObj.nome;

            // Find service name and value
            const servicoObj = appState.servicos.find(s => s.id == servicoId);
            if (servicoObj) {
                servicoNome = servicoObj.nome;
                valor = servicoObj.valor;
            }
        }

        // 2. Prepare the Payload (COMPLETE DATA)
        const dados = {
            data: data,
            hora: hora,
            observacoes: obs,
            status: 'pendente', // Default status
            status_pagamento: statusPagamento,
            tipo: tipo,
            
            // Text Fields (Crucial for Dashboard/Agenda display)
            cliente_nome: clienteNome,
            servico_nome: servicoNome,
            evento_nome: tipo === 'evento' ? eventoNome : null,
            valor: valor
        };

        // Add IDs only if it's a service
        if (tipo === 'servico') {
            dados.cliente_id = clienteId;
            dados.servico_id = servicoId;
        } else {
            dados.cliente_id = null;
            dados.servico_id = null;
        }

        // Verificar conflito de horário antes de salvar
        const conflito = await verificarConflitoHorario(data, hora, id || null);
        if (conflito) {
            const nomeConflito = conflito.cliente_nome || conflito.evento_nome || 'outro agendamento';
            showToast(`Horário ${hora.substring(0, 5)} já está ocupado com ${nomeConflito}. Escolha outro horário.`, 'warning');
            return;
        }

        let error;

        if (id) {
            // Update
            const res = await _supabase.from('agendamentos').update(dados).eq('id', id);
            error = res.error;
        } else {
            // Insert
            const res = await _supabase.from('agendamentos').insert(dados);
            error = res.error;
        }

        if (error) throw error;

        // --- DISPARO DE E-MAIL AUTOMÁTICO ---
        if (clienteObj && clienteObj.email) {
            const procedimento = dados.servico_nome || dados.evento_nome || 'Atendimento';
            const [ano, mes, dia] = dados.data.split('-');
            const dataHoraBr = `${dia}/${mes}/${ano} às ${dados.hora}`;
            
            // Chama a função de e-mail sem "await", assim não trava o fechamento da tela!
            window.dispararEmailAutomatico(clienteObj.email, clienteObj.nome, dataHoraBr, procedimento);
        }

        showToast('Agendamento salvo com sucesso!', 'success');
        fecharModal('modalAgendamento');
        
        // Refresh Screens
        if(typeof carregarDashboard === 'function') carregarDashboard();
        
        // Refresh Agenda if the function exists and we are on that page
        if(typeof carregarAgendaDoDia === 'function' && document.getElementById('agendaContainer')) {
            const dataObj = new Date(data);
            const userTimezoneOffset = dataObj.getTimezoneOffset() * 60000;
            const adjustedDate = new Date(dataObj.getTime() + userTimezoneOffset);
            carregarAgendaDoDia(adjustedDate); 
            
            if(typeof renderCalendar === 'function') renderCalendar();
        }

    } catch (err) {
        console.error("Erro ao salvar:", err);
        showToast('Erro ao salvar agendamento.', 'error');
    }
}

// ========================================
// FUNÇÕES QUE FALTAVAM (MODAL DE AGENDAMENTO)
// ========================================

async function abrirModalAgendamento(id = null) {
    const modal = document.getElementById('modalAgendamento');
    const form = document.getElementById('formAgendamento');
    
    if(form) form.reset();
    document.getElementById('agendamentoId').value = '';

    // 👇 MUDE DAQUI PARA BAIXO 👇

    // 2. Limpa os campos visuais de busca
    document.getElementById('inputBuscaCliente').value = '';
    document.getElementById('agendamentoCliente').value = '';
    document.getElementById('inputBuscaServico').value = '';
    document.getElementById('agendamentoServico').value = '';
    document.getElementById('agendamentoValor').value = '';

    // 3. Lógica: Edição vs Novo
    if (id) {
        // --- MODO EDIÇÃO ---
        document.getElementById('modalAgendamentoTitle').textContent = 'Editar Agendamento';
        
        let agendamento = appState.agendamentos.find(a => a.id === id);
        
        if (!agendamento) {
            try {
                const { data } = await _supabase.from('agendamentos').select('*').eq('id', id).single();
                agendamento = data;
            } catch (e) { console.error(e); }
        }

        if (agendamento) {
            document.getElementById('agendamentoId').value = agendamento.id;
            
            // Preenche os Ids ocultos
            document.getElementById('agendamentoCliente').value = agendamento.cliente_id;
            document.getElementById('agendamentoServico').value = agendamento.servico_id;
            
            // Preenche os nomes nas caixas de texto para a doutora ver
            const clienteObj = appState.clientes.find(c => c.id == agendamento.cliente_id);
            const servicoObj = appState.servicos.find(s => s.id == agendamento.servico_id);
            
            document.getElementById('inputBuscaCliente').value = clienteObj ? clienteObj.nome : (agendamento.cliente_nome || '');
            document.getElementById('inputBuscaServico').value = servicoObj ? servicoObj.nome : (agendamento.servico_nome || '');

            document.getElementById('agendamentoData').value = agendamento.data;
            document.getElementById('agendamentoHora').value = agendamento.hora;
            document.getElementById('agendamentoStatusPagamento').value = agendamento.status_pagamento;
            document.getElementById('agendamentoObservacoes').value = agendamento.observacoes || '';
            
            if (agendamento.valor) {
                document.getElementById('agendamentoValor').value = parseFloat(agendamento.valor).toFixed(2);
            }
        }
    } else {
        // --- MODO NOVO ---
        document.getElementById('modalAgendamentoTitle').textContent = 'Novo Agendamento';
        document.getElementById('agendamentoData').value = new Date().toISOString().split('T')[0];
    }

    modal.classList.add('active');
    document.getElementById('overlay').classList.add('active');
}

// Helper para atualizar o preço quando troca o serviço no select
function updateValorServico() {
    const sel = document.getElementById('agendamentoServico');
    if (!sel || sel.selectedIndex < 0) return;
    
    const opt = sel.options[sel.selectedIndex];
    const valor = opt.getAttribute('data-valor');
    
    // Se você tiver um input visual de valor (opcional)
    const inputValor = document.getElementById('agendamentoValor'); 
    if (inputValor && valor) {
        inputValor.value = "R$ " + parseFloat(valor).toFixed(2).replace('.', ',');
    }
}

// Adiciona o evento de troca de serviço para atualizar valor
const selServicoRef = document.getElementById('agendamentoServico');
if (selServicoRef) selServicoRef.addEventListener('change', updateValorServico);


// ========================================
// EXPORTAÇÕES GLOBAIS (ESSENCIAL!)
// ========================================
// Isso garante que o HTML (onclick="") consiga enxergar as funções JS
window.abrirModalAgendamento = abrirModalAgendamento;
window.abrirDetalhesCliente = abrirDetalhesCliente;
window.navigateTo = navigateTo;
window.fecharModal = fecharModal;
window.excluirCliente = excluirCliente;
window.excluirProduto = excluirProduto;
window.excluirServico = excluirServico;
window.abrirModalServico = abrirModalServico;
window.abrirModalEstoque = abrirModalEstoque;
window.abrirModalCliente = abrirModalCliente;
window.salvarAgendamento = salvarAgendamento;
window.carregarDashboard = carregarDashboard;

// ========================================
// CORREÇÃO DOS DROPDOWNS (ADICIONE NO FINAL DO ARQUIVO)
// ========================================

// 2. Função vazia para o Cliente (só para parar o erro)
window.selectCliente = function() {
    // Por enquanto não precisamos fazer nada automático ao selecionar cliente
    // Mas a função precisa existir para o HTML não quebrar
    console.log("Cliente selecionado"); 
};

// ========================================
// FUNÇÃO DE COMPARTILHAR LINK (FIXA NO FINAL DO APP.JS)
// ========================================

window.copiarLinkAgendamento = async function() {
    console.log("Gerando link personalizado...");

    // 1. Pega o ID do usuário logado
    const { data: { session } } = await _supabase.auth.getSession();
    
    if (!session) {
        showToast('Você precisa estar logada para gerar o link.', 'error');
        return;
    }

    const userId = session.user.id;
    const urlBase = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
    
    // 2. Cria o link com o parâmetro ?ref=ID
    const linkFinal = `${urlBase}agendar.html?ref=${userId}`;

    // 3. Copia
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(linkFinal).then(() => {
            showToast('Link copiado! Envie para sua cliente.', 'success');
        }).catch(err => {
            prompt("Copie o link manualmente:", linkFinal);
        });
    } else {
        prompt("Copie o link manualmente:", linkFinal);
    }
};

// ========================================
// FUNÇÃO DE CANCELAR AGENDAMENTO (RESTAURADA)
// ========================================

window.cancelarAgendamento = async function(id) {
    if (!confirm('Tem certeza que deseja cancelar este agendamento?')) return;

    try {
        // 1. Atualiza o status no Supabase para 'cancelado'
        const { error } = await _supabase
            .from('agendamentos')
            .update({ 
                status: 'cancelado',
                status_pagamento: 'cancelado' // Opcional: marca financeiro como cancelado também
            })
            .eq('id', id);

        if (error) throw error;

        showToast('Agendamento cancelado com sucesso.', 'success');

        // 2. Atualiza o Dashboard (se estiver visível)
        if (typeof carregarDashboard === 'function') carregarDashboard();
        
        // 3. Atualiza a Agenda (se estiver na tela de agenda)
        const displayData = document.getElementById('dataSelecionadaTexto');
        if (displayData && displayData.textContent !== '-' && typeof carregarAgendaDoDia === 'function') {
            // Recarrega o dia que estava aberto para sumir com o card cancelado
            const [dia, mes, ano] = displayData.textContent.split('/');
            // Cria a data (Mês no JS começa em 0)
            const dataObj = new Date(ano, mes - 1, dia);
            carregarAgendaDoDia(dataObj);
            
            // Atualiza as bolinhas do calendário também
            if(typeof renderCalendar === 'function') renderCalendar();
        }

    } catch (err) {
        console.error("Erro ao cancelar:", err);
        showToast('Erro ao cancelar agendamento.', 'error');
    }
};

// ========================================
// INTEGRAÇÃO GOOGLE CALENDAR (FINAL)
// ========================================

// 1. Função para Iniciar a Conexão (Redireciona para o Google)
window.conectarGoogle = async function() {
    console.log("🔌 Iniciando conexão com Google...");
    
    const { data, error } = await _supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.href, // Volta para a mesma página
            scopes: 'https://www.googleapis.com/auth/calendar', // Permissão de Agenda
            queryParams: {
                access_type: 'offline', // ⚠️ O SEGREDO: Pede um token que se renova
                prompt: 'consent'       // Força a tela de permissão para garantir o token
            }
        }
    });

    if (error) {
        console.error("Erro ao conectar:", error);
        showToast('Erro ao conectar com Google', 'error');
    }
};

// 2. Verifica se está conectado e muda a cor do botão
async function verificarStatusGoogle() {
    const btn = document.getElementById('btnConnectGoogle');
    if (!btn) return;

    const { data: { session } } = await _supabase.auth.getSession();
    
    // Se tiver sessão e tiver o token do provedor (Google)
    if (session && session.provider_token) {
        btn.innerHTML = '<i class="fab fa-google"></i> Conectado';
        btn.classList.add('connected'); // Você pode criar um estilo verde para isso
        btn.style.background = '#4CAF50';
        btn.style.color = '#fff';
        btn.style.borderColor = '#4CAF50';
        console.log("✅ Google Conectado!");
    } else {
        btn.innerHTML = '<i class="fab fa-google"></i> Sincronizar';
        btn.style.background = ''; // Volta ao padrão
        console.log("❌ Google Não conectado.");
    }
}

// Roda a verificação assim que o App carrega
document.addEventListener('DOMContentLoaded', () => {
    // Espera um pouco para o Supabase carregar a sessão
    setTimeout(verificarStatusGoogle, 1000);
});

// ========================================
// VERIFICAÇÃO DE LOGIN (COM PROTEÇÃO PARA RECUPERAÇÃO)
// ========================================
(async function verificarLogin() {
    // 1. O PULO DO GATO: Se tiver "type=recovery" na URL, NÃO FAÇA NADA!
    // Deixe o Supabase processar o token e o "Fiscal" lá de cima redirecionar.
    if (window.location.hash && window.location.hash.includes('type=recovery')) {
        console.log("🛑 Link de recuperação detectado! Pausando verificação de login...");
        return; // Sai da função e deixa o fluxo de recuperação seguir
    }

    const { data: { session } } = await _supabase.auth.getSession();
    
    // Se não tiver sessão e não estiver na tela de login, chuta pra fora
    if (!session) {
        // Verifica se já não estamos na tela de login para evitar loop
        if (!window.location.href.includes('login.html')) {
            window.location.href = 'login.html';
        }
    } else {
        console.log("✅ Usuário logado:", session.user.email);
        if (window.location.href.includes('login.html')) {
            // Se estiver na tela de login mas já tem sessão, manda pro dashboard
            window.location.href = 'index.html';
        }
    }
})();

// ==========================================
// LÓGICA DO PERFIL
// ==========================================


// Função auxiliar para copiar o link
function copiarLinkPerfil() {
    const input = document.getElementById('profLink');
    input.select();
    input.setSelectionRange(0, 99999); // Mobile
    navigator.clipboard.writeText(input.value).then(() => {
        showToast("Link copiado para a área de transferência!", "success");
    });
}

// --- FUNÇÃO DE UPLOAD DE FOTO ---
async function uploadFotoPerfil(event) {
    console.log("📸 Iniciando upload...");
    const file = event.target.files[0];
    if (!file) return;

    // 1. Validação básica (ex: max 2MB)
    if (file.size > 2 * 1024 * 1024) {
        showToast('A imagem é muito grande! Use uma foto com menos de 2MB.', 'warning');
        return;
    }

    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return;

    // Feedback visual (mostra que está carregando)
    const iconDiv = document.getElementById('avatarDefaultIcon');
    iconDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; // Loading

    try {
        // 2. Nome do arquivo único (evita cache)
        // Cria: avatar_IDDOUSUARIO_TIMESTAMP.png
        const fileExt = file.name.split('.').pop();
        const fileName = `avatar_${user.id}_${Date.now()}.${fileExt}`;

        // 3. Envia para o Supabase Storage
        const { error: uploadError } = await _supabase.storage
            .from('avatars')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) throw uploadError;

        // 4. Pega a URL Pública (o link da imagem)
        const { data: { publicUrl } } = _supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);

        // 5. Salva esse link na tabela 'profiles'
        const { error: dbError } = await _supabase
            .from('profiles')
            .update({ foto_url: publicUrl })
            .eq('id', user.id);

        if (dbError) throw dbError;

        // 6. Atualiza a tela imediatamente
        atualizarAvatarNaTela(publicUrl);
        showToast('Foto atualizada com sucesso!', 'success');

    } catch (error) {
        console.error("Erro no upload:", error);
        showToast('Erro ao enviar foto: ' + error.message, 'error');
        iconDiv.innerHTML = '<i class="fas fa-user"></i>'; // Volta o ícone normal
    }
}

// Função auxiliar para mostrar a foto na tela
function atualizarAvatarNaTela(url) {
    const img = document.getElementById('avatarPreview');
    const icon = document.getElementById('avatarDefaultIcon');
    
    if (url) {
        img.src = url;
        img.style.display = 'block'; // Mostra a foto
        icon.style.display = 'none'; // Esconde o ícone
    } else { 
        img.style.display = 'none';
        icon.style.display = 'flex';
    }
}

// Exporta para garantir
window.verificarStatusGoogle = verificarStatusGoogle;
// Localize a linha 1040 do app.js e substitua a função por esta:
window.carregarDadosPerfil = async function() {
    console.log("🚀 Carregando Perfil Único e Link..."); 

    try {
        // 1. Verifica login
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) {
            showToast('Usuário não logado!', 'error');
            return;
        }

        // 2. Preenche o e-mail no cabeçalho (usa o ID correto: headerEmail)
        const emailEl = document.getElementById('headerEmail');
        if(emailEl) emailEl.textContent = user.email;

        // 3. Busca dados no banco
        const { data: perfil, error } = await _supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

        if (perfil) {
            // Preenche os inputs (IDs corretos: profNome, profEspecialidade, profTelefone)
            if(document.getElementById('profNome')) 
                document.getElementById('profNome').value = perfil.nome || '';
                
            if(document.getElementById('headerNome')) 
                document.getElementById('headerNome').textContent = perfil.nome || 'Doutora';
                
            if(document.getElementById('profEspecialidade')) 
                document.getElementById('profEspecialidade').value = perfil.especialidade || '';
                
            if(document.getElementById('profTelefone')) 
                document.getElementById('profTelefone').value = perfil.telefone || '';
                
            if (perfil.foto_url && window.atualizarAvatarNaTela) {
                window.atualizarAvatarNaTela(perfil.foto_url);
            }
        }

        // 4. GERAÇÃO DO LINK (O segredo está aqui!)
        const urlBase = window.location.origin + window.location.pathname.replace('index.html', '');
        const linkFinal = `${urlBase}agendar.html?ref=${user.id}`;
        
        const elLink = document.getElementById('profLink');
        if (elLink) {
            elLink.value = linkFinal;
            console.log("✅ Link gerado:", linkFinal);
        }

        // 5. TROCA DE TELA
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        const divPerfil = document.getElementById('perfilPage');
        if (divPerfil) divPerfil.classList.add('active');

    } catch (err) {
        console.error("Erro crítico no perfil:", err);
    }
};

// Expor também a função de upload (caso tenha dado erro nela também)
if (typeof uploadFotoPerfil !== 'undefined') {
    window.uploadFotoPerfil = uploadFotoPerfil;
}

window.copiarLinkPerfil = copiarLinkPerfil; // Se tiver criado essa também

// ==============================================================
// 🔄 SINCRONIZADOR GOOGLE NATIVO (100% SUPABASE + FETCH)
// ==============================================================
window.sincronizarPendentesGoogle = async function() {
    console.log("🔄 Sincronizando com Google via API Nativa...");

    const btn = document.querySelector('button[onclick*="sincronizarPendentesGoogle"]');
    const iconeOriginal = btn ? btn.innerHTML : '';
    if(btn) { btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true; }

    try {
        // 1. Pega o Token Seguro diretamente do Supabase
        const { data: { session } } = await window._supabase.auth.getSession();
        const token = session?.provider_token;

        if (!token) {
            showToast('Você não está conectado ao Google. Faça login novamente com o Google.', 'warning');
            return;
        }

        const hoje = new Date().toISOString().split('T')[0];

        // 2. Busca Pendentes no Banco de Dados
        const { data: pendentes, error } = await window._supabase
            .from('agendamentos')
            .select('*, clientes(nome)')
            .gte('data', hoje)
            .is('google_event_id', null)
            .neq('status', 'cancelado');

        if (error) throw error;

        if (!pendentes || pendentes.length === 0) {
            showToast('Tudo atualizado! Nenhum agendamento pendente para enviar.', 'success');
            return;
        }

        let enviados = 0;
        for (const agenda of pendentes) {
            try {
                const inicio = `${agenda.data}T${agenda.hora}:00`;
                const dataInicio = new Date(inicio);
                const dataFim = new Date(dataInicio.getTime() + 60*60*1000); // Duração: 1 hora
                const fim = dataFim.toISOString().split('.')[0];

                const nomeCliente = agenda.clientes?.nome || 'Cliente Site';

                const evento = {
                    'summary': `💆‍♀️ ${agenda.servico_nome || 'Serviço'} - ${nomeCliente}`,
                    'description': `Agendamento via App. Obs: ${agenda.observacoes || '-'}`,
                    'start': { 'dateTime': inicio, 'timeZone': 'America/Sao_Paulo' },
                    'end':   { 'dateTime': fim, 'timeZone': 'America/Sao_Paulo' },
                    'colorId': '5' // Cor Amarela
                };

                // 3. Comunica com o Google diretamente, sem usar o 'gapi'!
                const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(evento)
                });

                const result = await response.json();

                if (!response.ok) {
                    console.error("Erro retornado pelo Google:", result);
                    throw new Error(result.error?.message || "Erro ao conectar com a Agenda.");
                }

                // 4. Salva o ID do Google de volta no nosso banco
                if (result.id) {
                    await window._supabase.from('agendamentos')
                        .update({ google_event_id: result.id })
                        .eq('id', agenda.id);
                    enviados++;
                }
            } catch (errEnvio) {
                console.error("Erro ao enviar item específico:", errEnvio);
            }
        }
        
        if (enviados > 0) {
            showToast(`${enviados} agendamentos enviados para o Google!`, 'success');
        }
    } catch (erro) {
        console.error("Erro Sync:", erro);
        showToast('Erro na sincronização. Certifique-se de estar logado com o Google.', 'error');
    } finally {
        if(btn) { btn.innerHTML = iconeOriginal; btn.disabled = false; }
    }
};

// ==============================================================
// 🤖 ABA DE AUTOMAÇÕES, WHATSAPP E E-MAIL (UNIFICADA)
// ==============================================================

const MENSAGEM_PADRAO_ZAP = `Olá {nome}! ✨\n\nPassando para confirmar o seu horário conosco.\n\n🗓 *Quando:* {data} às {hora}\n📌 *Procedimento:* {servico}\n\nPodemos confirmar sua presença? ✅`;
const EMAIL_PADRAO_ASSUNTO = "Seu agendamento está confirmado! ✨";
const EMAIL_PADRAO_CORPO = "Olá {nome},\n\nSeu agendamento para o procedimento {servico} foi confirmado com sucesso!\n\nTe esperamos no dia {data} às {hora}.\n\nAtenciosamente,\nEquipe Agendamento Premium";

window.carregarAutomacoes = async function() {
    console.log("⚙️ Carregando Automações...");
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return;

        const { data: perfil } = await _supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
        
        // 1. WhatsApp
        const elZap = document.getElementById('textoAutomacaoZap');
        if (elZap) elZap.value = (perfil && perfil.mensagem_whatsapp) ? perfil.mensagem_whatsapp : MENSAGEM_PADRAO_ZAP;

        // 2. E-mail
        const elAssunto = document.getElementById('textoAssuntoEmail');
        if (elAssunto) elAssunto.value = (perfil && perfil.email_assunto) ? perfil.email_assunto : EMAIL_PADRAO_ASSUNTO;

        const elCorpo = document.getElementById('textoCorpoEmail');
        if (elCorpo) elCorpo.value = (perfil && perfil.email_corpo) ? perfil.email_corpo : EMAIL_PADRAO_CORPO;

        const elToggle = document.getElementById('emailAtivoToggle');
        if (elToggle) elToggle.checked = (perfil && perfil.email_ativo === true);
        
    } catch (err) {
        console.error("Erro ao carregar automações:", err);
    }
};

window.salvarAutomacoes = async function(btnElement) {
    const textoNovo = document.getElementById('textoAutomacaoZap').value;
    const textoBotaoOriginal = btnElement.innerHTML;
    btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    btnElement.disabled = true;

    try {
        const { data: { user } } = await _supabase.auth.getUser();
        const { error } = await _supabase.from('profiles').upsert({ id: user.id, mensagem_whatsapp: textoNovo });
        if (error) throw error;
        if(typeof showToast === 'function') showToast("Mensagem do WhatsApp salva!", "success");
    } catch (err) {
        console.error(err);
        showToast('Erro ao salvar mensagem.', 'error');
    } finally {
        btnElement.innerHTML = textoBotaoOriginal;
        btnElement.disabled = false;
    }
};

window.salvarAutomacoesEmail = async function(btnElement) {
    const assunto = document.getElementById('textoAssuntoEmail').value;
    const corpo = document.getElementById('textoCorpoEmail').value;
    const ativo = document.getElementById('emailAtivoToggle').checked;
    
    const textoBotaoOriginal = btnElement.innerHTML;
    btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    btnElement.disabled = true;

    try {
        const { data: { user } } = await _supabase.auth.getUser();
        const { error } = await _supabase.from('profiles').upsert({ 
            id: user.id, 
            email_assunto: assunto,
            email_corpo: corpo,
            email_ativo: ativo
        });
        if (error) throw error;
        if(typeof showToast === 'function') showToast("Configurações de e-mail atualizadas!", "success");
    } catch (err) {
        console.error(err);
        showToast('Erro ao salvar configurações de e-mail.', 'error');
    } finally {
        btnElement.innerHTML = textoBotaoOriginal;
        btnElement.disabled = false;
    }
};

window.inserirVariavel = function(variavel) {
    const textarea = document.getElementById('textoAutomacaoZap');
    if (!textarea) return;
    const inicio = textarea.selectionStart;
    const fim = textarea.selectionEnd;
    const texto = textarea.value;
    textarea.value = texto.substring(0, inicio) + variavel + texto.substring(fim);
    textarea.focus();
    textarea.selectionEnd = inicio + variavel.length; 
};

// ==============================================================
// ✉️ LÓGICA DO E-MAIL AUTOMÁTICO
// ==============================================================

async function carregarAutomacoes() {
    console.log("⚙️ Carregando Automações...");
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return;

        const { data: perfil } = await _supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
        
        // 🛡️ Textos Padrões (Guardados DENTRO da função para nunca dar erro)
        const padraoZap = `Olá {nome}! ✨\n\nVocê tem um agendamento marcado com a Dra. Joyce Corrêa.\n\n🗓 *Quando:* {data} às {hora}\n💆‍♀️ *Procedimento:* {servico}\n\nPodemos confirmar sua presença? 😘`;
        const padraoAssunto = "Seu agendamento está confirmado! ✨";
        const padraoCorpo = "Olá {nome},\n\nSeu agendamento para o procedimento {servico} foi confirmado com sucesso!\n\nTe esperamos no dia {data} às {hora}.\n\nAtenciosamente,\nEquipe Agendamento Premium";

        // Carrega WhatsApp
        const elZap = document.getElementById('textoAutomacaoZap');
        if (elZap) elZap.value = (perfil && perfil.mensagem_whatsapp) ? perfil.mensagem_whatsapp : padraoZap;

        // Carrega E-mail
        const elAssunto = document.getElementById('textoAssuntoEmail');
        if (elAssunto) elAssunto.value = (perfil && perfil.email_assunto) ? perfil.email_assunto : padraoAssunto;

        const elCorpo = document.getElementById('textoCorpoEmail');
        if (elCorpo) elCorpo.value = (perfil && perfil.email_corpo) ? perfil.email_corpo : padraoCorpo;

        const elToggle = document.getElementById('emailAtivoToggle');
        if (elToggle) elToggle.checked = (perfil && perfil.email_ativo === true);
        
    } catch (err) { console.error("Erro ao carregar automações:", err); }
}

async function salvarAutomacoes(btnElement) {
    const textoNovo = document.getElementById('textoAutomacaoZap').value;
    const textoBotaoOriginal = btnElement.innerHTML;
    btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    btnElement.disabled = true;

    try {
        const { data: { user } } = await _supabase.auth.getUser();
        const { error } = await _supabase.from('profiles').upsert({ id: user.id, mensagem_whatsapp: textoNovo });
        if (error) throw error;
        if(typeof showToast === 'function') showToast("Mensagem do WhatsApp salva!", "success");
    } catch (err) { showToast('Erro ao salvar mensagem.', 'error'); }
    finally { btnElement.innerHTML = textoBotaoOriginal; btnElement.disabled = false; }
}

async function salvarAutomacoesEmail(btnElement) {
    const assunto = document.getElementById('textoAssuntoEmail').value;
    const corpo = document.getElementById('textoCorpoEmail').value;
    const ativo = document.getElementById('emailAtivoToggle').checked;
    
    const textoBotaoOriginal = btnElement.innerHTML;
    btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    btnElement.disabled = true;

    try {
        const { data: { user } } = await _supabase.auth.getUser();
        const { error } = await _supabase.from('profiles').upsert({ 
            id: user.id, email_assunto: assunto, email_corpo: corpo, email_ativo: ativo 
        });
        if (error) throw error;
        if(typeof showToast === 'function') showToast("Configurações de e-mail atualizadas!", "success");
    } catch (err) { showToast('Erro ao salvar configurações de e-mail.', 'error'); }
    finally { btnElement.innerHTML = textoBotaoOriginal; btnElement.disabled = false; }
}

function inserirVariavel(variavel) {
    const textarea = document.getElementById('textoAutomacaoZap');
    if (!textarea) return;
    const inicio = textarea.selectionStart;
    const fim = textarea.selectionEnd;
    const texto = textarea.value;
    textarea.value = texto.substring(0, inicio) + variavel + texto.substring(fim);
    textarea.focus();
    textarea.selectionEnd = inicio + variavel.length; 
}

window.dispararWhatsAppManual = async function(telefone, nome, dataHoraBr, procedimento) {
    if (!telefone || String(telefone).trim() === '') { showToast('Cliente sem telefone cadastrado.', 'warning'); return; }
    let numLimpo = String(telefone).replace(/\D/g, ''); 
    if (numLimpo.startsWith('0')) numLimpo = numLimpo.substring(1);
    if (!numLimpo.startsWith('55')) numLimpo = `55${numLimpo}`;
    if (numLimpo.length < 12 || numLimpo.length > 13) { showToast('O telefone deste cliente está incorreto.', 'warning'); return; }

    const partes = dataHoraBr.split(' às ');
    const dataApenas = partes[0] || '';
    const horaApenas = partes[1] || '';

    let textoBase = `Olá {nome}! ✨\n\nVocê tem um agendamento marcado com a Dra. Joyce Corrêa.\n\n🗓 *Quando:* {data} às {hora}\n💆‍♀️ *Procedimento:* {servico}\n\nPodemos confirmar sua presença? 😘`;
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        const { data: perfil } = await _supabase.from('profiles').select('mensagem_whatsapp').eq('id', user.id).maybeSingle();
        if (perfil && perfil.mensagem_whatsapp) textoBase = perfil.mensagem_whatsapp;
    } catch(e) { console.warn("Usando mensagem padrão."); }

    let textoFinal = textoBase
        .replace(/{nome}/g, (nome || 'Cliente').split(' ')[0])
        .replace(/{data}/g, dataApenas)
        .replace(/{hora}/g, horaApenas)
        .replace(/{servico}/g, procedimento || 'Atendimento');
    
    window.open(`https://api.whatsapp.com/send?phone=${numLimpo}&text=${encodeURIComponent(textoFinal)}`, '_blank');
};

window.dispararEmailAutomatico = async function(emailCliente, nomeCliente, dataHoraBr, procedimento) {
    if (!emailCliente || !emailCliente.includes('@')) return;
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        const { data: perfil } = await _supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
        if (!perfil || perfil.email_ativo !== true) return;

        const partes = dataHoraBr.split(' às ');
        const dataApenas = partes[0] || '';
        const horaApenas = partes[1] || '';

        const padraoAssunto = "Seu agendamento está confirmado! ✨";
        const padraoCorpo = "Olá {nome},\n\nSeu agendamento para o procedimento {servico} foi confirmado com sucesso!\n\nTe esperamos no dia {data} às {hora}.\n\nAtenciosamente,\nEquipe Agendamento Premium";

        let assuntoFinal = (perfil.email_assunto || padraoAssunto)
            .replace(/{nome}/g, nomeCliente.split(' ')[0])
            .replace(/{data}/g, dataApenas)
            .replace(/{hora}/g, horaApenas)
            .replace(/{servico}/g, procedimento);

        let corpoFinal = (perfil.email_corpo || padraoCorpo)
            .replace(/{nome}/g, nomeCliente.split(' ')[0])
            .replace(/{data}/g, dataApenas)
            .replace(/{hora}/g, horaApenas)
            .replace(/{servico}/g, procedimento);

        const { data, error } = await _supabase.functions.invoke('enviar-email', {
            body: { para: emailCliente, reply_to: user.email, assunto: assuntoFinal, corpo: corpoFinal }
        });

        if (error) console.error("Erro ao chamar Edge Function:", error);
        else console.log("✅ E-mail enviado com sucesso!");

    } catch (error) { console.error("Erro interno no e-mail:", error); }
};

// OBRIGATÓRIO: Conecta as funções seguras ao navegador
window.carregarAutomacoes = carregarAutomacoes;
window.salvarAutomacoes = salvarAutomacoes;
window.salvarAutomacoesEmail = salvarAutomacoesEmail;
window.inserirVariavel = inserirVariavel;

// ==============================================================
// 🔍 AUTOCOMPLETE INTELIGENTE (CLIENTES E SERVIÇOS)
// ==============================================================

window.abrirDropdownCliente = function() {
    const dropdown = document.getElementById('dropdownClientes');
    if(dropdown) dropdown.style.display = 'block';
    window.filtrarClientesDropdown();
}

window.filtrarClientesDropdown = function() {
    const input = document.getElementById('inputBuscaCliente');
    const dropdown = document.getElementById('dropdownClientes');
    if (!input || !dropdown) return;

    const termo = input.value.toLowerCase();
    dropdown.style.display = 'block';
    
    // Puxa os clientes do estado global e ordena de A a Z
    let filtrados = [...appState.clientes].sort((a, b) => a.nome.localeCompare(b.nome));
    
    if (termo) {
        filtrados = filtrados.filter(c => c.nome.toLowerCase().includes(termo));
    }

    if (filtrados.length === 0) {
        dropdown.innerHTML = '<div style="padding: 15px; color: #888; text-align: center;">Nenhum cliente encontrado.</div>';
        return;
    }

    dropdown.innerHTML = filtrados.map(c => `
        <div style="padding: 12px 15px; border-bottom: 1px solid #444; cursor: pointer; color: #fff; background: #2A2A2A;" 
             onclick="selecionarCliente('${c.id}', '${c.nome.replace(/'/g, "\\'")}')"
             onmouseover="this.style.background='#333'" 
             onmouseout="this.style.background='#2A2A2A'">
            ${c.nome}
        </div>
    `).join('');
}

window.selecionarCliente = function(id, nome) {
    document.getElementById('agendamentoCliente').value = id;
    document.getElementById('inputBuscaCliente').value = nome;
    document.getElementById('dropdownClientes').style.display = 'none';
}

// --- SERVIÇOS ---
window.abrirDropdownServico = function() {
    const dropdown = document.getElementById('dropdownServicos');
    if(dropdown) dropdown.style.display = 'block';
    window.filtrarServicosDropdown();
}

window.filtrarServicosDropdown = function() {
    const input = document.getElementById('inputBuscaServico');
    const dropdown = document.getElementById('dropdownServicos');
    if (!input || !dropdown) return;

    const termo = input.value.toLowerCase();
    dropdown.style.display = 'block';
    
    let filtrados = [...appState.servicos].sort((a, b) => a.nome.localeCompare(b.nome));
    
    if (termo) {
        filtrados = filtrados.filter(s => s.nome.toLowerCase().includes(termo));
    }

    if (filtrados.length === 0) {
        dropdown.innerHTML = '<div style="padding: 15px; color: #888; text-align: center;">Nenhum serviço encontrado.</div>';
        return;
    }

    dropdown.innerHTML = filtrados.map(s => `
        <div style="padding: 12px 15px; border-bottom: 1px solid #444; cursor: pointer; color: #fff; background: #2A2A2A; display: flex; justify-content: space-between;" 
             onclick="selecionarServico('${s.id}', '${s.nome.replace(/'/g, "\\'")}', '${s.valor}')"
             onmouseover="this.style.background='#333'" 
             onmouseout="this.style.background='#2A2A2A'">
            <span>${s.nome}</span>
            <span style="color: var(--gold);">R$ ${parseFloat(s.valor).toFixed(2)}</span>
        </div>
    `).join('');
}

window.selecionarServico = function(id, nome, valor) {
    document.getElementById('agendamentoServico').value = id;
    document.getElementById('inputBuscaServico').value = nome;
    
    // Atualiza o input de valor visualmente
    const inputValor = document.getElementById('agendamentoValor');
    if (inputValor) {
        inputValor.value = parseFloat(valor).toFixed(2);
    }
    
    document.getElementById('dropdownServicos').style.display = 'none';
}

// Fecha a lista se a doutora clicar fora dela
document.addEventListener('click', function(e) {
    const boxClientes = document.getElementById('dropdownClientes');
    const boxServicos = document.getElementById('dropdownServicos');
    
    if (boxClientes && !e.target.closest('#inputBuscaCliente') && !e.target.closest('#dropdownClientes')) {
        boxClientes.style.display = 'none';
    }
    if (boxServicos && !e.target.closest('#inputBuscaServico') && !e.target.closest('#dropdownServicos')) {
        boxServicos.style.display = 'none';
    }
});

window.filtrarServicosModal = function() {
    const termo = document.getElementById('searchServicoModal')?.value.toLowerCase() || '';
    const selServico = document.getElementById('agendamentoServico');
    if (!selServico) return;

    // Ordena serviços de A a Z
    let servicosOrdenados = [...appState.servicos].sort((a, b) => a.nome.localeCompare(b.nome));
    
    if (termo) {
        servicosOrdenados = servicosOrdenados.filter(s => s.nome.toLowerCase().includes(termo));
    }

    const valorAtual = selServico.value;

    selServico.innerHTML = '<option value="">Selecione o Serviço...</option>' + 
        servicosOrdenados.map(s => `<option value="${s.id}" data-valor="${s.valor}">${s.nome}</option>`).join('');

    if (valorAtual) selServico.value = valorAtual;
};

// ==============================================================
// 🎯 FINALIZAR / ESTORNAR ATENDIMENTOS EM TEMPO REAL
// ==============================================================

async function concluirAgendamento(agendamentoId) {
    if (!confirm('Deseja finalizar este atendimento? Os produtos vinculados serão debitados do estoque.')) return;

    const overlay = document.getElementById('loadingScreen');
    if (overlay) { overlay.classList.remove('hidden'); overlay.querySelector('h2').textContent = "Baixando Estoque..."; }

    try {
        const agendamento = appState.agendamentos.find(a => a.id === agendamentoId);
        if (!agendamento) throw new Error("Agendamento não encontrado.");

        // 1. Muda para CANCELADO (Isso impede o robô de auto-concluir ele de novo)
        await _supabase.from('agendamentos').update({ status: 'cancelado' }).eq('id', agendamentoId);

        // 2. Baixa Estoque
        if (agendamento.servico_id) {
            const servico = appState.servicos.find(s => s.id === agendamento.servico_id);
            if (servico && servico.produtos_vinculados) {
                for (const prodUsado of servico.produtos_vinculados) {
                    const itemEstoque = appState.estoque.find(e => e.id === prodUsado.estoque_id);
                    if (itemEstoque) {
                        let novaQtd = itemEstoque.quantidade - prodUsado.quantidade;
                        if (novaQtd < 0) novaQtd = 0;
                        await _supabase.from('estoque').update({ quantidade: novaQtd }).eq('id', itemEstoque.id);
                    }
                }
            }
        }

        if(typeof showToast === 'function') showToast('Atendimento concluído! 📦', 'success');

        // 3. RECARREGA TELA DO CLIENTE
        if (typeof carregarDadosIniciais === 'function') await carregarDadosIniciais();
        if (agendamento.cliente_id) abrirDetalhesCliente(agendamento.cliente_id); 
        if (typeof carregarDashboard === 'function' && appState.currentPage === 'dashboard') carregarDashboard();

    } catch (err) {
        console.error('Erro:', err);
        if(typeof showToast === 'function') showToast('Erro ao concluir.', 'error');
    } finally {
        if (overlay) { overlay.classList.add('hidden'); overlay.querySelector('h2').textContent = "Agendamento Premium"; }
    }
}

// ==============================================================
// 🔄 AUTO-CONCLUSÃO DE DIAS ANTERIORES E ESTORNO
// ==============================================================

async function autoConcluirPassados() {
    const hojeStr = new Date().toISOString().split('T')[0];
    
    // Procura agendamentos que a data é menor que hoje e ainda estão pendentes
    const passadosPendentes = appState.agendamentos.filter(a => a.data < hojeStr && a.status === 'pendente');

    if (passadosPendentes.length === 0) return;
    console.log(`⚡ Auto-concluindo ${passadosPendentes.length} agendamentos antigos...`);

    for (const agenda of passadosPendentes) {
        try {
            await _supabase.from('agendamentos').update({ status: 'concluido' }).eq('id', agenda.id);

            if (agenda.servico_id) {
                const servico = appState.servicos.find(s => s.id === agenda.servico_id);
                if (servico && servico.produtos_vinculados) {
                    for (const prod of servico.produtos_vinculados) {
                        const itemEstoque = appState.estoque.find(e => e.id === prod.estoque_id);
                        if (itemEstoque) {
                            let novaQtd = itemEstoque.quantidade - prod.quantidade;
                            if (novaQtd < 0) novaQtd = 0;
                            
                            await _supabase.from('estoque').update({ quantidade: novaQtd }).eq('id', itemEstoque.id);
                            itemEstoque.quantidade = novaQtd; 
                        }
                    }
                }
            }
            agenda.status = 'concluido'; 
        } catch(e) { console.error("Erro na auto-conclusão:", e); }
    }
}

async function reverterConclusao(agendamentoId) {
    if (!confirm('Deseja DESFAZER este atendimento?\nO status mudará para Cancelado/Falta e os produtos retornarão ao estoque.')) return;

    const overlay = document.getElementById('loadingScreen');
    if (overlay) { overlay.classList.remove('hidden'); overlay.querySelector('h2').textContent = "Estornando..."; }

    try {
        const agendamento = appState.agendamentos.find(a => a.id === agendamentoId);
        if (!agendamento) return;

        // 1. Muda para CANCELADO (Isso impede o robô de auto-concluir ele de novo)
        await _supabase.from('agendamentos').update({ status: 'cancelado' }).eq('id', agendamentoId);

        // 2. Devolve para o Estoque
        if (agendamento.servico_id) {
            const servico = appState.servicos.find(s => s.id === agendamento.servico_id);
            if (servico && servico.produtos_vinculados) {
                for (const prod of servico.produtos_vinculados) {
                    const itemEstoque = appState.estoque.find(e => e.id === prod.estoque_id);
                    if (itemEstoque) {
                        let novaQtd = itemEstoque.quantidade + prod.quantidade; 
                        await _supabase.from('estoque').update({ quantidade: novaQtd }).eq('id', itemEstoque.id);
                    }
                }
            }
        }

        if(typeof showToast === 'function') showToast('Conclusão desfeita e estoque estornado!', 'info');
        
        // 3. RECARREGA TELA DO CLIENTE
        if (typeof carregarDadosIniciais === 'function') await carregarDadosIniciais();
        if (agendamento.cliente_id) abrirDetalhesCliente(agendamento.cliente_id);
        if (typeof carregarDashboard === 'function' && appState.currentPage === 'dashboard') carregarDashboard();

    } catch (err) {
        console.error(err);
        showToast('Erro ao reverter: ' + err.message, 'error');
    } finally {
        if (overlay) { overlay.classList.add('hidden'); overlay.querySelector('h2').textContent = "Agendamento Premium"; }
    }
}

// 🛡️ EXPORTAÇÃO GLOBAL BLINDADA (Isso garante que o HTML ache os botões)
window.concluirAgendamento = concluirAgendamento;
window.autoConcluirPassados = autoConcluirPassados;
window.reverterConclusao = reverterConclusao;

// ==============================================================
// 🚪 FUNÇÃO DE LOGOUT (BLINDADA)
// ==============================================================
window.fazerLogout = async function(event) {
    // Evita comportamento padrão e cliques duplos
    if (event) event.preventDefault();

    if (!confirm("Deseja realmente desconectar e sair do sistema?")) return;

    try {
        // Feedback visual no botão
        const btn = document.querySelector('.btn-logout');
        const textoOriginal = btn ? btn.innerHTML : 'Sair';
        if (btn) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saindo...';
            btn.disabled = true;
        }

        // Desloga do Supabase
        const { error } = await _supabase.auth.signOut();
        if (error) throw error;
        
        // Redireciona para a tela de login
        window.location.replace('login.html');
        
    } catch (err) {
        console.error("Erro ao sair:", err);
        showToast('Erro ao sair: ' + err.message, 'error');
        // Em caso de falha, força um recarregamento para limpar o cache da sessão
        window.location.reload();
    }
};

// ========================================
// 🗑️ FUNÇÃO QUE FALTAVA (EXCLUIR SERVIÇO)
// ========================================
async function excluirServico(id) {
    if (!id || id === 'undefined') return;
    if (!confirm('Tem certeza que deseja excluir este serviço permanentemente?')) return;

    try {
        const { error } = await _supabase.from('servicos').delete().eq('id', id);
        if (error) throw error;
        
        if(typeof showToast === 'function') showToast('Serviço excluído com sucesso!', 'success');
        if(typeof carregarServicos === 'function') carregarServicos();
    } catch (err) {
        console.error(err);
        if(typeof showToast === 'function') showToast('Erro ao excluir serviço.', 'error');
    }
}