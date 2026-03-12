// ========================================
// APP-AGENDAMENTOS.JS — Scheduling, Dropdowns, Concluir/Estornar
// ========================================

function toggleTipoAgendamento() {
    const radio = document.querySelector('input[name="tipoAgendamento"]:checked');
    if (!radio) return;

    const tipo = radio.value;
    const camposServico = document.getElementById('camposServico');
    const camposEvento  = document.getElementById('camposEvento');
    const cliente = document.getElementById('agendamentoCliente');
    const servico = document.getElementById('agendamentoServico');
    const evento  = document.getElementById('eventoNome');

    if (tipo === 'servico') {
        if (camposServico) camposServico.style.display = 'block';
        if (camposEvento)  camposEvento.style.display  = 'none';
        if (cliente) cliente.required = true;
        if (servico) servico.required = true;
        if (evento)  evento.required  = false;
    } else {
        if (camposServico) camposServico.style.display = 'none';
        if (camposEvento)  camposEvento.style.display  = 'block';
        if (cliente) cliente.required = false;
        if (servico) servico.required = false;
        if (evento)  evento.required  = true;
    }
}

async function abrirModalAgendamento(id = null) {
    const modal = document.getElementById('modalAgendamento');
    const form  = document.getElementById('formAgendamento');
    if (form) form.reset();
    document.getElementById('agendamentoId').value = '';

    document.getElementById('inputBuscaCliente').value  = '';
    document.getElementById('agendamentoCliente').value = '';
    document.getElementById('inputBuscaServico').value  = '';
    document.getElementById('agendamentoServico').value = '';
    document.getElementById('agendamentoValor').value   = '';

    if (id) {
        document.getElementById('modalAgendamentoTitle').textContent = 'Editar Agendamento';

        let agendamento = appState.agendamentos.find(a => a.id === id);
        if (!agendamento) {
            try {
                const { data } = await _supabase.from('agendamentos').select('*').eq('id', id).single();
                agendamento = data;
            } catch (e) { console.error(e); }
        }

        if (agendamento) {
            document.getElementById('agendamentoId').value             = agendamento.id;
            document.getElementById('agendamentoCliente').value        = agendamento.cliente_id;
            document.getElementById('agendamentoServico').value        = agendamento.servico_id;

            const clienteObj = appState.clientes.find(c => c.id == agendamento.cliente_id);
            const servicoObj = appState.servicos.find(s => s.id == agendamento.servico_id);
            document.getElementById('inputBuscaCliente').value = clienteObj ? clienteObj.nome : (agendamento.cliente_nome || '');
            document.getElementById('inputBuscaServico').value = servicoObj ? servicoObj.nome : (agendamento.servico_nome || '');

            document.getElementById('agendamentoData').value           = agendamento.data;
            document.getElementById('agendamentoHora').value           = agendamento.hora;
            document.getElementById('agendamentoStatusPagamento').value = agendamento.status_pagamento;
            document.getElementById('agendamentoObservacoes').value    = agendamento.observacoes || '';

            if (agendamento.valor) {
                document.getElementById('agendamentoValor').value = parseFloat(agendamento.valor).toFixed(2);
            }
        }
    } else {
        document.getElementById('modalAgendamentoTitle').textContent = 'Novo Agendamento';
        document.getElementById('agendamentoData').value = new Date().toISOString().split('T')[0];
    }

    modal.classList.add('active');
    document.getElementById('overlay').classList.add('active');
}

