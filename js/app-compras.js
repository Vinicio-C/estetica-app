// ============================================================================
// COMPRAS — entrada de estoque por nota fiscal
//
// O caminho principal é importar o XML da NF-e, que o fornecedor é obrigado a
// enviar. É o dado oficial: nada de heurística, nada de OCR, nada sai do
// navegador. Ler a chave de acesso não serviria — a consulta pública sem
// certificado digital devolve só o resumo da nota, sem os itens.
// ============================================================================

let notaImportada = null;   // resultado do parse, aguardando confirmação
let itensCompraAtual = [];  // itens já vinculados aos produtos dela

// ─── PARSER DA NF-e ─────────────────────────────────────────────────────────

/**
 * Alguns emissores usam prefixo de namespace (<ns:emit>), outros não.
 * Comparar por localName funciona nos dois casos.
 */
function filhosPorNome(raiz, nome) {
    const achados = [];
    const percorrer = (no) => {
        for (const filho of no.children || []) {
            if (filho.localName === nome) achados.push(filho);
            percorrer(filho);
        }
    };
    percorrer(raiz);
    return achados;
}

function texto(raiz, nome, padrao = '') {
    const el = filhosPorNome(raiz, nome)[0];
    return el ? (el.textContent || '').trim() : padrao;
}

function numero(raiz, nome) {
    const v = texto(raiz, nome);
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
}

/**
 * Extrai da NF-e o que interessa para uma compra de insumos.
 * Devolve { chave, numero, fornecedor, cnpj, data, frete, desconto, total, itens[] }
 */
window.lerXmlNfe = function(conteudoXml) {
    const doc = new DOMParser().parseFromString(conteudoXml, 'application/xml');

    if (doc.querySelector('parsererror')) {
        throw new Error('Arquivo não é um XML válido.');
    }

    const infNFe = filhosPorNome(doc, 'infNFe')[0];
    if (!infNFe) {
        throw new Error('Não parece uma NF-e. Confira se é o XML da nota, e não o DANFE em PDF.');
    }

    // Id vem como "NFe35240912345678000199550010000123451000123456"
    const chave = (infNFe.getAttribute('Id') || '').replace(/\D/g, '');

    const emit = filhosPorNome(infNFe, 'emit')[0];
    const ide  = filhosPorNome(infNFe, 'ide')[0];
    const totais = filhosPorNome(infNFe, 'ICMSTot')[0];

    const emissao = ide ? (texto(ide, 'dhEmi') || texto(ide, 'dEmi')) : '';

    const itens = filhosPorNome(infNFe, 'det').map(det => {
        const prod = filhosPorNome(det, 'prod')[0];
        if (!prod) return null;

        const qtd   = numero(prod, 'qCom');
        const unit  = numero(prod, 'vUnCom');
        return {
            item: det.getAttribute('nItem') || '',
            codigo: texto(prod, 'cProd'),
            descricao: texto(prod, 'xProd'),
            ncm: texto(prod, 'NCM'),
            unidade: texto(prod, 'uCom') || 'UN',
            quantidade: qtd,
            valor_unitario: unit,
            valor_total: numero(prod, 'vProd') || +(qtd * unit).toFixed(2),
            // Preenchidos na tela de vínculo
            estoque_id: null,
            fator_conversao: 1
        };
    }).filter(Boolean);

    if (itens.length === 0) {
        throw new Error('A nota não tem itens de produto.');
    }

    return {
        chave,
        numero: ide ? texto(ide, 'nNF') : '',
        fornecedor: emit ? texto(emit, 'xNome') : '',
        cnpj: emit ? texto(emit, 'CNPJ') : '',
        data: emissao ? emissao.slice(0, 10) : hojeISO(),
        frete:    totais ? numero(totais, 'vFrete') : 0,
        desconto: totais ? numero(totais, 'vDesc')  : 0,
        total:    totais ? numero(totais, 'vNF')    : 0,
        itens
    };
};

// ─── IMPORTAÇÃO ─────────────────────────────────────────────────────────────

window.abrirImportacaoNfe = function() {
    document.getElementById('inputXmlNfe').click();
};

