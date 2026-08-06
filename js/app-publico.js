// ========================================
// SISTEMA DE AGENDAMENTO PÚBLICO (COM IDENTIFICAÇÃO)
// ========================================

const state = {
    step: 1,
    servicoSelecionado: null,
    dataSelecionada: null,
    horaSelecionada: null,
    clienteIdentificado: null,
    doutoraId: null
};

const CONFIG = { inicio: 9, fim: 19 }; 

let _enderecoCompleto = '';
let _mapsUrl = '';

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const refId = params.get('ref');
    if (refId) {
        state.doutoraId = refId;
        console.log("Agendando para:", refId);
        carregarPerfilProfissional();
    }
    carregarServicos();
    
    // Data mínima: Hoje
    const today = new Date().toISOString().split('T')[0];
    const elDate = document.getElementById('dateInput');
    if(elDate) elDate.min = today;
    
    const form = document.getElementById('formClientePublico');
    if(form) form.addEventListener('submit', finalizarAgendamento);
});

function changeStep(step) {
    document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
    document.getElementById(`step${step}`).classList.add('active');
    state.step = step;
}

// --- 1. SERVIÇOS ---
async function carregarServicos() {
    const container = document.getElementById('listaServicos');
    if(!container) return;
    
    try {
        // Via RPC: o anônimo não tem mais leitura direta das tabelas
        const { data, error } = await _supabase
            .rpc('agenda_servicos_publicos', { p_user_id: state.doutoraId });
        if (error) throw error;

        container.innerHTML = '';
        data.forEach(servico => {
            const card = document.createElement('div');
            card.className = 'service-card';
            card.innerHTML = `
                <div class="srv-info">
                    <h3>${servico.nome}</h3>
                    <p>${servico.duracao} min</p>
                </div>
                <div class="srv-price">R$ ${servico.valor.toFixed(2)}</div>
            `;
            card.onclick = () => selecionarServico(servico);
            container.appendChild(card);
        });
    } catch (err) {
        console.error(err);
        container.innerHTML = '<p style="color: #ef5350">Erro ao carregar serviços.</p>';
    }
}

function selecionarServico(servico) {
    state.servicoSelecionado = servico;
    changeStep(2);
}

async function carregarHorariosDisponiveis() {
    const dateInput = document.getElementById('dateInput');
    const container = document.getElementById('horariosGrid');
    
    if (!dateInput.value) return;
    state.dataSelecionada = dateInput.value;
    
    container.innerHTML = '<p class="hint">Verificando agenda...</p>';

    try {
        // --- A LINHA QUE FALTOU ESTÁ AQUI EMBAIXO 👇 ---
        const dataObj = new Date(state.dataSelecionada + 'T12:00:00');
        const diaSemana = dataObj.getDay(); // 0 = Domingo, 1 = Segunda...
        // ------------------------------------------------

        // 1. Busca regra de horário (Filtrando pela Doutora)
        const { data: regras, error: errRegra } = await _supabase
            .rpc('agenda_disponibilidade_publica', {
                p_user_id: state.doutoraId,
                p_dia_semana: diaSemana
            });

        if (errRegra) throw errRegra;
        const regra = regras && regras[0];

        // Se não tiver regra ou estiver fechado (ativo = false)
        if (!regra || !regra.ativo) {
            container.innerHTML = '<div class="fechado-msg"><i class="fas fa-store-slash"></i><br>Não atendemos neste dia.</div>';
            return;
        }

        // 2. Busca agendamentos ocupados com duração (Filtrando pela Doutora).
        // A RPC devolve só hora e duração — quem visita não vê de quem é o horário.
        const { data: ocupados, error: errOcup } = await _supabase
            .rpc('agenda_horarios_ocupados', {
                p_user_id: state.doutoraId,
                p_data: state.dataSelecionada
            });
        if (errOcup) throw errOcup;

        // Duração do serviço que o cliente está selecionando
        const duracaoServico = state.servicoSelecionado?.duracao || 60;

        // Converte "HH:MM" ou "HH:MM:SS" para minutos desde meia-noite
        const toMinutos = (h) => {
            const p = h.split(':');
            return parseInt(p[0]) * 60 + parseInt(p[1]);
        };

        // 3. Gera os botões
        const inicioHora = parseInt(regra.abertura.split(':')[0]);
        const fimHora = parseInt(regra.fechamento.split(':')[0]);

        container.innerHTML = '';

        for (let h = inicioHora; h < fimHora; h++) {
            const horaFormatada = `${h.toString().padStart(2, '0')}:00`;
            const slotInicio = toMinutos(horaFormatada);
            const slotFim = slotInicio + duracaoServico;

            // Bloqueia se o slot ultrapassar o horário de fechamento
            const fechamentoMin = fimHora * 60;
            if (slotFim > fechamentoMin) {
                break;
            }

            // Verifica sobreposição com qualquer agendamento existente
            const ocupado = ocupados.some(a => {
                const existInicio = toMinutos(a.hora);
                const existFim = existInicio + (a.duracao || 60);
                return slotInicio < existFim && existInicio < slotFim;
            });

            const btn = document.createElement('div');
            btn.className = 'time-btn';
            btn.textContent = horaFormatada;

            if (ocupado) {
                btn.classList.add('disabled');
            } else {
                btn.onclick = () => selecionarHorario(horaFormatada, btn);
            }
            container.appendChild(btn);
        }

        if (container.children.length === 0) {
            container.innerHTML = '<p>Agenda cheia para hoje.</p>';
        }

    } catch (err) {
        console.error("Erro Agenda:", err);
        container.innerHTML = '<p style="color:red">Erro ao carregar horários.</p>';
    }
}

