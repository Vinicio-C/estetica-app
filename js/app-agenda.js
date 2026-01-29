// ========================================
// AGENDA
// ========================================
async function carregarAgenda() {
    await carregarDadosIniciais();
    
    const view = appState.currentAgendaView;
    const date = appState.currentAgendaDate;
    
    let agendamentosFiltrados = [];
    
    if (view === 'dia') {
        const inicio = new Date(date);
        inicio.setHours(0, 0, 0, 0);
        const fim = new Date(date);
        fim.setHours(23, 59, 59, 999);
        
        agendamentosFiltrados = appState.agendamentos.filter(a => {
            const dataAgendamento = new Date(a.data);
            return dataAgendamento >= inicio && dataAgendamento <= fim;
        });
    } else if (view === 'semana') {
        const inicio = new Date(date);
        const dia = inicio.getDay();
        const diff = inicio.getDate() - dia;
        inicio.setDate(diff);
        inicio.setHours(0, 0, 0, 0);
        
        const fim = new Date(inicio);
        fim.setDate(fim.getDate() + 6);
        fim.setHours(23, 59, 59, 999);
        
        agendamentosFiltrados = appState.agendamentos.filter(a => {
            const dataAgendamento = new Date(a.data);
            return dataAgendamento >= inicio && dataAgendamento <= fim;
        });
    } else if (view === 'mes') {
        const inicio = new Date(date.getFullYear(), date.getMonth(), 1);
        const fim = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
        
        agendamentosFiltrados = appState.agendamentos.filter(a => {
            const dataAgendamento = new Date(a.data);
            return dataAgendamento >= inicio && dataAgendamento <= fim;
        });
    }
    
    // Ordenar por data
    agendamentosFiltrados.sort((a, b) => new Date(a.data) - new Date(b.data));
    
    // Calcular totais do dia
    const servicosDia = agendamentosFiltrados.filter(a => a.tipo === 'servico').length;
    const faturamentoDia = agendamentosFiltrados
        .filter(a => a.tipo === 'servico')
        .reduce((sum, a) => sum + (a.valor || 0), 0);
    
    document.getElementById('agendaTotalServicos').textContent = `${servicosDia} serviço${servicosDia !== 1 ? 's' : ''}`;
    document.getElementById('agendaTotalValor').textContent = formatCurrency(faturamentoDia);
    
    // Renderizar agendamentos
    const container = document.getElementById('agendaContainer');
    
    if (agendamentosFiltrados.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-times"></i>
                <p>Nenhum agendamento para este período</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = agendamentosFiltrados.map(a => `
        <div class="agendamento-item ${a.tipo} ${a.status}" onclick="editarAgendamento('${a.id}')">
            <div class="agendamento-header">
                <h4>
                    <i class="fas fa-${a.tipo === 'servico' ? 'cut' : 'calendar-day'}"></i>
                    ${a.tipo === 'servico' ? a.servico_nome : a.evento_nome}
                </h4>
                <div class="agendamento-time">
                    <i class="fas fa-clock"></i>
                    ${formatTime(a.data)}
                </div>
            </div>
            <div class="agendamento-details">
                <div class="agendamento-info">
                    ${a.tipo === 'servico' ? `
                        <div><i class="fas fa-user"></i> ${a.cliente_nome}</div>
                        <div><i class="fas fa-dollar-sign"></i> ${formatCurrency(a.valor)}</div>
                    ` : `
                        <div><i class="fas fa-info-circle"></i> ${a.observacoes || 'Evento'}</div>
                    `}
                </div>
                ${a.tipo === 'servico' ? `<span class="status-badge ${a.status_pagamento}">${a.status_pagamento}</span>` : ''}
            </div>
            ${a.status === 'agendado' ? `
                <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem;">
                    <button class="btn-primary btn-sm" onclick="concluirAgendamento(event, '${a.id}')">
                        <i class="fas fa-check"></i> Concluir
                    </button>
                    <button class="btn-danger btn-sm" onclick="cancelarAgendamento(event, '${a.id}')">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                </div>
            ` : ''}
        </div>
    `).join('');
}

function setAgendaView(view) {
    appState.currentAgendaView = view;
    
    document.querySelectorAll('.agenda-controls .btn-secondary').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`agendaView${view.charAt(0).toUpperCase() + view.slice(1)}`).classList.add('active');
    
    carregarAgenda();
}

function mudarData(dias) {
    appState.currentAgendaDate.setDate(appState.currentAgendaDate.getDate() + dias);
    document.getElementById('agendaDate').value = formatDateInput(appState.currentAgendaDate);
    carregarAgenda();
}

