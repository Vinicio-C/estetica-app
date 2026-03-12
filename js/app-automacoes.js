// ========================================
// APP-AUTOMACOES.JS — WhatsApp, E-mail, Templates
// ========================================

async function carregarAutomacoes() {
    console.log("⚙️ Carregando Automações...");
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return;

        const { data: perfil } = await _supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

        const padraoZap     = `Olá {nome}! ✨\n\nVocê tem um agendamento marcado.\n\n🗓 *Quando:* {data} às {hora}\n💆‍♀️ *Procedimento:* {servico}\n\nPodemos confirmar sua presença? 😘`;
        const padraoAssunto = "Seu agendamento está confirmado! ✨";
        const padraoCorpo   = "Olá {nome},\n\nSeu agendamento para o procedimento {servico} foi confirmado com sucesso!\n\nTe esperamos no dia {data} às {hora}.\n\nAtenciosamente,\nEquipe Agendamento Premium";

        const elZap = document.getElementById('textoAutomacaoZap');
        if (elZap) elZap.value = (perfil && perfil.mensagem_whatsapp) ? perfil.mensagem_whatsapp : padraoZap;

        const elAssunto = document.getElementById('textoAssuntoEmail');
        if (elAssunto) elAssunto.value = (perfil && perfil.email_assunto) ? perfil.email_assunto : padraoAssunto;

        const elCorpo = document.getElementById('textoCorpoEmail');
        if (elCorpo) elCorpo.value = (perfil && perfil.email_corpo) ? perfil.email_corpo : padraoCorpo;

        const elToggle = document.getElementById('emailAtivoToggle');
        if (elToggle) elToggle.checked = (perfil && perfil.email_ativo === true);

    } catch (err) {
        console.error("Erro ao carregar automações:", err);
    }
}

async function salvarAutomacoes(btnElement) {
    const textoNovo = document.getElementById('textoAutomacaoZap').value;
    const textoBotaoOriginal = btnElement.innerHTML;
    btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    btnElement.disabled = true;

    try {
        const { data: { user } } = await _supabase.auth.getUser();
        const { error } = await _supabase.from('profiles').upsert({ id: user.id, mensagem_whatsapp: textoNovo });
        if (error) throw error;
        showToast("Mensagem do WhatsApp salva!", "success");
    } catch (err) {
        console.error(err);
        alert("Erro ao salvar mensagem.");
    } finally {
        btnElement.innerHTML = textoBotaoOriginal;
        btnElement.disabled = false;
    }
}

async function salvarAutomacoesEmail(btnElement) {
    const assunto = document.getElementById('textoAssuntoEmail').value;
    const corpo   = document.getElementById('textoCorpoEmail').value;
    const ativo   = document.getElementById('emailAtivoToggle').checked;

    const textoBotaoOriginal = btnElement.innerHTML;
    btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    btnElement.disabled = true;

    try {
        const { data: { user } } = await _supabase.auth.getUser();
        const { error } = await _supabase.from('profiles').upsert({
            id: user.id, email_assunto: assunto, email_corpo: corpo, email_ativo: ativo
        });
        if (error) throw error;
        showToast("Configurações de e-mail atualizadas!", "success");
    } catch (err) {
        console.error(err);
        alert("Erro ao salvar e-mail.");
    } finally {
        btnElement.innerHTML = textoBotaoOriginal;
        btnElement.disabled = false;
    }
}

function inserirVariavel(variavel) {
    const textarea = document.getElementById('textoAutomacaoZap');
    if (!textarea) return;
    const inicio = textarea.selectionStart;
    const fim    = textarea.selectionEnd;
    const texto  = textarea.value;
    textarea.value = texto.substring(0, inicio) + variavel + texto.substring(fim);
    textarea.focus();
    textarea.selectionEnd = inicio + variavel.length;
}

window.dispararWhatsAppManual = async function(telefone, nome, dataHoraBr, procedimento) {
    if (!telefone || String(telefone).trim() === '') return alert('Cliente sem telefone cadastrado.');

    let numLimpo = String(telefone).replace(/\D/g, '');
    if (numLimpo.startsWith('0')) numLimpo = numLimpo.substring(1);
    if (!numLimpo.startsWith('55')) numLimpo = `55${numLimpo}`;
    if (numLimpo.length < 12 || numLimpo.length > 13) return alert('O telefone deste cliente está incorreto.');

    const partes     = dataHoraBr.split(' às ');
    const dataApenas = partes[0] || '';
    const horaApenas = partes[1] || '';

    let textoBase = `Olá {nome}! ✨\n\nVocê tem um agendamento marcado.\n\n🗓 *Quando:* {data} às {hora}\n💆‍♀️ *Procedimento:* {servico}\n\nPodemos confirmar sua presença? 😘`;
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        const { data: perfil } = await _supabase.from('profiles').select('mensagem_whatsapp').eq('id', user.id).maybeSingle();
        if (perfil && perfil.mensagem_whatsapp) textoBase = perfil.mensagem_whatsapp;
    } catch (e) { console.warn("Usando mensagem padrão."); }

    const textoFinal = textoBase
        .replace(/{nome}/g,    (nome || 'Cliente').split(' ')[0])
        .replace(/{data}/g,    dataApenas)
        .replace(/{hora}/g,    horaApenas)
        .replace(/{servico}/g, procedimento || 'Atendimento');

    window.open(`https://api.whatsapp.com/send?phone=${numLimpo}&text=${encodeURIComponent(textoFinal)}`, '_blank');
};

window.dispararEmailAutomatico = async function(emailCliente, nomeCliente, dataHoraBr, procedimento) {
    if (!emailCliente || !emailCliente.includes('@')) return;
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        const { data: perfil } = await _supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
        if (!perfil || perfil.email_ativo !== true) return;

        const partes     = dataHoraBr.split(' às ');
        const dataApenas = partes[0] || '';
        const horaApenas = partes[1] || '';

        const padraoAssunto = "Seu agendamento está confirmado! ✨";
        const padraoCorpo   = "Olá {nome},\n\nSeu agendamento para o procedimento {servico} foi confirmado com sucesso!\n\nTe esperamos no dia {data} às {hora}.\n\nAtenciosamente,\nEquipe Agendamento Premium";

        const assuntoFinal = (perfil.email_assunto || padraoAssunto)
            .replace(/{nome}/g,    nomeCliente.split(' ')[0])
            .replace(/{data}/g,    dataApenas)
            .replace(/{hora}/g,    horaApenas)
            .replace(/{servico}/g, procedimento);

        const corpoFinal = (perfil.email_corpo || padraoCorpo)
            .replace(/{nome}/g,    nomeCliente.split(' ')[0])
            .replace(/{data}/g,    dataApenas)
            .replace(/{hora}/g,    horaApenas)
            .replace(/{servico}/g, procedimento);

        const { error } = await _supabase.functions.invoke('enviar-email', {
            body: { para: emailCliente, reply_to: user.email, assunto: assuntoFinal, corpo: corpoFinal }
        });

        if (error) console.error("Erro ao chamar Edge Function:", error);
        else       console.log("✅ E-mail enviado com sucesso!");

    } catch (error) {
        console.error("Erro interno no e-mail:", error);
    }
};

// ========================================
// EXPORTAÇÕES GLOBAIS
// ========================================
window.carregarAutomacoes    = carregarAutomacoes;
window.salvarAutomacoes      = salvarAutomacoes;
window.salvarAutomacoesEmail = salvarAutomacoesEmail;
window.inserirVariavel       = inserirVariavel;
