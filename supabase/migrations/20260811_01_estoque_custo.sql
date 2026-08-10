-- Migração: custo real do estoque
-- Fase 2.1 do módulo financeiro.
--
-- Contexto: `estoque.valor_unitario` é ambíguo (não distingue o que a
-- profissional PAGA do que ela COBRA), nunca é exibido e não entra em nenhum
-- cálculo. Sem separar custo de preço é impossível calcular CMV, margem por
-- serviço ou quanto ela tem imobilizado em produto — que é justamente o
-- principal investimento de uma clínica de estética.

alter table public.estoque
  -- Custo médio ponderado, recalculado a cada entrada pelo trigger do razão.
  -- 4 casas porque insumo fracionado (ml, g) tem custo unitário baixo.
  add column if not exists custo_medio   numeric(12,4) not null default 0,
  add column if not exists preco_venda   numeric(12,2),
  add column if not exists unidade       text not null default 'un',
  -- Produto com histórico de movimento não pode ser apagado; é desativado.
  add column if not exists ativo         boolean not null default true,
  add column if not exists atualizado_em timestamptz not null default now();

-- `produtos_vinculados` já aceita decimal (parseFloat em app.js), então um
-- serviço que consome 0,5 ml hoje trunca o saldo. integer -> numeric é
-- widening: não quebra nada que já existe.
alter table public.estoque
  alter column quantidade        type numeric(12,3),
  alter column quantidade_minima type numeric(12,3);

comment on column public.estoque.custo_medio is
  'Custo médio ponderado por unidade. Mantido pelo trigger de estoque_movimentos.';
comment on column public.estoque.preco_venda is
  'Preço de revenda, quando o produto é vendido avulso. Não usado no CMV.';
comment on column public.estoque.valor_unitario is
  'DEPRECADO — substituído por custo_medio. Mantido por um release como rede de segurança. Não usar.';

create index if not exists idx_estoque_user_ativo on public.estoque (user_id, ativo);
