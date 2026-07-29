import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@14"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-06-20',
    })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Pega o usuário autenticado pelo token JWT do header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Não autorizado')

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) throw new Error('Usuário não encontrado')

    // Busca o perfil para ver se já tem customer_id no Stripe
    const { data: perfil } = await supabase
      .from('profiles')
      .select('stripe_customer_id, nome')
      .eq('id', user.id)
      .maybeSingle()

    let customerId = perfil?.stripe_customer_id

    // Um customer criado no sandbox não existe na conta de produção (e vice-versa).
    // Sem esta checagem, trocar de ambiente quebra o checkout com "No such customer".
    if (customerId) {
      try {
        const existente = await stripe.customers.retrieve(customerId)
        if ((existente as any).deleted) customerId = null
      } catch (_) {
        console.warn(`Customer ${customerId} não existe neste ambiente do Stripe — criando outro`)
        customerId = null
      }
    }

    // Cria o customer no Stripe se ainda não existir
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: perfil?.nome ?? user.email,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id

      // Salva o customer_id no perfil (usando service_role, que ignora RLS)
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    const origin = req.headers.get('origin') ?? 'https://esteticaapp.com.br'

    // O boleto só é oferecido pelo Stripe quando ele sabe que a cliente está no
    // Brasil. Sem endereço no customer, o filtro automático descartava o boleto
    // e sobrava só cartão — por isso a lista vai explícita aqui.
    // Apple Pay, Google Pay e Link não entram na lista: são carteiras que
    // andam junto com 'card' e aparecem sozinhas no aparelho compatível.
    const opcoesBase = {
      customer: customerId,
      mode: 'subscription' as const,
      line_items: [{
        price: Deno.env.get('STRIPE_PRICE_ID') ?? '',
        quantity: 1,
      }],
      success_url: `${origin}/index.html?plano=sucesso`,
      cancel_url: `${origin}/index.html?plano=cancelado`,
      locale: 'pt-BR' as const,
      metadata: { supabase_user_id: user.id },
    }

    let session
    try {
      session = await stripe.checkout.sessions.create({
        ...opcoesBase,
        payment_method_types: ['card', 'boleto'],
        // O Stripe envia um novo boleto por email a cada ciclo da assinatura
        payment_method_options: {
          boleto: { expires_after_days: 3 },
        },
      })
    } catch (erroBoleto) {
      // Se a conta não puder emitir boleto, não deixa o checkout inteiro cair:
      // volta para cartão (e carteiras) para não perder a venda.
      console.error('Checkout com boleto falhou, usando só cartão:', erroBoleto.message)
      session = await stripe.checkout.sessions.create({
        ...opcoesBase,
        payment_method_types: ['card'],
      })
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
