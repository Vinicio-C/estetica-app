// ========================================
// RELATÓRIOS - MÓDULO COMPLETO
// ========================================

// Variáveis globais para controlar os gráficos (permitir destruir e recriar)
let chartFaturamento = null;
let chartQuantidade = null;

async function carregarRelatorios() {
    // 1. Garante dados atualizados
    if (typeof carregarDadosIniciais === 'function') await carregarDadosIniciais();

    // 2. Pegar Filtros do HTML
    const elMes = document.getElementById('relatorioMes');
    const elAno = document.getElementById('relatorioAno');
    
    // Proteção: Se não estiver na página de relatórios, para aqui
    if (!elMes || !elAno) return;

    const mes = parseInt(elMes.value);
    const ano = parseInt(elAno.value);

    // 3. Filtrar Agendamentos (Apenas CONCLUÍDOS do mês selecionado)
    const dadosFiltrados = appState.agendamentos.filter(a => {
        const d = new Date(a.data);
        // Compara Mês e Ano (ajustando fuso horário se necessário, aqui uso simples)
        return d.getMonth() === mes && 
               d.getFullYear() === ano && 
               a.status === 'concluido';
    });

    // 4. Cálculos Gerais (Cards do Topo)
    const faturamentoTotal = dadosFiltrados.reduce((sum, a) => sum + (Number(a.valor) || 0), 0);
    const servicosRealizados = dadosFiltrados.length;
    
    // Total a Receber (Geral - Dívidas pendentes totais, não só do mês)
    const totalReceber = appState.agendamentos
        .filter(a => a.status_pagamento === 'devendo' && a.status === 'concluido')
        .reduce((sum, a) => sum + (Number(a.valor) || 0), 0);

    // 5. Atualizar HTML dos Cards
    // Verifica se os elementos existem antes de tentar alterar
    const elFat = document.getElementById('metricFaturamentoTotal');
    const elRec = document.getElementById('metricTotalReceber');
    const elServ = document.getElementById('metricServicosRealizados');

    if (elFat) elFat.textContent = formatCurrency(faturamentoTotal);
    if (elRec) elRec.textContent = formatCurrency(totalReceber);
    if (elServ) elServ.textContent = servicosRealizados;

    // 6. Preparar Dados para os Gráficos (Agrupar por Serviço)
    const dadosPorServico = {};
    
    dadosFiltrados.forEach(a => {
        // Usa o nome do serviço ou evento
        const nome = a.servico_nome || a.evento_nome || 'Outros';
        
        if (!dadosPorServico[nome]) {
            dadosPorServico[nome] = { qtd: 0, total: 0 };
        }
        
        dadosPorServico[nome].qtd += 1;
        dadosPorServico[nome].total += (Number(a.valor) || 0);
    });

    // Separa em arrays para o Chart.js
    const labels = Object.keys(dadosPorServico);
    const valuesFaturamento = labels.map(k => dadosPorServico[k].total);
    const valuesQuantidade = labels.map(k => dadosPorServico[k].qtd);

    // 7. Renderizar Gráficos e Tabela
    renderizarGraficos(labels, valuesFaturamento, valuesQuantidade);
    renderizarTabelaRelatorio(dadosFiltrados);
}

// --- FUNÇÃO PARA DESENHAR OS GRÁFICOS ---
function renderizarGraficos(labels, dataFat, dataQtd) {
    // Cores do Tema Dark Luxury
    const colors = [
        '#D4AF37', // Dourado Principal
        '#F4E4C1', // Bege Claro
        '#B88A00', // Dourado Escuro
        '#FFFFFF', // Branco
        '#666666'  // Cinza
    ];

    // Destruir gráficos antigos se existirem (para não sobrepor)
    if (chartFaturamento) chartFaturamento.destroy();
    if (chartQuantidade) chartQuantidade.destroy();

    // Configuração Global de Fonte do Chart.js
    if (typeof Chart !== 'undefined') {
        Chart.defaults.color = '#A0A0A0';
        Chart.defaults.borderColor = '#333';
        Chart.defaults.font.family = "'Montserrat', sans-serif";
    }

    // 1. Gráfico de Faturamento (Rosquinha)
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
                    legend: { position: 'right', labels: { boxWidth: 12 } },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) label += ': ';
                                label += formatCurrency(context.raw);
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }

    // 2. Gráfico de Quantidade (Barras)
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
                    borderRadius: 4,
                    barThickness: 30
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { 
                        beginAtZero: true, 
                        grid: { color: '#333' },
                        ticks: { stepSize: 1 }
                    },
                    x: { grid: { display: false } }
                }
            }
        });
    }
}

// --- FUNÇÃO PARA PREENCHER A TABELA DETALHADA ---
function renderizarTabelaRelatorio(dados) {
    const tbody = document.getElementById('relatorioTableBody');
    if (!tbody) return;

    if (dados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color: #666;">Nenhum dado encontrado neste período.</td></tr>';
        return;
    }

    // Ordena por dia
    dados.sort((a, b) => new Date(a.data) - new Date(b.data));

    tbody.innerHTML = dados.map(a => `
        <tr style="border-bottom: 1px solid #333;">
            <td style="padding: 12px;">
                <div style="font-weight:bold; color: #ECECEC;">${a.cliente_nome || 'Evento'}</div>
                <small style="color: #888;">${formatDate(a.data)}</small>
            </td>
            <td style="padding: 12px;">${a.servico_nome || a.evento_nome}</td>
            
            <td style="padding: 12px; color: var(--success);">
                ${a.status_pagamento === 'pago' ? formatCurrency(a.valor) : '-'}
            </td>
            
            <td style="padding: 12px; color: var(--error);">
                ${a.status_pagamento === 'devendo' ? formatCurrency(a.valor) : '-'}
            </td>
            
            <td style="padding: 12px; font-weight:bold; color: var(--gold);">
                ${formatCurrency(a.valor)}
            </td>
        </tr>
    `).join('');
}

// Função de Exportar (Simples)
function exportarRelatorioPDF() {
    window.print();
}

// Inicializador ao carregar a página (se necessário)
document.addEventListener('DOMContentLoaded', () => {
    // Define mês e ano atual nos selects se eles estiverem vazios
    const elMes = document.getElementById('relatorioMes');
    const elAno = document.getElementById('relatorioAno');
    
    if (elMes && elAno) {
        const hoje = new Date();
        elMes.value = hoje.getMonth();
        elAno.value = hoje.getFullYear();
    }
});