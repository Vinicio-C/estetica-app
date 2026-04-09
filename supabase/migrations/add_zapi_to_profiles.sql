-- Migração: Adiciona colunas Fonnte (WhatsApp automático) na tabela profiles
-- Rodar no Supabase > SQL Editor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS zapi_token text,
  ADD COLUMN IF NOT EXISTS zapi_ativo boolean DEFAULT false;
