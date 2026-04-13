// ========================================
// LÓGICA DA AGENDA (COM INDICADORES VISUAIS)
// ========================================

let currentDate = new Date();

document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('calendarGrid')) {
        renderCalendar();
        hoje(); 
    }
});

// --- 1. RENDERIZA O CALENDÁRIO ---
async function renderCalendar() {
    const monthYear = document.getElementById('calendarMonthYear');
    const grid = document.getElementById('calendarGrid');
    
    if (!grid) return;

    grid.innerHTML = '';

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthNames = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
    monthYear.textContent = `${monthNames[month]} ${year}`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const prevLastDay = new Date(year, month, 0).getDate();
    const lastDayIndex = new Date(year, month + 1, 0).getDay();
    const nextDays = 7 - lastDayIndex - 1;

    // Dias do mês anterior
    for (let x = firstDayIndex; x > 0; x--) {
        const day = document.createElement('div');
        day.classList.add('cal-day', 'empty');
        day.textContent = prevLastDay - x + 1;
        grid.appendChild(day);
    }

    // Dias do mês atual
    for (let i = 1; i <= lastDay; i++) {
        const day = document.createElement('div');
        day.classList.add('cal-day');
        day.textContent = i;
        
        // ETIQUETA IMPORTANTE: Guarda a data exata no elemento (YYYY-MM-DD)
        // Isso ajuda a achar o dia para colocar a bolinha depois
        const diaFmt = String(i).padStart(2, '0');
        const mesFmt = String(month + 1).padStart(2, '0');
        const dataFull = `${year}-${mesFmt}-${diaFmt}`;
        day.setAttribute('data-date', dataFull);

        const hoje = new Date();
        if (i === hoje.getDate() && month === hoje.getMonth() && year === hoje.getFullYear()) {
            day.classList.add('today');
        }

        day.onclick = () => {
            document.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'));
            day.classList.add('selected');
            const selectedDate = new Date(year, month, i);
            carregarAgendaDoDia(selectedDate);
        };

        grid.appendChild(day);
    }

    // Dias do próximo mês
    for (let j = 1; j <= nextDays; j++) {
        const day = document.createElement('div');
        day.classList.add('cal-day', 'empty');
        day.textContent = j;
        grid.appendChild(day);
    }

    // --- A MÁGICA: Busca os eventos e desenha as bolinhas ---
    await marcarDiasComEventos(year, month);
}

// --- FUNÇÃO NOVA: Busca quais dias têm evento ---
async function marcarDiasComEventos(ano, mes) {
    // Calcula primeiro e último dia do mês para filtrar no banco
    const primeiroDia = `${ano}-${String(mes + 1).padStart(2, '0')}-01`;
    const ultimoDia = `${ano}-${String(mes + 1).padStart(2, '0')}-${new Date(ano, mes + 1, 0).getDate()}`;

    try {
        // Busca APENAS as datas ocupadas (leve e rápido)
        const { data, error } = await _supabase
            .from('agendamentos')
            .select('data')
            .gte('data', primeiroDia)
            .lte('data', ultimoDia)
            .neq('status', 'cancelado');

        if (error) throw error;

        // Se tiver eventos, coloca a bolinha
        if (data && data.length > 0) {
            // Remove duplicados (se tiver 2 eventos no dia 12, só precisa de 1 bolinha)
            const diasOcupados = [...new Set(data.map(item => item.data))];

            diasOcupados.forEach(dataOcupada => {
                // Procura a div que tem essa data
                const el = document.querySelector(`.cal-day[data-date="${dataOcupada}"]`);
                if (el) {
                    // Adiciona a bolinha se ainda não tiver
                    if (!el.querySelector('.event-dot')) {
                        const dot = document.createElement('div');
                        dot.className = 'event-dot';
                        el.appendChild(dot);
                    }
                }
            });
        }
    } catch (err) {
        console.error("Erro ao carregar bolinhas:", err);
    }
}

