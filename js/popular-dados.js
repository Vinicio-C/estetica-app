// ==========================================
// POPULAR DADOS (Versão Garantida)
// ==========================================

async function popularDadosExemplo() {
    try {
        console.log('🚀 Iniciando população de dados...');
        
        // --- 1. CLIENTES ---
        let clientesData = await fetchAPI('tables/clientes?limit=100');
        let clientes = clientesData.data || [];

        if (clientes.length === 0) {
            console.log('👤 Criando clientes...');
            const novosClientes = [
                { nome: "Ana Silva", telefone: "(11) 99111-1111", email: "ana.silva@email.com" },
                { nome: "Beatriz Costa", telefone: "(21) 99222-2222", email: "bia.costa@email.com" },
                { nome: "Carla Dias", telefone: "(31) 99333-3333", email: "carla.dias@email.com" },
                { nome: "Daniela Oliveira", telefone: "(41) 99444-4444", email: "dani.oli@email.com" },
                { nome: "Eduarda Santos", telefone: "(51) 99555-5555", email: "duda.santos@email.com" }
            ];

            for (const c of novosClientes) {
                const novo = await fetchAPI('tables/clientes', {
                    method: 'POST',
                    body: JSON.stringify({ ...c, foto: '', data_cadastro: new Date().toISOString() })
                });
                clientes.push(novo);
            }
        }

        // --- 2. SERVIÇOS ---
        let servicosData = await fetchAPI('tables/servicos?limit=100');
        let servicos = servicosData.data || [];

        if (servicos.length === 0) {
            console.log('💉 Criando serviços...');
            const novosServicos = [
                { nome: "Toxina Botulínica (Testa)", tipo: "Harmonização", valor: 850.00, duracao: 30, descricao: "Aplicação superior" },
                { nome: "Preenchimento Labial", tipo: "Harmonização", valor: 1200.00, duracao: 60, descricao: "1ml de Ácido Hialurônico" },
                { nome: "Limpeza de Pele", tipo: "Estética Facial", valor: 180.00, duracao: 90, descricao: "Com extração" },
                { nome: "Peeling Químico", tipo: "Estética Facial", valor: 350.00, duracao: 45, descricao: "Renovação celular" },
                { nome: "Bioestimulador", tipo: "Injetáveis", valor: 2500.00, duracao: 60, descricao: "Rosto completo" }
            ];

            for (const s of novosServicos) {
                const novo = await fetchAPI('tables/servicos', {
                    method: 'POST',
                    body: JSON.stringify(s)
                });
                servicos.push(novo);
            }
        }

        // --- 3. ESTOQUE ---
        let estoqueData = await fetchAPI('tables/estoque?limit=100');
        if (!estoqueData.data || estoqueData.data.length === 0) {
            console.log('📦 Criando estoque...');
            const novoEstoque = [
                { nome: "Toxina Botulínica 100U", quantidade: 5, quantidade_minima: 3, valor_unitario: 450.00 },
                { nome: "Ácido Hialurônico 1ml", quantidade: 8, quantidade_minima: 5, valor_unitario: 380.00 },
                { nome: "Kit Limpeza", quantidade: 2, quantidade_minima: 1, valor_unitario: 150.00 },
                { nome: "Luvas Descartáveis", quantidade: 0, quantidade_minima: 2, valor_unitario: 40.00 }
            ];

            for (const e of novoEstoque) {
                await fetchAPI('tables/estoque', {
                    method: 'POST',
                    body: JSON.stringify(e)
                });
            }
        }

        // --- 4. AGENDAMENTOS (AQUI ESTÁ A MÁGICA) ---
        console.log('📅 Criando agendamentos...');
        
        // Verifica se já tem muitos agendamentos para não duplicar infinitamente
        let agendamentosCheck = await fetchAPI('tables/agendamentos?limit=10');
        
        // Se tiver menos de 5 agendamentos, vamos criar mais
        if (!agendamentosCheck.data || agendamentosCheck.data.length < 5) {
            
            const hoje = new Date();
            
            // Loop de -5 dias até +5 dias
            for (let i = -5; i <= 5; i++) {
                
                // Se for HOJE (i === 0), cria 3 agendamentos garantidos
                // Se for outro dia, cria apenas se cair no sorteio (50% chance)
                const deveCriar = (i === 0) || (Math.random() > 0.5);
                const qtdParaCriar = (i === 0) ? 3 : 1;

                if (deveCriar) {
                    for (let j = 0; j < qtdParaCriar; j++) {
                        const data = new Date(hoje);
                        data.setDate(data.getDate() + i);
                        // Horários: 9h, 11h, 14h...
                        data.setHours(9 + (j * 2), 0, 0, 0);

                        const cliente = clientes[Math.floor(Math.random() * clientes.length)];
                        const servico = servicos[Math.floor(Math.random() * servicos.length)];
                        
                        let status = 'agendado';
                        let statusPagamento = 'pendente';
                        
                        // Passado
                        if (i < 0) { 
                            status = 'concluido';
                            statusPagamento = Math.random() > 0.3 ? 'devendo' : 'pago';
                        }
                        
                        // HOJE (Garantir um pago para aparecer no Faturamento)
                        if (i === 0) {
                            if (j === 0) { // O primeiro de hoje já foi atendido e pago
                                status = 'concluido';
                                statusPagamento = 'pago';
                            } else {
                                status = 'agendado';
                                statusPagamento = 'pendente';
                            }
                        }

                        const agendamento = {
                            tipo: 'servico',
                            cliente_id: cliente.id,
                            cliente_nome: cliente.nome,
                            servico_id: servico.id,
                            servico_nome: servico.nome,
                            evento_nome: '',
                            data: data.toISOString(),
                            valor: servico.valor,
                            status_pagamento: statusPagamento,
                            status: status,
                            observacoes: i === 0 ? 'Agendamento de Hoje!' : 'Gerado automaticamente'
                        };

                        await fetchAPI('tables/agendamentos', {
                            method: 'POST',
                            body: JSON.stringify(agendamento)
                        });
                        console.log(`  ✅ Agendamento criado para: ${data.toLocaleDateString()}`);
                    }
                }
            }
        }
        
        console.log('✨ Tudo pronto!');
        setTimeout(() => window.location.reload(), 1500);
        
    } catch (error) {
        console.error('❌ Erro no script:', error);
        alert('Erro ao popular dados. Verifique o console.');
    }
}