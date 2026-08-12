// ============================================================================
// FINANCEIRO — o caixa: o que entrou, como entrou e o que saiu.
//
// Diferente dos Relatórios, que respondem "quanto faturei", esta tela responde
// "quanto dinheiro passou pela minha mão". São números diferentes de propósito:
// um atendimento concluído e não pago entra no faturamento e não entra no caixa.
// ============================================================================

let mesFinanceiro = new Date().getMonth();
let anoFinanceiro = new Date().getFullYear();
let dadosFinanceiro = { recebimentos: [], despesas: [], compras: [] };

const FORMAS = {
    dinheiro: 'Dinheiro', pix: 'Pix', debito: 'Débito',
    credito: 'Crédito', transferencia: 'Transferência',
    boleto: 'Boleto', outro: 'Outro'
};

const CATEGORIAS = {
    aluguel: 'Aluguel', energia: 'Energia', agua: 'Água', internet: 'Internet',
    telefone: 'Telefone', marketing: 'Marketing', salario: 'Salário',
    impostos: 'Impostos', equipamento: 'Equipamento', manutencao: 'Manutenção',
    contabilidade: 'Contabilidade', software: 'Software', transporte: 'Transporte',
    educacao: 'Cursos e capacitação', outros: 'Outros'
};

// ─── CARGA ──────────────────────────────────────────────────────────────────

window.carregarFinanceiro = async function() {
    const elMes = document.getElementById('financeiroMes');
    const elAno = document.getElementById('financeiroAno');
    if (!elMes || !elAno) return;

    if (!elMes.dataset.init) {
        elMes.value = mesFinanceiro;
        elAno.value = anoFinanceiro;
        elMes.dataset.init = 'true';
    }
    mesFinanceiro = parseInt(elMes.value);
    anoFinanceiro = parseInt(elAno.value);

    const { inicio, fim } = intervaloDoMes(mesFinanceiro, anoFinanceiro);

    // Consulta direta em vez de fetchAPI: aquele helper engole erro e devolve
    // lista vazia, e numa tela de dinheiro "R$ 0,00" no lugar de um erro é
    // pior do que a tela não abrir.
    const [rec, desp, comp] = await Promise.all([
        _supabase.from('pagamentos')
            .select('id, valor, taxa, valor_liquido, forma, parcelas, data, cliente_nome, observacao, agendamento_id')
            .gte('data', inicio).lte('data', fim).order('data', { ascending: false }),
        _supabase.from('despesas')
            .select('id, descricao, categoria, valor, data, forma, fornecedor')
            .gte('data', inicio).lte('data', fim).order('data', { ascending: false }),
        _supabase.from('compras')
            .select('id, fornecedor, documento, data_compra, valor_total, forma_pagamento')
            .gte('data_compra', inicio).lte('data_compra', fim).order('data_compra', { ascending: false })
    ]);

    const erro = rec.error || desp.error || comp.error;
    if (erro) {
        document.getElementById('financeiroConteudo').innerHTML =
            `<div class="fin-erro"><i class="fas fa-triangle-exclamation"></i>
             Não consegui carregar o financeiro: ${erro.message}</div>`;
        return;
    }

    dadosFinanceiro = {
        recebimentos: rec.data || [],
        despesas: desp.data || [],
        compras: comp.data || []
    };

    renderizarFinanceiro();
};

// ─── CÁLCULOS ───────────────────────────────────────────────────────────────

function resumoFinanceiro() {
    const { recebimentos, despesas, compras } = dadosFinanceiro;

    const entradas = recebimentos.reduce((s, r) => s + Number(r.valor || 0), 0);
    const taxas    = recebimentos.reduce((s, r) => s + Number(r.taxa || 0), 0);
    const liquido  = entradas - taxas;
    const totalDespesas = despesas.reduce((s, d) => s + Number(d.valor || 0), 0);
    const totalCompras  = compras.reduce((s, c) => s + Number(c.valor_total || 0), 0);

    const porForma = {};
    recebimentos.forEach(r => {
        porForma[r.forma] = (porForma[r.forma] || 0) + Number(r.valor || 0);
    });

    const porCategoria = {};
    despesas.forEach(d => {
        porCategoria[d.categoria] = (porCategoria[d.categoria] || 0) + Number(d.valor || 0);
    });

    return {
        entradas, taxas, liquido, totalDespesas, totalCompras,
        saldo: liquido - totalDespesas - totalCompras,
        porForma, porCategoria
    };
}

// ─── RENDER ─────────────────────────────────────────────────────────────────