window.importarXmlNfe = async function(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;

    try {
        const conteudo = await file.text();
        notaImportada = lerXmlNfe(conteudo);

        // Já importou essa nota antes?
        if (notaImportada.chave) {
            const { data: jaExiste } = await _supabase
                .from('compras').select('id, data_compra')
                .eq('chave_nfe', notaImportada.chave).maybeSingle();

            if (jaExiste) {
                showToast(`Esta nota já foi importada em ${dataBRCompras(jaExiste.data_compra)}.`, 'warning', 7000);
                notaImportada = null;
                return;
            }
        }

        await vincularItensConhecidos();
        renderizarImportacao();

        document.getElementById('modalImportarNfe').classList.add('active');
        document.getElementById('overlay').classList.add('active');

    } catch (err) {
        console.error(err);
        showToast('Erro ao ler a nota: ' + err.message, 'error', 8000);
    }
};

/**
 * Preenche o vínculo dos itens que já foram importados antes daquele fornecedor.
 * É o que faz a segunda nota em diante ser quase automática.
 */
async function vincularItensConhecidos() {
    if (!notaImportada?.cnpj) return;

    const codigos = notaImportada.itens.map(i => i.codigo).filter(Boolean);
    if (codigos.length === 0) return;

    const { data: refs, error } = await _supabase
        .from('estoque_fornecedor_ref')
        .select('codigo_fornecedor, estoque_id, fator_conversao')
        .eq('fornecedor_cnpj', notaImportada.cnpj)
        .in('codigo_fornecedor', codigos);

    if (error) { console.warn('Não consegui ler o de-para:', error.message); return; }

    const porCodigo = {};
    (refs || []).forEach(r => { porCodigo[r.codigo_fornecedor] = r; });

    notaImportada.itens.forEach(item => {
        const ref = porCodigo[item.codigo];
        if (ref) {
            item.estoque_id = ref.estoque_id;
            item.fator_conversao = Number(ref.fator_conversao) || 1;
            item.reconhecido = true;
        }
    });
}

function dataBRCompras(iso) {
    const d = parseDataLocal(iso);
    return d ? d.toLocaleDateString('pt-BR') : String(iso || '');
}

function opcoesProdutos(selecionado) {
    return (appState.estoque || [])
        .slice()
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
        .map(p => `<option value="${p.id}" ${p.id === selecionado ? 'selected' : ''}>${p.nome} (${p.unidade || 'un'})</option>`)
        .join('');
}

function renderizarImportacao() {
    const n = notaImportada;
    if (!n) return;

    document.getElementById('nfeFornecedor').textContent = n.fornecedor || '(sem nome)';
    document.getElementById('nfeInfo').textContent =
        `Nota ${n.numero || '—'} · ${dataBRCompras(n.data)} · ${n.itens.length} item(ns)` +
        (n.total ? ` · ${formatCurrency(n.total)}` : '');

    const corpo = n.itens.map((item, idx) => {
        const convertida = (item.quantidade * (item.fator_conversao || 1));
        const custoConvertido = item.fator_conversao > 0
            ? item.valor_unitario / item.fator_conversao : item.valor_unitario;

        return `
        <div class="nfe-item ${item.estoque_id ? 'vinculado' : ''}">
            <div class="nfe-item-topo">
                <div>
                    <strong>${item.descricao}</strong>
                    <small>cód. ${item.codigo || '—'} · ${item.quantidade} ${item.unidade} × ${formatCurrency(item.valor_unitario)} = ${formatCurrency(item.valor_total)}</small>
                </div>
                ${item.reconhecido ? '<span class="nfe-badge">reconhecido</span>' : ''}
            </div>

            <div class="nfe-item-vinculo">
                <label>
                    <span>Produto no seu estoque</span>
                    <select onchange="definirProdutoItem(${idx}, this.value)">
                        <option value="">— escolher —</option>
                        ${opcoesProdutos(item.estoque_id)}
                    </select>
                </label>
                <label class="nfe-fator">
                    <span>Unidades por ${item.unidade}</span>
                    <input type="number" min="0.0001" step="any" value="${item.fator_conversao}"
                           onchange="definirFatorItem(${idx}, this.value)">
                </label>
            </div>

            <div class="nfe-item-resultado ${item.estoque_id ? '' : 'pendente'}">
                ${item.estoque_id
                    ? `Entra <strong>${convertida.toLocaleString('pt-BR')}</strong> no estoque, a <strong>${formatCurrency(custoConvertido)}</strong> cada`
                    : 'Vincule a um produto para importar este item'}
            </div>
        </div>`;
    }).join('');

    document.getElementById('nfeItens').innerHTML = corpo;

    const pendentes = n.itens.filter(i => !i.estoque_id).length;
    const aviso = document.getElementById('nfeAviso');
    aviso.textContent = pendentes
        ? `${pendentes} item(ns) sem vínculo serão ignorados na importação.`
        : 'Todos os itens estão vinculados.';
    aviso.className = pendentes ? 'nfe-aviso pendente' : 'nfe-aviso';
}

