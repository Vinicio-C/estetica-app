// ========================================
// RELATÓRIOS - MÓDULO COMPLETO E FUNCIONAL
// ========================================

// Variáveis globais para os gráficos
let chartFaturamento = null;
let chartQuantidade = null;

async function carregarRelatorios() {
    // 1. Garante que temos dados atualizados
    if (typeof carregarDadosIniciais === 'function') await carregarDadosIniciais();

    const container = document.getElementById('relatoriosContent');
    if (!container) return;

    // 2. Filtros de Data
    const mes = parseInt(document.getElementById('relatorioMes').value);
    const ano = parseInt(document.getElementById('relatorioAno').value);

    // 3. Filtrar Dados (Apenas concluídos do mês selecionado)
    const dadosFiltrados = appState.agendamentos.filter(a => {
        const d = new Date(a.data);
        return d.getMonth() === mes && 
               d.getFullYear() === ano && 
               a.status === 'concluido';
    });

    // 4. Cálculos dos Cards
    const faturamentoTotal = dadosFiltrados.reduce((sum, a) => sum + (Number(a.valor) || 0), 0);
    const servicosRealizados = dadosFiltrados.length;
    
    // Total a Receber (Geral, todas as datas)
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
                <div class="metric-icon gold"><i class="fas fa-dollar-sign"></i></div>
                <div class="metric-info">
                    <p>Faturamento Total</p>
                    <h3>${formatCurrency(faturamentoTotal)}</h3>
                </div>
            </div>

            <div class="metric-card">
                <div class="metric-icon rose"><i class="fas fa-hand-holding-usd"></i></div>
                <div class="metric-info">
                    <p>Total a Receber</p>
                    <h3 style="color: var(--warning);">${formatCurrency(totalReceber)}</h3>
                </div>
            </div>

            <div class="metric-card">
                <div class="metric-icon beige"><i class="fas fa-cut"></i></div>
                <div class="metric-info">
                    <p>Serviços Realizados</p>
                    <h3>${servicosRealizados}</h3>
                </div>
            </div>
        </div>

        <div class="charts-row">
            <div class="chart-card">
                <h3><i class="fas fa-chart-pie"></i> Faturamento por Serviço</h3>
                <canvas id="chartFaturamentoTipo"></canvas>
            </div>
            
            <div class="chart-card">
                <h3><i class="fas fa-chart-bar"></i> Quantidade de Serviços</h3>
                <canvas id="chartQuantidadeTipo"></canvas>
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

    // 7. AGORA SIM: Desenhar os Gráficos e a Tabela
    // Pequeno timeout para garantir que o HTML foi injetado antes de desenhar
    setTimeout(() => {
        renderizarGraficos(labels, valuesFaturamento, valuesQuantidade);
        renderizarTabelaRelatorio(dadosFiltrados);
    }, 50);
}

// --- FUNÇÃO DE DESENHAR GRÁFICOS (CHART.JS) ---
function renderizarGraficos(labels, dataFat, dataQtd) {
    const colors = ['#D4AF37', '#F4E4C1', '#B88A00', '#FFFFFF', '#666666'];

    // Configuração Global
    if (typeof Chart !== 'undefined') {
        Chart.defaults.color = '#A0A0A0';
        Chart.defaults.borderColor = '#333';
        Chart.defaults.font.family = "'Montserrat', sans-serif";
    }

    // Destruir anteriores se existirem
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
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right' }
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
                    label: 'Quantidade',
                    data: dataQtd,
                    backgroundColor: '#D4AF37',
                    borderRadius: 4
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
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px;">Nenhum dado encontrado.</td></tr>';
        return;
    }

    tbody.innerHTML = dados.map(a => `
        <tr>
            <td>
                <div style="font-weight:bold; color: #ECECEC;">${a.cliente_nome || 'Evento'}</div>
                <small style="color: #888;">${formatDate(a.data)}</small>
            </td>
            <td>${a.servico_nome || a.evento_nome}</td>
            <td style="font-weight:bold; color: var(--gold);">${formatCurrency(a.valor)}</td>
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