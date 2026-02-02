// js/supabase-client.js

// ⚠️ SUBSTITUA PELAS SUAS CHAVES DO SUPABASE
const SUPABASE_URL = 'https://frnwbcvcaacraliropsw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZybndiY3ZjYWFjcmFsaXJvcHN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NDA5NzcsImV4cCI6MjA4NTIxNjk3N30.PmGVlSwl4KOSDezFRB8I_5IcsFTineYjE-vjF5G6Ce4';

// 1. Inicializa o cliente
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('☁️ Conector Supabase Ativo!');

// 2. Sobrescreve a função fetchAPI global do app
window.fetchAPI = async function(endpoint, options = {}) {
    // Proteção contra chamadas vazias
    if (!endpoint) return { data: [] };

    const parts = endpoint.split('/');
    if (!parts[1]) return { data: [] }; 

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

        // --- CORREÇÃO AQUI ---
        // Se der erro no Supabase, não trava o app (throw), apenas avisa e retorna vazio
        if (error) {
            console.warn(`⚠️ Erro Supabase em ${table}:`, error.message);
            // Retorna estrutura vazia para não quebrar o .map() ou .filter() do app.js
            return { data: [] };
        }
        
        return data;

    } catch (err) {
        // --- CORREÇÃO CRÍTICA ---
        // Se a internet cair ou o código falhar, retorna vazio em vez de travar o loading
        console.error('❌ Erro Fatal na API:', err);
        return { data: [] }; 
    }
};