window.definirProdutoItem = function(idx, estoqueId) {
    notaImportada.itens[idx].estoque_id = estoqueId || null;
    notaImportada.itens[idx].reconhecido = false;
    renderizarImportacao();
};

window.definirFatorItem = function(idx, valor) {
    const f = parseFloat(valor);
    notaImportada.itens[idx].fator_conversao = (!isNaN(f) && f > 0) ? f : 1;
    renderizarImportacao();
};

window.confirmarImportacaoNfe = async function(botao) {
    const n = notaImportada;
    if (!n) return;

    const aImportar = n.itens.filter(i => i.estoque_id);
    if (aImportar.length === 0) {
        showToast('Vincule ao menos um item a um produto.', 'warning');
        return;
    }

    if (botao) { botao.disabled = true; botao.textContent = 'Importando...'; }

    try {
        // 1. A nota
        const { data: compra, error: erroCompra } = await _supabase
            .from('compras')
            .insert([{
                fornecedor: n.fornecedor,
                fornecedor_cnpj: n.cnpj,
                documento: n.numero,
                chave_nfe: n.chave || null,
                data_compra: n.data,
                frete: n.frete,
                desconto: n.desconto,
                observacao: 'Importado do XML da NF-e'
            }])
            .select('id').single();

        if (erroCompra) throw erroCompra;

        // 2. Os itens já convertidos para a unidade dela. O trigger transforma
        //    cada um em entrada no razão e recalcula o custo médio.
        const linhas = aImportar.map(i => {
            const fator = i.fator_conversao || 1;
            return {
                compra_id: compra.id,
                estoque_id: i.estoque_id,
                quantidade: i.quantidade * fator,
                custo_unitario: i.valor_unitario / fator,
                descricao_fornecedor: i.descricao,
                codigo_fornecedor: i.codigo || null,
                qtd_fornecedor: i.quantidade,
                unidade_fornecedor: i.unidade
            };
        });

        const { error: erroItens } = await _supabase.from('compra_itens').insert(linhas);
        if (erroItens) throw erroItens;

        // 3. Memoriza o de-para, para a próxima nota deste fornecedor entrar sozinha
        if (n.cnpj) {
            const refs = aImportar
                .filter(i => i.codigo)
                .map(i => ({
                    estoque_id: i.estoque_id,
                    fornecedor_cnpj: n.cnpj,
                    codigo_fornecedor: i.codigo,
                    descricao_fornecedor: i.descricao,
                    fator_conversao: i.fator_conversao || 1
                }));

            if (refs.length) {
                const { error: erroRef } = await _supabase
                    .from('estoque_fornecedor_ref')
                    .upsert(refs, { onConflict: 'user_id,fornecedor_cnpj,codigo_fornecedor' });
                // Falhar aqui não invalida a compra: só significa que a próxima
                // nota vai pedir o vínculo de novo.
                if (erroRef) console.warn('De-para não memorizado:', erroRef.message);
            }
        }

        showToast(`Nota importada: ${aImportar.length} produto(s) deram entrada.`, 'success');
        fecharModal('modalImportarNfe');
        notaImportada = null;

        if (typeof carregarEstoque === 'function') await carregarEstoque();

    } catch (err) {
        console.error(err);
        showToast('Erro ao importar: ' + (err.message || ''), 'error', 8000);
    } finally {
        if (botao) { botao.disabled = false; botao.textContent = 'Importar nota'; }
    }
};

// ─── HISTÓRICO DO PRODUTO (o razão) ─────────────────────────────────────────

