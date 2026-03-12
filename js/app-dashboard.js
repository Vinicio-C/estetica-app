// ========================================
// APP-DASHBOARD.JS — Dashboard principal
// ========================================

async function carregarDashboard() {
    await carregarDadosIniciais();

    const hoje  = new Date(); hoje.setHours(0, 0, 0, 0);
    const amanha = new Date(hoje); amanha.setDate(amanha.getDate() + 1);

    const agendamentosHoje = appState.agendamentos.filter(a => {
        const d = new Date(a.data);
        return d >= hoje && d < amanha && a.status !== 'cancelado';
    });

    const faturamentoHoje = agendamentosHoje
        .filter(a => a.status_pagamento === 'pago')
        .reduce((sum, a) => sum + (Number(a.valor) || 0), 0);

    const totalClientes = appState.clientes.length;

    const debitosTotal = appState.agendamentos
        .filter(a => a.status_pagamento === 'devendo' && a.status !== 'cancelado')
        .reduce((sum, a) => sum + (Number(a.valor) || 0), 0);

    const elAgend = document.getElementById('statAgendamentosHoje');
    if (elAgend) elAgend.textContent = agendamentosHoje.length;

    const elFat = document.getElementById('statFaturamentoHoje');
    if (elFat) elFat.textContent = formatCurrency(faturamentoHoje);

    const elCli = document.getElementById('statTotalClientes');
    if (elCli) elCli.textContent = totalClientes;

    const elDeb = document.getElementById('statDebitosTotal');
    if (elDeb) elDeb.textContent = formatCurrency(debitosTotal);

    renderizarListasDashboard();

    if (typeof atualizarNotificacoes === 'function') atualizarNotificacoes();
}

function renderizarListasDashboard() {
    console.log('🔄 Iniciando renderização das listas do Dashboard...');
    const hojeStr = new Date().toISOString().split('T')[0];

    // 1. Próximos Agendamentos
    const listaAgenda = document.getElementById('dashAgendamentosList');
    if (listaAgenda) {
        const proximos = appState.agendamentos
            .filter(a => a.data >= hojeStr && a.status !== 'cancelado')
            .sort((a, b) => {
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

                let titulo    = a.cliente_nome || 'Cliente';
                if (a.tipo === 'evento') titulo = a.evento_nome || 'Evento';

                let descricao = 'Agendamento';
                if (a.servico_nome)          descricao = a.servico_nome;
                else if (a.evento_nome)      descricao = a.evento_nome;
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
                </div>`;
            }).join('');
        }
    }

    // 2. Alertas de Estoque
    const listaEstoque = document.getElementById('dashEstoqueList');
    if (!listaEstoque) {
        console.error('❌ ERRO: Não achei a div "dashEstoqueList" no HTML!');
    } else {
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
                </div>`).join('');
        }
    }

    // 3. Contas a Receber
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
                </div>`).join('');
        }
    }
}

// ========================================
// EXPORTAÇÕES GLOBAIS
// ========================================
window.carregarDashboard         = carregarDashboard;
window.renderizarListasDashboard = renderizarListasDashboard;
