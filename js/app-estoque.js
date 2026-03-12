// ========================================
// APP-ESTOQUE.JS — CRUD Estoque
// ========================================

async function carregarEstoque() {
    await carregarDadosIniciais();
    renderizarEstoque(appState.estoque);
}

function renderizarEstoque(produtos) {
    const container = document.getElementById('estoqueGrid');
    if (!container) return;

    if (produtos.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>Estoque vazio</p></div>`;
        return;
    }

    container.innerHTML = produtos.map(p => {
        let corStatus = '#66BB6A';
        if (p.quantidade <= p.quantidade_minima) corStatus = '#FFA726';
        if (p.quantidade === 0)                  corStatus = '#EF5350';

        return `
            <div class="estoque-card" style="border-left: 4px solid ${corStatus}; padding: 1.5rem; border-radius: 12px; background: #1E1E1E; margin-bottom: 0;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                    <h4 style="color: #fff; margin: 0; font-size: 1.1rem;">${p.nome}</h4>
                    <span style="background: ${corStatus}20; color: ${corStatus}; padding: 4px 8px; border-radius: 6px; font-weight: bold; font-size: 0.9rem;">
                        ${p.quantidade} un.
                    </span>
                </div>
                <div style="color: #888; font-size: 0.9rem; margin-bottom: 15px;">
                    Mínimo ideal: ${p.quantidade_minima}
                </div>
                <div style="display: flex; gap: 10px;">
                    <button onclick="abrirModalEstoque('${p.id}')" class="action-btn btn-edit">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button onclick="excluirProduto('${p.id}')" class="action-btn btn-delete">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                </div>
            </div>`;
    }).join('');
}

function filtrarEstoque(termo) {
    const produtosFiltrados = appState.estoque.filter(p =>
        p.nome.toLowerCase().includes(termo.toLowerCase())
    );
    renderizarEstoque(produtosFiltrados);
}

function abrirModalEstoque(produtoId = null) {
    const modal = document.getElementById('modalEstoque');
    const form  = document.getElementById('formEstoque');
    form.reset();

    const hiddenInput = document.getElementById('estoqueId');
    hiddenInput.value = '';

    if (produtoId) {
        const produto = appState.estoque.find(p => p.id === produtoId);
        if (produto) {
            document.getElementById('modalEstoqueTitle').textContent = 'Editar Produto';
            hiddenInput.value = produto.id;
            document.getElementById('estoqueNome').value             = produto.nome;
            document.getElementById('estoqueDescricao').value        = produto.descricao || '';
            document.getElementById('estoqueValor').value            = produto.valor_unitario;
            document.getElementById('estoqueQuantidade').value       = produto.quantidade;
            document.getElementById('estoqueQuantidadeMinima').value = produto.quantidade_minima;
        }
    } else {
        document.getElementById('modalEstoqueTitle').textContent = 'Novo Produto';
    }

    modal.classList.add('active');
    document.getElementById('overlay').classList.add('active');
}

async function salvarEstoque(e) {
    e.preventDefault();
    const id = document.getElementById('estoqueId').value;
    const dados = {
        nome:              document.getElementById('estoqueNome').value,
        descricao:         document.getElementById('estoqueDescricao').value,
        valor_unitario:    parseFloat(document.getElementById('estoqueValor').value),
        quantidade:        parseInt(document.getElementById('estoqueQuantidade').value),
        quantidade_minima: parseInt(document.getElementById('estoqueQuantidadeMinima').value)
    };

    try {
        if (id) {
            const { error } = await _supabase.from('estoque').update(dados).eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await _supabase.from('estoque').insert([dados]);
            if (error) throw error;
        }
        showToast('Produto salvo com sucesso!', 'success');
        fecharModal('modalEstoque');
        appState._lastFetch = 0;
        await carregarEstoque();
    } catch (err) {
        console.error(err);
        showToast('Erro ao salvar produto.', 'error');
    }
}

async function excluirProduto(id) {
    if (!id || id === 'undefined') return showToast('Erro: ID inválido', 'error');
    if (!confirm('Tem certeza que deseja excluir?')) return;

    try {
        const { error } = await _supabase.from('estoque').delete().eq('id', id);
        if (error) throw error;
        showToast('Produto excluído!', 'success');
        appState._lastFetch = 0;
        await carregarEstoque();
        if (typeof atualizarNotificacoes === 'function') atualizarNotificacoes();
    } catch (err) {
        console.error(err);
        showToast('Erro ao excluir.', 'error');
    }
}

// ========================================
// EXPORTAÇÕES GLOBAIS
// ========================================
window.carregarEstoque   = carregarEstoque;
window.renderizarEstoque = renderizarEstoque;
window.filtrarEstoque    = filtrarEstoque;
window.abrirModalEstoque = abrirModalEstoque;
window.salvarEstoque     = salvarEstoque;
window.excluirProduto    = excluirProduto;