function renderizarFinanceiro() {
    const r = resumoFinanceiro();

    document.getElementById('financeiroConteudo').innerHTML = `
        <div class="fin-cards">
            <div class="fin-card entrada">
                <span>Entrou no período</span>
                <strong>${formatCurrency(r.entradas)}</strong>
                ${r.taxas > 0 ? `<small>${formatCurrency(r.liquido)} líquido, após ${formatCurrency(r.taxas)} de taxas</small>` : ''}
            </div>
            <div class="fin-card saida">
                <span>Saiu no período</span>
                <strong>${formatCurrency(r.totalDespesas + r.totalCompras)}</strong>
                <small>${formatCurrency(r.totalDespesas)} despesas · ${formatCurrency(r.totalCompras)} compras</small>
            </div>
            <div class="fin-card ${r.saldo >= 0 ? 'positivo' : 'negativo'}">
                <span>Saldo do período</span>
                <strong>${formatCurrency(r.saldo)}</strong>
                <small>${r.saldo >= 0 ? 'entrou mais do que saiu' : 'saiu mais do que entrou'}</small>
            </div>
        </div>

        <div class="fin-abas">
            <button class="fin-aba ativa" data-aba="recebimentos" onclick="trocarAbaFinanceiro('recebimentos')">
                <i class="fas fa-arrow-down"></i> Recebimentos
            </button>
            <button class="fin-aba" data-aba="despesas" onclick="trocarAbaFinanceiro('despesas')">
                <i class="fas fa-arrow-up"></i> Despesas
            </button>
            <button class="fin-aba" data-aba="fechamento" onclick="trocarAbaFinanceiro('fechamento')">
                <i class="fas fa-scale-balanced"></i> Fechamento
            </button>
        </div>

        <div id="finAbaRecebimentos" class="fin-painel ativo">${htmlRecebimentos()}</div>
        <div id="finAbaDespesas" class="fin-painel">${htmlDespesas()}</div>
        <div id="finAbaFechamento" class="fin-painel">${htmlFechamento(r)}</div>
    `;
}

window.trocarAbaFinanceiro = function(aba) {
    // Escopado ao container. A trocarTab() global procura btn.dataset.tab, que
    // os botões dela não têm, e mexe em todos os .tab-btn do documento.
    document.querySelectorAll('.fin-aba').forEach(b =>
        b.classList.toggle('ativa', b.dataset.aba === aba));
    document.querySelectorAll('.fin-painel').forEach(p => p.classList.remove('ativo'));
    const alvo = document.getElementById('finAba' + aba.charAt(0).toUpperCase() + aba.slice(1));
    if (alvo) alvo.classList.add('ativo');
};

function htmlRecebimentos() {
    const lista = dadosFinanceiro.recebimentos;
    if (lista.length === 0) {
        return `<p class="fin-vazio">Nenhum recebimento registrado neste período.</p>`;
    }

    return `
        <table class="fin-tabela">
            <thead><tr>
                <th>Data</th><th>Cliente</th><th>Forma</th>
                <th style="text-align:right">Valor</th><th style="text-align:right">Líquido</th><th></th>
            </tr></thead>
            <tbody>
                ${lista.map(r => `
                    <tr>
                        <td>${dataCurtaBR(r.data)}</td>
                        <td>${r.cliente_nome || '—'}${r.observacao ? `<small>${r.observacao}</small>` : ''}</td>
                        <td><span class="fin-forma">${FORMAS[r.forma] || r.forma}</span>${r.parcelas > 1 ? ` ${r.parcelas}x` : ''}</td>
                        <td style="text-align:right; font-weight:600">${formatCurrency(r.valor)}</td>
                        <td style="text-align:right; color:${r.taxa > 0 ? '#FFA726' : '#888'}">${formatCurrency(r.valor_liquido)}</td>
                        <td style="text-align:right"><button class="fin-excluir" onclick="excluirRecebimento('${r.id}')" title="Excluir"><i class="fas fa-trash"></i></button></td>
                    </tr>`).join('')}
            </tbody>
        </table>`;
}

function htmlDespesas() {
    const lista = dadosFinanceiro.despesas;
    if (lista.length === 0) {
        return `<p class="fin-vazio">Nenhuma despesa registrada neste período.</p>`;
    }

    return `
        <table class="fin-tabela">
            <thead><tr>
                <th>Data</th><th>Descrição</th><th>Categoria</th>
                <th style="text-align:right">Valor</th><th></th>
            </tr></thead>
            <tbody>
                ${lista.map(d => `
                    <tr>
                        <td>${dataCurtaBR(d.data)}</td>
                        <td>${d.descricao}${d.fornecedor ? `<small>${d.fornecedor}</small>` : ''}</td>
                        <td><span class="fin-categoria">${CATEGORIAS[d.categoria] || d.categoria}</span></td>
                        <td style="text-align:right; font-weight:600">${formatCurrency(d.valor)}</td>
                        <td style="text-align:right"><button class="fin-excluir" onclick="excluirDespesa('${d.id}')" title="Excluir"><i class="fas fa-trash"></i></button></td>
                    </tr>`).join('')}
            </tbody>
        </table>`;
}

