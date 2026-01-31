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
                alert('CEP não encontrado.');
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
        telefone: document.getElementById('clienteTelefone').value,
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
    const cliente = appState.clientes.find(c => c.id === clienteId);
    if (!cliente) return;
    
    appState.currentCliente = cliente;
    
    // Cálculos Financeiros (Mantidos do seu código original)
    const servicosCliente = appState.agendamentos.filter(a => a.cliente_id === cliente.id && a.status === 'concluido');
    const totalServicos = servicosCliente.length;
    const valorTotal = servicosCliente.reduce((sum, a) => sum + (a.valor || 0), 0);
    const debitos = appState.agendamentos
        .filter(a => a.cliente_id === cliente.id && a.status_pagamento === 'devendo' && a.status === 'concluido')
        .reduce((sum, a) => sum + (a.valor || 0), 0);
    
    // Atualiza Texts
    document.getElementById('detalhesClienteNome').textContent = cliente.nome;
    document.getElementById('detalhesClienteTelefone').textContent = cliente.telefone;
    document.getElementById('detalhesClienteEmail').textContent = cliente.email;
    
    // --- NOVO: Mostrar Endereço se existir ---
    const elEndereco = document.getElementById('detalhesClienteEndereco');
    if (elEndereco) {
        if (cliente.endereco) {
            elEndereco.textContent = `${cliente.endereco}, ${cliente.numero} - ${cliente.bairro}`;
            elEndereco.parentElement.style.display = 'block'; // Mostra o ícone
        } else {
            elEndereco.textContent = '';
            elEndereco.parentElement.style.display = 'none'; // Esconde se não tiver endereço
        }
    }
    
    document.getElementById('detalhesTotalServicos').textContent = totalServicos;
    document.getElementById('detalhesValorTotal').textContent = formatCurrency(valorTotal);
    document.getElementById('detalhesDebitos').textContent = formatCurrency(debitos);
    
    // Renderiza Listas (Histórico e Débitos - Mantidos para economizar espaço visual,
    // mas o código original já cuida disso chamando as listas no HTML)
    // ... A lógica de renderizar histórico continua igual ...
    
    // Dica: Se sumir o histórico, copie e cole o trecho do 'historicoHTML' do seu código antigo aqui dentro.
    // Mas para facilitar, vou recolocar a renderização básica aqui:
    
    const historico = servicosCliente.sort((a, b) => new Date(b.data) - new Date(a.data));
    const historicoContainer = document.getElementById('detalhesHistorico');
    if (historicoContainer) {
        historicoContainer.innerHTML = historico.length === 0 
            ? '<div class="empty-state"><p>Sem histórico</p></div>' 
            : historico.map(a => `
                <div class="agendamento-item">
                    <div class="agendamento-header"><h4>${a.servico_nome}</h4><strong>${formatCurrency(a.valor)}</strong></div>
                    <div class="agendamento-time">${formatDate(a.data)} <span class="status-badge ${a.status_pagamento}">${a.status_pagamento}</span></div>
                </div>`).join('');
    }

    document.getElementById('modalDetalhesCliente').classList.add('active');
    document.getElementById('overlay').classList.add('active');
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
        alert('Erro: ID do cliente não encontrado.');
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
    // Garante dados frescos
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

function abrirModalServico(id = null) {
    const modal = document.getElementById('modalServico');
    const form = document.getElementById('formServico');
    form.reset();
    
    // Configura campo hidden de ID
    let hiddenInput = document.getElementById('servicoId');
    if (!hiddenInput) { console.warn('Input servicoId não encontrado'); return; }
    hiddenInput.value = '';

    if (id) {
        // Edição
        const servico = appState.servicos.find(s => s.id === id);
        if (servico) {
            document.getElementById('modalServicoTitle').textContent = 'Editar Serviço';
            hiddenInput.value = servico.id;
            document.getElementById('servicoNome').value = servico.nome;
            document.getElementById('servicoValor').value = servico.valor;
            document.getElementById('servicoDuracao').value = servico.duracao;
        }
    } else {
        document.getElementById('modalServicoTitle').textContent = 'Novo Serviço';
    }
    
    modal.classList.add('active');
    document.getElementById('overlay').classList.add('active');
}

async function salvarServico(e) {
    e.preventDefault();
    const id = document.getElementById('servicoId').value;
    const dados = {
        nome: document.getElementById('servicoNome').value,
        valor: parseFloat(document.getElementById('servicoValor').value),
        duracao: parseInt(document.getElementById('servicoDuracao').value)
    };

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
        await carregarServicos();
    } catch (err) {
        console.error(err);
        showToast('Erro ao salvar serviço.', 'error');
    }
}

async function excluirServico(id) {
    if (!id || id === 'undefined') return showToast('Erro: ID inválido', 'error');
    if (!confirm('Tem certeza que deseja excluir este serviço?')) return;

    try {
        const { error } = await _supabase.from('servicos').delete().eq('id', id);
        if (error) throw error;
        showToast('Serviço excluído!', 'success');
        await carregarServicos();
    } catch (err) {
        console.error(err);
        showToast('Erro ao excluir.', 'error');
    }
}

// =======================================================
// MÓDULO DE ESTOQUE (Migrado e com Visual Dark)
// =======================================================

async function carregarEstoque() {
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