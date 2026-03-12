// ========================================
// APP-CORE.JS — Estado, Helpers, Init, Nav, Auth, Notificações, Google, Perfil
// ========================================

// =========================================================
// FISCAL DE RECUPERAÇÃO DE SENHA (listener único)
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
    const supabaseCheck = setInterval(() => {
        if (window._supabase) {
            clearInterval(supabaseCheck);
            window._supabase.auth.onAuthStateChange((event, session) => {
                console.log("🔔 Evento de Auth Detectado:", event);
                if (event === 'PASSWORD_RECOVERY') {
                    console.log("🛑 É recuperação de senha! Redirecionando...");
                    document.body.innerHTML = '<div style="color:white; text-align:center; padding:50px;">Redirecionando para troca de senha...</div>';
                    window.location.href = 'nova-senha.html';
                }
            });
        }
    }, 100);
});

// ========================================
// ESTADO GLOBAL DA APLICAÇÃO
// ========================================
const appState = {
    currentPage: 'dashboard',
    currentCliente: null,
    currentAgendaView: 'dia',
    currentAgendaDate: new Date(),
    clientes: [],
    servicos: [],
    estoque: [],
    agendamentos: [],
    pagamentos: [],
    _lastFetch: 0 // timestamp do último carregamento completo
};

// Tempo mínimo (ms) entre recarregamentos completos do banco
const CACHE_TTL = 15000; // 15 segundos

// ========================================
// INICIALIZAÇÃO
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🌟 Inicializando Agendamento Premium...');

    // Watchdog: garante que o app abre em 3 segundos mesmo se o banco travar
    setTimeout(() => {
        const loader = document.getElementById('loadingScreen');
        if (loader && !loader.classList.contains('hidden')) {
            console.warn('⚠️ Watchdog: O banco demorou, forçando abertura do app.');
            loader.classList.add('hidden');
        }
    }, 3000);

    try {
        const lastDate = localStorage.getItem('lastAgendaDate');
        if (lastDate) {
            appState.currentAgendaDate = new Date(lastDate);
            if (typeof displayDate !== 'undefined') {
                displayDate = new Date(lastDate);
            }
        }

        setupEventListeners();
        await carregarDadosIniciais();

        if (typeof carregarDashboard === 'function') {
            carregarDashboard();
        }
    } catch (error) {
        console.error("Erro fatal na inicialização:", error);
    } finally {
        setTimeout(() => {
            const loader = document.getElementById('loadingScreen');
            if (loader) loader.classList.add('hidden');
        }, 1000);
    }
});

function setupEventListeners() {
    // Menu sidebar
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            navigateTo(item.dataset.page);
        });
    });

    // Menu toggle (mobile)
    const menuToggle = document.getElementById('menuToggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('active');
            document.getElementById('overlay').classList.toggle('active');
        });
    }

    // Overlay (fechar sidebar mobile)
    const overlay = document.getElementById('overlay');
    if (overlay) {
        overlay.addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('active');
            overlay.classList.remove('active');
        });
    }

    // Forms
    const fCliente = document.getElementById('formCliente');
    if (fCliente) fCliente.addEventListener('submit', salvarCliente);

    const fAgenda = document.getElementById('formAgendamento');
    if (fAgenda) fAgenda.addEventListener('submit', salvarAgendamento);

    const fServico = document.getElementById('formServico');
    if (fServico) fServico.addEventListener('submit', salvarServico);

    const fEstoque = document.getElementById('formEstoque');
    if (fEstoque) fEstoque.addEventListener('submit', salvarEstoque);

    // Search bars
    const sCliente = document.getElementById('searchClientes');
    if (sCliente) sCliente.addEventListener('input', (e) => filtrarClientes(e.target.value));

    const sServico = document.getElementById('searchServicos');
    if (sServico) sServico.addEventListener('input', (e) => filtrarServicos(e.target.value));

    const sEstoque = document.getElementById('searchEstoque');
    if (sEstoque) sEstoque.addEventListener('input', (e) => filtrarEstoque(e.target.value));

    // Botão de Notificações
    const btnNotif = document.getElementById('notificationsBtn');
    if (btnNotif) {
        btnNotif.addEventListener('click', async () => {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                showToast('Notificações ativadas!', 'success');
            } else {
                showToast('Habilite notificações no seu celular.', 'warning');
            }
        });
    }
}

