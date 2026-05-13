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
    if (e.target.id === 'profEndereco' || e.target.id === 'profNumero' || e.target.id === 'profCidade' || e.target.id === 'profEstado') {
        atualizarPreviewMapa();
    }
});

// LOCALIZAÇÃO — Busca CEP via ViaCEP
window.buscarCEP = async function() {
    const cepRaw = document.getElementById('profCep').value.replace(/\D/g, '');
    if (cepRaw.length !== 8) {
        if (typeof showToast === 'function') showToast('CEP inválido. Digite 8 números.', 'error');
        return;
    }
    try {
        const res = await fetch(`https://viacep.com.br/ws/${cepRaw}/json/`);
        const dados = await res.json();
        if (dados.erro) {
            if (typeof showToast === 'function') showToast('CEP não encontrado.', 'error');
            return;
        }
        document.getElementById('profEndereco').value = dados.logradouro || '';
        document.getElementById('profBairro').value = dados.bairro || '';
        document.getElementById('profCidade').value = dados.localidade || '';
        document.getElementById('profEstado').value = dados.uf || '';
        document.getElementById('profNumero').focus();
        atualizarPreviewMapa();
        if (typeof showToast === 'function') showToast('Endereço preenchido!', 'success');
    } catch (e) {
        if (typeof showToast === 'function') showToast('Erro ao buscar CEP.', 'error');
    }
};

// LOCALIZAÇÃO — Geolocalização do dispositivo
window.usarLocalizacaoAtual = function() {
    if (!navigator.geolocation) {
        if (typeof showToast === 'function') showToast('Geolocalização não disponível neste navegador.', 'error');
        return;
    }
    if (typeof showToast === 'function') showToast('Obtendo localização...', 'info');
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`, {
                headers: { 'Accept-Language': 'pt-BR' }
            });
            const d = await res.json();
            const addr = d.address || {};
            document.getElementById('profEndereco').value = addr.road || addr.pedestrian || '';
            document.getElementById('profNumero').value = addr.house_number || '';
            document.getElementById('profBairro').value = addr.suburb || addr.neighbourhood || addr.city_district || '';
            document.getElementById('profCidade').value = addr.city || addr.town || addr.village || '';
            document.getElementById('profEstado').value = (addr.state_code || addr.ISO3166_2_lvl4 || '').replace(/^BR-/, '').slice(0, 2);
            const cepRaw = (addr.postcode || '').replace(/\D/g, '');
            if (cepRaw) document.getElementById('profCep').value = cepRaw.replace(/(\d{5})(\d)/, '$1-$2');
            atualizarPreviewMapa();
            if (typeof showToast === 'function') showToast('Localização obtida!', 'success');
        } catch (e) {
            if (typeof showToast === 'function') showToast('Erro ao obter endereço. Preencha manualmente.', 'error');
        }
    }, () => {
        if (typeof showToast === 'function') showToast('Permissão de localização negada.', 'error');
    });
};

// LOCALIZAÇÃO — Atualiza o iframe de preview
function atualizarPreviewMapa() {
    const endereco = document.getElementById('profEndereco')?.value.trim() || '';
    const numero = document.getElementById('profNumero')?.value.trim() || '';
    const cidade = document.getElementById('profCidade')?.value.trim() || '';
    const estado = document.getElementById('profEstado')?.value.trim() || '';
    const container = document.getElementById('mapaPreviewContainer');
    const iframe = document.getElementById('mapaPreviewIframe');
    if (!container || !iframe) return;

    if (!endereco || !cidade) {
        container.style.display = 'none';
        return;
    }
    const query = encodeURIComponent([endereco, numero, cidade, estado, 'Brasil'].filter(Boolean).join(', '));
    iframe.src = `https://maps.google.com/maps?q=${query}&output=embed`;
    container.style.display = 'block';
}