function mudarMes(direction) {
    currentDate.setMonth(currentDate.getMonth() + direction);
    renderCalendar();
}

function hoje() {
    currentDate = new Date();
    renderCalendar();
    
    // Auto-seleciona hoje visualmente
    setTimeout(() => {
        const diaHoje = String(currentDate.getDate()).padStart(2, '0');
        const mesHoje = String(currentDate.getMonth() + 1).padStart(2, '0');
        const anoHoje = currentDate.getFullYear();
        const dataHojeStr = `${anoHoje}-${mesHoje}-${diaHoje}`;
        
        const el = document.querySelector(`.cal-day[data-date="${dataHojeStr}"]`);
        if(el) el.classList.add('selected');
        
        carregarAgendaDoDia(currentDate);
    }, 100);
}

// --- LISTA DE AGENDAMENTOS (MANTIDA IGUAL, SÓ TRAZENDO PRA CÁ PRA NÃO QUEBRAR) ---
async function carregarAgendaDoDia(dataObj) {
    const container = document.getElementById('agendaContainer');
    const displayData = document.getElementById('dataSelecionadaTexto');
    if(!container) return;

    const dia = String(dataObj.getDate()).padStart(2, '0');
    const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
    const ano = dataObj.getFullYear();
    const dataFormatadaBr = `${dia}/${mes}/${ano}`;
    const dataSQL = `${ano}-${mes}-${dia}`;
    
    if(displayData) displayData.textContent = dataFormatadaBr;

    container.innerHTML = '<div class="loading">Carregando agenda...</div>';

    try {
        const { data, error } = await _supabase
            .from('agendamentos')
            .select('*')
            .eq('data', dataSQL)
            .neq('status', 'cancelado')
            .order('hora');

        if (error) throw error;

        container.innerHTML = '';

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: #666;">
                    <i class="far fa-calendar" style="font-size: 2rem; opacity: 0.5; margin-bottom: 10px;"></i>
                    <p>Agenda livre neste dia.</p>
                </div>`;
            return;
        }

        data.forEach(item => {
            const nomeCliente = item.cliente_nome || 'Cliente sem nome';
            let titulo = item.servico_nome || item.evento_nome || 'Agendamento';
            
            const valor = item.valor ? `R$ ${parseFloat(item.valor).toFixed(2)}` : '-';
            const obs = item.observacoes || '';
            const horaFormatada = item.hora ? item.hora.slice(0, 5) : '--:--';

            let statusClass = '';
            if (item.status_pagamento === 'pago') statusClass = 'status-concluido';
            
            // --- PEGA O TELEFONE DO CLIENTE NO ESTADO GLOBAL ---
            const clienteRef = appState.clientes.find(c => String(c.id) == String(item.cliente_id));
            const telefoneParaZap = clienteRef ? clienteRef.telefone : '';
            const dataHoraParaZap = `${dataFormatadaBr} às ${horaFormatada}`;
            
            // Badge de lembrete enviado (persiste via localStorage)
            const storageKeyCard = `zap_sent_${item.id}_${dataSQL}`;
            const jaEnviadoCard = !!localStorage.getItem(storageKeyCard);
            const badgeCardHtml = jaEnviadoCard
                ? `<span class="badge-lembrete-enviado"><i class="fas fa-check"></i> Enviado</span>`
                : '';

            const card = document.createElement('div');
            card.className = `agenda-card ${statusClass}`;
            card.id = `agenda-card-${item.id}`;
            card.innerHTML = `
                <div class="time-column">
                    <span class="time-hour">${horaFormatada}</span>
                    <i class="far fa-clock time-icon"></i>
                </div>
                <div class="info-column">
                    <div class="service-title">${titulo}</div>
                    <div class="client-name"><i class="far fa-user"></i> ${nomeCliente}</div>
                    <div style="font-size: 0.85em; color: #888; margin-top: 5px;">${obs}</div>
                </div>
                <div class="action-column">
                    <span class="price-tag">${valor}</span>
                    ${badgeCardHtml}
                    <div style="display: flex; gap: 5px; justify-content: flex-end;">
                        <button class="icon-btn-small" style="background: #25D366; color: white; border: none; font-size: 1rem;" onclick="dispararLembreteAgenda('${item.id}', '${telefoneParaZap}', '${nomeCliente.replace(/'/g, "\\'")}', '${dataHoraParaZap}', '${titulo.replace(/'/g, "\\'")}', '${dataSQL}')" title="Confirmar pelo Zap">
                            <i class="fab fa-whatsapp"></i>
                        </button>
                        <button class="icon-btn-small edit" onclick="abrirModalAgendamento('${item.id}')"><i class="fas fa-pencil-alt"></i></button>
                        <button class="icon-btn-small delete" onclick="cancelarAgendamento('${item.id}')"><i class="fas fa-times"></i></button>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = '<div style="color: var(--error); padding: 20px;">Erro ao carregar agenda.</div>';
    }
}

