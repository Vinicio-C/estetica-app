// ========================================
// Estética Premium - App JavaScript
// ========================================

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
    console.log('🌟 Inicializando Estética Premium...');
    
    // Registrar Service Worker para PWA
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('/service-worker.js');
            console.log('✅ Service Worker registrado');
        } catch (err) {
            console.log('⚠️ Service Worker não registrado:', err);
        }
    }
    
    // Configurar event listeners
    setupEventListeners();
    
    // Carregar dados iniciais
    await carregarDadosIniciais();
    
    // Inicializar página
    carregarDashboard();
    
    // Ocultar loading screen
    setTimeout(() => {
        document.getElementById('loadingScreen').classList.add('hidden');
    }, 1000);
});

// ========================================
// Event Listeners
// ========================================
function setupEventListeners() {
    // Menu sidebar
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            navigateTo(page);
        });
    });
    
    // Menu toggle (mobile)
    document.getElementById('menuToggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('active');
        document.getElementById('overlay').classList.toggle('active');
    });
    
    // Overlay (fechar sidebar mobile)
    document.getElementById('overlay').addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
    });
    
    // Forms
    document.getElementById('formCliente').addEventListener('submit', salvarCliente);
    document.getElementById('formAgendamento').addEventListener('submit', salvarAgendamento);
    document.getElementById('formServico').addEventListener('submit', salvarServico);
    document.getElementById('formEstoque').addEventListener('submit', salvarEstoque);
    
    // Search bars
    document.getElementById('searchClientes').addEventListener('input', (e) => {
        filtrarClientes(e.target.value);
    });
    
    document.getElementById('searchServicos').addEventListener('input', (e) => {
        filtrarServicos(e.target.value);
    });
    
    document.getElementById('searchEstoque').addEventListener('input', (e) => {
        filtrarEstoque(e.target.value);
    });

    // Botão de Notificações (Sininho)
    document.getElementById('notificationsBtn').addEventListener('click', async () => {
    // 1. Tentar pedir permissão
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
        // 2. Se aceitou, envia notificação de teste
        showToast('Notificações ativadas com sucesso!', 'success');
        
        if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.ready;
            reg.showNotification('Estética Premium', {
                body: 'Você receberá avisos sobre agendamentos e estoque!',
                icon: 'icons/icon-192.png',
                vibrate: [200, 100, 200]
            });
        }
    } else {
        // 3. Se negou
        showToast('Para receber alertas, ative as notificações nas Configurações do iPhone.', 'warning');
    }
});
    
    // Agenda date picker
    const agendaDateInput = document.getElementById('agendaDate');
    agendaDateInput.value = formatDateInput(appState.currentAgendaDate);
    agendaDateInput.addEventListener('change', (e) => {
        appState.currentAgendaDate = new Date(e.target.value + 'T00:00:00');
        carregarAgenda();
    });
}

// ========================================
// Navegação
// ========================================
function navigateTo(page) {
    // Atualizar estado
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
    document.getElementById(page + 'Page').classList.add('active');
    
    // Atualizar título
    const titles = {
        dashboard: 'Dashboard',
        clientes: 'Clientes',
        agenda: 'Agenda',
        servicos: 'Serviços',
        estoque: 'Estoque',
        relatorios: 'Relatórios'
    };
    document.getElementById('pageTitle').textContent = titles[page];
    
    // Carregar dados da página
    switch(page) {
        case 'dashboard':
            carregarDashboard();
            break;
        case 'clientes':
            carregarClientes();
            break;
        case 'agenda':
            carregarAgenda();
            break;
        case 'servicos':
            carregarServicos();
            break;
        case 'estoque':
            carregarEstoque();
            break;
        case 'relatorios':
            carregarRelatorios();
            break;
    }
    
    // Fechar sidebar mobile
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('overlay').classList.remove('active');
}

// ======================================== 
// Carregar Dados Iniciais
// ========================================
async function carregarDadosIniciais() {
    try {
        // Carregar todas as tabelas
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
        
        console.log('✅ Dados carregados:', {
            clientes: appState.clientes.length,
            servicos: appState.servicos.length,
            estoque: appState.estoque.length,
            agendamentos: appState.agendamentos.length,
            pagamentos: appState.pagamentos.length
        });
    } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
    }
}

