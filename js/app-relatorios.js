// ========================================
// RELATÓRIOS INTELIGENTES (Financeiro + Operacional + VIPs)
// ========================================

let chartFaturamento = null;
let chartQuantidade = null;

async function carregarRelatorios() {
    // 1. Garante dados atualizados
    if (typeof carregarDadosIniciais === 'function') await carregarDadosIniciais();

    const container = document.getElementById('relatoriosContent');
    if (!container) return;

    // 2. Configura Filtros (Seleção Automática do Mês Atual)
    const elMes = document.getElementById('relatorioMes');
    const elAno = document.getElementById('relatorioAno');
    
    if (!elMes || !elAno) return;

    if (!elMes.dataset.init) {
        const hoje = new Date();
        elMes.value = hoje.getMonth();
        elAno.value = hoje.getFullYear();
        elMes.dataset.init = "true";
    }

    const mes = parseInt(elMes.value);
    const ano = parseInt(elAno.value);

    // 3. Filtrar Dados do Mês (TUDO que não foi cancelado)
    const dadosDoMes = appState.agendamentos.filter(a => {
        const d = new Date(a.data);
        return d.getMonth() === mes && 
               d.getFullYear() === ano && 
               a.status !== 'cancelado';
    });

    // --- CÁLCULOS FINANCEIROS ---
    const faturamentoReal = dadosDoMes
        .filter(a => a.status === 'concluido' || a.status_pagamento === 'pago')
        .reduce((sum, a) => sum + (Number(a.valor) || 0), 0);

    const faturamentoPrevisto = dadosDoMes
        .filter(a => a.status === 'agendado' && a.status_pagamento !== 'pago')
        .reduce((sum, a) => sum + (Number(a.valor) || 0), 0);

    const totalReceberGeral = appState.agendamentos
        .filter(a => a.status_pagamento === 'devendo' && a.status !== 'cancelado')
        .reduce((sum, a) => sum + (Number(a.valor) || 0), 0);

    // --- CÁLCULOS PARA GRÁFICOS E RANKING ---
    
    // A. Agrupar por Serviço (Valor e Quantidade)
    const statsServicos = {};
    dadosDoMes.forEach(a => {
        const nome = a.servico_nome || a.evento_nome || 'Outros';
        if (!statsServicos[nome]) {
            statsServicos[nome] = { qtd: 0, valor: 0 };
        }
        statsServicos[nome].qtd += 1;
        statsServicos[nome].valor += (Number(a.valor) || 0);
    });

    const labelsServicos = Object.keys(statsServicos);
    const dataValor = labelsServicos.map(k => statsServicos[k].valor);
    const dataQtd = labelsServicos.map(k => statsServicos[k].qtd);

    // B. Ranking de Clientes (Quem veio mais vezes neste mês)
    const statsClientes = {};
    dadosDoMes.forEach(a => {
        // Ignora "Eventos Pessoais" sem cliente
        if (!a.cliente_nome) return;
        
        if (!statsClientes[a.cliente_nome]) {
            statsClientes[a.cliente_nome] = { qtd: 0, gasto: 0 };
        }
        statsClientes[a.cliente_nome].qtd += 1;
        statsClientes[a.cliente_nome].gasto += (Number(a.valor) || 0);
    });

    // Transforma em array e ordena (Top 5)
    const rankingClientes = Object.entries(statsClientes)
        .map(([nome, dados]) => ({ nome, ...dados }))
        .sort((a, b) => b.qtd - a.qtd) // Ordena por quantidade (quem vem mais)
        .slice(0, 5); // Pega só os 5 primeiros

    // 4. HTML DA PÁGINA (ATUALIZADO)
    container.innerHTML = `
        <div class="metrics-row">
            <div class="metric-card">
                <div class="metric-icon gold"><i class="fas fa-coins"></i></div>
                <div class="metric-info">
                    <p>Faturamento Realizado</p>
                    <h3>${formatCurrency(faturamentoReal)}</h3>
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-icon blue"><i class="fas fa-chart-line"></i></div>
                <div class="metric-info">
                    <p>Previsão (Agendado)</p>
                    <h3 style="color: var(--info);">${formatCurrency(faturamentoPrevisto)}</h3>
                </div>
            </div>
            <div class="metric-card" style="border-left: 4px solid var(--error);">
                <div class="metric-icon red"><i class="fas fa-hand-holding-usd"></i></div>
                <div class="metric-info">
                    <p>Total a Receber (Geral)</p>
                    <h3 style="color: var(--error);">${formatCurrency(totalReceberGeral)}</h3>
                </div>
            </div>
        </div>

        <div class="charts-row">
            <div class="chart-card">
                <h3><i class="fas fa-chart-pie"></i> Faturamento por Serviço (R$)</h3>
                <div style="height: 250px;">
                    <canvas id="chartFaturamentoTipo"></canvas>
                </div>
            </div>
            
            <div class="chart-card">
                <h3><i class="fas fa-chart-bar"></i> Nº de Procedimentos</h3>
                <div style="height: 250px;">
                    <canvas id="chartQuantidadeServicos"></canvas>
                </div>
            </div>
        </div>

        <div class="charts-row">
            <div class="chart-card">
                <h3><i class="fas fa-crown" style="color: var(--gold);"></i> Top Clientes do Mês</h3>
                <div class="ranking-list">
                    ${rankingClientes.length === 0 ? '<p style="color:#666; text-align:center; padding:20px;">Sem dados.</p>' : 
                        rankingClientes.map((c, index) => `
                            <div class="ranking-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #333;">
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <span style="font-weight:bold; color:var(--gold); font-size:1.2rem;">#${index + 1}</span>
                                    <span>${c.nome}</span>
                                </div>
                                <div style="text-align:right;">
                                    <div style="font-weight:bold;">${c.qtd} visitas</div>
                                    <div style="font-size:0.8rem; color:#888;">${formatCurrency(c.gasto)}</div>
                                </div>
                            </div>
                        `).join('')
                    }
                </div>
            </div>

            <div class="chart-card">
                <h3><i class="fas fa-list-ol"></i> Extrato Detalhado</h3>
                <div class="table-responsive" style="height: 300px; overflow-y: auto;">
                    <table class="relatorio-table">
                        <thead>
                            <tr>
                                <th>Dia</th>
                                <th>Cliente/Serviço</th>
                                <th>Status</th>
                                <th>Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${dadosDoMes.length === 0 ? 
                                '<tr><td colspan="4" style="text-align:center; padding:20px;">Nenhum dado neste mês.</td></tr>' : 
                                dadosDoMes.sort((a,b) => new Date(a.data) - new Date(b.data)).map(a => `
                                    <tr>
                                        <td>${new Date(a.data).getDate()}/${new Date(a.data).getMonth()+1}</td>
                                        <td>
                                            <strong>${a.cliente_nome || a.evento_nome}</strong><br>
                                            <small>${a.servico_nome || ''}</small>
                                        </td>
                                        <td>
                                            <span class="status-badge ${a.status === 'concluido' ? 'pago' : 'pendente'}">
                                                ${a.status === 'concluido' ? 'Realizado' : 'Agendado'}
                                            </span>
                                        </td>
                                        <td style="color: var(--gold);">${formatCurrency(a.valor)}</td>
                                    </tr>
                                `).join('')
                            }
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    // 5. Renderizar Gráficos
    setTimeout(() => {
        renderizarGraficos(labelsServicos, dataValor, dataQtd);
    }, 100);
}

function renderizarGraficos(labels, dataValor, dataQtd) {
    if (typeof Chart === 'undefined') return;

    // --- Gráfico 1: Pizza (Faturamento) ---
    const ctxFat = document.getElementById('chartFaturamentoTipo');
    if (ctxFat) {
        if (chartFaturamento) chartFaturamento.destroy();
        const colors = ['#D4AF37', '#F9A825', '#FFD54F', '#FFF176', '#FFEE58', '#FFFFFF'];

        chartFaturamento = new Chart(ctxFat.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: dataValor,
                    backgroundColor: colors,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { color: '#ccc', font: { size: 10 } } }
                }
            }
        });
    }

    // --- Gráfico 2: Barras (Quantidade) - NOVO! ---
    const ctxQtd = document.getElementById('chartQuantidadeServicos');
    if (ctxQtd) {
        if (chartQuantidade) chartQuantidade.destroy();

        chartQuantidade = new Chart(ctxQtd.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Qtd. Procedimentos',
                    data: dataQtd,
                    backgroundColor: '#D4AF37',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { 
                        beginAtZero: true, 
                        ticks: { color: '#888', stepSize: 1 }, // Inteiros apenas
                        grid: { color: '#333' }
                    },
                    x: { ticks: { color: '#ccc' }, grid: { display: false } }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
}

// Inicializador
document.addEventListener('DOMContentLoaded', () => {
    const elMes = document.getElementById('relatorioMes');
    if (elMes) {
        carregarRelatorios();
    }
});