// Funções globais necessárias
window.hoje = hoje;
window.carregarAgendaDoDia = carregarAgendaDoDia;

// --- LEMBRETE INDIVIDUAL VIA CARD DA AGENDA ---
window.dispararLembreteAgenda = async function(agendamentoId, telefone, nome, dataHoraBr, procedimento, dataSQL) {
    await window.dispararWhatsAppManual(telefone, nome, dataHoraBr, procedimento);

    const storageKey = `zap_sent_${agendamentoId}_${dataSQL}`;
    localStorage.setItem(storageKey, '1');

    // Atualiza badge no card da agenda
    const card = document.getElementById(`agenda-card-${agendamentoId}`);
    if (card) {
        const actionCol = card.querySelector('.action-column');
        if (actionCol && !actionCol.querySelector('.badge-lembrete-enviado')) {
            const badge = document.createElement('span');
            badge.className = 'badge-lembrete-enviado';
            badge.innerHTML = '<i class="fas fa-check"></i> Enviado';
            // Insere antes dos botões de ação
            const btnGroup = actionCol.querySelector('div');
            actionCol.insertBefore(badge, btnGroup);
        }
    }

    // Atualiza badge no card do dashboard, se estiver visível
    const dashRow = document.getElementById(`lembrete-row-${agendamentoId}`);
    if (dashRow) {
        const actionDiv = dashRow.querySelector('.dash-item-action');
        if (actionDiv && !actionDiv.querySelector('.badge-lembrete-enviado')) {
            const badge = document.createElement('span');
            badge.className = 'badge-lembrete-enviado';
            badge.innerHTML = '<i class="fas fa-check"></i> Enviado';
            actionDiv.insertBefore(badge, actionDiv.firstChild);
        }
    }
};