function htmlFechamento(r) {
    const linha = (rotulo, valor, classe = '') =>
        `<div class="fin-linha ${classe}"><span>${rotulo}</span><strong>${formatCurrency(valor)}</strong></div>`;

    const formas = Object.entries(r.porForma).sort((a, b) => b[1] - a[1]);
    const cats   = Object.entries(r.porCategoria).sort((a, b) => b[1] - a[1]);

    return `
        <div class="fin-fechamento">
            <div class="fin-bloco">
                <h4>Entradas por forma de pagamento</h4>
                ${formas.length
                    ? formas.map(([f, v]) => linha(FORMAS[f] || f, v)).join('')
                    : '<p class="fin-vazio">Sem entradas no período.</p>'}
                ${r.taxas > 0 ? linha('(−) Taxas de maquininha', -r.taxas, 'negativa') : ''}
                ${linha('Entrou líquido', r.liquido, 'total')}
            </div>

            <div class="fin-bloco">
                <h4>Saídas</h4>
                ${cats.length
                    ? cats.map(([c, v]) => linha(CATEGORIAS[c] || c, v)).join('')
                    : '<p class="fin-vazio">Sem despesas no período.</p>'}
                ${r.totalCompras > 0 ? linha('Compras de estoque', r.totalCompras, 'compra') : ''}
                ${linha('Total que saiu', r.totalDespesas + r.totalCompras, 'total')}
            </div>

            <div class="fin-bloco saldo ${r.saldo >= 0 ? 'positivo' : 'negativo'}">
                <h4>Saldo do período</h4>
                ${linha('Entrou líquido', r.liquido)}
                ${linha('(−) Saiu', -(r.totalDespesas + r.totalCompras), 'negativa')}
                ${linha('= Saldo', r.saldo, 'total')}
            </div>

            <p class="fin-nota">
                <strong>Compra de material não é despesa.</strong> Ela vira estoque, que é um bem seu, e
                só pesa no lucro quando o produto é usado num atendimento. Aqui ela aparece porque
                o dinheiro saiu de fato da conta — esta tela mostra o caixa, não o lucro.
                O lucro fica nos Relatórios.
            </p>
        </div>`;
}