function selecionarHorario(hora, elemento) {
    document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('selected'));
    elemento.classList.add('selected');
    state.horaSelecionada = hora;
    
    // Resumo
    document.getElementById('resumoServico').textContent = state.servicoSelecionado.nome;
    const [ano, mes, dia] = state.dataSelecionada.split('-');
    document.getElementById('resumoData').textContent = `${dia}/${mes}/${ano}`;
    document.getElementById('resumoHora').textContent = hora;
    document.getElementById('resumoValor').textContent = 'R$ ' + state.servicoSelecionado.valor.toFixed(2);

    setTimeout(() => changeStep(3), 300);
}

// --- 3. IDENTIFICAÇÃO INTELIGENTE (NOVO) ---
async function verificarEmail() {
    const emailInput = document.getElementById('clienteEmail');
    const feedback = document.getElementById('emailFeedback');
    const email = emailInput.value.trim().toLowerCase();

    if (!email || !email.includes('@')) {
        feedback.textContent = '';
        return;
    }

    feedback.style.color = '#888';
    feedback.textContent = 'Verificando cadastro...';

    try {
        // Busca cliente por email, apenas entre as clientes desta profissional
        const { data: achados, error } = await _supabase
            .rpc('agenda_buscar_cliente', {
                p_user_id: state.doutoraId,
                p_email: email
            });

        if (error) throw error;
        const data = achados && achados[0];

        if (data) {
            // ENCONTROU! Preenche os dados
            state.clienteIdentificado = data;
            document.getElementById('clienteIdExistente').value = data.id;
            
            document.getElementById('clienteNome').value = data.nome || '';
            document.getElementById('clienteTelefone').value = data.telefone || '';
            document.getElementById('clienteCpf').value = data.cpf || '';
            document.getElementById('clienteNascimento').value = data.data_nascimento || '';

            feedback.style.color = '#4CAF50'; // Verde
            feedback.innerHTML = `<i class="fas fa-check-circle"></i> Olá de volta, ${data.nome.split(' ')[0]}!`;
        } else {
            // NÃO ENCONTROU (Novo Cliente)
            state.clienteIdentificado = null;
            document.getElementById('clienteIdExistente').value = '';
            // Não limpa os campos para não apagar o que ela já digitou se errou o email
            
            feedback.style.color = '#D4AF37'; // Dourado
            feedback.textContent = 'Primeiro acesso? Preencha seus dados abaixo.';
        }
    } catch (err) {
        console.error("Erro verificação:", err);
        feedback.textContent = '';
    }
}
// Exporta para o HTML usar no onblur
window.verificarEmail = verificarEmail;


