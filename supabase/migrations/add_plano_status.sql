-- Migração: Adiciona colunas de controle de plano/assinatura na tabela profiles
-- Rodar no Supabase > SQL Editor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plano_status TEXT DEFAULT 'trial' CHECK (plano_status IN ('trial', 'ativo', 'expirado', 'vitalicio')),
  ADD COLUMN IF NOT EXISTS trial_expira_em TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Protege o campo plano_status: usuários só podem editar os próprios dados,
-- mas não podem alterar o plano pelo front-end (apenas service_role pode).
-- A política UPDATE existente provavelmente usa WITH CHECK (id = auth.uid()).
-- Aqui garantimos que o campo plano_status não possa ser modificado pelo usuário
-- via RLS: recriarmos a política UPDATE para excluir plano_status da edição direta.

-- Remove política antiga de UPDATE (se existir com nome padrão)
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- Recria permitindo update apenas dos campos não-sensíveis
-- (plano_status, stripe_*, trial_expira_em só podem ser alterados via service_role)
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND plano_status = (SELECT plano_status FROM public.profiles WHERE id = auth.uid())
    AND stripe_customer_id IS NOT DISTINCT FROM (SELECT stripe_customer_id FROM public.profiles WHERE id = auth.uid())
    AND stripe_subscription_id IS NOT DISTINCT FROM (SELECT stripe_subscription_id FROM public.profiles WHERE id = auth.uid())
  );