function navigateTo(page) {
    appState.currentPage = page;

    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) item.classList.add('active');
    });

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    const targetPage = document.getElementById(page + 'Page');
    if (targetPage) targetPage.classList.add('active');

    const titles = {
        dashboard: 'Dashboard',
        clientes: 'Clientes',
        agenda: 'Agenda',
        servicos: 'Serviços',
        estoque: 'Estoque',
        relatorios: 'Relatórios',
        automacoes: 'Automações'
    };
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) pageTitle.textContent = titles[page];

    switch (page) {
        case 'dashboard':  if (typeof carregarDashboard  === 'function') carregarDashboard();  break;
        case 'clientes':   if (typeof carregarClientes   === 'function') carregarClientes();   break;
        case 'agenda':     if (typeof carregarAgenda     === 'function') carregarAgenda();     break;
        case 'servicos':   if (typeof carregarServicos   === 'function') carregarServicos();   break;
        case 'estoque':    if (typeof carregarEstoque    === 'function') carregarEstoque();    break;
        case 'relatorios': if (typeof carregarRelatorios === 'function') carregarRelatorios(); break;
        case 'automacoes': if (typeof carregarAutomacoes === 'function') carregarAutomacoes(); break;
    }

    const sidebar = document.getElementById('sidebar');
    const overlayEl = document.getElementById('overlay');
    if (sidebar) sidebar.classList.remove('active');
    if (overlayEl) overlayEl.classList.remove('active');
}

async function carregarDadosIniciais(forcar = false) {
    const agora = Date.now();
    if (!forcar && appState._lastFetch && (agora - appState._lastFetch < CACHE_TTL)) {
        return;
    }

    try {
        const [clientes, servicos, estoque, agendamentos, pagamentos] = await Promise.all([
            fetchAPI('tables/clientes?limit=1000'),
            fetchAPI('tables/servicos?limit=1000'),
            fetchAPI('tables/estoque?limit=1000'),
            fetchAPI('tables/agendamentos?limit=1000'),
            fetchAPI('tables/pagamentos?limit=1000')
        ]);

        appState.clientes    = clientes.data    || [];
        appState.servicos    = servicos.data    || [];
        appState.estoque     = estoque.data     || [];
        appState.agendamentos = agendamentos.data || [];
        appState.pagamentos  = pagamentos.data  || [];
        appState._lastFetch  = agora;

        if (typeof autoConcluirPassados === 'function') {
            await autoConcluirPassados();
        }
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
    }
}

// ========================================
// HELPER FUNCTIONS
// ========================================

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    }).format(date);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    if (dateString.includes('-')) {
        const partes = dateString.split('-');
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return dateString;
}

function formatTime(timeString) {
    if (!timeString) return '-';
    return timeString.slice(0, 5);
}