// --- 4. FINALIZAR ---
async function finalizarAgendamento(e) {
    e.preventDefault();
    const btn = document.querySelector('.btn-confirmar');
    btn.disabled = true;
    btn.textContent = "PROCESSANDO...";

    // Coleta dados do form
    const nome = document.getElementById('clienteNome').value.trim();
    const email = document.getElementById('clienteEmail').value.trim().toLowerCase();
    const telefone = document.getElementById('clienteTelefone').value.trim();
    const cpf = document.getElementById('clienteCpf').value.trim();
    const nascimento = document.getElementById('clienteNascimento').value;
    
    try {
        if (!state.servicoSelecionado) throw new Error("Serviço inválido.");

        // Cadastro da cliente e agendamento são feitos numa única chamada no
        // servidor. O valor e a duração vêm do cadastro do serviço, e não daqui —
        // e o anônimo não precisa mais de acesso direto às tabelas.
        const { error: erroAgenda } = await _supabase.rpc('agenda_criar_agendamento', {
            p_user_id:    state.doutoraId,
            p_servico_id: state.servicoSelecionado.id,
            p_data:       state.dataSelecionada,
            p_hora:       state.horaSelecionada,
            p_nome:       nome,
            p_telefone:   telefone,
            p_email:      email || null,
            p_cpf:        cpf || null,
            p_nascimento: nascimento || null
        });

        if (erroAgenda) throw erroAgenda;

        // B2. Avisa a profissional por email. Sem await e com catch próprio:
        // se o email falhar, o agendamento já está salvo e a cliente não pode
        // ver erro nenhum por causa disso.
        _supabase.functions.invoke('notificar-agendamento', {
            body: {
                user_id: state.doutoraId,
                data: state.dataSelecionada,
                hora: state.horaSelecionada,
            }
        }).catch(err => console.warn('Falha ao avisar a profissional:', err));

        // C. Sucesso
        document.getElementById('nomeSucesso').textContent = nome;
        document.getElementById('servicoSucesso').textContent = state.servicoSelecionado.nome;
        const [a, m, d] = state.dataSelecionada.split('-');
        document.getElementById('dataSucesso').textContent = `${d}/${m}/${a}`;
        document.getElementById('horaSucesso').textContent = state.horaSelecionada;
        
        changeStep('Success');

    } catch (err) {
        console.error("Erro:", err);
        alert('Erro ao agendar: ' + err.message);
        btn.disabled = false;
        btn.textContent = "CONFIRMAR AGENDAMENTO";
    }
}

// --- 5. LOCALIZAÇÃO DA PROFISSIONAL ---
async function carregarPerfilProfissional() {
    try {
        // RPC devolve só os campos públicos — nunca zapi_token ou dados do Stripe
        const { data: perfis } = await _supabase
            .rpc('agenda_perfil_publico', { p_user_id: state.doutoraId });

        const perfil = perfis && perfis[0];

        if (perfil) {
            if (perfil.nome) {
                const h1 = document.getElementById('headerNomeProfissional');
                if (h1) h1.textContent = perfil.nome;
            }
            if (perfil.especialidade) {
                const sub = document.getElementById('headerEspecialidade');
                if (sub) sub.textContent = perfil.especialidade;
            }
            renderizarCardLocalizacao(perfil);
        }
    } catch (e) {
        console.error("Erro ao carregar perfil público:", e);
    }
}

function renderizarCardLocalizacao(perfil) {
    if (!perfil.endereco) return;

    const partes = [
        perfil.endereco,
        perfil.numero,
        perfil.complemento,
        perfil.bairro ? `– ${perfil.bairro}` : null,
        perfil.cidade ? `${perfil.cidade}` : null,
        perfil.estado ? `– ${perfil.estado}` : null,
        perfil.cep ? `| CEP ${perfil.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2')}` : null
    ].filter(Boolean).join(' ');

    _enderecoCompleto = partes;
    _mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(partes)}`;

    const texto = document.getElementById('locEnderecoTexto');
    const card = document.getElementById('cardLocalizacao');
    const mapaContainer = document.getElementById('mapaPublicoContainer');
    const mapaIframe = document.getElementById('mapaPublicoIframe');

    if (texto) texto.textContent = partes;
    if (card) card.style.display = 'block';

    if (mapaIframe && mapaContainer) {
        const query = encodeURIComponent(partes);
        mapaIframe.src = `https://maps.google.com/maps?q=${query}&output=embed`;
        mapaContainer.style.display = 'block';
    }
}

window.abrirMaps = function() {
    if (_mapsUrl) window.open(_mapsUrl, '_blank');
};

window.copiarEndereco = async function() {
    if (!_enderecoCompleto) return;
    try {
        await navigator.clipboard.writeText(_enderecoCompleto);
        const btn = document.getElementById('btnCopiarEndereco');
        if (btn) {
            const original = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> Copiado!';
            btn.style.background = '#D4AF37';
            btn.style.color = '#121212';
            setTimeout(() => {
                btn.innerHTML = original;
                btn.style.background = 'transparent';
                btn.style.color = '#D4AF37';
            }, 2000);
        }
    } catch (e) {
        prompt('Copie o endereço abaixo:', _enderecoCompleto);
    }
};

// --- 6. FUNÇÃO PARA NOVO AGENDAMENTO (Mantendo o ID) ---
window.novoAgendamento = function() {
    if (state.doutoraId) {
        // Força o recarregamento da página INCLUINDO o ID da doutora na URL
        const novaUrl = window.location.pathname + '?ref=' + state.doutoraId;
        window.location.href = novaUrl;
    } else {
        // Se não tiver ID (caso raro), apenas recarrega
        window.location.reload();
    }
};