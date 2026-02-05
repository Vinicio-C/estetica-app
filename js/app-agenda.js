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
            
            const card = document.createElement('div');
            card.className = `agenda-card ${statusClass}`;
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
                    <div style="display: flex; gap: 5px; justify-content: flex-end;">
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
    
    const updates = [];
    
    for (let i = 0; i <= 6; i++) {
        const ativo = document.getElementById(`ativo_${i}`).checked;
        const abertura = document.getElementById(`abre_${i}`).value; // Ex: "09:00:00"
        const fechamento = document.getElementById(`fecha_${i}`).value;

        updates.push({
            dia_semana: i,
            ativo: ativo,
            abertura: abertura, // O banco aceita HH:MM
            fechamento: fechamento
        });
    }

    try {
        const { error } = await _supabase.from('disponibilidade').upsert(updates);
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