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

    // Cria a sessão de checkout com o preço mensal de R$29,99
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: Deno.env.get('STRIPE_PRICE_ID') ?? '',
        quantity: 1,
      }],
      success_url: `${origin}/index.html?plano=sucesso`,
      cancel_url: `${origin}/index.html?plano=cancelado`,
      locale: 'pt-BR',
      metadata: { supabase_user_id: user.id },
    })

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