// --- ENVIAR LEMBRETES PARA TODOS OS CLIENTES DA DATA SELECIONADA ---
window.enviarLembretesTodos = async function() {
    const displayEl = document.getElementById('dataSelecionadaTexto');
    const dataExibida = displayEl ? displayEl.textContent.trim() : '';

    if (!dataExibida || dataExibida === '-') {
        if (typeof showToast === 'function') showToast('Selecione uma data na agenda primeiro.', 'warning');
        return;
    }

    // Converte DD/MM/YYYY → YYYY-MM-DD
    const partes = dataExibida.split('/');
    if (partes.length !== 3) return;
    const [dia, mes, ano] = partes;
    const dataSQL = `${ano}-${mes}-${dia}`;

    // Filtra agendamentos da data que ainda não receberam lembrete
    const pendentes = (appState.agendamentos || []).filter(a => {
        if (a.data !== dataSQL || a.status === 'cancelado') return false;
        return !localStorage.getItem(`zap_sent_${a.id}_${dataSQL}`);
    });

    if (pendentes.length === 0) {
        if (typeof showToast === 'function') showToast('Todos os lembretes desta data já foram enviados!', 'success');
        return;
    }

    const confirmou = confirm(
        `Enviar WhatsApp para ${pendentes.length} cliente(s)?\n\nO navegador abrirá uma janela por cliente com uma pequena pausa entre elas.`
    );
    if (!confirmou) return;

    // Busca template da profissional uma única vez
    let textoBase = `Olá {nome}! ✨\n\nPassando para confirmar o seu horário conosco.\n\n🗓 *Quando:* {data} às {hora}\n📌 *Procedimento:* {servico}\n\nPodemos confirmar sua presença? ✅`;
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (user) {
            const { data: perfil } = await _supabase
                .from('profiles')
                .select('mensagem_whatsapp')
                .eq('id', user.id)
                .maybeSingle();
            if (perfil && perfil.mensagem_whatsapp) textoBase = perfil.mensagem_whatsapp;
        }
    } catch (e) { /* usa template padrão */ }

    // Desabilita botão durante envio
    const btnEnviar = document.getElementById('btnEnviarTodosZap');
    if (btnEnviar) {
        btnEnviar.disabled = true;
        btnEnviar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    }

    const DELAY_MS = 1200;

    for (let i = 0; i < pendentes.length; i++) {
        const a = pendentes[i];
        const clienteRef = (appState.clientes || []).find(c => String(c.id) === String(a.cliente_id));
        const telefone = clienteRef ? (clienteRef.telefone || '') : '';

        if (!telefone) {
            if (typeof showToast === 'function') showToast(`${a.cliente_nome || 'Cliente'}: sem telefone, pulando.`, 'warning');
            continue;
        }

        let numLimpo = String(telefone).replace(/\D/g, '');
        if (numLimpo.startsWith('0')) numLimpo = numLimpo.substring(1);
        if (!numLimpo.startsWith('55')) numLimpo = `55${numLimpo}`;
        if (numLimpo.length < 12 || numLimpo.length > 13) {
            if (typeof showToast === 'function') showToast(`${a.cliente_nome || 'Cliente'}: telefone inválido, pulando.`, 'warning');
            continue;
        }

        const horaFmt = a.hora ? a.hora.slice(0, 5) : '';
        const dataFmtBr = `${dia}/${mes}/${ano}`;
        const primeiroNome = (a.cliente_nome || 'Cliente').split(' ')[0];

        const textoFinal = textoBase
            .replace(/{nome}/g, primeiroNome)
            .replace(/{data}/g, dataFmtBr)
            .replace(/{hora}/g, horaFmt)
            .replace(/{servico}/g, a.servico_nome || 'Atendimento');

        window.open(
            `https://api.whatsapp.com/send?phone=${numLimpo}&text=${encodeURIComponent(textoFinal)}`,
            '_blank'
        );

        // Marca localStorage e atualiza badges
        const storageKey = `zap_sent_${a.id}_${dataSQL}`;
        localStorage.setItem(storageKey, '1');

        const card = document.getElementById(`agenda-card-${a.id}`);
        if (card) {
            const actionCol = card.querySelector('.action-column');
            if (actionCol && !actionCol.querySelector('.badge-lembrete-enviado')) {
                const badge = document.createElement('span');
                badge.className = 'badge-lembrete-enviado';
                badge.innerHTML = '<i class="fas fa-check"></i> Enviado';
                const btnGroup = actionCol.querySelector('div');
                actionCol.insertBefore(badge, btnGroup);
            }
        }

        // Aguarda antes do próximo (exceto no último)
        if (i < pendentes.length - 1) {
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
    }

    if (btnEnviar) {
        btnEnviar.disabled = false;
        btnEnviar.innerHTML = '<i class="fab fa-whatsapp"></i> Enviar Todos';
    }

    if (typeof showToast === 'function') showToast('Lembretes enviados!', 'success');
};

const nomesDias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

