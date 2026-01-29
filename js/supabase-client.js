// js/supabase-client.js

// ⚠️ SUBSTITUA PELAS SUAS CHAVES DO SUPABASE
const SUPABASE_URL = 'https://frnwbcvcaacraliropsw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZybndiY3ZjYWFjcmFsaXJvcHN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NDA5NzcsImV4cCI6MjA4NTIxNjk3N30.PmGVlSwl4KOSDezFRB8I_5IcsFTineYjE-vjF5G6Ce4';

// 1. Inicializa o cliente com um nome diferente (_supabase) para não dar erro
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('☁️ Conector Supabase Ativo!');

// 2. Sobrescreve a função fetchAPI global do app
window.fetchAPI = async function(endpoint, options = {}) {
    // endpoint ex: "tables/clientes?limit=1000"
    
    // Proteção contra chamadas vazias
    if (!endpoint) return;

    const parts = endpoint.split('/');
    // parts[1] seria "clientes?limit..." ou "clientes"
    // parts[2] seria o ID (se houver)

    if (!parts[1]) return; 

    let tableStr = parts[1];
    let id = parts[2];
    
    // Limpar query params (remove ?limit=1000)
    const table = tableStr.split('?')[0];

    const method = options.method || 'GET';
    let data, error;

    console.log(`☁️ Supabase Request: [${method}] ${table} ${id || ''}`);

    try {
        if (method === 'GET') {
            if (id) {
                // Buscar UM
                const response = await _supabase.from(table).select('*').eq('id', id).single();
                data = response.data;
                error = response.error;
            } else {
                // Buscar TODOS
                const response = await _supabase.from(table).select('*');
                // O app espera { data: [...] }
                data = { data: response.data || [] };
                error = response.error;
            }
        } 
        else if (method === 'POST') {
            // Criar
            const body = JSON.parse(options.body);
            // Removemos o ID para o Supabase gerar o UUID automático
            if (!body.id || body.id === '') delete body.id; 
            
            const response = await _supabase.from(table).insert([body]).select().single();
            data = response.data;
            error = response.error;
        } 
        else if (method === 'PUT' || method === 'PATCH') {
            // Atualizar
            const body = JSON.parse(options.body);
            const response = await _supabase.from(table).update(body).eq('id', id).select().single();
            data = response.data;
            error = response.error;
        } 
        else if (method === 'DELETE') {
            // Deletar
            const response = await _supabase.from(table).delete().eq('id', id);
            data = { success: true }; 
            error = response.error;
        }

        if (error) {
            console.error('Supabase Error Detail:', error);
            throw error;
        }
        
        return data;

    } catch (err) {
        console.error('Erro na conexão Supabase:', err);
        throw err;
    }
};