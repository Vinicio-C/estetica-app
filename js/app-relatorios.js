// ========================================
// RELATÓRIOS - MÓDULO COMPLETO
// ========================================

// Variáveis globais para os gráficos
let chartFaturamento = null;
let chartQuantidade = null;

async function carregarRelatorios() {
    // 1. Garante dados atualizados
    if (typeof carregarDadosIniciais === 'function') await carregarDadosIniciais();

    const container = document.getElementById('relatoriosContent');
    if (!container) return;

    // 2. Filtros de Data (Pega do HTML)
    const elMes = document.getElementById('relatorioMes');
    const elAno = document.getElementById('relatorioAno');
    
    // Se não tiver os filtros na tela (ex: mudou de página), para.
    if (!elMes || !elAno) return;

    const mes = parseInt(elMes.value);
    const ano = parseInt(elAno.value);

    // 3. Filtrar Dados (Apenas CONCLUÍDOS do mês selecionado)
    const dadosFiltrados = appState.agendamentos.filter(a => {
        const d = new Date(a.data);
        return d.getMonth() === mes && 
               d.getFullYear() === ano && 
               a.status === 'concluido';
    });

    // 4. Cálculos dos Cards
    const faturamentoTotal = dadosFiltrados.reduce((sum, a) => sum + (Number(a.valor) || 0), 0);
    const servicosRealizados = dadosFiltrados.length;
    
    // Total a Receber (Geral, todas as datas - dívida é dívida)
    const totalReceber = appState.agendamentos
        .filter(a => a.status_pagamento === 'devendo' && a.status === 'concluido')
        .reduce((sum, a) => sum + (Number(a.valor) || 0), 0);

    // 5. Preparar Dados para os Gráficos (Agrupar por Serviço)
    const dadosPorServico = {};
    dadosFiltrados.forEach(a => {
        const nome = a.servico_nome || a.evento_nome || 'Outros';
        if (!dadosPorServico[nome]) {
            dadosPorServico[nome] = { qtd: 0, total: 0 };
        }
        dadosPorServico[nome].qtd += 1;
        dadosPorServico[nome].total += (Number(a.valor) || 0);
    });

    const labels = Object.keys(dadosPorServico);
    const valuesFaturamento = labels.map(k => dadosPorServico[k].total);
    const valuesQuantidade = labels.map(k => dadosPorServico[k].qtd);

    // 6. Montar o HTML da Página
    container.innerHTML = `
        <div class="metrics-row">
            <div class="metric-card">
                <div class="metric-icon" style="color: var(--gold);"><i class="fas fa-dollar-sign"></i></div>
                <div class="metric-info">
                    <p>Faturamento Total</p>
                    <h3>${formatCurrency(faturamentoTotal)}</h3>
                </div>
            </div>

            <div class="metric-card" style="border-left: 4px solid var(--warning);">
                <div class="metric-icon" style="color: var(--warning);"><i class="fas fa-hand-holding-usd"></i></div>
                <div class="metric-info">
                    <p>Total a Receber</p>
                    <h3 style="color: var(--warning);">${formatCurrency(totalReceber)}</h3>
                </div>
            </div>

            <div class="metric-card">
                <div class="metric-icon"><i class="fas fa-cut"></i></div>
                <div class="metric-info">
                    <p>Serviços Realizados</p>
                    <h3>${servicosRealizados}</h3>
                </div>
            </div>
        </div>

        <div class="charts-row">
            <div class="chart-card">
                <h3><i class="fas fa-chart-pie"></i> Faturamento por Serviço</h3>
                <div style="height: 300px;">
                    <canvas id="chartFaturamentoTipo"></canvas>
                </div>
            </div>
            
            <div class="chart-card">
                <h3><i class="fas fa-chart-bar"></i> Quantidade de Serviços</h3>
                <div style="height: 300px;">
                    <canvas id="chartQuantidadeTipo"></canvas>
                </div>
            </div>
        </div>

        <div class="table-card">
            <h3><i class="fas fa-table"></i> Detalhes do Período</h3>
            <div class="table-responsive">
                <table class="relatorio-table">
                    <thead>
                        <tr>
                            <th>Data/Cliente</th>
                            <th>Serviço</th>
                            <th>Status</th>
                            <th>Valor</th>
                        </tr>
                    </thead>
                    <tbody id="relatorioTableBody"></tbody>
                </table>
            </div>
        </div>

        <div style="margin-top: 30px; text-align: right;">
            <button class="btn-primary" onclick="window.print()">
                <i class="fas fa-print"></i> Imprimir Relatório
            </button>
        </div>
    `;

    // 7. Renderizar Gráficos e Tabela (Com delay para garantir que o HTML existe)
    setTimeout(() => {
        renderizarGraficos(labels, valuesFaturamento, valuesQuantidade);
        renderizarTabelaRelatorio(dadosFiltrados);
    }, 100);
}