function hoje() {
    appState.currentAgendaDate = new Date();
    document.getElementById('agendaDate').value = formatDateInput(appState.currentAgendaDate);
    carregarAgenda();
}

async function abrirModalAgendamento(agendamentoId = null) {
    await carregarDadosIniciais();
    
    const modal = document.getElementById('modalAgendamento');
    const form = document.getElementById('formAgendamento');
    
    form.reset();
    
    // Preencher selects
    const selectCliente = document.getElementById('agendamentoCliente');
    selectCliente.innerHTML = '<option value="">Selecione um cliente</option>' + 
        appState.clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
    
    const selectServico = document.getElementById('agendamentoServico');
    selectServico.innerHTML = '<option value="">Selecione um serviço</option>' + 
        appState.servicos.map(s => `<option value="${s.id}">${s.nome} - ${formatCurrency(s.valor)}</option>`).join('');
    
    if (agendamentoId) {
        // Editar
        const agendamento = appState.agendamentos.find(a => a.id === agendamentoId);
        if (agendamento) {
            document.querySelector(`input[name="tipoAgendamento"][value="${agendamento.tipo}"]`).checked = true;
            toggleTipoAgendamento();
            
            if (agendamento.tipo === 'servico') {
                selectCliente.value = agendamento.cliente_id;
                selectServico.value = agendamento.servico_id;
                document.getElementById('agendamentoValor').value = formatCurrency(agendamento.valor);
                document.getElementById('agendamentoStatusPagamento').value = agendamento.status_pagamento;
            } else {
                document.getElementById('eventoNome').value = agendamento.evento_nome;
            }
            
            const dataAgendamento = new Date(agendamento.data);
            document.getElementById('agendamentoData').value = formatDateInput(dataAgendamento);
            document.getElementById('agendamentoHora').value = formatTimeInput(dataAgendamento);
            document.getElementById('agendamentoObservacoes').value = agendamento.observacoes || '';
            document.getElementById('agendamentoId').value = agendamento.id;
        }
    } else {
        // Novo
        const dataAtual = new Date(appState.currentAgendaDate);
        document.getElementById('agendamentoData').value = formatDateInput(dataAtual);
        document.getElementById('agendamentoHora').value = '09:00';
        document.getElementById('agendamentoId').value = '';
        toggleTipoAgendamento();
    }
    
    modal.classList.add('active');
    document.getElementById('overlay').classList.add('active');
}

function toggleTipoAgendamento() {
    const tipo = document.querySelector('input[name="tipoAgendamento"]:checked').value;
    
    if (tipo === 'servico') {
        document.getElementById('camposServico').style.display = 'block';
        document.getElementById('camposEvento').style.display = 'none';
        document.getElementById('agendamentoCliente').required = true;
        document.getElementById('agendamentoServico').required = true;
        document.getElementById('eventoNome').required = false;
    } else {
        document.getElementById('camposServico').style.display = 'none';
        document.getElementById('camposEvento').style.display = 'block';
        document.getElementById('agendamentoCliente').required = false;
        document.getElementById('agendamentoServico').required = false;
        document.getElementById('eventoNome').required = true;
    }
}

function selectCliente() {
    // Apenas trigger, não precisa fazer nada especial
}

function selectServico() {
    const servicoId = document.getElementById('agendamentoServico').value;
    if (servicoId) {
        const servico = appState.servicos.find(s => s.id === servicoId);
        if (servico) {
            document.getElementById('agendamentoValor').value = formatCurrency(servico.valor);
        }
    }
}

