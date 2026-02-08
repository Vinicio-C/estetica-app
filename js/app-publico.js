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

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const refId = params.get('ref');
    if (refId) {
        state.doutoraId = refId;
        console.log("Agendando para:", refId);
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
        let query = _supabase.from('servicos').select('*').order('nome');
        if (state.doutoraId) {
            query = query.eq('user_id', state.doutoraId);
        }

        const { data, error } = await query;
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
        let queryRegra = _supabase
            .from('disponibilidade')
            .select('*')
            .eq('dia_semana', diaSemana); // Usa a variável diaSemana aqui

        if (state.doutoraId) {
            queryRegra = queryRegra.eq('user_id', state.doutoraId);
        }

        // Usa maybeSingle para não dar erro se não achar regra
        const { data: regra, error: errRegra } = await queryRegra.maybeSingle();

        if (errRegra) throw errRegra;

        // Se não tiver regra ou estiver fechado (ativo = false)
        if (!regra || !regra.ativo) {
            container.innerHTML = '<div class="fechado-msg"><i class="fas fa-store-slash"></i><br>Não atendemos neste dia.</div>';
            return;
        }

        // 2. Busca agendamentos ocupados (Filtrando pela Doutora)
        let queryOcup = _supabase
            .from('agendamentos')
            .select('hora')
            .eq('data', state.dataSelecionada)
            .neq('status', 'cancelado');

        if (state.doutoraId) {
            queryOcup = queryOcup.eq('user_id', state.doutoraId);
        }

        const { data: ocupados, error: errOcup } = await queryOcup;
        if (errOcup) throw errOcup;
        
        const horariosOcupados = ocupados.map(a => a.hora.slice(0, 5));

        // 3. Gera os botões
        const inicioHora = parseInt(regra.abertura.split(':')[0]); 
        const fimHora = parseInt(regra.fechamento.split(':')[0]); 

        container.innerHTML = '';
        
        for (let h = inicioHora; h < fimHora; h++) {
            const horaFormatada = `${h.toString().padStart(2, '0')}:00`;
            const btn = document.createElement('div');
            btn.className = 'time-btn';
            btn.textContent = horaFormatada;

            if (horariosOcupados.includes(horaFormatada)) {
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
        // Busca cliente por email
        const { data, error } = await _supabase
            .from('clientes')
            .select('*')
            .eq('email', email)
            .maybeSingle();

        if (error) throw error;

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
    
    // Verifica se já temos um ID vindo da verificação de email
    let clienteId = document.getElementById('clienteIdExistente').value;

    try {
        if (!state.servicoSelecionado) throw new Error("Serviço inválido.");

        // A. Gestão do Cliente
        if (clienteId) {
            // Cliente JÁ EXISTE: Atualiza os dados (caso ela tenha mudado o telefone)
            await _supabase.from('clientes').update({ 
                telefone, nome, cpf, data_nascimento: nascimento || null 
            }).eq('id', clienteId);
        } else {
            // Cliente NOVO: Cria do zero
            // Tenta buscar por telefone antes, só por segurança
            const { data: clienteTel } = await _supabase
                .from('clientes').select('id').eq('telefone', telefone).maybeSingle();

            if (clienteTel) {
                clienteId = clienteTel.id;
                // Atualiza com o novo email
                await _supabase.from('clientes').update({ email, nome, cpf, data_nascimento: nascimento || null }).eq('id', clienteId);
            } else {
                const { data: novo, error: errCriar } = await _supabase
                    .from('clientes')
                    .insert({ 
                        nome, email, telefone, cpf, 
                        data_nascimento: nascimento || null,
                        user_id: state.doutoraId // <--- IMPORTANTE
                    })
                    .select().single();
                
                if (errCriar) throw errCriar;
                clienteId = novo.id;
            }
        }

        // B. Cria o Agendamento
        const payload = {
            cliente_id: clienteId,
            servico_id: state.servicoSelecionado.id,
            user_id: state.doutoraId,
            
            // Dados Textuais (Backup)
            cliente_nome: nome,
            servico_nome: state.servicoSelecionado.nome,
            tipo: 'servico',
            
            // Financeiro
            valor: state.servicoSelecionado.valor,
            status: 'pendente',
            status_pagamento: 'pendente',
            
            // Agenda
            data: state.dataSelecionada,
            hora: state.horaSelecionada,
            observacoes: 'Agendamento pelo Site'
        };

        const { error: erroAgenda } = await _supabase.from('agendamentos').insert(payload);
        if (erroAgenda) throw erroAgenda;

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