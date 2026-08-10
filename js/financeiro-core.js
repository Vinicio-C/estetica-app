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