// ========================================
// DASHBOARD (Versão Final: Notificações + Listas Completas)
// ========================================
async function carregarDashboard() {
    // 1. Recarregar dados frescos
    await carregarDadosIniciais();
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    
    // --- CÁLCULOS DOS CARDS SUPERIORES ---
    const agendamentosHoje = appState.agendamentos.filter(a => {
        const dataAgendamento = new Date(a.data);
        return dataAgendamento >= hoje && dataAgendamento < amanha && a.status !== 'cancelado';
    });
    
    const faturamentoHoje = agendamentosHoje
        .filter(a => a.status_pagamento === 'pago')
        .reduce((sum, a) => sum + (Number(a.valor) || 0), 0);
    
    const debitosTotal = appState.agendamentos
        .filter(a => a.status_pagamento === 'devendo') // Conta tudo que deve, concluído ou não (opcional: adicionar && a.status === 'concluido')
        .reduce((sum, a) => sum + (Number(a.valor) || 0), 0);
    
    // Atualizar HTML dos Cards
    document.getElementById('statAgendamentosHoje').textContent = agendamentosHoje.length;
    document.getElementById('statFaturamentoHoje').textContent = formatCurrency(faturamentoHoje);
    document.getElementById('statTotalClientes').textContent = appState.clientes.length;
    document.getElementById('statDebitosTotal').textContent = formatCurrency(debitosTotal);

    // --- LÓGICA DO BOTÃO DE NOTIFICAÇÃO (MANTIDA) ---
    // (A lógica do botão já está no HTML/CSS que fizemos antes, ou na função setupEventListeners)
    // Se precisar reinjetar o botão aqui, avise. Por enquanto, focamos nas listas abaixo.

    // --- 1. LISTA: PRÓXIMOS AGENDAMENTOS ---
    const proximosAgendamentos = appState.agendamentos
        .filter(a => new Date(a.data) >= hoje && a.status === 'agendado')
        .sort((a, b) => new Date(a.data) - new Date(b.data))
        .slice(0, 5);
    
    const proximosContainer = document.getElementById('proximosAgendamentos');
    if (proximosContainer) {
        if (proximosAgendamentos.length === 0) {
            proximosContainer.innerHTML = `<div class="empty-state"><i class="fas fa-calendar-check"></i><p>Agenda livre por enquanto</p></div>`;
        } else {
            proximosContainer.innerHTML = proximosAgendamentos.map(a => `
                <div class="agendamento-item">
                    <div class="agendamento-header">
                        <h4>${a.servico_nome || a.evento_nome}</h4>
                        <div class="agendamento-time"><i class="fas fa-clock"></i> ${formatDateTime(a.data)}</div>
                    </div>
                    <div class="agendamento-info">
                        ${a.cliente_nome ? `<i class="fas fa-user"></i> ${a.cliente_nome}` : ''}
                    </div>
                </div>
            `).join('');
        }
    }

    // --- 2. LISTA: ALERTAS DE ESTOQUE (CORREÇÃO AQUI) ---
    const alertasEstoque = appState.estoque.filter(p => p.quantidade <= p.quantidade_minima);
    const alertasContainer = document.getElementById('alertasEstoque');
    
    if (alertasContainer) {
        if (alertasEstoque.length === 0) {
            alertasContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-check-circle" style="color: var(--success)"></i>
                    <p>Estoque em dia</p>
                </div>`;
        } else {
            alertasContainer.innerHTML = alertasEstoque.map(p => `
                <div class="agendamento-item" style="border-left-color: ${p.quantidade === 0 ? 'var(--error)' : 'var(--warning)'};">
                    <div class="agendamento-header">
                        <h4>${p.nome}</h4>
                        <span style="color: ${p.quantidade === 0 ? 'var(--error)' : 'var(--warning)'}; font-weight: 700;">
                            ${p.quantidade} un.
                        </span>
                    </div>
                    <div class="agendamento-info">
                        Mínimo: ${p.quantidade_minima} un.
                    </div>
                </div>
            `).join('');
        }
    }

    // --- 3. LISTA: CLIENTES COM DÉBITOS (CORREÇÃO AQUI) ---
    // Agrupar débitos por cliente
    const debitosMap = {};
    appState.agendamentos.forEach(a => {
        if (a.status_pagamento === 'devendo' && a.status === 'concluido') {
            if (!debitosMap[a.cliente_id]) {
                debitosMap[a.cliente_id] = { 
                    nome: a.cliente_nome, 
                    total: 0, 
                    qtd: 0,
                    id: a.cliente_id 
                };
            }
            debitosMap[a.cliente_id].total += Number(a.valor);
            debitosMap[a.cliente_id].qtd++;
        }
    });

    const debitosArray = Object.values(debitosMap);
    const debitosContainer = document.getElementById('clientesDebitos');

    if (debitosContainer) {
        if (debitosArray.length === 0) {
            debitosContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-check-circle" style="color: var(--success)"></i>
                    <p>Nenhum débito pendente</p>
                </div>`;
        } else {
            debitosContainer.innerHTML = debitosArray.map(d => `
                <div class="agendamento-item" style="border-left-color: var(--error);" onclick="abrirDetalhesCliente('${d.id}')">
                    <div class="agendamento-header">
                        <h4>${d.nome}</h4>
                        <span style="color: var(--error); font-weight: 700; font-size: 1.1rem;">
                            ${formatCurrency(d.total)}
                        </span>
                    </div>
                    <div class="agendamento-info">
                        ${d.qtd} serviço(s) pendente(s)
                        <i class="fas fa-chevron-right" style="float: right; margin-top: 3px;"></i>
                    </div>
                </div>
            `).join('');
        }
    }
    
    // Atualizar também o dropdown de notificações se ele existir
    if (typeof atualizarNotificacoes === 'function') {
        atualizarNotificacoes();
    }
}