const ROTULO_ORIGEM = {
    compra: 'Compra',
    atendimento: 'Consumo em atendimento',
    estorno_atendimento: 'Estorno de atendimento',
    ajuste_manual: 'Ajuste manual',
    inventario: 'Inventário',
    perda: 'Perda',
    vencimento: 'Vencimento'
};

window.abrirHistoricoProduto = async function(estoqueId) {
    const produto = (appState.estoque || []).find(p => p.id === estoqueId);
    if (!produto) return;

    document.getElementById('histProdutoNome').textContent = produto.nome;
    document.getElementById('histProdutoCorpo').innerHTML =
        '<p style="color:#888; text-align:center; padding:20px;">Carregando...</p>';
    document.getElementById('modalHistoricoProduto').classList.add('active');
    document.getElementById('overlay').classList.add('active');

    // Direto no _supabase e tratando o erro: o fetchAPI devolve lista vazia
    // quando falha, o que numa tela de estoque pareceria "sem movimento".
    const { data, error } = await _supabase
        .from('estoque_movimentos')
        .select('data, tipo, origem, quantidade_delta, custo_unitario, saldo_apos, observacao')
        .eq('estoque_id', estoqueId)
        .order('created_at', { ascending: false })
        .limit(200);

    if (error) {
        document.getElementById('histProdutoCorpo').innerHTML =
            `<p style="color:#EF5350; text-align:center; padding:20px;">Erro ao carregar: ${error.message}</p>`;
        return;
    }

    if (!data || data.length === 0) {
        document.getElementById('histProdutoCorpo').innerHTML =
            '<p style="color:#888; text-align:center; padding:20px;">Nenhuma movimentação registrada.</p>';
        return;
    }

    document.getElementById('histProdutoCorpo').innerHTML = `
        <table class="hist-tabela">
            <thead><tr><th>Data</th><th>Movimento</th><th style="text-align:right">Qtd</th><th style="text-align:right">Custo un.</th><th style="text-align:right">Saldo</th></tr></thead>
            <tbody>
                ${data.map(m => {
                    const delta = Number(m.quantidade_delta);
                    const cor = delta > 0 ? '#66BB6A' : '#EF5350';
                    return `<tr>
                        <td>${dataBRCompras(m.data)}</td>
                        <td>${ROTULO_ORIGEM[m.origem] || m.origem}${m.observacao ? `<small style="display:block;color:#777">${m.observacao}</small>` : ''}</td>
                        <td style="text-align:right; color:${cor}; font-weight:600">${delta > 0 ? '+' : ''}${delta.toLocaleString('pt-BR')}</td>
                        <td style="text-align:right">${m.custo_unitario ? formatCurrency(m.custo_unitario) : '—'}</td>
                        <td style="text-align:right">${Number(m.saldo_apos).toLocaleString('pt-BR')}</td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>`;
};

// ─── AJUSTE MANUAL ──────────────────────────────────────────────────────────

window.abrirModalAjusteEstoque = function(estoqueId) {
    const produto = (appState.estoque || []).find(p => p.id === estoqueId);
    if (!produto) return;

    document.getElementById('ajusteEstoqueId').value = produto.id;
    document.getElementById('ajusteProdutoNome').textContent = produto.nome;
    document.getElementById('ajusteSaldoAtual').textContent =
        `${Number(produto.quantidade).toLocaleString('pt-BR')} ${produto.unidade || 'un'}`;
    document.getElementById('ajusteNovoSaldo').value = produto.quantidade;
    document.getElementById('ajusteMotivo').value = 'inventario';
    document.getElementById('ajusteObservacao').value = '';

    document.getElementById('modalAjusteEstoque').classList.add('active');
    document.getElementById('overlay').classList.add('active');
};

window.salvarAjusteEstoque = async function(e) {
    e.preventDefault();
    const id = document.getElementById('ajusteEstoqueId').value;
    const produto = (appState.estoque || []).find(p => p.id === id);
    if (!produto) return;

    const novoSaldo = parseFloat(document.getElementById('ajusteNovoSaldo').value);
    if (isNaN(novoSaldo)) { showToast('Informe o novo saldo.', 'warning'); return; }

    const delta = novoSaldo - Number(produto.quantidade);
    if (delta === 0) { showToast('O saldo informado é igual ao atual.', 'info'); return; }

    try {
        // Grava a DIFERENÇA, não o valor absoluto: assim o razão continua
        // fechando e o histórico mostra o que foi corrigido.
        const { error } = await _supabase.from('estoque_movimentos').insert([{
            estoque_id: id,
            tipo: 'ajuste',
            origem: document.getElementById('ajusteMotivo').value,
            quantidade_delta: delta,
            observacao: document.getElementById('ajusteObservacao').value || null
        }]);
        if (error) throw error;

        showToast('Saldo ajustado.', 'success');
        fecharModal('modalAjusteEstoque');
        if (typeof carregarEstoque === 'function') await carregarEstoque();

    } catch (err) {
        console.error(err);
        showToast('Erro ao ajustar: ' + (err.message || ''), 'error');
    }
};

// ─── COMPRA MANUAL ──────────────────────────────────────────────────────────
//
// Nem toda compra vem com XML: farmácia, fornecedor pequeno, compra avulsa.
// E o fluxo aqui é o oposto da NF-e — ela tem a caixa na mão, não um arquivo.
// Por isso os campos seguem o que ela sabe: quantas embalagens, quantas unidades
// vêm em cada uma e quanto pagou. O sistema faz a conta.
//
// Isto é diferente de "Ajustar": ajuste corrige contagem (inventário, perda) e
// não tem dinheiro envolvido. Compra tem custo, e é o custo que alimenta o CMV.

let itensCompraManual = [];

window.abrirModalCompra = function() {
    itensCompraManual = [];
    document.getElementById('formCompra').reset();
    document.getElementById('compraData').value = hojeISO();
    document.getElementById('compraItemEmbalagens').value = '1';
    document.getElementById('compraItemPorEmbalagem').value = '1';
    document.getElementById('compraItemPrevia').textContent = '';

    const sel = document.getElementById('compraItemProduto');
    if (sel) sel.innerHTML = '<option value="">— escolher produto —</option>' + opcoesProdutos(null);

    renderizarItensCompraManual();
    document.getElementById('modalCompra').classList.add('active');
    document.getElementById('overlay').classList.add('active');
};

window.adicionarItemCompra = function() {
    const estoqueId   = document.getElementById('compraItemProduto').value;
    const embalagens  = parseFloat(document.getElementById('compraItemEmbalagens').value);
    const porEmbalagem= parseFloat(document.getElementById('compraItemPorEmbalagem').value);
    const valorPago   = parseFloat(document.getElementById('compraItemValor').value);

    if (!estoqueId)         { showToast('Escolha o produto.', 'warning'); return; }
    if (!(embalagens > 0))  { showToast('Informe quantas embalagens entraram.', 'warning'); return; }
    if (!(porEmbalagem > 0)){ showToast('Informe quantas unidades vêm em cada embalagem.', 'warning'); return; }
    if (!(valorPago >= 0))  { showToast('Informe quanto você pagou.', 'warning'); return; }

    const produto = (appState.estoque || []).find(p => p.id === estoqueId);
    const totalUnidades = embalagens * porEmbalagem;

    itensCompraManual.push({
        estoque_id: estoqueId,
        nome: produto ? produto.nome : 'Produto',
        unidade: (produto && produto.unidade) || 'un',
        embalagens,
        por_embalagem: porEmbalagem,
        quantidade: totalUnidades,
        valor_pago: valorPago,
        custo_unitario: valorPago / totalUnidades
    });

    document.getElementById('compraItemProduto').value = '';
    document.getElementById('compraItemEmbalagens').value = '1';
    document.getElementById('compraItemPorEmbalagem').value = '1';
    document.getElementById('compraItemValor').value = '';
    document.getElementById('compraItemPrevia').textContent = '';
    document.getElementById('compraItemProduto').focus();

    renderizarItensCompraManual();
};

window.removerItemCompra = function(idx) {
    itensCompraManual.splice(idx, 1);
    renderizarItensCompraManual();
};

// Prévia enquanto ela digita. Mesmo princípio da tela de NF-e: a conversão
// precisa ficar visível ANTES de gravar, senão o erro passa despercebido.
window.previverItemCompra = function() {
    const emb = parseFloat(document.getElementById('compraItemEmbalagens').value);
    const por = parseFloat(document.getElementById('compraItemPorEmbalagem').value);
    const val = parseFloat(document.getElementById('compraItemValor').value);
    const alvo = document.getElementById('compraItemPrevia');
    if (!alvo) return;

    if (emb > 0 && por > 0) {
        const total = emb * por;
        const unit = val >= 0 ? val / total : null;
        alvo.innerHTML = `Entra <strong>${total.toLocaleString('pt-BR')}</strong> no estoque` +
            (unit !== null ? `, a <strong>${formatCurrency(unit)}</strong> cada` : '');
    } else {
        alvo.textContent = '';
    }
};

function renderizarItensCompraManual() {
    const lista = document.getElementById('compraItensLista');
    const totalEl = document.getElementById('compraTotalItens');
    if (!lista) return;

    if (itensCompraManual.length === 0) {
        lista.innerHTML = '<p class="compra-vazio">Nenhum item ainda. Adicione o primeiro acima.</p>';
        if (totalEl) totalEl.textContent = formatCurrency(0);
        return;
    }

    lista.innerHTML = itensCompraManual.map((i, idx) => `
        <div class="compra-item">
            <div class="compra-item-info">
                <strong>${i.nome}</strong>
                <small>${i.embalagens} × ${i.por_embalagem} = <b>${i.quantidade.toLocaleString('pt-BR')} ${i.unidade}</b> · ${formatCurrency(i.custo_unitario)} cada</small>
            </div>
            <div class="compra-item-valor">${formatCurrency(i.valor_pago)}</div>
            <button type="button" class="compra-item-remover" onclick="removerItemCompra(${idx})" title="Remover">
                <i class="fas fa-times"></i>
            </button>
        </div>`).join('');

    const soma = itensCompraManual.reduce((s, i) => s + i.valor_pago, 0);
    if (totalEl) totalEl.textContent = formatCurrency(soma);
}

window.salvarCompra = async function(e) {
    e.preventDefault();

    if (itensCompraManual.length === 0) {
        showToast('Adicione ao menos um item à compra.', 'warning');
        return;
    }

    const botao = e.submitter || document.querySelector('#formCompra button[type="submit"]');
    if (botao) { botao.disabled = true; botao.dataset.txt = botao.innerHTML; botao.innerHTML = 'Salvando...'; }

    try {
        const { data: compra, error: erroCompra } = await _supabase
            .from('compras')
            .insert([{
                fornecedor: document.getElementById('compraFornecedor').value || null,
                documento: document.getElementById('compraDocumento').value || null,
                data_compra: document.getElementById('compraData').value || hojeISO(),
                frete: parseFloat(document.getElementById('compraFrete').value) || 0,
                desconto: parseFloat(document.getElementById('compraDesconto').value) || 0,
                forma_pagamento: document.getElementById('compraFormaPagamento').value || null,
                observacao: document.getElementById('compraObservacao').value || null
            }])
            .select('id').single();

        if (erroCompra) throw erroCompra;

        // O trigger transforma cada item em entrada no razão e recalcula o
        // custo médio ponderado do produto.
        const linhas = itensCompraManual.map(i => ({
            compra_id: compra.id,
            estoque_id: i.estoque_id,
            quantidade: i.quantidade,
            custo_unitario: i.custo_unitario,
            descricao_fornecedor: `${i.embalagens} embalagem(ns) de ${i.por_embalagem}`,
            qtd_fornecedor: i.embalagens,
            unidade_fornecedor: 'embalagem'
        }));

        const { error: erroItens } = await _supabase.from('compra_itens').insert(linhas);
        if (erroItens) throw erroItens;

        showToast(`Compra registrada: ${linhas.length} produto(s) deram entrada.`, 'success');
        fecharModal('modalCompra');
        itensCompraManual = [];

        if (typeof carregarEstoque === 'function') await carregarEstoque();

    } catch (err) {
        console.error(err);
        showToast('Erro ao salvar compra: ' + (err.message || ''), 'error', 8000);
    } finally {
        if (botao) { botao.disabled = false; botao.innerHTML = botao.dataset.txt || 'Salvar compra'; }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const fAjuste = document.getElementById('formAjusteEstoque');
    if (fAjuste) fAjuste.addEventListener('submit', salvarAjusteEstoque);

    const fCompra = document.getElementById('formCompra');
    if (fCompra) fCompra.addEventListener('submit', salvarCompra);
});
