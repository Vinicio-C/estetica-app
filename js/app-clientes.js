// ========================================
// APP-CLIENTES.JS — CRUD Clientes
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
            </div>`;
        return;
    }

    container.innerHTML = clientes.map(cliente => {
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
                    <div class="cliente-avatar"><i class="fas fa-user"></i></div>
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
                    </div>` : ''}
            </div>`;
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
    const form  = document.getElementById('formCliente');
    form.reset();

    if (clienteId) {
        const cliente = appState.clientes.find(c => c.id === clienteId);
        if (cliente) {
            document.getElementById('modalClienteTitle').textContent = 'Editar Cliente';
            document.getElementById('clienteId').value = cliente.id;
            document.getElementById('clienteNome').value      = cliente.nome;
            document.getElementById('clienteTelefone').value  = cliente.telefone;
            document.getElementById('clienteEmail').value     = cliente.email;
            document.getElementById('clienteCpf').value       = cliente.cpf            || '';
            document.getElementById('clienteNascimento').value = cliente.data_nascimento || '';
            document.getElementById('clienteCep').value       = cliente.cep            || '';
            document.getElementById('clienteEndereco').value  = cliente.endereco       || '';
            document.getElementById('clienteNumero').value    = cliente.numero         || '';
            document.getElementById('clienteBairro').value    = cliente.bairro         || '';
            document.getElementById('clienteCidade').value    = cliente.cidade         || '';
            document.getElementById('clienteEstado').value    = cliente.estado         || '';
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
    cep = cep.replace(/\D/g, '');

    if (cep.length === 8) {
        const campoEndereco = document.getElementById('clienteEndereco');
        const valorOriginal = campoEndereco.value;
        campoEndereco.value = 'Buscando...';

        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await response.json();

            if (!data.erro) {
                document.getElementById('clienteEndereco').value = data.logradouro;
                document.getElementById('clienteBairro').value   = data.bairro;
                document.getElementById('clienteCidade').value   = data.localidade;
                document.getElementById('clienteEstado').value   = data.uf;
                document.getElementById('clienteNumero').focus();
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

    const data = {
        nome:            document.getElementById('clienteNome').value,
        telefone:        document.getElementById('clienteTelefone').value,
        email:           document.getElementById('clienteEmail').value,
        cpf:             document.getElementById('clienteCpf').value        || null,
        data_nascimento: document.getElementById('clienteNascimento').value || null,
        cep:             document.getElementById('clienteCep').value        || null,
        endereco:        document.getElementById('clienteEndereco').value   || null,
        numero:          document.getElementById('clienteNumero').value     || null,
        bairro:          document.getElementById('clienteBairro').value     || null,
        cidade:          document.getElementById('clienteCidade').value     || null,
        estado:          document.getElementById('clienteEstado').value     || null,
        data_cadastro:   id ? undefined : new Date().toISOString()
    };

    if (id) delete data.data_cadastro;

    try {
        if (id) {
            const { error } = await _supabase.from('clientes').update(data).eq('id', id);
            if (error) throw error;
            showToast('Cliente atualizado com sucesso!', 'success');
        } else {
            const { error } = await _supabase.from('clientes').insert([data]);
            if (error) throw error;
            showToast('Cliente cadastrado com sucesso!', 'success');
        }

        fecharModal('modalCliente');
        appState._lastFetch = 0;
        await carregarClientes();
    } catch (error) {
        console.error('Erro ao salvar:', error);
        showToast('Erro ao salvar cliente: ' + error.message, 'error');
    }
}

async function abrirDetalhesCliente(clienteId) {
    let cliente = appState.clientes.find(c => c.id === clienteId);

    if (!cliente) {
        const { data } = await _supabase.from('clientes').select('*').eq('id', clienteId).single();
        cliente = data;
    }

    if (!cliente) return;
    appState.currentCliente = cliente;

    document.getElementById('detalhesClienteNome').textContent     = cliente.nome;
    document.getElementById('detalhesClienteTelefone').textContent = cliente.telefone || '-';
    document.getElementById('detalhesClienteEmail').textContent    = cliente.email || 'Não informado';

    const boxEndereco  = document.getElementById('boxEndereco');
    const spanEndereco = document.getElementById('detalhesClienteEndereco');
    if (cliente.endereco) {
        spanEndereco.textContent = `${cliente.endereco}, ${cliente.numero || ''} - ${cliente.bairro || ''}`;
        boxEndereco.style.display = 'block';
    } else {
        boxEndereco.style.display = 'none';
    }

    const containerHist   = document.getElementById('detalhesHistorico');
    const containerFuturo = document.getElementById('detalhesAgendados');
    containerFuturo.innerHTML = '<div style="padding:10px; color:#888;">Buscando agendamentos...</div>';

    try {
        const { data: agendamentosReais, error } = await _supabase
            .from('agendamentos')
            .select('*')
            .eq('cliente_id', clienteId)
            .order('data', { ascending: false });

        if (error) throw error;

        const hoje = new Date().toISOString().split('T')[0];

        const historicoList = agendamentosReais.filter(a =>
            a.data < hoje || a.status === 'concluido' || a.status === 'cancelado'
        );
        const agendadosList = agendamentosReais.filter(a =>
            a.data >= hoje && a.status !== 'concluido' && a.status !== 'cancelado'
        );

        const totalServicos = historicoList.filter(a => a.status === 'concluido').length;
        const valorTotal    = historicoList
            .filter(a => a.status === 'concluido')
            .reduce((sum, a) => sum + (Number(a.valor) || 0), 0);
        const debitos = agendamentosReais
            .filter(a => a.status_pagamento === 'devendo' && a.status !== 'cancelado')
            .reduce((sum, a) => sum + (Number(a.valor) || 0), 0);

        document.getElementById('detalhesTotalServicos').textContent = totalServicos;
        document.getElementById('detalhesValorTotal').textContent    = formatCurrency(valorTotal);
        document.getElementById('detalhesDebitos').textContent       = formatCurrency(debitos);

        // Histórico
        if (historicoList.length === 0) {
            containerHist.innerHTML = '<div class="empty-state" style="padding:10px"><p>Sem histórico anterior</p></div>';
        } else {
            containerHist.innerHTML = historicoList.map(a => {
                const statusStr = a.status === 'concluido' ? 'Concluído' : (a.status === 'pendente' ? 'Pendente' : 'Cancelado');
                const corStatus = a.status === 'concluido' ? '#4CAF50' : (a.status === 'pendente' ? '#FFA726' : '#ff4444');

                return `
                <div class="agendamento-item" onclick="fecharModal('modalDetalhesCliente'); abrirModalAgendamento('${a.id}')"
                     style="margin-bottom: 10px; padding: 12px; opacity: 0.9; border: 1px solid #333; border-radius: 8px; cursor: pointer; transition: 0.3s;"
                     onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='#333'">
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                        <strong style="color:#fff">${a.servico_nome || a.evento_nome || 'Serviço'}</strong>
                        <span style="color:var(--gold)">${formatCurrency(a.valor)}</span>
                    </div>
                    <div style="font-size:0.8rem; color:#888; display:flex; justify-content:space-between; align-items:center;">
                        <span>${formatDate(a.data)} • <span style="color: ${corStatus}; font-weight: bold;">${statusStr}</span></span>
                        <div style="display:flex; gap: 5px;">
                            ${a.status === 'concluido' ? `
                                <button onclick="event.stopPropagation(); reverterConclusao('${a.id}')"
                                    style="background:transparent; border:1px solid #ff4444; color:#ff4444; padding:4px 8px; border-radius:4px; cursor:pointer; font-size: 0.75rem;" title="Desfazer e devolver estoque">
                                    <i class="fas fa-undo"></i> Estornar
                                </button>` : ''}
                            ${a.status === 'pendente' ? `
                                <button onclick="event.stopPropagation(); concluirAgendamento('${a.id}')"
                                    style="background:transparent; border:1px solid #4CAF50; color:#4CAF50; padding:4px 8px; border-radius:4px; cursor:pointer; font-size: 0.75rem;" title="Baixar Estoque">
                                    <i class="fas fa-check"></i> Concluir
                                </button>` : ''}
                        </div>
                    </div>
                </div>`;
            }).join('');
        }

        // Agendamentos futuros
        if (agendadosList.length === 0) {
            containerFuturo.innerHTML = '<div class="empty-state" style="padding:10px"><p>Nenhum agendamento futuro</p></div>';
        } else {
            agendadosList.sort((a, b) => new Date(a.data) - new Date(b.data));
            containerFuturo.innerHTML = agendadosList.map(a => `
                <div class="agendamento-item" onclick="fecharModal('modalDetalhesCliente'); abrirModalAgendamento('${a.id}')"
                     style="margin-bottom: 10px; padding: 12px; border-left: 3px solid var(--gold); background: rgba(212, 175, 55, 0.05); border-radius: 4px; cursor: pointer; transition: 0.3s;"
                     onmouseover="this.style.background='rgba(212, 175, 55, 0.1)'" onmouseout="this.style.background='rgba(212, 175, 55, 0.05)'">
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                        <strong style="color:#fff">${a.servico_nome || 'Agendamento Online'}</strong>
                        <span style="color:var(--gold)">${formatDate(a.data)}</span>
                    </div>
                    <div style="font-size:0.8rem; color:#ccc; display:flex; justify-content:space-between; align-items:center;">
                        <span>Às ${formatTime(a.hora)}</span>
                        <div style="display:flex; gap: 10px;">
                            <button class="icon-btn-small" onclick="event.stopPropagation(); concluirAgendamento('${a.id}')"
                                style="background:transparent; border:1px solid #4CAF50; color: #4CAF50; cursor: pointer;" title="Concluir e Baixar Estoque">
                                <i class="fas fa-check"></i>
                            </button>
                            <button class="icon-btn-small"
                                style="background:transparent; border:1px solid #25D366; color: #25D366; cursor: pointer;"
                                onclick="event.stopPropagation(); dispararWhatsAppManual('${cliente.telefone}', '${cliente.nome}', '${formatDate(a.data)} às ${formatTime(a.hora)}', '${a.servico_nome}')"
                                title="Enviar WhatsApp">
                                <i class="fab fa-whatsapp"></i>
                            </button>
                        </div>
                    </div>
                </div>`).join('');
        }

    } catch (err) {
        console.error("Erro ao buscar detalhes:", err);
        containerFuturo.innerHTML = '<p style="color:red">Erro ao carregar.</p>';
    }

    document.getElementById('modalDetalhesCliente').classList.add('active');
    document.getElementById('overlay').classList.add('active');

    trocarTab('historico');
}

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

        const { error } = await _supabase.from('clientes').delete().eq('id', idParaExcluir);
        if (error) throw error;

        showToast('Cliente excluído com sucesso!', 'success');
        fecharModal('modalDetalhesCliente');

        appState._lastFetch = 0;
        await carregarDadosIniciais(true);
        if (typeof carregarDashboard === 'function') await carregarDashboard();
        if (appState.currentPage === 'clientes') carregarClientes();

    } catch (error) {
        console.error('Erro ao excluir:', error);
        showToast(`Erro ao excluir: ${error.message || 'Erro desconhecido'}`, 'error');
    }
}

// ========================================
// EXPORTAÇÕES GLOBAIS
// ========================================
window.carregarClientes     = carregarClientes;
window.renderizarClientes   = renderizarClientes;
window.filtrarClientes      = filtrarClientes;
window.abrirModalCliente    = abrirModalCliente;
window.buscarCep            = buscarCep;
window.salvarCliente        = salvarCliente;
window.abrirDetalhesCliente = abrirDetalhesCliente;
window.deletarClienteAtual  = deletarClienteAtual;
window.editarCliente        = editarCliente;
window.excluirCliente       = excluirCliente;
