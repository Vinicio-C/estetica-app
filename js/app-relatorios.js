// ========================================
// RELATÓRIOS INTELIGENTES (Financeiro + Operacional + VIPs)
// ========================================

let chartFaturamento = null;
let chartQuantidade = null;
let chartMargem = null;

// Último recorte calculado, reaproveitado pela impressão
let ultimoRelatorio = null;

/**
 * Custo dos produtos consumidos no período, do livro-razão.
 *
 * Usa `custo_unitario` gravado NO MOVIMENTO, e não `estoque.custo_medio` atual —
 * é isso que torna o resultado de um mês fechado imutável. Se ela comprar mais
 * caro em setembro, o CMV de agosto não pode mudar.
 *
 * Devolve { total, porAgendamento: {id: custo}, porProduto: [{nome, qtd, custo}] }
 */
async function carregarCustosDoPeriodo(mes, ano) {
    const vazio = { total: 0, porAgendamento: {}, porProduto: [], erro: null };
    const { inicio, fim } = intervaloDoMes(mes, ano);

    // Direto no _supabase: o fetchAPI engole erro e devolve lista vazia, o que
    // aqui viraria "custo zero" e um lucro inventado.
    const { data, error } = await _supabase
        .from('estoque_movimentos')
        .select('agendamento_id, quantidade_delta, custo_total, estoque_id, origem')
        .eq('origem', 'atendimento')
        .gte('data', inicio).lte('data', fim);

    if (error) {
        console.warn('Não consegui ler os custos do período:', error.message);
        return { ...vazio, erro: error.message };
    }

    const porAgendamento = {};
    const porProdutoMap = {};
    let total = 0;

    (data || []).forEach(m => {
        const custo = Number(m.custo_total) || 0;
        total += custo;

        if (m.agendamento_id) {
            porAgendamento[m.agendamento_id] = (porAgendamento[m.agendamento_id] || 0) + custo;
        }

        const prod = (appState.estoque || []).find(p => p.id === m.estoque_id);
        const nome = prod ? prod.nome : 'Produto removido';
        if (!porProdutoMap[nome]) porProdutoMap[nome] = { nome, qtd: 0, custo: 0 };
        porProdutoMap[nome].qtd += Math.abs(Number(m.quantidade_delta) || 0);
        porProdutoMap[nome].custo += custo;
    });

    return {
        total,
        porAgendamento,
        porProduto: Object.values(porProdutoMap).sort((a, b) => b.custo - a.custo),
        erro: null
    };
}

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

    // 2b. Custos do período. Vem do livro-razão, não do custo atual do produto:
    // cada saída guardou o custo do momento, então um mês fechado não muda
    // quando o preço de compra sobe depois.
    const custos = await carregarCustosDoPeriodo(mes, ano);

    // 3. Filtrar Dados do Mês (TUDO que não foi cancelado)
    // ehDoMes() trata a data como local. Com new Date("2026-08-01") o dia 1
    // caía no mês anterior, porque a string ISO é interpretada como UTC.
    const dadosDoMes = appState.agendamentos.filter(a =>
        ehDoMes(a.data, mes, ano) && a.status !== 'cancelado'
    );

    // --- CÁLCULOS FINANCEIROS ---
    const faturamentoReal = dadosDoMes
        .filter(a => a.status === 'concluido' || a.status_pagamento === 'pago')
        .reduce((sum, a) => sum + (Number(a.valor) || 0), 0);

    // 'pendente' é o status que salvarAgendamento realmente grava. Isto filtrava
    // 'agendado', string que não existe no código — a Previsão dava sempre R$ 0.
    const faturamentoPrevisto = dadosDoMes
        .filter(a => a.status === 'pendente' && a.status_pagamento !== 'pago')
        .reduce((sum, a) => sum + (Number(a.valor) || 0), 0);

    const totalReceberGeral = appState.agendamentos
        .filter(a => a.status_pagamento === 'devendo' && a.status !== 'cancelado')
        .reduce((sum, a) => sum + (Number(a.valor) || 0), 0);

    // --- CÁLCULOS PARA GRÁFICOS E RANKING ---
    
    // A. Agrupar por Serviço (Valor, Quantidade e agora CUSTO)
    const statsServicos = {};
    dadosDoMes.forEach(a => {
        const nome = a.servico_nome || a.evento_nome || 'Outros';
        if (!statsServicos[nome]) {
            statsServicos[nome] = { qtd: 0, valor: 0, custo: 0 };
        }
        statsServicos[nome].qtd += 1;
        statsServicos[nome].valor += (Number(a.valor) || 0);
        // Custo real daquele atendimento, do razão
        statsServicos[nome].custo += (custos.porAgendamento[a.id] || 0);
    });

    // Margem por serviço: a informação que o app nunca teve. Responde qual
    // procedimento realmente dá lucro, e não apenas qual fatura mais.
    const margemPorServico = Object.entries(statsServicos)
        .map(([nome, s]) => ({
            nome, qtd: s.qtd, receita: s.valor, custo: s.custo,
            margem: s.valor - s.custo,
            margemPct: s.valor > 0 ? ((s.valor - s.custo) / s.valor) * 100 : 0
        }))
        .sort((a, b) => b.margem - a.margem);

    const lucroBruto = faturamentoReal - custos.total;
    const margemGeralPct = faturamentoReal > 0 ? (lucroBruto / faturamentoReal) * 100 : 0;

    // Despesas do período, para chegar no lucro líquido
    const { inicio: iniDesp, fim: fimDesp } = intervaloDoMes(mes, ano);
    let totalDespesas = 0;
    try {
        const { data: desp } = await _supabase.from('despesas')
            .select('valor').gte('data', iniDesp).lte('data', fimDesp);
        totalDespesas = (desp || []).reduce((s, d) => s + Number(d.valor || 0), 0);
    } catch (_) { /* sem despesas, lucro liquido = bruto */ }

    const lucroLiquido = lucroBruto - totalDespesas;

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

        <!-- Resultado: o que sobra depois do custo do produto e das despesas.
             É o que faturamento sozinho nunca respondeu. -->
        <div class="dre-bloco">
            <h3><i class="fas fa-scale-balanced"></i> Resultado do Período</h3>
            <div class="dre-linhas">
                <div class="dre-linha">
                    <span>Receita dos atendimentos</span>
                    <strong>${formatCurrency(faturamentoReal)}</strong>
                </div>
                <div class="dre-linha custo">
                    <span>(−) Custo dos produtos usados</span>
                    <strong>${formatCurrency(custos.total)}</strong>
                </div>
                <div class="dre-linha subtotal">
                    <span>= Lucro bruto</span>
                    <strong>${formatCurrency(lucroBruto)} <em>${margemGeralPct.toFixed(1)}%</em></strong>
                </div>
                <div class="dre-linha custo">
                    <span>(−) Despesas do período</span>
                    <strong>${formatCurrency(totalDespesas)}</strong>
                </div>
                <div class="dre-linha total ${lucroLiquido >= 0 ? '' : 'negativo'}">
                    <span>= Lucro líquido</span>
                    <strong>${formatCurrency(lucroLiquido)}</strong>
                </div>
            </div>
            ${custos.erro
                ? `<p class="dre-aviso erro">Não consegui ler os custos: ${custos.erro}. O lucro acima está incompleto.</p>`
                : custos.total === 0
                    ? `<p class="dre-aviso">Nenhum produto foi baixado no período. Vincule produtos aos serviços em Serviços para o custo aparecer aqui.</p>`
                    : ''}
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

        <!-- Margem por serviço: qual procedimento dá lucro, e não só qual fatura -->
        <div class="chart-card" style="height:auto; margin-bottom:20px;">
            <h3><i class="fas fa-percent"></i> Margem por Serviço</h3>
            ${margemPorServico.length === 0
                ? '<p style="color:#666; text-align:center; padding:20px;">Sem atendimentos no período.</p>'
                : `<div class="table-responsive">
                    <table class="relatorio-table margem-tabela">
                        <thead><tr>
                            <th>Serviço</th>
                            <th style="text-align:center">Qtd</th>
                            <th style="text-align:right">Receita</th>
                            <th style="text-align:right">Custo</th>
                            <th style="text-align:right">Margem</th>
                            <th style="text-align:right">%</th>
                        </tr></thead>
                        <tbody>
                            ${margemPorServico.map(s => {
                                const cor = s.margemPct >= 70 ? '#66BB6A' : s.margemPct >= 40 ? '#FFA726' : '#EF5350';
                                return `<tr>
                                    <td>${s.nome}</td>
                                    <td style="text-align:center">${s.qtd}</td>
                                    <td style="text-align:right">${formatCurrency(s.receita)}</td>
                                    <td style="text-align:right; color:#888">${formatCurrency(s.custo)}</td>
                                    <td style="text-align:right; font-weight:600">${formatCurrency(s.margem)}</td>
                                    <td style="text-align:right; color:${cor}; font-weight:700">${s.margemPct.toFixed(0)}%</td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                   </div>
                   <p class="dre-aviso">O custo vem dos produtos que saíram do estoque naquele atendimento. Serviço sem produto vinculado aparece com 100% de margem — o que significa "custo não medido", não "sem custo".</p>`}
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
                                dadosDoMes.sort((a,b) => parseDataLocal(a.data) - parseDataLocal(b.data)).map(a => `
                                    <tr>
                                        <td>${parseDataLocal(a.data).getDate()}/${parseDataLocal(a.data).getMonth()+1}</td>
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

    // Guarda o recorte atual para a impressão não precisar recalcular
    ultimoRelatorio = {
        mes, ano, dadosDoMes, statsServicos, rankingClientes,
        faturamentoReal, faturamentoPrevisto, totalReceberGeral,
        custoTotal: custos.total, lucroBruto, totalDespesas, lucroLiquido,
        margemGeralPct, margemPorServico, produtosConsumidos: custos.porProduto
    };
}