// 3. CARREGAR DADOS (Chamado pelo Menu)
window.carregarDadosPerfil = async function() {
    console.log("⚡ Abrindo Perfil...");

    // Roda independente do resto — garante que o status sempre aparece
    preencherStatusPlano();

    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return;

        const { data: perfil } = await _supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

        if (perfil) {
            document.getElementById('profNome').value = perfil.nome || '';
            document.getElementById('profEspecialidade').value = perfil.especialidade || '';
            document.getElementById('profTelefone').value = mascaraTelefone(perfil.telefone || '');
            document.getElementById('headerNome').textContent = perfil.nome || 'Doutora';
            if (perfil.foto_url && window.atualizarAvatarNaTela) {
                window.atualizarAvatarNaTela(perfil.foto_url);
            }
            // Localização
            document.getElementById('profCep').value = perfil.cep || '';
            document.getElementById('profEndereco').value = perfil.endereco || '';
            document.getElementById('profNumero').value = perfil.numero || '';
            document.getElementById('profComplemento').value = perfil.complemento || '';
            document.getElementById('profBairro').value = perfil.bairro || '';
            document.getElementById('profCidade').value = perfil.cidade || '';
            document.getElementById('profEstado').value = perfil.estado || '';
            atualizarPreviewMapa();
        }

        document.getElementById('headerEmail').textContent = user.email;

        const urlBase = window.location.origin + window.location.pathname.replace('index.html', '');
        document.getElementById('profLink').value = `${urlBase}agendar.html?ref=${user.id}`;

    } catch (err) { console.error("Erro carga perfil:", err); }
};

// Abre o portal de gerenciamento de assinatura do Stripe
window.abrirPortalStripe = async function(event) {
    if (event) event.preventDefault();
    if(typeof showToast === 'function') showToast('Redirecionando para o portal de assinatura...', 'info');
    // Por enquanto abre o email de suporte — o portal do Stripe requer uma Edge Function extra
    window.open('mailto:suporte@esteticaapp.com.br?subject=Gerenciar%20Assinatura', '_blank');
};

// 3b. PREENCHER STATUS DO PLANO NA SEÇÃO DE ASSINATURA
async function preencherStatusPlano() {
    const textoEl = document.getElementById('textoStatusPlano');
    const btnAssinar = document.getElementById('btnAssinar');
    const btnGerenciar = document.getElementById('btnGerenciarPlano');
    if (!textoEl) return;

    try {
        const plano = typeof verificarPlano === 'function' ? await verificarPlano() : null;
        if (!plano) return;

        if (plano === 'vitalicio') {
            textoEl.textContent = 'Acesso Vitalicio — obrigado pela confianca!';
            textoEl.style.color = '#D4AF37';
        } else if (plano === 'ativo') {
            textoEl.textContent = 'Plano Ativo — R$ 29,99/mes. Proximo vencimento conforme Stripe.';
            textoEl.style.color = '#4CAF50';
            if (btnGerenciar) btnGerenciar.style.display = 'block';
        } else if (plano && plano.status === 'trial') {
            textoEl.textContent = `Periodo de teste — ${plano.diasRestantes} dia(s) restante(s).`;
            textoEl.style.color = '#D4AF37';
            if (btnAssinar) btnAssinar.style.display = 'block';
        } else {
            textoEl.textContent = 'Plano expirado — assine para continuar usando.';
            textoEl.style.color = '#f44336';
            if (btnAssinar) btnAssinar.style.display = 'block';
        }
    } catch (e) {
        textoEl.textContent = 'Nao foi possivel verificar o plano.';
    }
}

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
            telefone: document.getElementById('profTelefone').value.replace(/\D/g, ""),
            cep: document.getElementById('profCep').value.replace(/\D/g, ""),
            endereco: document.getElementById('profEndereco').value,
            numero: document.getElementById('profNumero').value,
            complemento: document.getElementById('profComplemento').value,
            bairro: document.getElementById('profBairro').value,
            cidade: document.getElementById('profCidade').value,
            estado: document.getElementById('profEstado').value.toUpperCase()
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