function formatTimeInput(date) {
    if (!date) return '';
    const d = new Date(date);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDateInput(date) {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'check-circle';
    if (type === 'error')   icon = 'exclamation-circle';
    if (type === 'warning') icon = 'exclamation-triangle';
    if (type === 'info')    icon = 'info-circle';

    toast.innerHTML = `<i class="fas fa-${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function fecharModal(modalId) {
    const modal   = document.getElementById(modalId);
    const overlay = document.getElementById('overlay');
    if (modal)   modal.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
}

function trocarTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) btn.classList.add('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    const el = document.getElementById(`tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
    if (el) el.classList.add('active');
}

function limparNotificacoes(e) {
    if (e) e.stopPropagation();
    const lista  = document.getElementById('notifList');
    const badge  = document.getElementById('notifCount');
    if (lista) lista.innerHTML = '<div class="notif-empty"><i class="fas fa-check-circle"></i><br>Notificações limpas!</div>';
    if (badge) { badge.style.display = 'none'; badge.textContent = '0'; }
    showToast('Notificações limpas.', 'info');
}

// ========================================
// SISTEMA DE NOTIFICAÇÕES
// ========================================

function toggleNotifications() {
    const dropdown = document.getElementById('notificationsDropdown');
    dropdown.classList.toggle('active');
    if (dropdown.classList.contains('active')) atualizarNotificacoes();
}

document.addEventListener('click', (e) => {
    const wrapper  = document.querySelector('.notifications-wrapper');
    const dropdown = document.getElementById('notificationsDropdown');
    if (wrapper && !wrapper.contains(e.target) && dropdown) {
        dropdown.classList.remove('active');
    }
});

async function atualizarNotificacoes() {
    const estoque      = appState.estoque      || [];
    const agendamentos = appState.agendamentos || [];
    const clientes     = appState.clientes     || [];

    const lista = document.getElementById('notifList');
    const badge = document.getElementById('notifCount');
    if (!lista || !badge) return;

    lista.innerHTML = '';
    let count = 0;
    let html  = '';
    const hoje = new Date();

    // 1. Aniversariantes do dia
    clientes.forEach(c => {
        if (c.data_nascimento) {
            const partes  = c.data_nascimento.split('-');
            const diaNasc = parseInt(partes[2]);
            const mesNasc = parseInt(partes[1]) - 1;
            if (hoje.getDate() === diaNasc && hoje.getMonth() === mesNasc) {
                count++;
                html += `
                    <div class="notif-item" style="border-left: 4px solid #E91E63;" onclick="abrirDetalhesCliente('${c.id}')">
                        <div class="notif-icon" style="color: #E91E63;"><i class="fas fa-birthday-cake"></i></div>
                        <div class="notif-content">
                            <h4 style="color: #E91E63;">Aniversário Hoje! 🎉</h4>
                            <p><strong>${c.nome}</strong> está completando mais um ano.</p>
                        </div>
                    </div>`;
            }
        }
    });

    // 2. Estoque baixo
    estoque.forEach(item => {
        if (item.quantidade <= item.quantidade_minima) {
            count++;
            const isCritico = item.quantidade === 0;
            html += `
                <div class="notif-item ${isCritico ? 'critical' : 'warning'}" onclick="navigateTo('estoque')">
                    <div class="notif-icon"><i class="fas fa-box-open"></i></div>
                    <div class="notif-content">
                        <h4>${item.nome}</h4>
                        <p>${isCritico ? 'Esgotado!' : 'Estoque baixo'}: Restam ${item.quantidade}</p>
                    </div>
                </div>`;
        }
    });

    // 3. Contas a receber atrasadas
    agendamentos.forEach(a => {
        const dataServico = new Date(a.data);
        if (dataServico < hoje && a.status === 'concluido' && a.status_pagamento === 'devendo') {
            count++;
            html += `
                <div class="notif-item critical" onclick="abrirDetalhesCliente('${a.cliente_id}')">
                    <div class="notif-icon"><i class="fas fa-exclamation-circle"></i></div>
                    <div class="notif-content">
                        <h4>Débito: ${a.cliente_nome}</h4>
                        <p>Venceu em ${formatDate(a.data)}</p>
                    </div>
                </div>`;
        }
    });

    if (count > 0) {
        lista.innerHTML = html;
        badge.style.display = 'flex';
        badge.textContent = count;
    } else {
        lista.innerHTML = '<div class="notif-empty"><i class="fas fa-check-circle"></i><br>Tudo em dia!</div>';
        badge.style.display = 'none';
    }
}

// ========================================
// GOOGLE CALENDAR
// ========================================

window.conectarGoogle = async function() {
    console.log("🔌 Iniciando conexão com Google...");
    const { data, error } = await _supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.href,
            scopes: 'https://www.googleapis.com/auth/calendar',
            queryParams: { access_type: 'offline', prompt: 'consent' }
        }
    });
    if (error) {
        console.error("Erro ao conectar:", error);
        showToast('Erro ao conectar com Google', 'error');
    }
};

async function verificarStatusGoogle() {
    const btn = document.getElementById('btnConnectGoogle');
    if (!btn) return;
    const { data: { session } } = await _supabase.auth.getSession();
    if (session && session.provider_token) {
        btn.innerHTML = '<i class="fab fa-google"></i> Conectado';
        btn.style.background = '#4CAF50';
        btn.style.color = '#fff';
        btn.style.borderColor = '#4CAF50';
        console.log("✅ Google Conectado!");
    } else {
        btn.innerHTML = '<i class="fab fa-google"></i> Sincronizar';
        btn.style.background = '';
        console.log("❌ Google Não conectado.");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(verificarStatusGoogle, 1000);
});

