// ========================================
// AGENDA
// ========================================
async function carregarAgenda() {
    await carregarDadosIniciais();
    
    const view = appState.currentAgendaView;
    const date = appState.currentAgendaDate;
    let agendamentosFiltrados = [];
    
   if (view === 'dia') {
        const inicio = new Date(date); inicio.setHours(0,0,0,0);
        const fim = new Date(date); fim.setHours(23,59,59,999);
        agendamentosFiltrados = appState.agendamentos.filter(a => {
            const d = new Date(a.data); return d >= inicio && d <= fim;
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
        .filter(a => a.tipo === 'servico' && a.status !== 'cancelado')
        .reduce((sum, a) => sum + (a.valor || 0), 0);
    
    document.getElementById('agendaTotalServicos').textContent = servicosDia;
    document.getElementById('agendaTotalValor').textContent = formatCurrency(faturamentoDia);
    
    // Renderizar agendamentos
    const container = document.getElementById('agendaContainer');
    
    if (agendamentosFiltrados.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="far fa-calendar" style="font-size:3rem; color:#333; margin-bottom:15px;"></i>
                <p>Agenda livre para este período</p>
            </div>`;
        return;
    }
    
    container.innerHTML = agendamentosFiltrados.map(a => {
        // Define classe extra se estiver concluído ou cancelado
        let statusClass = '';
        if (a.status === 'concluido') statusClass = 'status-concluido';
        if (a.status === 'cancelado') statusClass = 'status-cancelado';

        return `
        <div class="agenda-card ${statusClass}" onclick="editarAgendamento('${a.id}')">
            
            <div class="time-column">
                <span class="time-hour">${formatTime(a.data)}</span>
                <i class="fas fa-clock time-icon"></i>
            </div>

            <div class="info-column">
                <div class="service-title">
                    ${a.tipo === 'servico' ? a.servico_nome : a.evento_nome}
                </div>
                <div class="client-name">
                    ${a.tipo === 'servico' ? `<i class="fas fa-user"></i> ${a.cliente_nome}` : `<i class="fas fa-info-circle"></i> ${a.observacoes || 'Evento Pessoal'}`}
                </div>
                ${a.tipo === 'servico' ? 
                  `<span class="status-badge ${a.status_pagamento}" style="margin-top:5px; display:inline-block; font-size:0.7rem;">${a.status_pagamento}</span>` 
                  : ''}
            </div>

            <div class="action-column">
                ${a.tipo === 'servico' ? `<span class="price-tag">${formatCurrency(a.valor)}</span>` : ''}
                
                ${a.status === 'agendado' ? `
                    <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:5px;">
                        <button class="btn-icon" style="color:var(--success); width:30px; height:30px;" onclick="concluirAgendamento(event, '${a.id}')" title="Concluir">
                            <i class="fas fa-check"></i>
                        </button>
                    </div>
                ` : ''}
            </div>
        </div>
        `;
    }).join('');
}

function setAgendaView(view) {
    // 1. Atualiza o estado global
    appState.currentAgendaView = view;
    
    // 2. FORÇA BRUTA: Pega todos os botões e apaga a luz de todos
    // Usamos getElementsByClassName que é mais rápido e direto
    const allButtons = document.getElementsByClassName('view-btn');
    for (let i = 0; i < allButtons.length; i++) {
        allButtons[i].classList.remove('active');
    }

    // 3. Acende apenas o botão certo
    const idMap = {
        'dia': 'agendaViewDia',
        'semana': 'agendaViewSemana',
        'mes': 'agendaViewMes'
    };

    const activeBtn = document.getElementById(idMap[view]);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    // 4. Recarrega a lista
    console.log('Trocando visualização para:', view);
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

async function conectarGoogle() {
    // 1. Calcular a URL exata para onde o Google deve devolver o usuário
    // Removemos parâmetros de busca (?) e hash (#) para limpar a URL
    let urlAtual = window.location.href.split(/[?#]/)[0]; 
    
    // Remove "index.html" se estiver lá (limpeza padrão)
    if (urlAtual.endsWith('index.html')) {
        urlAtual = urlAtual.replace('index.html', '');
    }
    
    // Remove barra final se tiver, para padronizar (ex: .../app/ vira .../app)
    if (urlAtual.endsWith('/')) {
        urlAtual = urlAtual.slice(0, -1);
    }

    console.log('🔗 URL de Retorno:', urlAtual);

    try {
        showToast('Redirecionando para o Google...', 'info');

        const { data, error } = await _supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: urlAtual,
                scopes: 'https://www.googleapis.com/auth/calendar',
                
                // --- O SEGREDO PARA O CELULAR ESTÁ AQUI EMBAIXO 👇 ---
                queryParams: {
                    access_type: 'offline', // Pede permissão para funcionar mesmo fechado
                    prompt: 'consent'       // Força o Google a gerar o Token de Atualização
                }
            }
        });

        if (error) throw error;
        
        // Se der certo, ele vai sair da página aqui e ir pro Google
        
    } catch (error) {
        console.error('Erro ao conectar:', error);
        showToast('Erro ao iniciar conexão Google: ' + error.message, 'error');
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