// --- FUNÇÃO QUE DESENHA OS GRÁFICOS (FALTAVA NO SEU ARQUIVO) ---
function renderizarGraficos(labels, dataFat, dataQtd) {
    const colors = ['#D4AF37', '#F4E4C1', '#B88A00', '#FFFFFF', '#666666'];

    // Configuração Global Chart.js
    if (typeof Chart !== 'undefined') {
        Chart.defaults.color = '#A0A0A0';
        Chart.defaults.borderColor = '#333';
        Chart.defaults.font.family = "'Montserrat', sans-serif";
    }

    // Destruir gráficos antigos
    if (chartFaturamento) chartFaturamento.destroy();
    if (chartQuantidade) chartQuantidade.destroy();

    // 1. Gráfico Pizza (Rosquinha)
    const ctx1 = document.getElementById('chartFaturamentoTipo');
    if (ctx1) {
        chartFaturamento = new Chart(ctx1.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: dataFat,
                    backgroundColor: colors,
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { boxWidth: 12, color: '#ECECEC' } }
                }
            }
        });
    }

    // 2. Gráfico Barras
    const ctx2 = document.getElementById('chartQuantidadeTipo');
    if (ctx2) {
        chartQuantidade = new Chart(ctx2.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Qtd',
                    data: dataQtd,
                    backgroundColor: '#D4AF37',
                    borderRadius: 4,
                    barThickness: 40
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#333' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }
}

// --- FUNÇÃO DA TABELA ---
function renderizarTabelaRelatorio(dados) {
    const tbody = document.getElementById('relatorioTableBody');
    if (!tbody) return;

    if (dados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color: #666;">Nenhum serviço concluído neste período.</td></tr>';
        return;
    }

    // Ordenar por data
    dados.sort((a, b) => new Date(a.data) - new Date(b.data));

    tbody.innerHTML = dados.map(a => `
        <tr style="border-bottom: 1px solid #333;">
            <td style="padding: 12px;">
                <div style="font-weight:bold; color: #ECECEC;">${a.cliente_nome || 'Evento'}</div>
                <small style="color: #888;">${formatDate(a.data)}</small>
            </td>
            <td style="padding: 12px;">${a.servico_nome || a.evento_nome}</td>
            <td style="padding: 12px;">
                <span class="status-badge ${a.status_pagamento}" style="font-size:0.75rem; padding:2px 8px; border-radius:4px;">
                    ${a.status_pagamento}
                </span>
            </td>
            <td style="padding: 12px; font-weight:bold; color: var(--gold);">
                ${formatCurrency(a.valor)}
            </td>
        </tr>
    `).join('');
}

// Inicializar ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    const elMes = document.getElementById('relatorioMes');
    const elAno = document.getElementById('relatorioAno');
    
    if (elMes && elAno) {
        const hoje = new Date();
        elMes.value = hoje.getMonth();
        elAno.value = hoje.getFullYear();
    }
});