async function salvarAgendamento(e) {
    e.preventDefault();

    const id              = document.getElementById('agendamentoId').value;
    const clienteId       = document.getElementById('agendamentoCliente').value;
    const servicoId       = document.getElementById('agendamentoServico').value;
    const data            = document.getElementById('agendamentoData').value;
    const hora            = document.getElementById('agendamentoHora').value;
    const statusPagamento = document.getElementById('agendamentoStatusPagamento').value;
    const obs             = document.getElementById('agendamentoObservacoes').value;
    const tipo            = document.querySelector('input[name="tipoAgendamento"]:checked').value;
    const eventoNome      = document.getElementById('eventoNome').value;

    if (tipo === 'servico' && (!clienteId || !servicoId)) {
        showToast('Selecione o Cliente e o Serviço.', 'warning'); return;
    }
    if (tipo === 'evento' && !eventoNome) {
        showToast('Digite o nome do evento.', 'warning'); return;
    }
    if (!data || !hora) {
        showToast('Data e Hora são obrigatórios.', 'warning'); return;
    }

    try {
        let clienteNome = null;
        let servicoNome = null;
        let valor       = 0;
        let clienteObj  = null;

        if (tipo === 'servico') {
            clienteObj = appState.clientes.find(c => c.id == clienteId);
            if (clienteObj) clienteNome = clienteObj.nome;

            const servicoObj = appState.servicos.find(s => s.id == servicoId);
            if (servicoObj) { servicoNome = servicoObj.nome; valor = servicoObj.valor; }
        }

        const dados = {
            data: data,
            hora: hora,
            observacoes: obs,
            status: 'pendente',
            status_pagamento: statusPagamento,
            tipo: tipo,
            cliente_nome: clienteNome,
            servico_nome: servicoNome,
            evento_nome:  tipo === 'evento' ? eventoNome : null,
            valor: valor
        };

        if (tipo === 'servico') {
            dados.cliente_id = clienteId;
            dados.servico_id = servicoId;
        } else {
            dados.cliente_id = null;
            dados.servico_id = null;
        }

        let error;
        if (id) {
            const res = await _supabase.from('agendamentos').update(dados).eq('id', id);
            error = res.error;
        } else {
            const res = await _supabase.from('agendamentos').insert(dados);
            error = res.error;
        }

        if (error) throw error;

        // Disparo de e-mail automático
        if (clienteObj && clienteObj.email) {
            const procedimento = dados.servico_nome || dados.evento_nome || 'Atendimento';
            const [ano, mes, dia] = dados.data.split('-');
            const dataHoraBr = `${dia}/${mes}/${ano} às ${dados.hora}`;
            if (typeof window.dispararEmailAutomatico === 'function') {
                window.dispararEmailAutomatico(clienteObj.email, clienteObj.nome, dataHoraBr, procedimento);
            }
        }

        showToast('Agendamento salvo com sucesso!', 'success');
        fecharModal('modalAgendamento');
        appState._lastFetch = 0;

        if (typeof carregarDashboard === 'function') carregarDashboard();
        if (typeof carregarAgendaDoDia === 'function' && document.getElementById('agendaContainer')) {
            const dataObj = new Date(data);
            const adjustedDate = new Date(dataObj.getTime() + dataObj.getTimezoneOffset() * 60000);
            carregarAgendaDoDia(adjustedDate);
            if (typeof renderCalendar === 'function') renderCalendar();
        }

    } catch (err) {
        console.error("Erro ao salvar:", err);
        showToast('Erro ao salvar agendamento.', 'error');
    }
}

function updateValorServico() {
    const sel = document.getElementById('agendamentoServico');
    if (!sel || sel.selectedIndex < 0) return;
    const opt   = sel.options[sel.selectedIndex];
    const valor = opt.getAttribute('data-valor');
    const inputValor = document.getElementById('agendamentoValor');
    if (inputValor && valor) {
        inputValor.value = "R$ " + parseFloat(valor).toFixed(2).replace('.', ',');
    }
}

const selServicoRef = document.getElementById('agendamentoServico');
if (selServicoRef) selServicoRef.addEventListener('change', updateValorServico);

window.cancelarAgendamento = async function(id) {
    if (!confirm('Tem certeza que deseja cancelar este agendamento?')) return;

    try {
        const { error } = await _supabase
            .from('agendamentos')
            .update({ status: 'cancelado', status_pagamento: 'cancelado' })
            .eq('id', id);

        if (error) throw error;

        showToast('Agendamento cancelado com sucesso.', 'success');

        if (typeof carregarDashboard === 'function') carregarDashboard();

        const displayData = document.getElementById('dataSelecionadaTexto');
        if (displayData && displayData.textContent !== '-' && typeof carregarAgendaDoDia === 'function') {
            const [dia, mes, ano] = displayData.textContent.split('/');
            const dataObj = new Date(ano, mes - 1, dia);
            carregarAgendaDoDia(dataObj);
            if (typeof renderCalendar === 'function') renderCalendar();
        }
    } catch (err) {
        console.error("Erro ao cancelar:", err);
        showToast('Erro ao cancelar agendamento.', 'error');
    }
};

async function concluirAgendamento(agendamentoId) {
    if (!confirm('Deseja finalizar este atendimento? Os produtos vinculados serão debitados do estoque.')) return;

    const overlayEl = document.getElementById('loadingScreen');
    if (overlayEl) { overlayEl.classList.remove('hidden'); overlayEl.querySelector('h2').textContent = "Baixando Estoque..."; }

    try {
        const agendamento = appState.agendamentos.find(a => a.id === agendamentoId);
        if (!agendamento) throw new Error("Agendamento não encontrado.");

        await _supabase.from('agendamentos').update({ status: 'concluido' }).eq('id', agendamentoId);

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

        showToast('Atendimento concluído! 📦', 'success');

        await carregarDadosIniciais(true);
        if (agendamento.cliente_id) abrirDetalhesCliente(agendamento.cliente_id);
        if (typeof carregarDashboard === 'function' && appState.currentPage === 'dashboard') carregarDashboard();

    } catch (err) {
        console.error('Erro:', err);
        showToast('Erro ao concluir.', 'error');
    } finally {
        if (overlayEl) { overlayEl.classList.add('hidden'); overlayEl.querySelector('h2').textContent = "Agendamento Premium"; }
    }
}

async function autoConcluirPassados() {
    const hojeStr = new Date().toISOString().split('T')[0];
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
        } catch (e) { console.error("Erro na auto-conclusão:", e); }
    }
}

