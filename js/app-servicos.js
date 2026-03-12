// ========================================
// APP-SERVICOS.JS — CRUD Serviços
// ========================================

window.produtosServicoAtual = [];

async function carregarServicos() {
    await carregarDadosIniciais();
    renderizarServicos(appState.servicos);
}

function renderizarServicos(servicos) {
    const container = document.getElementById('servicosGrid');
    if (!container) return;

    if (servicos.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>Nenhum serviço cadastrado</p></div>`;
        return;
    }

    container.innerHTML = servicos.map(s => `
        <div class="servico-card" style="padding: 1.5rem; border-radius: 12px; background: #1E1E1E;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h4 style="color: #fff; margin: 0; font-size: 1.2rem;">${s.nome}</h4>
                <strong style="color: var(--gold); font-size: 1.2rem;">${formatCurrency(s.valor)}</strong>
            </div>
            <div style="color: #888; font-size: 0.9rem; margin-bottom: 20px; display: flex; gap: 10px;">
                <span><i class="fas fa-clock"></i> ${s.duracao} min</span>
            </div>
            <div style="display: flex; gap: 10px;">
                <button onclick="abrirModalServico('${s.id}')" class="action-btn btn-edit">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button onclick="excluirServico('${s.id}')" class="action-btn btn-delete">
                    <i class="fas fa-trash"></i> Excluir
                </button>
            </div>
        </div>`).join('');
}

function filtrarServicos(termo) {
    const servicosFiltrados = appState.servicos.filter(s =>
        s.nome.toLowerCase().includes(termo.toLowerCase())
    );
    renderizarServicos(servicosFiltrados);
}

window.abrirModalServico = function(id = null) {
    const modal = document.getElementById('modalServico');
    const form  = document.getElementById('formServico');
    if (form) form.reset();

    let hiddenInput = document.getElementById('servicoId');
    if (hiddenInput) hiddenInput.value = '';

    window.produtosServicoAtual = [];
    const selectProduto = document.getElementById('selectProdutoServico');
    if (selectProduto) {
        selectProduto.innerHTML = '<option value="">Selecione um produto do estoque...</option>' +
            appState.estoque.map(p => `<option value="${p.id}">${p.nome} (Estoque atual: ${p.quantidade})</option>`).join('');
    }

    if (id) {
        const servico = appState.servicos.find(s => s.id === id);
        if (servico) {
            document.getElementById('modalServicoTitle').textContent = 'Editar Serviço';
            if (hiddenInput) hiddenInput.value = servico.id;
            document.getElementById('servicoNome').value = servico.nome || '';
            if (document.getElementById('servicoTipo'))      document.getElementById('servicoTipo').value      = servico.tipo      || '';
            if (document.getElementById('servicoDuracao'))   document.getElementById('servicoDuracao').value   = servico.duracao   || '';
            if (document.getElementById('servicoValor'))     document.getElementById('servicoValor').value     = servico.valor     || '';
            if (document.getElementById('servicoDescricao')) document.getElementById('servicoDescricao').value = servico.descricao || '';
            if (servico.produtos_vinculados) {
                window.produtosServicoAtual = JSON.parse(JSON.stringify(servico.produtos_vinculados));
            }
        }
    } else {
        document.getElementById('modalServicoTitle').textContent = 'Novo Serviço';
    }

    renderizarProdutosVinculados();
    modal.classList.add('active');
    document.getElementById('overlay').classList.add('active');
};

window.adicionarProdutoAoServico = function() {
    const select = document.getElementById('selectProdutoServico');
    const qtdInput = document.getElementById('qtdProdutoServico');
    const produtoId = select.value;
    const qtd = parseFloat(qtdInput.value);

    if (!produtoId) return showToast("Selecione um produto do estoque.", "warning");
    if (!qtd || qtd <= 0) return showToast("A quantidade deve ser maior que zero.", "warning");

    const produtoInfo = appState.estoque.find(p => p.id === produtoId);
    if (!produtoInfo) return;

    const existeIndex = window.produtosServicoAtual.findIndex(p => p.estoque_id === produtoId);
    if (existeIndex >= 0) {
        window.produtosServicoAtual[existeIndex].quantidade += qtd;
    } else {
        window.produtosServicoAtual.push({ estoque_id: produtoId, nome: produtoInfo.nome, quantidade: qtd });
    }

    select.value = '';
    qtdInput.value = '1';
    renderizarProdutosVinculados();
};

window.removerProdutoDoServico = function(index) {
    window.produtosServicoAtual.splice(index, 1);
    renderizarProdutosVinculados();
};

window.renderizarProdutosVinculados = function() {
    const container = document.getElementById('listaProdutosVinculados');
    if (!container) return;

    if (window.produtosServicoAtual.length === 0) {
        container.innerHTML = '<div style="color: #666; font-size: 0.85rem; text-align: center; padding: 10px;">Nenhum produto vinculado ainda.</div>';
        return;
    }

    container.innerHTML = window.produtosServicoAtual.map((p, index) => `
        <div style="display: flex; justify-content: space-between; align-items: center; background: #1a1a1a; padding: 8px 12px; margin-bottom: 5px; border-radius: 4px; border: 1px solid #333;">
            <span style="color: #fff; font-size: 0.9rem;"><i class="fas fa-box" style="color: #888; font-size: 0.8rem; margin-right: 5px;"></i> ${p.nome}</span>
            <div style="display: flex; align-items: center; gap: 15px;">
                <span style="color: var(--gold); font-weight: bold; font-size: 0.9rem;">${p.quantidade} un.</span>
                <button type="button" onclick="removerProdutoDoServico(${index})"
                    style="background: transparent; border: none; color: #ff4444; cursor: pointer;" title="Remover Vínculo">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>`).join('');
};

// Alias local
function renderizarProdutosVinculados() {
    window.renderizarProdutosVinculados();
}

window.salvarServico = async function(e) {
    e.preventDefault();
    const id = document.getElementById('servicoId').value;

    const dados = {
        nome:               document.getElementById('servicoNome').value,
        valor:              parseFloat(document.getElementById('servicoValor').value),
        duracao:            parseInt(document.getElementById('servicoDuracao').value),
        produtos_vinculados: window.produtosServicoAtual
    };

    if (document.getElementById('servicoTipo'))      dados.tipo      = document.getElementById('servicoTipo').value;
    if (document.getElementById('servicoDescricao')) dados.descricao = document.getElementById('servicoDescricao').value;

    const btn = e.target.querySelector('button[type="submit"]');
    const txtOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    btn.disabled = true;

    try {
        if (id) {
            const { error } = await _supabase.from('servicos').update(dados).eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await _supabase.from('servicos').insert([dados]);
            if (error) throw error;
        }

        showToast('Serviço salvo com sucesso!', 'success');
        fecharModal('modalServico');
        await carregarDadosIniciais(true);
        carregarServicos();
    } catch (err) {
        console.error(err);
        showToast('Erro ao salvar serviço.', 'error');
    } finally {
        btn.innerHTML = txtOriginal;
        btn.disabled = false;
    }
};

async function excluirServico(id) {
    if (!id || id === 'undefined') return;
    if (!confirm('Tem certeza que deseja excluir este serviço permanentemente?')) return;

    try {
        const { error } = await _supabase.from('servicos').delete().eq('id', id);
        if (error) throw error;
        showToast('Serviço excluído com sucesso!', 'success');
        carregarServicos();
    } catch (err) {
        console.error(err);
        showToast('Erro ao excluir serviço.', 'error');
    }
}

// ========================================
// EXPORTAÇÕES GLOBAIS
// ========================================
window.carregarServicos  = carregarServicos;
window.renderizarServicos = renderizarServicos;
window.filtrarServicos   = filtrarServicos;
window.excluirServico    = excluirServico;
window.salvarServico     = window.salvarServico; // já definido como window.*
