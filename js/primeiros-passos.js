// js/primeiros-passos.js — roteiro de configuração inicial no dashboard.
//
// Motivo de existir: quem se cadastra entra num app zerado. Sem serviço e sem
// horário de atendimento o link público não funciona — abre e mostra tela vazia
// para a cliente dela. Nada na interface dizia isso, então a profissional podia
// divulgar um link quebrado sem saber.
//
// O bloco some sozinho quando os passos essenciais estão feitos, e pode ser
// dispensado à mão. Não usa fetchAPI de propósito: ele engole erro e devolve
// lista vazia, o que aqui viraria "faça isso de novo" para quem já fez.

const _PP_DISPENSADO = (uid) => `primeiros_passos_ok_${uid}`;

async function carregarPrimeirosPassos() {
    const bloco = document.getElementById('primeirosPassos');
    if (!bloco) return;

    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) return;

        if (localStorage.getItem(_PP_DISPENSADO(user.id))) return;

        // head + count: conta sem trazer as linhas
        const conta = (tabela, filtro) => {
            let q = _supabase.from(tabela).select('id', { count: 'exact', head: true });
            if (filtro) q = filtro(q);
            return q;
        };

        const [servicos, horarios, clientes, perfil] = await Promise.all([
            conta('servicos'),
            conta('disponibilidade', q => q.eq('ativo', true)),
            conta('clientes'),
            _supabase.from('profiles').select('telefone, especialidade').eq('id', user.id).maybeSingle()
        ]);

        // Erro de rede ou policy: melhor não mostrar nada do que mostrar errado
        if (servicos.error || horarios.error) return;

        const temServico  = (servicos.count || 0) > 0;
        const temHorario  = (horarios.count || 0) > 0;
        const temCliente  = (clientes.count || 0) > 0;
        const p = perfil.data || {};
        const temPerfil   = !!(p.telefone && p.especialidade);

        const passos = [
            {
                feito: temServico,
                titulo: 'Cadastre seus serviços',
                texto: 'Nome, preço e duração de cada procedimento.',
                icone: 'fa-spa',
                acao: () => navigateTo('servicos'),
                rotulo: 'Cadastrar serviço',
                essencial: true
            },
            {
                feito: temHorario,
                titulo: 'Defina seus horários de atendimento',
                texto: 'Sem isso, sua página de agendamento não mostra horário nenhum.',
                icone: 'fa-clock',
                acao: () => navigateTo('perfil'),
                rotulo: 'Definir horários',
                essencial: true
            },
            {
                feito: temPerfil,
                titulo: 'Complete seu perfil',
                texto: 'Telefone e especialidade aparecem para suas clientes.',
                icone: 'fa-user',
                acao: () => navigateTo('perfil'),
                rotulo: 'Completar perfil'
            },
            {
                feito: temCliente,
                titulo: 'Cadastre sua primeira cliente',
                texto: 'Ou espere a primeira agendar sozinha pelo seu link.',
                icone: 'fa-users',
                acao: () => navigateTo('clientes'),
                rotulo: 'Cadastrar cliente'
            }
        ];

        // Tudo essencial resolvido: o bloco cumpriu a função e sai da frente
        if (passos.filter(x => x.essencial).every(x => x.feito)) {
            localStorage.setItem(_PP_DISPENSADO(user.id), '1');
            bloco.style.display = 'none';
            return;
        }

        const prontos = passos.filter(x => x.feito).length;
        document.getElementById('ppBarra').style.width =
            Math.round((prontos / passos.length) * 100) + '%';
        document.getElementById('ppSubtitulo').textContent =
            `${prontos} de ${passos.length} concluídos — o link de agendamento só funciona com serviço e horário.`;

        document.getElementById('ppLista').innerHTML = passos.map((x, i) => `
            <div class="pp-item ${x.feito ? 'pp-feito' : ''}">
                <div class="pp-check">
                    <i class="fas ${x.feito ? 'fa-check' : x.icone}"></i>
                </div>
                <div class="pp-texto">
                    <strong>${x.titulo}</strong>
                    <span>${x.texto}</span>
                </div>
                ${x.feito
                    ? '<span class="pp-ok">Feito</span>'
                    : `<button class="pp-btn" data-passo="${i}">${x.rotulo}</button>`}
            </div>
        `).join('');

        document.getElementById('ppLista').querySelectorAll('.pp-btn').forEach(btn => {
            btn.onclick = () => passos[Number(btn.dataset.passo)].acao();
        });

        bloco.style.display = 'block';
    } catch (e) {
        console.warn('Primeiros passos:', e);
    }
}

function dispensarPrimeirosPassos() {
    const bloco = document.getElementById('primeirosPassos');
    if (bloco) bloco.style.display = 'none';
    _supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) localStorage.setItem(_PP_DISPENSADO(user.id), '1');
    });
}

window.carregarPrimeirosPassos = carregarPrimeirosPassos;
window.dispensarPrimeirosPassos = dispensarPrimeirosPassos;

document.addEventListener('DOMContentLoaded', () => {
    // Espera o app terminar o boot para não competir por conexão
    setTimeout(carregarPrimeirosPassos, 1200);
});