async function salvarAgendamento(e) {
    e.preventDefault();
    
    const id = document.getElementById('agendamentoId').value;
    const tipo = document.querySelector('input[name="tipoAgendamento"]:checked').value;
    
    const dataStr = document.getElementById('agendamentoData').value;
    const horaStr = document.getElementById('agendamentoHora').value;
    const dataCompleta = new Date(`${dataStr}T${horaStr}:00`);
    
    let data = {
        tipo: tipo,
        data: dataCompleta.toISOString(),
        observacoes: document.getElementById('agendamentoObservacoes').value,
        status: 'agendado'
    };
    
    if (tipo === 'servico') {
        const clienteId = document.getElementById('agendamentoCliente').value;
        const servicoId = document.getElementById('agendamentoServico').value;
        const cliente = appState.clientes.find(c => c.id === clienteId);
        const servico = appState.servicos.find(s => s.id === servicoId);
        
        data = {
            ...data,
            cliente_id: clienteId,
            cliente_nome: cliente.nome,
            servico_id: servicoId,
            servico_nome: servico.nome,
            valor: servico.valor,
            status_pagamento: document.getElementById('agendamentoStatusPagamento').value,
            evento_nome: ''
        };
    } else {
        data = {
            ...data,
            cliente_id: '',
            cliente_nome: '',
            servico_id: '',
            servico_nome: '',
            valor: 0,
            status_pagamento: '',
            evento_nome: document.getElementById('eventoNome').value
        };
    }
    
    try {
        if (id) {
            // Atualizar
            await fetchAPI(`tables/agendamentos/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            showToast('Agendamento atualizado com sucesso!', 'success');
        } else {
            // Criar
            await fetchAPI('tables/agendamentos', {
                method: 'POST',
                body: JSON.stringify(data)
            });

            await enviarParaGoogleCalendar(data);
            showToast('Agendamento criado com sucesso!', 'success');
        }
        
        fecharModal('modalAgendamento');
        await carregarAgenda();
    } catch (error) {
        showToast('Erro ao salvar agendamento', 'error');
    }
}

function editarAgendamento(id) {
    abrirModalAgendamento(id);
}

async function concluirAgendamento(event, id) {
    event.stopPropagation();
    
    try {
        const agendamento = appState.agendamentos.find(a => a.id === id);
        await fetchAPI(`tables/agendamentos/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'concluido' })
        });
        
        showToast('Agendamento concluído!', 'success');
        await carregarAgenda();
    } catch (error) {
        showToast('Erro ao concluir agendamento', 'error');
    }
}

async function cancelarAgendamento(event, id) {
    event.stopPropagation();
    
    if (!confirm('Tem certeza que deseja cancelar este agendamento?')) {
        return;
    }
    
    try {
        await fetchAPI(`tables/agendamentos/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'cancelado' })
        });
        
        showToast('Agendamento cancelado!', 'success');
        await carregarAgenda();
    } catch (error) {
        showToast('Erro ao cancelar agendamento', 'error');
    }
}

async function marcarComoPago(agendamentoId) {
    try {
        await fetchAPI(`tables/agendamentos/${agendamentoId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status_pagamento: 'pago' })
        });
        
        showToast('Marcado como pago!', 'success');
        
        if (appState.currentCliente) {
            await abrirDetalhesCliente(appState.currentCliente.id);
        }
        await carregarDashboard();
    } catch (error) {
        showToast('Erro ao atualizar pagamento', 'error');
    }
}

function sincronizarGoogleCalendar() {
    showToast('Para sincronizar com Google Calendar, acesse as configurações do app e conecte sua conta Google.', 'info');
}

// ========================================
// SERVIÇOS
// ========================================
async function carregarServicos() {
    await carregarDadosIniciais();
    renderizarServicos(appState.servicos);
}