window.sincronizarPendentesGoogle = async function() {
    console.log("🔄 Sincronizando com Google via API Nativa...");

    const btn = document.querySelector('button[onclick*="sincronizarPendentesGoogle"]');
    const iconeOriginal = btn ? btn.innerHTML : '';
    if (btn) { btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true; }

    try {
        const { data: { session } } = await window._supabase.auth.getSession();
        const token = session?.provider_token;

        if (!token) {
            alert("🔒 Você não está conectado ao Google.\nPor favor, faça login novamente com o Google para gerar uma chave de acesso nova.");
            return;
        }

        const hoje = new Date().toISOString().split('T')[0];

        const { data: pendentes, error } = await window._supabase
            .from('agendamentos')
            .select('*, clientes(nome)')
            .gte('data', hoje)
            .is('google_event_id', null)
            .neq('status', 'cancelado');

        if (error) throw error;

        if (!pendentes || pendentes.length === 0) {
            alert("✅ Tudo atualizado! Nenhum agendamento pendente para enviar.");
            return;
        }

        let enviados = 0;
        for (const agenda of pendentes) {
            try {
                const inicio = `${agenda.data}T${agenda.hora}:00`;
                const dataInicio = new Date(inicio);
                const dataFim = new Date(dataInicio.getTime() + 60 * 60 * 1000);
                const fim = dataFim.toISOString().split('.')[0];
                const nomeCliente = agenda.clientes?.nome || 'Cliente Site';

                const evento = {
                    'summary': `💆‍♀️ ${agenda.servico_nome || 'Serviço'} - ${nomeCliente}`,
                    'description': `Agendamento via App. Obs: ${agenda.observacoes || '-'}`,
                    'start': { 'dateTime': inicio, 'timeZone': 'America/Sao_Paulo' },
                    'end':   { 'dateTime': fim,    'timeZone': 'America/Sao_Paulo' },
                    'colorId': '5'
                };

                const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(evento)
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.error?.message || "Erro ao conectar com a Agenda.");

                if (result.id) {
                    await window._supabase.from('agendamentos')
                        .update({ google_event_id: result.id })
                        .eq('id', agenda.id);
                    enviados++;
                }
            } catch (errEnvio) {
                console.error("Erro ao enviar item específico:", errEnvio);
            }
        }

        if (enviados > 0) alert(`🎉 Sucesso! ${enviados} agendamentos foram enviados para o Google.`);

    } catch (erro) {
        console.error("Erro Sync:", erro);
        alert("Erro na sincronização. Certifique-se de estar logado na conta correta.");
    } finally {
        if (btn) { btn.innerHTML = iconeOriginal; btn.disabled = false; }
    }
};