const MESES_EXTENSO = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                       'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

/**
 * Imprime o relatório do mês selecionado.
 *
 * O CSS de impressão (style.css:1878) esconde tudo que não seja #fichaImpressao,
 * então `window.print()` direto saía em branco. Em vez de mexer nesse CSS — que
 * é o que faz a ficha de anamnese funcionar — montamos o conteúdo dentro do
 * mesmo container, reaproveitando o cabeçalho já estilizado.
 *
 * Os gráficos ficam de fora de propósito: canvas não imprime de forma confiável.
 * Os mesmos números vão em tabela, que é o que serve para levar ao contador.
 */
window.imprimirRelatorio = async function() {
    if (!ultimoRelatorio) {
        if (typeof showToast === 'function') showToast('Abra o relatório antes de imprimir.', 'warning');
        return;
    }

    const r = ultimoRelatorio;
    const periodo = `${MESES_EXTENSO[r.mes]} de ${r.ano}`;

    // Cabeçalho: reaproveita a estrutura da anamnese, trocando os rótulos
    let perfil = {};
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (user) {
            const { data } = await _supabase.from('profiles')
                .select('nome, especialidade').eq('id', user.id).maybeSingle();
            perfil = data || {};
        }
    } catch (_) { /* cabeçalho genérico serve */ }

    const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    set('printTituloClinica', perfil.nome || 'Estética Premium');
    set('printEspecialidade', perfil.especialidade || '');
    set('printSubtitulo', 'Relatório Financeiro');
    set('printRotuloCliente', 'Período:');
    set('printNomeCliente', periodo);
    set('printRotuloData', 'Emitido em:');
    set('printDataFicha', new Date().toLocaleDateString('pt-BR'));

    const linhasServico = Object.entries(r.statsServicos)
        .sort((a, b) => b[1].valor - a[1].valor)
        .map(([nome, s]) => `<tr><td>${nome}</td><td style="text-align:center">${s.qtd}</td><td style="text-align:right">${formatCurrency(s.valor)}</td></tr>`)
        .join('');

    const linhasExtrato = r.dadosDoMes
        .slice()
        .sort((a, b) => parseDataLocal(a.data) - parseDataLocal(b.data))
        .map(a => {
            const d = parseDataLocal(a.data);
            const dia = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
            const quem = a.cliente_nome || a.evento_nome || '—';
            const oque = a.servico_nome || '';
            const pago = a.status_pagamento === 'pago' ? 'Pago'
                       : a.status_pagamento === 'devendo' ? 'Devendo' : 'Pendente';
            return `<tr><td>${dia}</td><td>${quem}${oque ? ' — ' + oque : ''}</td><td>${pago}</td><td style="text-align:right">${formatCurrency(Number(a.valor) || 0)}</td></tr>`;
        }).join('');

    document.getElementById('printBodyDinamico').innerHTML = `
        <div class="print-section">
            <h3>Resumo do Período</h3>
            <table class="print-tabela">
                <tr><td>Faturamento realizado</td><td style="text-align:right"><strong>${formatCurrency(r.faturamentoReal)}</strong></td></tr>
                <tr><td>Previsão (ainda pendente)</td><td style="text-align:right">${formatCurrency(r.faturamentoPrevisto)}</td></tr>
                <tr><td>Total a receber (todo o histórico)</td><td style="text-align:right">${formatCurrency(r.totalReceberGeral)}</td></tr>
                <tr><td>Atendimentos no período</td><td style="text-align:right">${r.dadosDoMes.length}</td></tr>
            </table>
        </div>

        <div class="print-section">
            <h3>Resultado</h3>
            <table class="print-tabela">
                <tr><td>Receita dos atendimentos</td><td style="text-align:right">${formatCurrency(r.faturamentoReal)}</td></tr>
                <tr><td>(−) Custo dos produtos usados</td><td style="text-align:right">${formatCurrency(r.custoTotal || 0)}</td></tr>
                <tr><td><strong>= Lucro bruto</strong></td><td style="text-align:right"><strong>${formatCurrency(r.lucroBruto || 0)} (${(r.margemGeralPct || 0).toFixed(1)}%)</strong></td></tr>
                <tr><td>(−) Despesas do período</td><td style="text-align:right">${formatCurrency(r.totalDespesas || 0)}</td></tr>
                <tr><td><strong>= Lucro líquido</strong></td><td style="text-align:right"><strong>${formatCurrency(r.lucroLiquido || 0)}</strong></td></tr>
            </table>
        </div>

        ${(r.margemPorServico || []).length ? `
        <div class="print-section">
            <h3>Margem por Serviço</h3>
            <table class="print-tabela">
                <thead><tr><th>Serviço</th><th style="text-align:center">Qtd</th><th style="text-align:right">Receita</th><th style="text-align:right">Custo</th><th style="text-align:right">Margem</th></tr></thead>
                <tbody>${r.margemPorServico.map(s => `<tr>
                    <td>${s.nome}</td>
                    <td style="text-align:center">${s.qtd}</td>
                    <td style="text-align:right">${formatCurrency(s.receita)}</td>
                    <td style="text-align:right">${formatCurrency(s.custo)}</td>
                    <td style="text-align:right">${formatCurrency(s.margem)} (${s.margemPct.toFixed(0)}%)</td>
                </tr>`).join('')}</tbody>
            </table>
        </div>` : ''}

        <div class="print-section">
            <h3>Por Serviço</h3>
            <table class="print-tabela">
                <thead><tr><th>Serviço</th><th style="text-align:center">Qtd</th><th style="text-align:right">Valor</th></tr></thead>
                <tbody>${linhasServico || '<tr><td colspan="3">Sem dados no período.</td></tr>'}</tbody>
            </table>
        </div>

        <div class="print-section">
            <h3>Extrato Detalhado</h3>
            <table class="print-tabela">
                <thead><tr><th>Dia</th><th>Cliente / Serviço</th><th>Pagamento</th><th style="text-align:right">Valor</th></tr></thead>
                <tbody>${linhasExtrato || '<tr><td colspan="4">Sem atendimentos no período.</td></tr>'}</tbody>
            </table>
        </div>`;

    const ficha = document.getElementById('fichaImpressao');
    ficha.style.display = 'block';

    const limpar = () => {
        ficha.style.display = 'none';
        document.getElementById('printBodyDinamico').innerHTML = '';
        window.removeEventListener('afterprint', limpar);
    };
    window.addEventListener('afterprint', limpar);

    setTimeout(() => {
        window.print();
        setTimeout(limpar, 1500); // rede de segurança p/ navegadores sem afterprint
    }, 300);
};

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

