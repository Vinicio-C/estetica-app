-- Migração: Cria tabela de templates de anamnese personalizados por profissional
-- Rodar no Supabase > SQL Editor

CREATE TABLE IF NOT EXISTS public.anamnese_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campos JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Apenas um template por profissional
CREATE UNIQUE INDEX IF NOT EXISTS anamnese_templates_user_id_key ON public.anamnese_templates(user_id);

-- RLS
ALTER TABLE public.anamnese_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "template_select_own" ON public.anamnese_templates
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "template_insert_own" ON public.anamnese_templates
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "template_update_own" ON public.anamnese_templates
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "template_delete_own" ON public.anamnese_templates
  FOR DELETE USING (user_id = auth.uid());
