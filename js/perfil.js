// js/perfil.js

// 1. MÁSCARA DE TELEFONE (Visual)
function mascaraTelefone(v) {
    v = v.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 10) {
        v = v.replace(/^(\222)(\d{5})(\d{4}).*/, "($1) $2-$3");
    } else if (v.length > 5) {
        v = v.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
    } else if (v.length > 2) {
        v = v.replace(/^(\d{2})(\d{0,5}).*/, "($1) $2");
    } else if (v.length > 0) {
        v = v.replace(/^(\d*)/, "($1");
    }
    return v;
}

// 2. APLICA A MÁSCARA ENQUANTO DIGITA
document.addEventListener('input', (e) => {
    if (e.target.id === 'profTelefone') {
        let input = e.target;
        input.value = mascaraTelefone(input.value);
    }
});

// 3. CARREGAR DADOS (Chamado pelo Menu)
window.carregarDadosPerfil = async function() {
    console.log("⚡ Abrindo Perfil...");
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return;

        const { data: perfil } = await _supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

        // Preenche campos de edição
        if (perfil) {
            document.getElementById('profNome').value = perfil.nome || '';
            document.getElementById('profEspecialidade').value = perfil.especialidade || '';
            document.getElementById('profTelefone').value = mascaraTelefone(perfil.telefone || '');
            
            // Atualiza Topo
            document.getElementById('headerNome').textContent = perfil.nome || 'Doutora';
            if (perfil.foto_url && window.atualizarAvatarNaTela) {
                window.atualizarAvatarNaTela(perfil.foto_url);
            }
        }
        
        document.getElementById('headerEmail').textContent = user.email;

        // Gera o Link Externo
        const urlBase = window.location.origin + window.location.pathname.replace('index.html', '');
        document.getElementById('profLink').value = `${urlBase}agendar.html?ref=${user.id}`;

        // Mostra a tela
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('perfilPage').classList.add('active');

    } catch (err) { console.error("Erro carga:", err); }
};

// 4. SALVAR DADOS (Chamado pelo Form onsubmit)
window.salvarPerfilReal = async function(event) {
    if (event) event.preventDefault(); // Trava o recarregamento da página
    
    console.log("💾 Salvando...");
    const btn = document.querySelector('#formPerfilInterno button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Processando...";

    try {
        const { data: { user } } = await _supabase.auth.getUser();
        
        const dados = {
            id: user.id,
            nome: document.getElementById('profNome').value,
            especialidade: document.getElementById('profEspecialidade').value,
            telefone: document.getElementById('profTelefone').value.replace(/\D/g, "") // Salva limpo
        };

        const { error } = await _supabase.from('profiles').upsert(dados);
        if (error) throw error;

        // Atualiza visual instantaneamente
        document.getElementById('headerNome').textContent = dados.nome;
        
        if (typeof showToast === 'function') showToast("Alterações salvas! ✨", "success");
        else alert("Alterações salvas com sucesso! ✨");

    } catch (err) {
        alert("Erro ao salvar: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Salvar Alterações";
    }
};