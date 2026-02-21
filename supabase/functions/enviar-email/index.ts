import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Configuração de CORS para permitir que seu front-end acesse
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Responde ao 'preflight' do navegador (Evita aquele erro de bloqueio vermelho)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Pega os dados que o app.js vai mandar
    const { para, reply_to, assunto, corpo } = await req.json()

    // Dispara para o Resend usando a chave secreta que vamos salvar no Supabase
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`
      },
      body: JSON.stringify({
        from: 'Estética Premium <contato@esteticaapp.com.br>',
        to: [para],
        reply_to: reply_to, // Respostas vão pra doutora
        subject: assunto,
        html: `<p style="white-space: pre-wrap; font-family: sans-serif; color: #333; line-height: 1.6;">${corpo}</p>`
      })
    })

    const data = await res.json()
    return new Response(JSON.stringify(data), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 400 
    })
  }
})