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
            .select('id, fornecedor, documento, data_compra, valor_total, forma_pagamento, xml_path')
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
            <button class="fin-aba" data-aba="compras" onclick="trocarAbaFinanceiro('compras')">
                <i class="fas fa-file-invoice"></i> Compras
            </button>
            <button class="fin-aba" data-aba="fechamento" onclick="trocarAbaFinanceiro('fechamento')">
                <i class="fas fa-scale-balanced"></i> Fechamento
            </button>
        </div>

        <div id="finAbaRecebimentos" class="fin-painel ativo">${htmlRecebimentos()}</div>
        <div id="finAbaDespesas" class="fin-painel">${htmlDespesas()}</div>
        <div id="finAbaCompras" class="fin-painel">${htmlCompras()}</div>
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

function htmlCompras() {
    const lista = dadosFinanceiro.compras;
    if (lista.length === 0) {
        return `<p class="fin-vazio">Nenhuma compra registrada neste período.</p>`;
    }

    return `
        <table class="fin-tabela">
            <thead><tr>
                <th>Data</th><th>Fornecedor</th><th>Nota</th>
                <th style="text-align:right">Valor</th><th>Forma</th><th style="text-align:right">XML</th>
            </tr></thead>
            <tbody>
                ${lista.map(c => `
                    <tr>
                        <td>${dataCurtaBR(c.data_compra)}</td>
                        <td>${c.fornecedor || '—'}</td>
                        <td>${c.documento || '—'}</td>
                        <td style="text-align:right; font-weight:600">${formatCurrency(c.valor_total)}</td>
                        <td>${c.forma_pagamento ? `<span class="fin-forma">${FORMAS[c.forma_pagamento] || c.forma_pagamento}</span>` : '—'}</td>
                        <td style="text-align:right">
                            ${c.xml_path
                                ? `<button class="fin-xml" onclick="baixarXmlCompra('${c.id}')" title="Baixar o XML arquivado"><i class="fas fa-file-code"></i> XML</button>`
                                : '<span style="color:#555; font-size:0.78rem">manual</span>'}
                        </td>
                    </tr>`).join('')}
            </tbody>
        </table>
        <p class="fin-nota" style="grid-column:auto; margin-top:16px;">
            O XML original de cada nota importada fica arquivado. Serve para conferir com o contador
            e para reconferir um vínculo de produto que tenha ficado errado — o que costuma só aparecer
            semanas depois, olhando o custo médio.
        </p>`;
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

// ─── BUSCA DE CLIENTE NO RECEBIMENTO ────────────────────────────────────────
//
// Consulta o banco em vez do appState: a lista em memória vem do fetchAPI, que
// tem teto de 1000 linhas do PostgREST, e conforme a base cresce a busca
// começaria a não achar cliente sem dar nenhum aviso.
//
// Selecionar a cliente carrega os débitos em aberto dela. Isso é o que fecha o
// ciclo: um recebimento solto, sem vínculo com atendimento, não quita nada —
// o trigger que atualiza status_pagamento depende do agendamento_id.

let buscaClienteTimer = null;

window.buscarClienteRecebimento = function() {
    clearTimeout(buscaClienteTimer);
    // Debounce: sem isso seria uma consulta por tecla digitada
    buscaClienteTimer = setTimeout(executarBuscaCliente, 250);
};

async function executarBuscaCliente() {
    const input = document.getElementById('recebimentoBuscaCliente');
    const dropdown = document.getElementById('recebimentoDropdownClientes');
    if (!input || !dropdown) return;

    const termo = input.value.trim();
    dropdown.style.display = 'block';

    // Digitar sem escolher da lista é válido: fica só o nome, sem vínculo.
    document.getElementById('recebimentoClienteId').value = '';

    if (termo.length < 2) {
        dropdown.innerHTML = '<div class="rec-drop-vazio">Digite ao menos 2 letras para buscar.</div>';
        return;
    }

    dropdown.innerHTML = '<div class="rec-drop-vazio">Buscando...</div>';

    const { data, error } = await _supabase
        .from('clientes')
        .select('id, nome, telefone')
        .ilike('nome', `%${termo}%`)
        .order('nome')
        .limit(20);

    if (error) {
        dropdown.innerHTML = `<div class="rec-drop-vazio erro">Erro ao buscar: ${error.message}</div>`;
        return;
    }

    if (!data || data.length === 0) {
        dropdown.innerHTML = '<div class="rec-drop-vazio">Nenhuma cliente encontrada. O nome digitado será usado assim mesmo.</div>';
        return;
    }

    dropdown.innerHTML = data.map(c => `
        <div class="rec-drop-item" onclick="selecionarClienteRecebimento('${c.id}', ${JSON.stringify(c.nome)})">
            <strong>${c.nome}</strong>
            ${c.telefone ? `<small>${c.telefone}</small>` : ''}
        </div>`).join('');
}

window.selecionarClienteRecebimento = async function(id, nome) {
    document.getElementById('recebimentoClienteId').value = id;
    document.getElementById('recebimentoBuscaCliente').value = nome;
    document.getElementById('recebimentoDropdownClientes').style.display = 'none';
    await carregarDebitosDaCliente(id);
};

/**
 * Lista os atendimentos em aberto da cliente para quitar.
 * Sem escolher um, o recebimento entra como avulso e não baixa débito nenhum.
 */
async function carregarDebitosDaCliente(clienteId) {
    const box = document.getElementById('recebimentoDebitos');
    if (!box) return;

    box.style.display = 'block';
    box.innerHTML = '<p class="rec-debitos-vazio">Carregando atendimentos em aberto...</p>';

    const { data, error } = await _supabase
        .from('agendamentos')
        .select('id, servico_nome, evento_nome, data, valor, status_pagamento')
        .eq('cliente_id', clienteId)
        .in('status_pagamento', ['devendo', 'pendente'])
        .neq('status', 'cancelado')
        .order('data', { ascending: false })
        .limit(20);

    if (error) {
        box.innerHTML = `<p class="rec-debitos-vazio erro">Erro ao buscar atendimentos: ${error.message}</p>`;
        return;
    }

    if (!data || data.length === 0) {
        box.innerHTML = '<p class="rec-debitos-vazio">Esta cliente não tem atendimentos em aberto. O recebimento será registrado como avulso.</p>';
        return;
    }

    // Quanto já foi pago em cada um, para sugerir só o que falta
    const ids = data.map(a => a.id);
    const { data: pagos } = await _supabase
        .from('pagamentos').select('agendamento_id, valor').in('agendamento_id', ids);

    const pagoPor = {};
    (pagos || []).forEach(p => {
        pagoPor[p.agendamento_id] = (pagoPor[p.agendamento_id] || 0) + Number(p.valor);
    });

    box.innerHTML = `
        <p class="rec-debitos-titulo">Atendimentos em aberto — escolha qual está quitando:</p>
        <div class="rec-debitos-lista">
            ${data.map(a => {
                const total = Number(a.valor) || 0;
                const pago = pagoPor[a.id] || 0;
                const falta = Math.max(0, total - pago);
                return `
                <button type="button" class="rec-debito" onclick="escolherDebito('${a.id}', ${falta})">
                    <span class="rec-debito-nome">${a.servico_nome || a.evento_nome || 'Atendimento'}</span>
                    <span class="rec-debito-data">${dataCurtaBR(a.data)}</span>
                    <span class="rec-debito-valor">${formatCurrency(falta)}${pago > 0 ? `<small>de ${formatCurrency(total)}</small>` : ''}</span>
                </button>`;
            }).join('')}
        </div>`;
}

window.escolherDebito = function(agendamentoId, falta) {
    document.getElementById('recebimentoAgendamentoId').value = agendamentoId;
    document.getElementById('recebimentoValor').value = falta.toFixed(2);

    document.querySelectorAll('.rec-debito').forEach(b => b.classList.remove('escolhido'));
    if (window.event?.currentTarget) window.event.currentTarget.classList.add('escolhido');
    // Marca pelo id, sem depender do event (que é frágil)
    document.querySelectorAll('.rec-debito').forEach(b => {
        if (b.getAttribute('onclick')?.includes(agendamentoId)) b.classList.add('escolhido');
    });
};

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
            document.getElementById('recebimentoBuscaCliente').value = ag.cliente_nome || '';
            document.getElementById('recebimentoClienteId').value = ag.cliente_id || '';
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
        document.getElementById('recebimentoBuscaCliente').value = '';
        document.getElementById('recebimentoClienteId').value = '';
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
            // Vem da busca quando ela escolheu da lista; do agendamento quando
            // o modal foi aberto por um debito. Nome digitado sem escolher fica
            // gravado assim mesmo, sem vinculo.
            cliente_id: document.getElementById('recebimentoClienteId').value || ag?.cliente_id || null,
            cliente_nome: document.getElementById('recebimentoBuscaCliente').value || ag?.cliente_nome || null,
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