function dataCurtaBR(iso) {
    const d = parseDataLocal(iso);
    if (!d) return String(iso || '');
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── RECEBIMENTO ────────────────────────────────────────────────────────────

window.abrirModalRecebimento = function(agendamentoId = null) {
    const form = document.getElementById('formRecebimento');
    form.reset();
    document.getElementById('recebimentoAgendamentoId').value = agendamentoId || '';
    document.getElementById('recebimentoData').value = hojeISO();
    document.getElementById('recebimentoParcelas').value = 1;

    const contexto = document.getElementById('recebimentoContexto');

    if (agendamentoId) {
        const ag = (appState.agendamentos || []).find(a => a.id === agendamentoId);
        if (ag) {
            const jaPago = 0; // buscado abaixo
            document.getElementById('recebimentoValor').value = ag.valor || '';
            document.getElementById('recebimentoClienteNome').value = ag.cliente_nome || '';
            contexto.style.display = 'block';
            contexto.innerHTML = `<strong>${ag.cliente_nome || 'Cliente'}</strong>
                <small>${ag.servico_nome || 'Atendimento'} · ${dataCurtaBR(ag.data)} · total ${formatCurrency(ag.valor || 0)}</small>`;

            // Se já houve recebimento parcial, sugere só o que falta
            _supabase.from('pagamentos').select('valor').eq('agendamento_id', agendamentoId)
                .then(({ data }) => {
                    const pago = (data || []).reduce((s, p) => s + Number(p.valor), 0);
                    if (pago > 0) {
                        const falta = Math.max(0, Number(ag.valor || 0) - pago);
                        document.getElementById('recebimentoValor').value = falta.toFixed(2);
                        contexto.innerHTML += `<small class="fin-parcial">Já recebido: ${formatCurrency(pago)} — falta ${formatCurrency(falta)}</small>`;
                    }
                });
        }
    } else {
        contexto.style.display = 'none';
        document.getElementById('recebimentoClienteNome').value = '';
    }

    document.getElementById('modalRecebimento').classList.add('active');
    document.getElementById('overlay').classList.add('active');
};

window.salvarRecebimento = async function(e) {
    e.preventDefault();
    const botao = e.submitter;
    if (botao) { botao.disabled = true; botao.dataset.txt = botao.innerHTML; botao.innerHTML = 'Salvando...'; }

    try {
        const agendamentoId = document.getElementById('recebimentoAgendamentoId').value || null;
        const ag = agendamentoId
            ? (appState.agendamentos || []).find(a => a.id === agendamentoId) : null;

        const { error } = await _supabase.from('pagamentos').insert([{
            agendamento_id: agendamentoId,
            cliente_id: ag?.cliente_id || null,
            cliente_nome: document.getElementById('recebimentoClienteNome').value || ag?.cliente_nome || null,
            valor: parseFloat(document.getElementById('recebimentoValor').value),
            forma: document.getElementById('recebimentoForma').value,
            parcelas: parseInt(document.getElementById('recebimentoParcelas').value) || 1,
            taxa: parseFloat(document.getElementById('recebimentoTaxa').value) || 0,
            data: document.getElementById('recebimentoData').value || hojeISO(),
            observacao: document.getElementById('recebimentoObservacao').value || null
        }]);

        if (error) throw error;

        showToast('Recebimento registrado!', 'success');
        fecharModal('modalRecebimento');

        // O trigger no banco atualizou status_pagamento; o appState precisa reler
        if (typeof carregarDadosIniciais === 'function') await carregarDadosIniciais();
        if (appState.currentPage === 'financeiro') await carregarFinanceiro();
        if (appState.currentPage === 'dashboard' && typeof carregarDashboard === 'function') carregarDashboard();

    } catch (err) {
        console.error(err);
        showToast('Erro ao registrar recebimento: ' + (err.message || ''), 'error', 8000);
    } finally {
        if (botao) { botao.disabled = false; botao.innerHTML = botao.dataset.txt || 'Registrar'; }
    }
};

window.excluirRecebimento = async function(id) {
    if (!confirm('Excluir este recebimento? O status de pagamento do atendimento será recalculado.')) return;
    try {
        const { error } = await _supabase.from('pagamentos').delete().eq('id', id);
        if (error) throw error;
        showToast('Recebimento excluído.', 'success');
        if (typeof carregarDadosIniciais === 'function') await carregarDadosIniciais();
        await carregarFinanceiro();
    } catch (err) {
        console.error(err);
        showToast('Erro ao excluir: ' + (err.message || ''), 'error');
    }
};

// ─── DESPESA ────────────────────────────────────────────────────────────────

window.abrirModalDespesa = function() {
    document.getElementById('formDespesa').reset();
    document.getElementById('despesaData').value = hojeISO();
    document.getElementById('modalDespesa').classList.add('active');
    document.getElementById('overlay').classList.add('active');
};

window.salvarDespesa = async function(e) {
    e.preventDefault();
    const botao = e.submitter;
    if (botao) { botao.disabled = true; botao.dataset.txt = botao.innerHTML; botao.innerHTML = 'Salvando...'; }

    try {
        const { error } = await _supabase.from('despesas').insert([{
            descricao: document.getElementById('despesaDescricao').value,
            categoria: document.getElementById('despesaCategoria').value,
            valor: parseFloat(document.getElementById('despesaValor').value),
            data: document.getElementById('despesaData').value || hojeISO(),
            forma: document.getElementById('despesaForma').value || null,
            fornecedor: document.getElementById('despesaFornecedor').value || null,
            recorrente: document.getElementById('despesaRecorrente').checked
        }]);

        if (error) throw error;

        showToast('Despesa registrada!', 'success');
        fecharModal('modalDespesa');
        await carregarFinanceiro();

    } catch (err) {
        console.error(err);
        showToast('Erro ao registrar despesa: ' + (err.message || ''), 'error', 8000);
    } finally {
        if (botao) { botao.disabled = false; botao.innerHTML = botao.dataset.txt || 'Registrar'; }
    }
};

window.excluirDespesa = async function(id) {
    if (!confirm('Excluir esta despesa?')) return;
    try {
        const { error } = await _supabase.from('despesas').delete().eq('id', id);
        if (error) throw error;
        showToast('Despesa excluída.', 'success');
        await carregarFinanceiro();
    } catch (err) {
        console.error(err);
        showToast('Erro ao excluir: ' + (err.message || ''), 'error');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const fr = document.getElementById('formRecebimento');
    if (fr) fr.addEventListener('submit', salvarRecebimento);
    const fd = document.getElementById('formDespesa');
    if (fd) fd.addEventListener('submit', salvarDespesa);
});