async function reverterConclusao(agendamentoId) {
    if (!confirm('Deseja DESFAZER este atendimento?\nO status mudará para Cancelado/Falta e os produtos retornarão ao estoque.')) return;

    const overlayEl = document.getElementById('loadingScreen');
    if (overlayEl) { overlayEl.classList.remove('hidden'); overlayEl.querySelector('h2').textContent = "Estornando..."; }

    try {
        const agendamento = appState.agendamentos.find(a => a.id === agendamentoId);
        if (!agendamento) return;

        await _supabase.from('agendamentos').update({ status: 'cancelado' }).eq('id', agendamentoId);

        if (agendamento.servico_id) {
            const servico = appState.servicos.find(s => s.id === agendamento.servico_id);
            if (servico && servico.produtos_vinculados) {
                for (const prod of servico.produtos_vinculados) {
                    const itemEstoque = appState.estoque.find(e => e.id === prod.estoque_id);
                    if (itemEstoque) {
                        const novaQtd = itemEstoque.quantidade + prod.quantidade;
                        await _supabase.from('estoque').update({ quantidade: novaQtd }).eq('id', itemEstoque.id);
                    }
                }
            }
        }

        showToast('Conclusão desfeita e estoque estornado!', 'info');

        await carregarDadosIniciais(true);
        if (agendamento.cliente_id) abrirDetalhesCliente(agendamento.cliente_id);
        if (typeof carregarDashboard === 'function' && appState.currentPage === 'dashboard') carregarDashboard();

    } catch (err) {
        console.error(err);
        alert("Erro ao reverter: " + err.message);
    } finally {
        if (overlayEl) { overlayEl.classList.add('hidden'); overlayEl.querySelector('h2').textContent = "Agendamento Premium"; }
    }
}

// ========================================
// AUTOCOMPLETE — CLIENTES E SERVIÇOS
// ========================================

window.abrirDropdownCliente = function() {
    const dropdown = document.getElementById('dropdownClientes');
    if (dropdown) dropdown.style.display = 'block';
    window.filtrarClientesDropdown();
};

window.filtrarClientesDropdown = function() {
    const input    = document.getElementById('inputBuscaCliente');
    const dropdown = document.getElementById('dropdownClientes');
    if (!input || !dropdown) return;

    const termo = input.value.toLowerCase();
    dropdown.style.display = 'block';

    let filtrados = [...appState.clientes].sort((a, b) => a.nome.localeCompare(b.nome));
    if (termo) filtrados = filtrados.filter(c => c.nome.toLowerCase().includes(termo));

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
        </div>`).join('');
};

window.selecionarCliente = function(id, nome) {
    document.getElementById('agendamentoCliente').value = id;
    document.getElementById('inputBuscaCliente').value  = nome;
    document.getElementById('dropdownClientes').style.display = 'none';
};

window.abrirDropdownServico = function() {
    const dropdown = document.getElementById('dropdownServicos');
    if (dropdown) dropdown.style.display = 'block';
    window.filtrarServicosDropdown();
};

window.filtrarServicosDropdown = function() {
    const input    = document.getElementById('inputBuscaServico');
    const dropdown = document.getElementById('dropdownServicos');
    if (!input || !dropdown) return;

    const termo = input.value.toLowerCase();
    dropdown.style.display = 'block';

    let filtrados = [...appState.servicos].sort((a, b) => a.nome.localeCompare(b.nome));
    if (termo) filtrados = filtrados.filter(s => s.nome.toLowerCase().includes(termo));

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
        </div>`).join('');
};

window.selecionarServico = function(id, nome, valor) {
    document.getElementById('agendamentoServico').value = id;
    document.getElementById('inputBuscaServico').value  = nome;
    const inputValor = document.getElementById('agendamentoValor');
    if (inputValor) inputValor.value = parseFloat(valor).toFixed(2);
    document.getElementById('dropdownServicos').style.display = 'none';
};

// Fecha dropdowns ao clicar fora
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
    const termo     = document.getElementById('searchServicoModal')?.value.toLowerCase() || '';
    const selServico = document.getElementById('agendamentoServico');
    if (!selServico) return;

    let servicosOrdenados = [...appState.servicos].sort((a, b) => a.nome.localeCompare(b.nome));
    if (termo) servicosOrdenados = servicosOrdenados.filter(s => s.nome.toLowerCase().includes(termo));

    const valorAtual = selServico.value;
    selServico.innerHTML = '<option value="">Selecione o Serviço...</option>' +
        servicosOrdenados.map(s => `<option value="${s.id}" data-valor="${s.valor}">${s.nome}</option>`).join('');
    if (valorAtual) selServico.value = valorAtual;
};

// ========================================
// EXPORTAÇÕES GLOBAIS
// ========================================
window.toggleTipoAgendamento = toggleTipoAgendamento;
window.abrirModalAgendamento = abrirModalAgendamento;
window.salvarAgendamento     = salvarAgendamento;
window.updateValorServico    = updateValorServico;
window.concluirAgendamento   = concluirAgendamento;
window.autoConcluirPassados  = autoConcluirPassados;
window.reverterConclusao     = reverterConclusao;