function renderizarServicos(servicos) {
    const container = document.getElementById('servicosGrid');
    
    if (servicos.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <i class="fas fa-concierge-bell"></i>
                <p>Nenhum serviço cadastrado</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = servicos.map(servico => `
        <div class="servico-card" onclick="abrirModalServico('${servico.id}')">
            <h3>${servico.nome}</h3>
            <span class="servico-tipo">${servico.tipo}</span>
            <div class="servico-valor">${formatCurrency(servico.valor)}</div>
            <div class="servico-duracao">
                <i class="fas fa-clock"></i> ${servico.duracao} minutos
            </div>
            ${servico.descricao ? `<p style="margin-top: 1rem; color: #666; font-size: 0.9rem;">${servico.descricao}</p>` : ''}
        </div>
    `).join('');
}

function filtrarServicos(termo) {
    const servicosFiltrados = appState.servicos.filter(s => 
        s.nome.toLowerCase().includes(termo.toLowerCase()) ||
        s.tipo.toLowerCase().includes(termo.toLowerCase())
    );
    renderizarServicos(servicosFiltrados);
}

function abrirModalServico(servicoId = null) {
    const modal = document.getElementById('modalServico');
    const form = document.getElementById('formServico');
    
    form.reset();
    
    if (servicoId) {
        // Editar
        const servico = appState.servicos.find(s => s.id === servicoId);
        if (servico) {
            document.getElementById('modalServicoTitle').textContent = 'Editar Serviço';
            document.getElementById('servicoId').value = servico.id;
            document.getElementById('servicoNome').value = servico.nome;
            document.getElementById('servicoTipo').value = servico.tipo;
            document.getElementById('servicoDuracao').value = servico.duracao;
            document.getElementById('servicoValor').value = servico.valor;
            document.getElementById('servicoDescricao').value = servico.descricao || '';
        }
    } else {
        // Novo
        document.getElementById('modalServicoTitle').textContent = 'Novo Serviço';
        document.getElementById('servicoId').value = '';
    }
    
    modal.classList.add('active');
    document.getElementById('overlay').classList.add('active');
}

async function salvarServico(e) {
    e.preventDefault();
    
    const id = document.getElementById('servicoId').value;
    const data = {
        nome: document.getElementById('servicoNome').value,
        tipo: document.getElementById('servicoTipo').value,
        duracao: parseInt(document.getElementById('servicoDuracao').value),
        valor: parseFloat(document.getElementById('servicoValor').value),
        descricao: document.getElementById('servicoDescricao').value
    };
    
    try {
        if (id) {
            // Atualizar
            await fetchAPI(`tables/servicos/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            showToast('Serviço atualizado com sucesso!', 'success');
        } else {
            // Criar
            await fetchAPI('tables/servicos', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            showToast('Serviço cadastrado com sucesso!', 'success');
        }
        
        fecharModal('modalServico');
        await carregarServicos();
    } catch (error) {
        showToast('Erro ao salvar serviço', 'error');
    }
}

// ========================================
// ESTOQUE
// ========================================
async function carregarEstoque() {
    await carregarDadosIniciais();
    renderizarEstoque(appState.estoque);
}

function renderizarEstoque(produtos) {
    const container = document.getElementById('estoqueGrid');
    
    if (produtos.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <i class="fas fa-boxes"></i>
                <p>Nenhum produto cadastrado</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = produtos.map(produto => {
        const isCritico = produto.quantidade === 0;
        const isAlerta = produto.quantidade > 0 && produto.quantidade <= produto.quantidade_minima;
        
        return `
            <div class="estoque-card ${isCritico ? 'critico' : isAlerta ? 'alerta' : ''}" onclick="abrirModalEstoque('${produto.id}')">
                ${(isCritico || isAlerta) ? `<div class="estoque-alert-badge"><i class="fas fa-exclamation-triangle"></i></div>` : ''}
                <h3>${produto.nome}</h3>
                ${produto.descricao ? `<p style="color: #666; font-size: 0.9rem; margin: 0.5rem 0;">${produto.descricao}</p>` : ''}
                <div class="estoque-info">
                    <div>
                        <div style="font-size: 0.8rem; color: #999;">Quantidade</div>
                        <div class="estoque-quantidade ${isCritico ? 'critico' : isAlerta ? 'baixo' : ''}">
                            ${produto.quantidade}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.8rem; color: #999;">Valor Un.</div>
                        <div style="font-size: 1.1rem; font-weight: 600; color: var(--gold-dark);">
                            ${formatCurrency(produto.valor_unitario)}
                        </div>
                    </div>
                </div>
                <div style="margin-top: 0.5rem; font-size: 0.85rem; color: #999;">
                    <i class="fas fa-info-circle"></i> Mínimo: ${produto.quantidade_minima}
                </div>
            </div>
        `;
    }).join('');
}

function filtrarEstoque(termo) {
    const produtosFiltrados = appState.estoque.filter(p => 
        p.nome.toLowerCase().includes(termo.toLowerCase()) ||
        (p.descricao && p.descricao.toLowerCase().includes(termo.toLowerCase()))
    );
    renderizarEstoque(produtosFiltrados);
}

function abrirModalEstoque(produtoId = null) {
    const modal = document.getElementById('modalEstoque');
    const form = document.getElementById('formEstoque');
    
    form.reset();
    
    if (produtoId) {
        // Editar
        const produto = appState.estoque.find(p => p.id === produtoId);
        if (produto) {
            document.getElementById('modalEstoqueTitle').textContent = 'Editar Produto';
            document.getElementById('estoqueId').value = produto.id;
            document.getElementById('estoqueNome').value = produto.nome;
            document.getElementById('estoqueDescricao').value = produto.descricao || '';
            document.getElementById('estoqueValor').value = produto.valor_unitario;
            document.getElementById('estoqueQuantidade').value = produto.quantidade;
            document.getElementById('estoqueQuantidadeMinima').value = produto.quantidade_minima;
        }
    } else {
        // Novo
        document.getElementById('modalEstoqueTitle').textContent = 'Novo Produto';
        document.getElementById('estoqueId').value = '';
    }
    
    modal.classList.add('active');
    document.getElementById('overlay').classList.add('active');
}

async function salvarEstoque(e) {
    e.preventDefault();
    
    const id = document.getElementById('estoqueId').value;
    const data = {
        nome: document.getElementById('estoqueNome').value,
        descricao: document.getElementById('estoqueDescricao').value,
        valor_unitario: parseFloat(document.getElementById('estoqueValor').value),
        quantidade: parseInt(document.getElementById('estoqueQuantidade').value),
        quantidade_minima: parseInt(document.getElementById('estoqueQuantidadeMinima').value)
    };
    
    try {
        if (id) {
            // Atualizar
            await fetchAPI(`tables/estoque/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            showToast('Produto atualizado com sucesso!', 'success');
        } else {
            // Criar
            await fetchAPI('tables/estoque', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            showToast('Produto cadastrado com sucesso!', 'success');
        }
        
        fecharModal('modalEstoque');
        await carregarEstoque();
    } catch (error) {
        showToast('Erro ao salvar produto', 'error');
    }
}

async function conectarGoogle() {
    // No GitHub Pages, 'origin' pega só o dominio, mas precisamos da pasta do projeto
    // href pega tudo: "https://user.github.io/repo/index.html"
    // Vamos limpar o "index.html" e parâmetros extras para garantir
    let urlAtual = window.location.href.split('?')[0]; // Remove ?param=...
    
    // Remove "index.html" se estiver lá
    if (urlAtual.endsWith('index.html')) {
        urlAtual = urlAtual.replace('index.html', '');
    }
    
    // Remove barra final se tiver, para padronizar
    if (urlAtual.endsWith('/')) {
        urlAtual = urlAtual.slice(0, -1);
    }

    console.log('🔗 URL Base calculada:', urlAtual);

    try {
        const { data, error } = await _supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                scopes: 'https://www.googleapis.com/auth/calendar',
                // O Supabase vai usar a Site URL configurada no painel, 
                // mas enviamos isso para garantir que ele volte para a pasta certa
                redirectTo: urlAtual 
            }
        });
        if (error) throw error;
    } catch (error) {
        showToast('Erro ao conectar: ' + error.message, 'error');
    }
}

