// ========================================
// RELATÓRIOS
// ========================================
let chartFaturamento = null;
let chartQuantidade = null;

async function carregarRelatorios() {
    await carregarDadosIniciais(); // Garante dados frescos

    // Pega o container
    const container = document.getElementById('relatoriosContent'); // Verifique se esse ID existe no seu HTML de relatórios
    if (!container) return;

    // Filtros (Se quiser implementar filtro de data depois, use aqui)
    const totalAgendamentos = appState.agendamentos.length;
    
    // Cálculos
    const faturamentoTotal = appState.agendamentos
        .filter(a => a.status_pagamento === 'pago')
        .reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);

    const aReceber = appState.agendamentos
        .filter(a => a.status_pagamento === 'devendo' && a.status !== 'cancelado')
        .reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);

    const servicosRealizados = appState.agendamentos
        .filter(a => a.status === 'concluido').length;

    // --- RENDERIZAÇÃO BONITA (CARDS) ---
    container.innerHTML = `
        <div class="metrics-row">
            <div class="metric-card">
                <div class="metric-icon"><i class="fas fa-dollar-sign"></i></div>
                <div class="metric-info">
                    <p>Faturamento Total</p>
                    <h3>${formatCurrency(faturamentoTotal)}</h3>
                </div>
            </div>

            <div class="metric-card" style="border-left: 4px solid var(--warning);">
                <div class="metric-icon" style="color: var(--warning);"><i class="fas fa-hand-holding-usd"></i></div>
                <div class="metric-info">
                    <p>A Receber</p>
                    <h3 style="color: var(--warning);">${formatCurrency(aReceber)}</h3>
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

        <div style="margin-top: 30px; text-align: right;">
            <button class="btn-primary" onclick="window.print()">
                <i class="fas fa-file-pdf"></i> Imprimir Relatório
            </button>
        </div>
    `;
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