async function abrirModalHorarios() {
    const modal = document.getElementById('modalHorarios');
    const container = document.getElementById('listaDiasSemana');
    
    modal.classList.add('active');
    document.getElementById('overlay').classList.add('active');

    try {
        // Busca configuração atual
        const { data, error } = await _supabase
            .from('disponibilidade')
            .select('*')
            .order('dia_semana');

        if (error) throw error;

        container.innerHTML = '';

        // Cria uma linha para cada dia (0 a 6)
        data.forEach(dia => {
            const nomeDia = nomesDias[dia.dia_semana];
            
            // Só deixa editar hora se estiver "Ativo"
            const disabled = !dia.ativo ? 'disabled' : '';
            const styleOpacity = !dia.ativo ? 'opacity: 0.5;' : '';

            container.innerHTML += `
                <div class="dia-config-row" style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #333; ${styleOpacity}">
                    <div style="width: 100px;">
                        <label class="switch-label" style="font-weight: bold; color: var(--gold);">
                            ${nomeDia}
                        </label>
                    </div>
                    
                    <label class="switch">
                        <input type="checkbox" id="ativo_${dia.dia_semana}" ${dia.ativo ? 'checked' : ''} onchange="toggleDia(${dia.dia_semana})">
                        <span class="slider round"></span>
                    </label>

                    <input type="time" id="abre_${dia.dia_semana}" value="${dia.abertura}" ${disabled} class="time-input-small">
                    <span style="color:#666">até</span>
                    <input type="time" id="fecha_${dia.dia_semana}" value="${dia.fechamento}" ${disabled} class="time-input-small">
                </div>
            `;
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = '<p style="color:red">Erro ao carregar configurações.</p>';
    }
}

// Ativa/Desativa os inputs quando clica no switch
window.toggleDia = function(diaIndex) {
    const check = document.getElementById(`ativo_${diaIndex}`);
    const row = check.closest('.dia-config-row');
    const inputs = row.querySelectorAll('input[type="time"]');
    
    if (check.checked) {
        row.style.opacity = '1';
        inputs.forEach(i => i.disabled = false);
    } else {
        row.style.opacity = '0.5';
        inputs.forEach(i => i.disabled = true);
    }
};

// Salvar no Banco
document.getElementById('formHorarios').addEventListener('submit', async (e) => {
    e.preventDefault();

    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) { showToast('Sessão expirada. Faça login novamente.', 'error'); return; }

    const updates = [];

    for (let i = 0; i <= 6; i++) {
        const ativo = document.getElementById(`ativo_${i}`).checked;
        const abertura = document.getElementById(`abre_${i}`).value;
        const fechamento = document.getElementById(`fecha_${i}`).value;

        updates.push({
            user_id: user.id,
            dia_semana: i,
            ativo: ativo,
            abertura: abertura,
            fechamento: fechamento
        });
    }

    try {
        const { error } = await _supabase.from('disponibilidade').upsert(updates, { onConflict: 'user_id,dia_semana' });
        if (error) throw error;
        
        showToast('Horários atualizados com sucesso!', 'success');
        fecharModal('modalHorarios');
    } catch (err) {
        console.error(err);
        showToast('Erro ao salvar horários.', 'error');
    }
});

// Exporta globalmente para o botão funcionar
window.abrirModalHorarios = abrirModalHorarios;

// ==============================================================
// 🕒 GESTOR DE HORÁRIOS E BLOQUEIOS FIXOS (ACADEMIA, ALMOÇO)
// ==============================================================

// Molde padrão para quando a doutora abrir a primeira vez
window.diasSemanaPadrao = [
    { dia: 1, nome: 'Segunda-feira', ativo: true, inicio: '08:00', fim: '18:00', bloqueios: [] },
    { dia: 2, nome: 'Terça-feira', ativo: true, inicio: '08:00', fim: '18:00', bloqueios: [] },
    { dia: 3, nome: 'Quarta-feira', ativo: true, inicio: '08:00', fim: '18:00', bloqueios: [] },
    { dia: 4, nome: 'Quinta-feira', ativo: true, inicio: '08:00', fim: '18:00', bloqueios: [] },
    { dia: 5, nome: 'Sexta-feira', ativo: true, inicio: '08:00', fim: '18:00', bloqueios: [] },
    { dia: 6, nome: 'Sábado', ativo: false, inicio: '08:00', fim: '12:00', bloqueios: [] },
    { dia: 0, nome: 'Domingo', ativo: false, inicio: '08:00', fim: '12:00', bloqueios: [] }
];

// Variável que guarda o que está na tela
window.configHorariosAtual = [];

window.abrirModalHorarios = async function() {
    const modal = document.getElementById('modalHorarios');
    const container = document.getElementById('listaDiasSemana');
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--gold);"><i class="fas fa-spinner fa-spin"></i> Carregando seus horários...</div>';

    modal.classList.add('active');
    document.getElementById('overlay').classList.add('active');

    try {
        const { data: { user } } = await _supabase.auth.getUser();
        
        // Busca a configuração salva no banco
        const { data: perfil } = await _supabase.from('profiles').select('horarios_config').eq('id', user.id).single();

        if (perfil && perfil.horarios_config) {
            configHorariosAtual = perfil.horarios_config;
        } else {
            // Se nunca configurou, usa o molde padrão
            configHorariosAtual = JSON.parse(JSON.stringify(diasSemanaPadrao));
        }

        renderizarConfigHorarios();
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p style="color:#ff4444; text-align:center;">Erro ao carregar horários.</p>';
    }
};