// ========================================
// CLIENTES
// ========================================
async function carregarClientes() {
    await carregarDadosIniciais();
    renderizarClientes(appState.clientes);
}

function renderizarClientes(clientes) {
    const container = document.getElementById('clientesGrid');
    
    if (clientes.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <i class="fas fa-users"></i>
                <p>Nenhum cliente cadastrado</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = clientes.map(cliente => {
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
}

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
        // Editar cliente
        const cliente = appState.clientes.find(c => c.id === clienteId);
        if (cliente) {
            document.getElementById('modalClienteTitle').textContent = 'Editar Cliente';
            document.getElementById('clienteId').value = cliente.id;
            document.getElementById('clienteNome').value = cliente.nome;
            document.getElementById('clienteTelefone').value = cliente.telefone;
            document.getElementById('clienteEmail').value = cliente.email;
        }
    } else {
        // Novo cliente
        document.getElementById('modalClienteTitle').textContent = 'Novo Cliente';
        document.getElementById('clienteId').value = '';
    }
    
    modal.classList.add('active');
    document.getElementById('overlay').classList.add('active');
}

async function salvarCliente(e) {
    e.preventDefault();
    
    const id = document.getElementById('clienteId').value;
    const data = {
        nome: document.getElementById('clienteNome').value,
        telefone: document.getElementById('clienteTelefone').value,
        email: document.getElementById('clienteEmail').value,
        foto: '',
        data_cadastro: new Date().toISOString()
    };
    
    try {
        if (id) {
            // Atualizar
            await fetchAPI(`tables/clientes/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            showToast('Cliente atualizado com sucesso!', 'success');
        } else {
            // Criar
            await fetchAPI('tables/clientes', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            showToast('Cliente cadastrado com sucesso!', 'success');
        }
        
        fecharModal('modalCliente');
        await carregarClientes();
    } catch (error) {
        showToast('Erro ao salvar cliente', 'error');
    }
}

async function abrirDetalhesCliente(clienteId) {
    const cliente = appState.clientes.find(c => c.id === clienteId);
    if (!cliente) return;
    
    appState.currentCliente = cliente;
    
    // Calcular estatísticas
    const servicosCliente = appState.agendamentos.filter(a => 
        a.cliente_id === cliente.id && a.status === 'concluido'
    );
    
    const totalServicos = servicosCliente.length;
    
    const valorTotal = servicosCliente.reduce((sum, a) => sum + (a.valor || 0), 0);
    
    const debitos = appState.agendamentos
        .filter(a => a.cliente_id === cliente.id && a.status_pagamento === 'devendo' && a.status === 'concluido')
        .reduce((sum, a) => sum + (a.valor || 0), 0);
    
    // Preencher modal
    document.getElementById('detalhesClienteNome').textContent = cliente.nome;
    document.getElementById('detalhesClienteTelefone').textContent = cliente.telefone;
    document.getElementById('detalhesClienteEmail').textContent = cliente.email;
    document.getElementById('detalhesTotalServicos').textContent = totalServicos;
    document.getElementById('detalhesValorTotal').textContent = formatCurrency(valorTotal);
    document.getElementById('detalhesDebitos').textContent = formatCurrency(debitos);
    
    // Histórico
    const historico = servicosCliente
        .sort((a, b) => new Date(b.data) - new Date(a.data));
    
    const historicoHTML = historico.length === 0 ? `
        <div class="empty-state">
            <i class="fas fa-history"></i>
            <p>Nenhum serviço realizado</p>
        </div>
    ` : historico.map(a => `
        <div class="agendamento-item">
            <div class="agendamento-header">
                <h4>${a.servico_nome}</h4>
                <strong style="color: var(--gold-dark);">${formatCurrency(a.valor)}</strong>
            </div>
            <div class="agendamento-details">
                <div class="agendamento-time">
                    <i class="fas fa-calendar"></i>
                    ${formatDate(a.data)}
                </div>
                <span class="status-badge ${a.status_pagamento}">${a.status_pagamento}</span>
            </div>
        </div>
    `).join('');
    
    document.getElementById('detalhesHistorico').innerHTML = historicoHTML;
    
    // Agendados este mês
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);
    
    const agendadosMes = appState.agendamentos.filter(a => {
        const dataAgendamento = new Date(a.data);
        return a.cliente_id === cliente.id && 
               a.status === 'agendado' &&
               dataAgendamento >= inicioMes && 
               dataAgendamento <= fimMes;
    });
    
    const agendadosHTML = agendadosMes.length === 0 ? `
        <div class="empty-state">
            <i class="fas fa-calendar"></i>
            <p>Nenhum agendamento este mês</p>
        </div>
    ` : agendadosMes.map(a => `
        <div class="agendamento-item">
            <div class="agendamento-header">
                <h4>${a.servico_nome}</h4>
                <strong style="color: var(--gold-dark);">${formatCurrency(a.valor)}</strong>
            </div>
            <div class="agendamento-time">
                <i class="fas fa-clock"></i>
                ${formatDateTime(a.data)}
            </div>
        </div>
    `).join('');
    
    document.getElementById('detalhesAgendados').innerHTML = agendadosHTML;
    
    // Débitos
    const debitosList = appState.agendamentos.filter(a => 
        a.cliente_id === cliente.id && a.status_pagamento === 'devendo' && a.status === 'concluido'
    );
    
    const debitosHTML = debitosList.length === 0 ? `
        <div class="empty-state">
            <i class="fas fa-check-circle"></i>
            <p>Nenhum débito pendente</p>
        </div>
    ` : debitosList.map(a => `
        <div class="agendamento-item" style="border-left-color: #E53935;">
            <div class="agendamento-header">
                <h4>${a.servico_nome}</h4>
                <strong style="color: #E53935;">${formatCurrency(a.valor)}</strong>
            </div>
            <div class="agendamento-time">
                <i class="fas fa-calendar"></i>
                ${formatDate(a.data)}
            </div>
            <button class="btn-primary btn-sm" style="margin-top: 0.5rem;" onclick="marcarComoPago('${a.id}')">
                <i class="fas fa-check"></i> Marcar como Pago
            </button>
        </div>
    `).join('');
    
    document.getElementById('detalhesDebitosList').innerHTML = debitosHTML;
    
    // Mostrar modal
    document.getElementById('modalDetalhesCliente').classList.add('active');
    document.getElementById('overlay').classList.add('active');
}

function editarCliente() {
    if (!appState.currentCliente) return;
    fecharModal('modalDetalhesCliente');
    abrirModalCliente(appState.currentCliente.id);
}

async function excluirCliente(id) {
    // 1. Tenta pegar o ID do parâmetro OU do cliente aberto na tela
    let idParaExcluir = id;
    
    // Se o ID for "undefined" (string) ou nulo, tenta pegar do estado global
    if (!idParaExcluir || idParaExcluir === 'undefined') {
        if (appState.currentCliente && appState.currentCliente.id) {
            idParaExcluir = appState.currentCliente.id;
        }
    }

    // 2. TRAVA DE SEGURANÇA FINAL
    // Se mesmo assim não tiver ID, para tudo e avisa. Não chama o Supabase.
    if (!idParaExcluir || idParaExcluir === 'undefined') {
        console.error('⛔ ERRO CRÍTICO: Tentativa de excluir sem ID válido.');
        alert('Erro: O sistema não conseguiu identificar qual cliente excluir.\nPor favor, feche e abra o detalhe do cliente novamente.');
        return; // <--- O CÓDIGO PARA AQUI
    }

    if (!confirm('Tem certeza? Isso apagará também o histórico e agendamentos deste cliente.')) return;

    try {
        console.log(`🗑️ Excluindo Cliente ID: ${idParaExcluir}`);

        // 3. Buscar agendamentos para limpar do Google Agenda
        const { data: agendamentosDoCliente } = await _supabase
            .from('agendamentos')
            .select('google_event_id')
            .eq('cliente_id', idParaExcluir);

        // Limpar do Google (se houver)
        if (agendamentosDoCliente && agendamentosDoCliente.length > 0) {
            for (const agenda of agendamentosDoCliente) {
                if (agenda.google_event_id && typeof deletarDoGoogleCalendar === 'function') {
                    await deletarDoGoogleCalendar(agenda.google_event_id);
                }
            }
        }

        // Use a variável nova 'idParaExcluir' que garantimos que tem valor
        await fetchAPI(`tables/clientes?id=eq.${idParaExcluir}`, { 
            method: 'DELETE'
        });

        showToast('Cliente excluído com sucesso!', 'success');
        
        // Atualizar interface
        closeModal('modalDetalhesCliente');
        if (typeof carregarDadosIniciais === 'function') await carregarDadosIniciais();
        if (typeof carregarDashboard === 'function') await carregarDashboard();
        if (appState.currentPage === 'clientes') carregarClientes();

    } catch (error) {
        console.error('Erro ao excluir:', error);
        showToast('Erro ao processar exclusão.', 'error');
    }
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
    // Busca dados frescos (usa o cache local do appState se possível, ou chama a API)
    const estoque = appState.estoque || [];
    const agendamentos = appState.agendamentos || [];
    
    const lista = document.getElementById('notifList');
    const badge = document.getElementById('notifCount');
    lista.innerHTML = '';
    
    let count = 0;
    let html = '';

    // 1. Alerta de Estoque Baixo
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

    // 2. Alerta de Contas a Receber (Atrasadas)
    const hoje = new Date();
    agendamentos.forEach(a => {
        const dataServico = new Date(a.data);
        // Se já passou, foi concluído e ainda deve
        if (dataServico < hoje && a.status === 'concluido' && a.status_pagamento === 'devendo') {
            count++;
            html += `
                <div class="notif-item critical" onclick="navigateTo('clientes')">
                    <div class="notif-icon"><i class="fas fa-exclamation-circle"></i></div>
                    <div class="notif-content">
                        <h4>Débito: ${a.cliente_nome}</h4>
                        <p>Venceu em ${new Date(a.data).toLocaleDateString()}</p>
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
    if (!token) return alert('Conecte a agenda primeiro!');

    // 1. Listar eventos do dia
    const resp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${start.toISOString()}&timeMax=${end.toISOString()}&singleEvents=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const lista = await resp.json();
    
    if (!lista.items || lista.items.length === 0) return alert('Nenhum evento encontrado neste dia.');

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
    alert(`Faxina concluída! ${apagados} eventos apagados.`);
}

// ========================================
// HELPER FUNCTIONS (Funções Auxiliares)
// ========================================

// Formata data para o valor do input type="date" (YYYY-MM-DD)
function formatDateInput(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
}

// Formata moeda (R$)
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

// Formata apenas data (DD/MM/YYYY)
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR').format(date);
}

// Formata apenas hora (HH:mm)
function formatTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
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