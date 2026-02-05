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
    /* <-- COMENTE AQUI (Abra o comentário)
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('/service-worker.js');
            console.log('✅ Service Worker registrado');
        } catch (err) {
            console.log('⚠️ Service Worker não registrado:', err);
        }
    }
    */
    
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
        relatorios: 'Relatórios'
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

// ========================================
// FUNÇÃO CORRIGIDA: DETALHES DO CLIENTE (Histórico + Agendados)
// ========================================

async function abrirDetalhesCliente(clienteId) {
    const cliente = appState.clientes.find(c => c.id === clienteId);
    if (!cliente) return;
    
    appState.currentCliente = cliente;
    
    // --- 1. Preencher Textos Básicos ---
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

    // --- 2. Separação dos Dados (Passado vs Futuro) ---
    // Histórico: Tudo que está "concluido" ou "cancelado"
    const historicoList = appState.agendamentos
        .filter(a => a.cliente_id === cliente.id && (a.status === 'concluido' || a.status === 'cancelado'))
        .sort((a, b) => new Date(b.data) - new Date(a.data)); // Do mais recente pro antigo

    // Futuros: Tudo que está "agendado"
    const agendadosList = appState.agendamentos
        .filter(a => a.cliente_id === cliente.id && a.status === 'agendado')
        .sort((a, b) => new Date(a.data) - new Date(b.data)); // Do mais próximo pro distante
    
    // --- 3. Cálculos Financeiros ---
    const totalServicos = historicoList.filter(a => a.status === 'concluido').length;
    const valorTotal = historicoList
        .filter(a => a.status === 'concluido')
        .reduce((sum, a) => sum + (Number(a.valor) || 0), 0);
    
    // Soma débitos de TUDO (passado concluído ou futuro que já marcou como devendo)
    const debitos = appState.agendamentos
        .filter(a => a.cliente_id === cliente.id && a.status_pagamento === 'devendo' && a.status !== 'cancelado')
        .reduce((sum, a) => sum + (Number(a.valor) || 0), 0);
    
    document.getElementById('detalhesTotalServicos').textContent = totalServicos;
    document.getElementById('detalhesValorTotal').textContent = formatCurrency(valorTotal);
    document.getElementById('detalhesDebitos').textContent = formatCurrency(debitos);
    
    // --- 4. Renderizar Lista: HISTÓRICO (Aba 1) ---
    const containerHist = document.getElementById('detalhesHistorico');
    if (historicoList.length === 0) {
        containerHist.innerHTML = '<div class="empty-state" style="padding:10px"><p>Sem histórico anterior</p></div>';
    } else {
        containerHist.innerHTML = historicoList.map(a => `
            <div class="agendamento-item" style="margin-bottom: 10px; padding: 12px; opacity: 0.8;">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <strong style="color:#fff">${a.servico_nome || 'Evento'}</strong>
                    <span style="color:var(--gold)">${formatCurrency(a.valor)}</span>
                </div>
                <div style="font-size:0.8rem; color:#888;">
                    ${formatDate(a.data)} • <span class="status-badge ${a.status}">${a.status}</span>
                </div>
            </div>
        `).join('');
    }

    // --- 5. Renderizar Lista: AGENDADOS (Aba 2 - QUE FALTAVA) ---
    const containerFuturo = document.getElementById('detalhesAgendados'); // Esse ID deve existir no seu HTML
    
    if (agendadosList.length === 0) {
        containerFuturo.innerHTML = '<div class="empty-state" style="padding:10px"><p>Nenhum agendamento futuro</p></div>';
    } else {
        containerFuturo.innerHTML = agendadosList.map(a => `
            <div class="agendamento-item" style="margin-bottom: 10px; padding: 12px; border-left: 3px solid var(--gold); background: rgba(212, 175, 55, 0.05);">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <strong style="color:#fff">${a.servico_nome || 'Evento'}</strong>
                    <span style="color:var(--gold)">${formatDate(a.data)}</span>
                </div>
                <div style="font-size:0.8rem; color:#ccc; display:flex; justify-content:space-between; align-items:center;">
                    <span>Às ${formatTime(a.data)} • ${a.status_pagamento || 'Pendente'}</span>
                    <button class="icon-btn-small" onclick="abrirModalAgendamento('${a.id}')" style="background:transparent; border:1px solid #444;">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Abre o modal
    document.getElementById('modalDetalhesCliente').classList.add('active');
    document.getElementById('overlay').classList.add('active');
    
    // Reseta para a primeira aba sempre que abrir
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

// --- FUNÇÃO DE SALVAR AGENDAMENTO (ADMIN - CORRIGIDA) ---
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
        // 1. Get Names (We need to look up the text names from the IDs)
        let clienteNome = null;
        let servicoNome = null;
        let valor = 0;

        if (tipo === 'servico') {
            // Find client name in the global list
            const clienteObj = appState.clientes.find(c => c.id == clienteId);
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

        showToast('Agendamento salvo com sucesso!', 'success');
        fecharModal('modalAgendamento');
        
        // Refresh Screens
        if(typeof carregarDashboard === 'function') carregarDashboard();
        
        // Refresh Agenda if the function exists and we are on that page
        if(typeof carregarAgendaDoDia === 'function' && document.getElementById('agendaContainer')) {
            // Reload the specific date being viewed or the date of the new appointment
            const dataObj = new Date(data);
            // Adjust for timezone offset to ensure correct day is loaded
            const userTimezoneOffset = dataObj.getTimezoneOffset() * 60000;
            const adjustedDate = new Date(dataObj.getTime() + userTimezoneOffset);
            carregarAgendaDoDia(adjustedDate); 
            
            // Also refresh the dots
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
    
    // 1. Resetar Form e ID
    if(form) form.reset();
    document.getElementById('agendamentoId').value = '';
    
    // 2. Popular Selects (Clientes e Serviços) usando o Estado Global (appState)
    // Isso evita ter que ir no banco toda vez, já que carregamos no início
    const selCliente = document.getElementById('agendamentoCliente');
    const selServico = document.getElementById('agendamentoServico');
    
    if (selCliente && appState.clientes.length > 0) {
        // Mantém a opção padrão "Selecione..." e adiciona os clientes
        selCliente.innerHTML = '<option value="">Selecione o Cliente...</option>' + 
            appState.clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
    }
    
    if (selServico && appState.servicos.length > 0) {
        selServico.innerHTML = '<option value="">Selecione o Serviço...</option>' + 
            appState.servicos.map(s => `<option value="${s.id}" data-valor="${s.valor}">${s.nome}</option>`).join('');
    }

    // 3. Lógica: Edição vs Novo
    if (id) {
        // --- MODO EDIÇÃO ---
        document.getElementById('modalAgendamentoTitle').textContent = 'Editar Agendamento';
        
        // Busca primeiro no estado local (mais rápido)
        let agendamento = appState.agendamentos.find(a => a.id === id);
        
        // Se não achar (ex: acabou de criar), busca no banco
        if (!agendamento) {
            try {
                const { data } = await _supabase.from('agendamentos').select('*').eq('id', id).single();
                agendamento = data;
            } catch (e) { console.error(e); }
        }

        if (agendamento) {
            document.getElementById('agendamentoId').value = agendamento.id;
            document.getElementById('agendamentoCliente').value = agendamento.cliente_id;
            document.getElementById('agendamentoServico').value = agendamento.servico_id;
            document.getElementById('agendamentoData').value = agendamento.data; // YYYY-MM-DD
            document.getElementById('agendamentoHora').value = agendamento.hora; // HH:MM
            document.getElementById('agendamentoStatusPagamento').value = agendamento.status_pagamento;
            document.getElementById('agendamentoObservacoes').value = agendamento.observacoes || '';
            
            // Atualiza o valor visualmente (se tiver campo de valor visual)
            updateValorServico();
        }
    } else {
        // --- MODO NOVO ---
        document.getElementById('modalAgendamentoTitle').textContent = 'Novo Agendamento';
        // Define data de hoje como padrão
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

// 1. Atualiza o Valor quando seleciona o Serviço
window.selectServico = function() {
    const sel = document.getElementById('agendamentoServico');
    const inputValor = document.getElementById('agendamentoValor');
    
    if (!sel || !inputValor) return;

    // Pega a opção selecionada
    const opt = sel.options[sel.selectedIndex];
    
    // Pega o valor que guardamos no atributo data-valor
    const valor = opt.getAttribute('data-valor');

    if (valor) {
        // Formata e joga no input
        inputValor.value = parseFloat(valor).toFixed(2); // Salva como número decimal (ex: 150.00)
    } else {
        inputValor.value = "";
    }
};

// 2. Função vazia para o Cliente (só para parar o erro)
window.selectCliente = function() {
    // Por enquanto não precisamos fazer nada automático ao selecionar cliente
    // Mas a função precisa existir para o HTML não quebrar
    console.log("Cliente selecionado"); 
};

// ========================================
// FUNÇÃO DE COMPARTILHAR LINK (Adicione no final do app.js)
// ========================================

window.copiarLinkAgendamento = function() {
    // Pega a URL atual do site
    const urlAtual = window.location.href;
    
    // Remove o nome do arquivo atual (ex: index.html) e deixa só a pasta
    const baseUrl = urlAtual.substring(0, urlAtual.lastIndexOf('/') + 1);
    
    // Cria o link para a página pública
    const linkPublico = baseUrl + 'agendar.html';

    // Tenta copiar para a área de transferência
    navigator.clipboard.writeText(linkPublico).then(() => {
        showToast('Link copiado! Envie para o cliente.', 'success');
    }).catch(err => {
        console.error("Erro ao copiar:", err);
        // Se falhar (alguns navegadores bloqueiam), mostra um prompt para copiar manual
        prompt("Copie o link abaixo e envie para o cliente:", linkPublico);
    });
};