import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })

function esc(v: unknown) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // A função agora exige JWT no gateway (verify_jwt), mas revalidamos aqui
    // para saber QUEM está enviando — é isso que permite limitar o destinatário.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Não autorizado' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: erroUser } = await supabase.auth.getUser(token)
    if (erroUser || !user) return json({ error: 'Sessão inválida' }, 401)

    const { para, assunto, corpo } = await req.json()
    if (!para || !assunto || !corpo) return json({ error: 'Dados incompletos' }, 400)

    // O destinatário precisa ser uma cliente desta profissional.
    // Sem essa checagem, qualquer pessoa com uma conta no app consegue enviar
    // email para qualquer endereço assinado com o nosso domínio. Um único caso
    // de phishing derruba a reputação de esteticaapp.com.br no Resend, e leva
    // junto os emails de confirmação de cadastro e de recuperação de senha.
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id')
      .eq('user_id', user.id)
      .ilike('email', String(para).trim())
      .limit(1)
      .maybeSingle()

    if (!cliente) {
      console.warn(`Usuário ${user.id} tentou enviar para "${para}", que não é cliente dele`)
      return json({ error: 'O destinatário precisa ser uma cliente sua' }, 403)
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      },
      body: JSON.stringify({
        from: 'Estética Premium <contato@esteticaapp.com.br>',
        to: [para],
        // Sempre a profissional autenticada, nunca um valor vindo do navegador
        reply_to: user.email,
        subject: String(assunto).slice(0, 200),
        // O corpo vem de um template editável no perfil. Escapamos para o email
        // não virar veículo de HTML ou link arbitrário saindo do nosso domínio.
        html: `<p style="white-space: pre-wrap; font-family: sans-serif; color: #333; line-height: 1.6;">${esc(corpo)}</p>`,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error('Resend recusou o envio:', data)
      return json({ error: 'Falha ao enviar email', detalhe: data }, 502)
    }

    return json(data)

  } catch (error) {
    console.error('Erro em enviar-email:', error.message)
    return json({ error: error.message }, 400)
  }
})