window.renderizarConfigHorarios = function() {
    const container = document.getElementById('listaDiasSemana');
    
    container.innerHTML = configHorariosAtual.map((dia, index) => `
        <div style="background: #1a1a1a; border: 1px solid ${dia.ativo ? '#D4AF37' : '#333'}; border-radius: 8px; padding: 15px; margin-bottom: 15px; transition: all 0.3s;">
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: ${dia.ativo ? '15px' : '0'};">
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; color: ${dia.ativo ? '#fff' : '#666'}; font-weight: bold; font-size: 1.1rem;">
                    <input type="checkbox" ${dia.ativo ? 'checked' : ''} onchange="toggleDiaAtivo(${index}, this.checked)" style="width: 18px; height: 18px; accent-color: var(--gold);">
                    ${dia.nome}
                </label>
                ${!dia.ativo ? '<span style="color: #666; font-size: 0.8rem;">Folga</span>' : ''}
            </div>
            
            ${dia.ativo ? `
                <div style="display: flex; gap: 15px; align-items: center; margin-bottom: 15px; background: #222; padding: 10px; border-radius: 6px;">
                    <div style="flex: 1;">
                        <label style="font-size: 0.8rem; color: #888; display: block; margin-bottom: 5px;">Início do Expediente</label>
                        <input type="time" value="${dia.inicio}" onchange="atualizarHoraDia(${index}, 'inicio', this.value)" style="width: 100%; background: #111; color: #fff; border: 1px solid #444; padding: 8px; border-radius: 4px;">
                    </div>
                    <div style="flex: 1;">
                        <label style="font-size: 0.8rem; color: #888; display: block; margin-bottom: 5px;">Fim do Expediente</label>
                        <input type="time" value="${dia.fim}" onchange="atualizarHoraDia(${index}, 'fim', this.value)" style="width: 100%; background: #111; color: #fff; border: 1px solid #444; padding: 8px; border-radius: 4px;">
                    </div>
                </div>
                
                <div style="background: #222; padding: 10px; border-radius: 6px; border-left: 3px solid #E91E63;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <span style="font-size: 0.85rem; color: #aaa;"><i class="fas fa-lock" style="color: #E91E63;"></i> Bloqueios / Pausas Fixas</span>
                        <button type="button" onclick="adicionarBloqueio(${index})" style="background: transparent; border: 1px solid #E91E63; color: #E91E63; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">+ Adicionar</button>
                    </div>
                    
                    ${dia.bloqueios.length === 0 ? '<p style="color: #555; font-size: 0.8rem; margin: 0; text-align: center;">Nenhuma pausa neste dia.</p>' : ''}
                    
                    ${dia.bloqueios.map((b, bIndex) => `
                        <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px; background: #111; padding: 8px; border-radius: 4px; border: 1px solid #333;">
                            <input type="text" placeholder="Ex: Academia, Almoço..." value="${b.titulo || ''}" onchange="atualizarBloqueio(${index}, ${bIndex}, 'titulo', this.value)" style="flex: 2; background: transparent; border: none; color: #fff; border-bottom: 1px solid #444; font-size: 0.9rem;" title="Motivo do Bloqueio">
                            
                            <input type="time" value="${b.inicio}" onchange="atualizarBloqueio(${index}, ${bIndex}, 'inicio', this.value)" style="background: #222; border: 1px solid #444; color: #fff; padding: 5px; border-radius: 4px; font-size: 0.85rem;">
                            <span style="color: #666;">às</span>
                            <input type="time" value="${b.fim}" onchange="atualizarBloqueio(${index}, ${bIndex}, 'fim', this.value)" style="background: #222; border: 1px solid #444; color: #fff; padding: 5px; border-radius: 4px; font-size: 0.85rem;">
                            
                            <button type="button" onclick="removerBloqueio(${index}, ${bIndex})" style="background: transparent; border: none; color: #ff4444; cursor: pointer; padding: 5px;" title="Remover Pausa">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `).join('');
};

// Funções Auxiliares para manipular os dados na tela
window.toggleDiaAtivo = (index, valor) => { configHorariosAtual[index].ativo = valor; renderizarConfigHorarios(); };
window.atualizarHoraDia = (index, campo, valor) => { configHorariosAtual[index][campo] = valor; };
window.adicionarBloqueio = (index) => { 
    if(!configHorariosAtual[index].bloqueios) configHorariosAtual[index].bloqueios = [];
    // Adiciona um molde padrão (ex: horário de almoço)
    configHorariosAtual[index].bloqueios.push({ titulo: 'Academia', inicio: '12:00', fim: '13:00' }); 
    renderizarConfigHorarios(); 
};
window.atualizarBloqueio = (diaIndex, bIndex, campo, valor) => { configHorariosAtual[diaIndex].bloqueios[bIndex][campo] = valor; };
window.removerBloqueio = (diaIndex, bIndex) => { configHorariosAtual[diaIndex].bloqueios.splice(bIndex, 1); renderizarConfigHorarios(); };

// Salvar no Banco de Dados
window.salvarHorariosConfig = async function(event) {
    event.preventDefault();
    const btn = document.querySelector('#formHorarios button[type="submit"]');
    const txtOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    btn.disabled = true;

    try {
        const { data: { user } } = await _supabase.auth.getUser();
        
        // Salva a configuração inteira no formato JSON na coluna "horarios_config"
        const { error } = await _supabase
            .from('profiles')
            .update({ horarios_config: configHorariosAtual })
            .eq('id', user.id);
        
        if (error) throw error;
        
        if(typeof showToast === 'function') showToast("Horários atualizados com sucesso! ✨", "success");
        else alert("Horários atualizados!");
        
        fecharModal('modalHorarios');
        
        // Se a doutora estiver na página da agenda, recarrega para aplicar as novas regras
        if (typeof carregarAgendaDoDia === 'function' && document.getElementById('dataSelecionadaTexto')) {
            const strData = document.getElementById('dataSelecionadaTexto').textContent;
            if (strData && strData !== '-') {
                const [dia, mes, ano] = strData.split('/');
                carregarAgendaDoDia(new Date(ano, mes - 1, dia));
            }
        }

    } catch (err) {
        console.error(err);
        alert("Erro ao salvar: " + err.message);
    } finally {
        btn.innerHTML = txtOriginal;
        btn.disabled = false;
    }
};