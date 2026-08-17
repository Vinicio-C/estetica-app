// ============================================================================
// financeiro-core.js — funções puras compartilhadas por relatórios, financeiro
// e dashboard. Sem DOM, sem Supabase: dá para testar isolado.
// ============================================================================

// ─── DATAS ──────────────────────────────────────────────────────────────────
//
// O app grava data como texto "YYYY-MM-DD". `new Date("2026-08-01")` é
// interpretado como UTC pela especificação; no fuso do Brasil (UTC-3) isso vira
// 31/07 às 21h, então getMonth() devolve julho. Resultado: agendamentos do dia 1
// caem no mês anterior nos relatórios.
//
// O espelho do problema é `new Date().toISOString()`, que devolve a data em UTC:
// depois das 21h ela já é a de amanhã. Era isso que fazia a auto-conclusão
// finalizar os atendimentos do dia e baixar o estoque antes da hora.

/**
 * `instanceof Date` é falso para Date vindo de outro contexto de execução
 * (iframe, worker, vm de teste). toString da própria Object é confiável sempre.
 */
function ehData(v) {
    return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime());
}

/**
 * Converte "YYYY-MM-DD" (ou ISO completo) em Date na meia-noite LOCAL.
 * Use sempre que for comparar mês/ano/dia de uma data vinda do banco.
 */
window.parseDataLocal = function(valor) {
    if (!valor) return null;
    if (ehData(valor)) return valor;

    const texto = String(valor).trim();
    const m = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
        // Construtor com componentes = horário local, sem conversão de fuso
        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }

    const d = new Date(texto);
    return isNaN(d) ? null : d;
};

/** Data de hoje como "YYYY-MM-DD" no fuso local (nunca use toISOString para isso). */
window.hojeISO = function() {
    return window.dataParaISO(new Date());
};

/** Date -> "YYYY-MM-DD" usando os componentes locais. */
window.dataParaISO = function(d) {
    if (!ehData(d)) return '';
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
};

/** Primeiro e último dia do mês (0-11) como "YYYY-MM-DD". */
window.intervaloDoMes = function(mes, ano) {
    return {
        inicio: window.dataParaISO(new Date(ano, mes, 1)),
        fim: window.dataParaISO(new Date(ano, mes + 1, 0))
    };
};

/** true se a data (texto do banco) cai no mês/ano informados. */
window.ehDoMes = function(valor, mes, ano) {
    const d = window.parseDataLocal(valor);
    return !!d && d.getMonth() === mes && d.getFullYear() === ano;
};

// ─── MENSAGENS AUTOMÁTICAS ──────────────────────────────────────────────────
//
// A troca de {nome}/{data}/{hora}/{servico} estava copiada em quatro lugares
// (WhatsApp manual, WhatsApp automático, e-mail e envio em lote da agenda) e as
// cópias já tinham divergido: uma mandava a data crua do banco, "2026-08-20",
// direto para a cliente. Uma variável nova precisava ser adicionada nos quatro.
// Agora é aqui, e só aqui.

/** "2026-08-20" ou "20/08/2026" -> "20/08/2026". Aceita já formatado. */
function _dataBR(valor) {
    if (!valor) return '';
    const texto = String(valor).trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) return texto;
    const d = window.parseDataLocal(texto);
    if (!d) return texto;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** "14:30:00" -> "14:30". */
function _horaBR(valor) {
    return valor ? String(valor).trim().slice(0, 5) : '';
}

/**
 * Preenche o template da profissional com os dados do agendamento.
 *
 * `valor` sem preço vira "a combinar" em vez de "R$ 0,00": mandar zero para a
 * cliente parece cobrança errada, e string vazia deixa a linha "Valor:" pendurada.
 */
window.montarMensagem = function(template, dados) {
    const d = dados || {};

    const precoNumero = Number(d.valor);
    const preco = (d.valor === null || d.valor === undefined || d.valor === '' || isNaN(precoNumero) || precoNumero <= 0)
        ? 'a combinar'
        : precoNumero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    return String(template || '')
        .replace(/{nome}/g, String(d.nome || 'Cliente').trim().split(' ')[0])
        .replace(/{data}/g, _dataBR(d.data))
        .replace(/{hora}/g, _horaBR(d.hora))
        .replace(/{servico}/g, d.servico || 'Atendimento')
        .replace(/{valor}/g, preco);
};

// Textos padrão, usados enquanto a profissional não salva os dela.
// Ficam aqui porque app-agenda.js carrega ANTES de app.js e também precisa deles.
window.MENSAGEM_PADRAO_ZAP = `Olá {nome}! ✨\n\nPassando para confirmar o seu horário conosco.\n\n🗓 *Quando:* {data} às {hora}\n📌 *Procedimento:* {servico}\n💰 *Valor:* {valor}\n\nPodemos confirmar sua presença? ✅`;
window.EMAIL_PADRAO_ASSUNTO = "Seu agendamento está confirmado! ✨";
window.EMAIL_PADRAO_CORPO = "Olá {nome},\n\nSeu agendamento para o procedimento {servico} foi confirmado com sucesso!\n\nTe esperamos no dia {data} às {hora}.\nValor do procedimento: {valor}.\n\nAtenciosamente,\nEquipe Agendamento Premium";

/** "20/08/2026 às 14:30" -> { data, hora }. Formato usado nas telas antigas. */
window.separarDataHoraBr = function(texto) {
    const partes = String(texto || '').split(' às ');
    return { data: partes[0] || '', hora: partes[1] || '' };
};
