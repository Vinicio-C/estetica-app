document.addEventListener('DOMContentLoaded', async () => {
    checkLogin(); // Sua função de checar login existente
    carregarDadosPerfil();
    
    document.getElementById('formPerfil').addEventListener('submit', salvarPerfil);
});

async function carregarDadosPerfil() {
    // 1. Pega o usuário logado
    const { data: { user } } = await _supabase.auth.getUser();
    
    if (!user) return;

    // Mostra o email no topo (dado fixo do login)
    document.getElementById('headerEmail').textContent = user.email;

    // 2. Busca os dados na tabela 'profiles'
    const { data: perfil, error } = await _supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (error) {
        console.error('Erro ao buscar perfil:', error);
        return;
    }

    if (perfil) {
        // Preenche os campos
        document.getElementById('nome').value = perfil.nome || '';
        document.getElementById('especialidade').value = perfil.especialidade || '';
        document.getElementById('telefone').value = perfil.telefone || '';
        
        // Atualiza o nome no topo
        atualizarHeader(perfil.nome);
    }
}

async function salvarPerfil(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.textContent = "Salvando...";
    btn.disabled = true;

    const { data: { user } } = await _supabase.auth.getUser();

    const atualizacao = {
        nome: document.getElementById('nome').value,
        especialidade: document.getElementById('especialidade').value,
        telefone: document.getElementById('telefone').value,
        // user_id não precisa atualizar, é a chave primária
    };

    const { error } = await _supabase
        .from('profiles')
        .update(atualizacao)
        .eq('id', user.id);

    if (error) {
        alert('Erro ao salvar: ' + error.message);
    } else {
        alert('Perfil atualizado com sucesso! ✨');
        atualizarHeader(atualizacao.nome);
    }

    btn.textContent = "Salvar Alterações";
    btn.disabled = false;
}

function atualizarHeader(nome) {
    const el = document.getElementById('headerNome');
    if(el) el.textContent = nome || 'Doutora (Sem nome)';
}