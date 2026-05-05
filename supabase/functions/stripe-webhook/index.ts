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

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature ?? '',
      Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
    )
  } catch (err) {
    console.error('Webhook signature invalida:', err.message)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  console.log('Stripe event recebido:', event.type)

  try {
    switch (event.type) {
      case 'invoice.paid': {
        // Pagamento realizado — ativa o plano
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        await atualizarPlanoPorCustomer(supabase, customerId, {
          plano_status: 'ativo',
          stripe_subscription_id: invoice.subscription as string,
        })
        break
      }

      case 'customer.subscription.deleted':
      case 'invoice.payment_failed': {
        // Assinatura cancelada ou pagamento falhou — bloqueia o acesso
        const obj = event.data.object as Stripe.Subscription | Stripe.Invoice
        const customerId = (obj as any).customer as string

        await atualizarPlanoPorCustomer(supabase, customerId, {
          plano_status: 'expirado',
        })
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        // Se a assinatura foi pausada ou o status não é mais ativo
        const novoStatus = subscription.status === 'active' ? 'ativo' : 'expirado'
        await atualizarPlanoPorCustomer(supabase, customerId, {
          plano_status: novoStatus,
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
