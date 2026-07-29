import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@14"

serve(async (req) => {
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
    apiVersion: '2024-06-20',
  })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const signature = req.headers.get('stripe-signature')
  const body = await req.text()
  const segredo = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

  let event: Stripe.Event

  try {
    // constructEvent (síncrono) depende do crypto do Node e não funciona no
    // runtime Deno das Edge Functions — a verificação falha sempre.
    // A versão Async usa o SubtleCrypto, que existe aqui.
    event = await stripe.webhooks.constructEventAsync(body, signature ?? '', segredo)
  } catch (err) {
    // Diagnóstico sem vazar o segredo: só formato e tamanho
    console.error('Webhook signature invalida:', err.message)
    console.error('Diagnostico -> segredo definido:', segredo.length > 0,
      '| prefixo whsec_:', segredo.startsWith('whsec_'),
      '| tamanho:', segredo.length,
      '| header stripe-signature presente:', Boolean(signature))
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  console.log('Stripe event recebido:', event.type)

  try {
    switch (event.type) {
      case 'invoice.paid': {
        // Pagamento realizado — ativa o plano
        const invoice = event.data.object as any
        const dados: Record<string, string> = { plano_status: 'ativo' }
        const idAssinatura = assinaturaDaFatura(invoice)
        if (idAssinatura) dados.stripe_subscription_id = idAssinatura

        await atualizarPlanoPorCustomer(supabase, invoice.customer as string, dados)
        break
      }

      case 'invoice.payment_failed': {
        // Com boleto, a fatura "falha" no instante em que o boleto é emitido e
        // ainda não foi pago. Bloquear aqui tirava o acesso de quem acabou de
        // assinar e tem até 3 dias para pagar.
        // Quem decide a expiração é o ciclo de vida da assinatura (canceled /
        // unpaid / deleted), depois que o Stripe esgota as tentativas.
        const invoice = event.data.object as any
        console.log(`Pagamento pendente na fatura ${invoice.id} — acesso mantido, aguardando o status da assinatura`)
        break
      }

      case 'customer.subscription.deleted': {
        // Assinatura encerrada de fato — bloqueia o acesso
        const subscription = event.data.object as Stripe.Subscription
        await atualizarPlanoPorCustomer(supabase, subscription.customer as string, {
          plano_status: 'expirado',
        })
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        const status = subscription.status

        // 'incomplete' e 'past_due' são transitórios: com boleto a assinatura
        // fica assim até o pagamento compensar (até 3 dias). Expirar aqui
        // bloquearia justamente quem acabou de assinar e ainda vai pagar.
        if (status === 'incomplete' || status === 'past_due') {
          console.log(`Assinatura ${subscription.id} em "${status}" — aguardando compensação, acesso mantido`)
          break
        }

        const ativo = status === 'active' || status === 'trialing'
        await atualizarPlanoPorCustomer(supabase, customerId, {
          plano_status: ativo ? 'ativo' : 'expirado',
          stripe_subscription_id: subscription.id,
        })
        break
      }
    }
  } catch (err) {
    console.error('Erro ao processar evento Stripe:', err.message)
    return new Response(`Erro interno: ${err.message}`, { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })
})

// A partir da API 2025-03-31 o campo `invoice.subscription` saiu do topo e foi
// para `invoice.parent.subscription_details.subscription`. Este endpoint entrega
// eventos na versão 2026-04-22.dahlia, então o campo antigo vem vazio.
// Aceita os dois formatos para não depender da versão configurada no Stripe.
function assinaturaDaFatura(invoice: any): string | null {
  return invoice?.parent?.subscription_details?.subscription
      ?? invoice?.subscription
      ?? null
}

async function atualizarPlanoPorCustomer(
  supabase: ReturnType<typeof createClient>,
  customerId: string,
  dados: Record<string, string>
) {
  // Não sobrescreve plano_status se for 'vitalicio'
  const { data: perfil } = await supabase
    .from('profiles')
    .select('plano_status')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (perfil?.plano_status === 'vitalicio') {
    console.log('Plano vitalício — ignorando atualização do Stripe')
    return
  }

  const { error } = await supabase
    .from('profiles')
    .update(dados)
    .eq('stripe_customer_id', customerId)

  if (error) throw error
  console.log(`Plano atualizado para customer ${customerId}:`, dados)
}
