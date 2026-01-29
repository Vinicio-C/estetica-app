// ========================================
// RELATÓRIOS
// ========================================
let chartFaturamento = null;
let chartQuantidade = null;

async function carregarRelatorios() {
    await carregarDadosIniciais();
    
    const mes = parseInt(document.getElementById('relatorioMes').value);
    const ano = parseInt(document.getElementById('relatorioAno').value);
    
    // Definir período
    const inicio = new Date(ano, mes, 1);
    const fim = new Date(ano, mes + 1, 0, 23, 59, 59);
    
    // Filtrar agendamentos do período
    const agendamentosPeriodo = appState.agendamentos.filter(a => {
        const dataAgendamento = new Date(a.data);
        return dataAgendamento >= inicio && 
               dataAgendamento <= fim && 
               a.tipo === 'servico' &&
               a.status === 'concluido';
    });
    
    // Calcular métricas
    const faturamentoTotal = agendamentosPeriodo
        .filter(a => a.status_pagamento === 'pago')
        .reduce((sum, a) => sum + (a.valor || 0), 0);
    
    const totalReceber = agendamentosPeriodo
        .filter(a => a.status_pagamento === 'devendo')
        .reduce((sum, a) => sum + (a.valor || 0), 0);
    
    const servicosRealizados = agendamentosPeriodo.length;
    
    // Atualizar métricas
    document.getElementById('metricFaturamentoTotal').textContent = formatCurrency(faturamentoTotal);
    document.getElementById('metricTotalReceber').textContent = formatCurrency(totalReceber);
    document.getElementById('metricServicosRealizados').textContent = servicosRealizados;
    
    // Agrupar por tipo de serviço
    const porTipo = {};
    agendamentosPeriodo.forEach(a => {
        const servico = appState.servicos.find(s => s.id === a.servico_id);
        const tipo = servico ? servico.tipo : 'Outros';
        
        if (!porTipo[tipo]) {
            porTipo[tipo] = {
                quantidade: 0,
                faturamento: 0
            };
        }
        
        porTipo[tipo].quantidade++;
        if (a.status_pagamento === 'pago') {
            porTipo[tipo].faturamento += a.valor || 0;
        }
    });
    
    const tipos = Object.keys(porTipo);
    const quantidades = tipos.map(t => porTipo[t].quantidade);
    const faturamentos = tipos.map(t => porTipo[t].faturamento);
    
    // Cores elegantes para os gráficos
    const coresGraficos = [
        '#D4AF37', // Gold
        '#E8C4B0', // Rose gold
        '#D4B5A0', // Beige 3
        '#C9A68A', // Beige 4
        '#B8941E', // Gold dark
        '#F4E4C1', // Gold light
        '#7CB342', // Green
        '#FFA726', // Orange
        '#29B6F6', // Blue
        '#AB47BC'  // Purple
    ];
    
    // Gráfico de Faturamento por Tipo
    if (chartFaturamento) {
        chartFaturamento.destroy();
    }
    
    const ctxFaturamento = document.getElementById('chartFaturamentoTipo').getContext('2d');
    chartFaturamento = new Chart(ctxFaturamento, {
        type: 'pie',
        data: {
            labels: tipos,
            datasets: [{
                data: faturamentos,
                backgroundColor: coresGraficos.slice(0, tipos.length),
                borderWidth: 2,
                borderColor: '#FFFFFF'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: {
                            family: 'Montserrat',
                            size: 12
                        },
                        padding: 15,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = formatCurrency(context.parsed);
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
    
    // Gráfico de Quantidade por Tipo
    if (chartQuantidade) {
        chartQuantidade.destroy();
    }
    
    const ctxQuantidade = document.getElementById('chartQuantidadeTipo').getContext('2d');
    chartQuantidade = new Chart(ctxQuantidade, {
        type: 'pie',
        data: {
            labels: tipos,
            datasets: [{
                data: quantidades,
                backgroundColor: coresGraficos.slice(0, tipos.length),
                borderWidth: 2,
                borderColor: '#FFFFFF'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: {
                            family: 'Montserrat',
                            size: 12
                        },
                        padding: 15,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} serviços (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
    
    // Tabela Detalhada por Cliente
    const porCliente = {};
    
    agendamentosPeriodo.forEach(a => {
        if (!porCliente[a.cliente_id]) {
            porCliente[a.cliente_id] = {
                nome: a.cliente_nome,
                servicos: 0,
                pago: 0,
                devendo: 0
            };
        }
        
        porCliente[a.cliente_id].servicos++;
        
        if (a.status_pagamento === 'pago') {
            porCliente[a.cliente_id].pago += a.valor || 0;
        } else if (a.status_pagamento === 'devendo') {
            porCliente[a.cliente_id].devendo += a.valor || 0;
        }
    });
    
    const clientesArray = Object.values(porCliente).sort((a, b) => 
        (b.pago + b.devendo) - (a.pago + a.devendo)
    );
    
    const tableBody = document.getElementById('relatorioTableBody');
    
    if (clientesArray.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: #999;">
                    <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                    Nenhum serviço realizado neste período
                </td>
            </tr>
        `;
    } else {
        tableBody.innerHTML = clientesArray.map(c => `
            <tr>
                <td><strong>${c.nome}</strong></td>
                <td style="text-align: center;">${c.servicos}</td>
                <td style="text-align: right; color: #7CB342; font-weight: 600;">${formatCurrency(c.pago)}</td>
                <td style="text-align: right; color: #E53935; font-weight: 600;">${formatCurrency(c.devendo)}</td>
                <td style="text-align: right; font-weight: 700; color: var(--gold-dark);">${formatCurrency(c.pago + c.devendo)}</td>
            </tr>
        `).join('');
    }
}

function exportarRelatorioPDF() {
    showToast('Funcionalidade de exportação em desenvolvimento. Use Imprimir (Ctrl+P) como alternativa.', 'info');
    setTimeout(() => {
        window.print();
    }, 1000);
}

// Inicializar relatório quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    const hoje = new Date();
    document.getElementById('relatorioMes').value = hoje.getMonth();
    document.getElementById('relatorioAno').value = hoje.getFullYear();
});

// ========================================
// MODALS
// ========================================
function fecharModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    document.getElementById('overlay').classList.remove('active');
}

// Fechar modal ao clicar no overlay
document.addEventListener('click', (e) => {
    if (e.target.id === 'overlay') {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
        document.getElementById('overlay').classList.remove('active');
    }
});

// ========================================
// TOAST NOTIFICATIONS
// ========================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="fas ${icons[type]}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(400px)';
        setTimeout(() => {
            container.removeChild(toast);
        }, 300);
    }, 3000);
}

// ========================================
// UTILITY FUNCTIONS
// ========================================
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

function formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function formatDateTime(date) {
    const d = new Date(date);
    return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatTime(date) {
    const d = new Date(date);
    return d.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDateInput(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatTimeInput(date) {
    const d = new Date(date);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

console.log('✨ Módulo de Relatórios carregado!');