// 2. Verificar se já está conectado ao carregar
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await _supabase.auth.getSession();
    
    const btn = document.getElementById('btnConnectGoogle');
    if (btn) {
        if (session && session.provider_token) {
            btn.innerHTML = '<i class="fas fa-check"></i> Agenda Sincronizada';
            btn.style.background = 'var(--success)';
            btn.onclick = null; // Desativa clique
        }
    }
});

// js/app-agenda.js

// Função Auxiliar para Deletar
async function deletarDoGoogleCalendar(googleEventId) {
    if (!googleEventId) return;
    
    const { data: { session } } = await _supabase.auth.getSession();
    if (!session?.provider_token) return;

    try {
        console.log('🗑️ Apagando do Google:', googleEventId);
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${session.provider_token}`
            }
        });
    } catch (error) {
        console.error('Erro ao deletar do Google:', error);
    }
}

// Função Principal de Envio (Atualizada)
async function enviarParaGoogleCalendar(agendamento) {
    console.log('☁️ Sincronizando com Google...');
    
    const { data: { session } } = await _supabase.auth.getSession();
    
    if (!session || !session.provider_token) {
        // Silencioso se não tiver conectado, para não travar o fluxo
        console.log('Sem token Google. Pulando.'); 
        return;
    }

    const inicio = new Date(agendamento.data);
    const fim = new Date(inicio.getTime() + (60 * 60 * 1000)); 

    const eventoGoogle = {
        summary: `Estética: ${agendamento.servico_nome || agendamento.evento_nome}`,
        description: `Cliente: ${agendamento.cliente_nome || 'N/A'}\nObs: ${agendamento.observacoes || ''}`,
        start: { dateTime: inicio.toISOString(), timeZone: "America/Sao_Paulo" },
        end: { dateTime: fim.toISOString(), timeZone: "America/Sao_Paulo" }
    };

    try {
        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.provider_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventoGoogle)
        });

        const resultado = await response.json();

        if (response.ok) {
            console.log('✅ Criado no Google. ID:', resultado.id);
            
            // O PULO DO GATO: Salvar o ID do Google no nosso Banco
            // Usamos o supabase client direto para ser mais rápido e evitar loops
            if (agendamento.id) {
                await _supabase
                    .from('agendamentos')
                    .update({ google_event_id: resultado.id })
                    .eq('id', agendamento.id);
            }
            
            showToast('Sincronizado com Google Agenda!', 'success');
        } else {
            console.error('Erro Google:', resultado);
        }
    } catch (error) {
        console.error('Erro de Rede Google:', error);
    }
}
