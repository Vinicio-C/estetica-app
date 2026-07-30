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

function dataBR(iso: string) {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso)
}

function horaBR(hora: string) {
  return String(hora).slice(0, 5) // "14:30:00" -> "14:30"
}

function esc(v: unknown) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id, data, hora } = await req.json()
    if (!user_id || !data || !hora) throw new Error('Dados incompletos')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Esta função é pública (a página de agendamento não tem login), então nada
    // do que o navegador manda é usado no email. Confirmamos no banco que existe
    // mesmo um agendamento recém-criado com esses dados e montamos o aviso a
    // partir do que está gravado. Sem isso, o endpoint viraria um gatilho de
    // spam para a caixa de entrada da profissional.
    const limite = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    const { data: agendamento } = await supabase
      .from('agendamentos')
      .select('cliente_nome, servico_nome, data, hora, valor, cliente_id, observacoes')
      .eq('user_id', user_id)
      .eq('data', data)
      .eq('hora', hora)
      .gte('created_at', limite)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!agendamento) {
      return json({ ignorado: 'nenhum agendamento recente com esses dados' })
    }

    const { data: perfil } = await supabase
      .from('profiles')
      .select('nome, notificar_novo_agendamento')
      .eq('id', user_id)
      .maybeSingle()

    if (perfil?.notificar_novo_agendamento === false) {
      return json({ ignorado: 'notificacao desativada no perfil' })
    }

    const { data: userRes } = await supabase.auth.admin.getUserById(user_id)
    const emailDoutora = userRes?.user?.email
    if (!emailDoutora) throw new Error('Profissional sem email cadastrado')

    // Contato da cliente, para a profissional conseguir responder direto
    let telefoneCliente = ''
    let emailCliente = ''
    if (agendamento.cliente_id) {
      const { data: cliente } = await supabase
        .from('clientes')
        .select('telefone, email')
        .eq('id', agendamento.cliente_id)
        .maybeSingle()
      telefoneCliente = cliente?.telefone ?? ''
      emailCliente = cliente?.email ?? ''
    }

    const quando = `${dataBR(agendamento.data)} às ${horaBR(agendamento.hora)}`
    const valor = agendamento.valor
      ? Number(agendamento.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : null

    const linha = (rotulo: string, valor: string) => valor
      ? `<tr>
           <td style="padding:8px 14px 8px 0; color:#666; font-size:14px; white-space:nowrap; vertical-align:top;">${rotulo}</td>
           <td style="padding:8px 0; color:#111; font-size:15px; font-weight:600;">${esc(valor)}</td>
         </tr>`
      : ''

    const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif; background:#f5f5f5; padding:28px 16px;">
  <div style="max-width:520px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; border:1px solid #e5e5e5;">
    <div style="background:#111; padding:22px 26px;">
      <div style="color:#D4AF37; font-size:12px; letter-spacing:1.5px; text-transform:uppercase;">Novo agendamento</div>
      <div style="color:#fff; font-size:20px; font-weight:700; margin-top:5px;">${esc(agendamento.cliente_nome)}</div>
    </div>
    <div style="padding:24px 26px;">
      <p style="margin:0 0 18px; color:#333; font-size:15px; line-height:1.55;">
        ${perfil?.nome ? `Olá, ${esc(perfil.nome)}! ` : ''}Uma cliente acabou de agendar pela sua página de agendamento.
      </p>
      <table style="border-collapse:collapse; width:100%;">
        ${linha('Cliente', agendamento.cliente_nome)}
        ${linha('Serviço', agendamento.servico_nome)}
        ${linha('Quando', quando)}
        ${valor ? linha('Valor', valor) : ''}
        ${linha('Telefone', telefoneCliente)}
        ${linha('E-mail', emailCliente)}
      </table>
      <p style="margin:22px 0 0; padding-top:16px; border-top:1px solid #eee; color:#888; font-size:13px; line-height:1.5;">
        O agendamento entrou como <strong>pendente</strong>. Confirme pelo app para reservar o horário na sua agenda.
      </p>
    </div>
  </div>
  <p style="max-width:520px; margin:14px auto 0; color:#999; font-size:12px; text-align:center;">
    Estética Premium · para desativar estes avisos, acesse Perfil no aplicativo
  </p>
</div>`.trim()

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      },
      body: JSON.stringify({
        from: 'Estética Premium <contato@esteticaapp.com.br>',
        to: [emailDoutora],
        // Responder o email fala direto com a cliente
        ...(emailCliente ? { reply_to: emailCliente } : {}),
        subject: `Novo agendamento: ${agendamento.cliente_nome} — ${quando}`,
        html,
      }),
    })

    const resultado = await res.json()
    if (!res.ok) {
      console.error('Resend recusou o envio:', resultado)
      return json({ error: 'Falha ao enviar email', detalhe: resultado }, 502)
    }

    console.log(`Aviso de agendamento enviado para ${emailDoutora}`)
    return json({ enviado: true, id: resultado?.id ?? null })

  } catch (error) {
    console.error('Erro ao notificar agendamento:', error.message)
    return json({ error: error.message }, 400)
  }
})