async function limparAgendaGoogleDoDia(dataString) {
    const start = new Date(dataString); start.setHours(0, 0, 0, 0);
    const end   = new Date(dataString); end.setHours(23, 59, 59, 999);

    const { data: { session } } = await _supabase.auth.getSession();
    const token = session?.provider_token;
    if (!token) return alert('Conecte a agenda primeiro!');

    const resp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${start.toISOString()}&timeMax=${end.toISOString()}&singleEvents=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const lista = await resp.json();

    if (!lista.items || lista.items.length === 0) return alert('Nenhum evento encontrado neste dia.');
    if (!confirm(`Encontrei ${lista.items.length} eventos no dia ${dataString}. Apagar TODOS do Google?`)) return;

    let apagados = 0;
    for (const item of lista.items) {
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${item.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        apagados++;
        console.log('🗑️ Apagado:', item.summary);
    }
    alert(`Faxina concluída! ${apagados} eventos apagados.`);
}

// ========================================
// VERIFICAÇÃO DE LOGIN
// ========================================
(async function verificarLogin() {
    if (window.location.hash && window.location.hash.includes('type=recovery')) {
        console.log("🛑 Link de recuperação detectado! Pausando verificação de login...");
        return;
    }

    const { data: { session } } = await _supabase.auth.getSession();

    if (!session) {
        if (!window.location.href.includes('login.html')) {
            window.location.href = 'login.html';
        }
    } else {
        console.log("✅ Usuário logado:", session.user.email);
        if (window.location.href.includes('login.html')) {
            window.location.href = 'index.html';
        }
    }
})();

// ========================================
// LOGOUT
// ========================================
window.fazerLogout = async function(event) {
    if (event) event.preventDefault();
    if (!confirm("Deseja realmente desconectar e sair do sistema?")) return;

    try {
        const btn = document.querySelector('.btn-logout');
        const textoOriginal = btn ? btn.innerHTML : 'Sair';
        if (btn) { btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saindo...'; btn.disabled = true; }

        const { error } = await _supabase.auth.signOut();
        if (error) throw error;

        window.location.replace('login.html');
    } catch (err) {
        console.error("Erro ao sair:", err);
        alert("Erro ao sair: " + err.message);
        window.location.reload();
    }
};

// ========================================
// PERFIL
// ========================================

function copiarLinkPerfil() {
    const input = document.getElementById('profLink');
    input.select();
    input.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(input.value).then(() => {
        showToast("Link copiado para a área de transferência!", "success");
    });
}

async function uploadFotoPerfil(event) {
    console.log("📸 Iniciando upload...");
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        alert("A imagem é muito grande! Use uma foto com menos de 2MB.");
        return;
    }

    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return;

    const iconDiv = document.getElementById('avatarDefaultIcon');
    iconDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `avatar_${user.id}_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await _supabase.storage
            .from('avatars')
            .upload(fileName, file, { cacheControl: '3600', upsert: false });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = _supabase.storage.from('avatars').getPublicUrl(fileName);

        const { error: dbError } = await _supabase
            .from('profiles')
            .update({ foto_url: publicUrl })
            .eq('id', user.id);

        if (dbError) throw dbError;

        atualizarAvatarNaTela(publicUrl);
        alert("Foto atualizada com sucesso! ✨");
    } catch (error) {
        console.error("Erro no upload:", error);
        alert("Erro ao enviar foto: " + error.message);
        iconDiv.innerHTML = '<i class="fas fa-user"></i>';
    }
}

function atualizarAvatarNaTela(url) {
    const img  = document.getElementById('avatarPreview');
    const icon = document.getElementById('avatarDefaultIcon');
    if (url) {
        img.src = url;
        img.style.display = 'block';
        icon.style.display = 'none';
    } else {
        img.style.display = 'none';
        icon.style.display = 'flex';
    }
}

window.carregarDadosPerfil = async function() {
    console.log("🚀 Carregando Perfil Único e Link...");

    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) { alert("Usuário não logado!"); return; }

        const emailEl = document.getElementById('headerEmail');
        if (emailEl) emailEl.textContent = user.email;

        const { data: perfil } = await _supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

        if (perfil) {
            if (document.getElementById('profNome'))         document.getElementById('profNome').value         = perfil.nome           || '';
            if (document.getElementById('headerNome'))       document.getElementById('headerNome').textContent = perfil.nome           || 'Doutora';
            if (document.getElementById('profEspecialidade')) document.getElementById('profEspecialidade').value = perfil.especialidade || '';
            if (document.getElementById('profTelefone'))     document.getElementById('profTelefone').value     = perfil.telefone       || '';
            if (perfil.foto_url) atualizarAvatarNaTela(perfil.foto_url);
        }

        const urlBase  = window.location.origin + window.location.pathname.replace('index.html', '');
        const linkFinal = `${urlBase}agendar.html?ref=${user.id}`;
        const elLink   = document.getElementById('profLink');
        if (elLink) { elLink.value = linkFinal; console.log("✅ Link gerado:", linkFinal); }

        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        const divPerfil = document.getElementById('perfilPage');
        if (divPerfil) divPerfil.classList.add('active');

    } catch (err) {
        console.error("Erro crítico no perfil:", err);
    }
};

window.copiarLinkAgendamento = async function() {
    console.log("Gerando link personalizado...");
    const { data: { session } } = await _supabase.auth.getSession();
    if (!session) { alert("Erro: Você precisa estar logada para gerar o link."); return; }

    const userId   = session.user.id;
    const urlBase  = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
    const linkFinal = `${urlBase}agendar.html?ref=${userId}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(linkFinal)
            .then(() => alert('Link copiado! Envie para seu cliente:\n' + linkFinal))
            .catch(() => prompt("Copie o link manualmente:", linkFinal));
    } else {
        prompt("Copie o link manualmente:", linkFinal);
    }
};

// ========================================
// EXPORTAÇÕES GLOBAIS
// ========================================
window.navigateTo          = navigateTo;
window.fecharModal         = fecharModal;
window.showToast           = showToast;
window.formatCurrency      = formatCurrency;
window.formatDate          = formatDate;
window.formatTime          = formatTime;
window.formatDateTime      = formatDateTime;
window.formatTimeInput     = formatTimeInput;
window.formatDateInput     = formatDateInput;
window.trocarTab           = trocarTab;
window.toggleNotifications = toggleNotifications;
window.limparNotificacoes  = limparNotificacoes;
window.atualizarNotificacoes = atualizarNotificacoes;
window.carregarDadosIniciais = carregarDadosIniciais;
window.verificarStatusGoogle = verificarStatusGoogle;
window.uploadFotoPerfil    = uploadFotoPerfil;
window.atualizarAvatarNaTela = atualizarAvatarNaTela;
window.copiarLinkPerfil    = copiarLinkPerfil;
window.limparAgendaGoogleDoDia = limparAgendaGoogleDoDia;

// Stub para o HTML que chama selectCliente()
window.selectCliente = function() {
    console.log("Cliente selecionado");
};
