-- Migração: livro-razão de estoque
-- Fase 2.2 do módulo financeiro.
--
-- Hoje o saldo é sobrescrito in-place pelo navegador
-- (`update estoque set quantidade = <valor calculado no cliente>`), o que:
--   1. perde o histórico — não dá para saber o que entrou, o que saiu nem por quê;
--   2. tem corrida read-modify-write: salvar o modal de estoque com um valor
--      lido antes de uma baixa automática apaga essa baixa;
--   3. impossibilita CMV, porque não se sabe a que custo cada saída ocorreu.
--
-- Aqui o saldo passa a ser consequência dos movimentos, aplicados pelo banco.

create table if not exists public.estoque_movimentos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  estoque_id  uuid not null references public.estoque(id) on delete cascade,

  tipo   text not null check (tipo in ('entrada','saida','ajuste')),
  origem text not null check (origem in (
            'compra','atendimento','estorno_atendimento',
            'ajuste_manual','inventario','perda','vencimento')),

  -- Assinado: positivo entra, negativo sai. Somar a coluna reconstrói o saldo.
  quantidade_delta numeric(12,3) not null check (quantidade_delta <> 0),

  -- Na entrada, o custo da nota. Na saída, SNAPSHOT do custo médio do momento —
  -- é isso que impede o CMV de um mês fechado mudar quando o preço subir depois.
  custo_unitario numeric(12,4),
  custo_total    numeric(12,2)
                 generated always as (round(abs(quantidade_delta) * coalesce(custo_unitario, 0), 2)) stored,

  saldo_apos numeric(12,3),   -- preenchido pelo trigger, para auditoria

  agendamento_id uuid references public.agendamentos(id) on delete set null,
  observacao     text,
  data       date        not null default (now() at time zone 'America/Sao_Paulo')::date,
  created_at timestamptz not null default now(),

  constraint mov_sinal_coerente check (
       (tipo = 'entrada' and quantidade_delta > 0)
    or (tipo = 'saida'   and quantidade_delta < 0)
    or  tipo = 'ajuste')
);

create index if not exists idx_mov_user_data     on public.estoque_movimentos (user_id, data desc);
create index if not exists idx_mov_estoque_data  on public.estoque_movimentos (estoque_id, data desc);
create index if not exists idx_mov_agendamento   on public.estoque_movimentos (agendamento_id)
  where agendamento_id is not null;

-- ---------------------------------------------------------------------------
-- Trigger: aplica o movimento no saldo e mantém o custo médio ponderado.
-- BEFORE INSERT para poder preencher custo_unitario e saldo_apos na própria linha.
-- ---------------------------------------------------------------------------
create or replace function public.aplicar_movimento_estoque()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qtd_atual   numeric(12,3);
  v_custo_atual numeric(12,4);
  v_novo_saldo  numeric(12,3);
  v_novo_custo  numeric(12,4);
  v_base        numeric(12,3);
begin
  -- FOR UPDATE serializa movimentos concorrentes do mesmo produto.
  select quantidade, custo_medio into v_qtd_atual, v_custo_atual
  from public.estoque
  where id = new.estoque_id
  for update;

  if not found then
    raise exception 'Produto % não encontrado', new.estoque_id;
  end if;

  v_novo_saldo := v_qtd_atual + new.quantidade_delta;
  v_novo_custo := v_custo_atual;

  if new.quantidade_delta > 0 and new.custo_unitario is not null then
    -- Média ponderada. Base negativa (consumo sem compra registrada) contaria
    -- ao contrário, por isso o greatest.
    v_base := greatest(v_qtd_atual, 0);
    if (v_base + new.quantidade_delta) > 0 then
      v_novo_custo := ((v_base * v_custo_atual) + (new.quantidade_delta * new.custo_unitario))
                      / (v_base + new.quantidade_delta);
    else
      v_novo_custo := new.custo_unitario;
    end if;
  elsif new.custo_unitario is null then
    -- Saída e ajuste herdam o custo médio vigente: é o CMV daquele consumo.
    new.custo_unitario := v_custo_atual;
  end if;

  -- Saldo negativo é PERMITIDO de propósito. O código antigo travava em zero
  -- (`if (novaQtd < 0) novaQtd = 0`), o que fazia sum(movimentos) <> quantidade
  -- e quebrava a própria razão de existir do razão. Negativo significa
  -- "consumiu algo que nunca foi registrado como compra" — é informação útil,
  -- e a tela mostra em vermelho.
  new.saldo_apos := v_novo_saldo;

  update public.estoque
     set quantidade    = v_novo_saldo,
         custo_medio   = v_novo_custo,
         atualizado_em = now()
   where id = new.estoque_id;

  return new;
end;
$$;

drop trigger if exists trg_aplicar_movimento_estoque on public.estoque_movimentos;
create trigger trg_aplicar_movimento_estoque
  before insert on public.estoque_movimentos
  for each row execute function public.aplicar_movimento_estoque();

-- Função de trigger não precisa ser exposta em /rest/v1/rpc
revoke all on function public.aplicar_movimento_estoque() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS — mesmo padrão das demais tabelas: cada profissional só vê o que é dela,
-- e o anônimo não alcança nada.
-- ---------------------------------------------------------------------------
alter table public.estoque_movimentos enable row level security;

drop policy if exists mov_select on public.estoque_movimentos;
create policy mov_select on public.estoque_movimentos
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists mov_insert on public.estoque_movimentos;
create policy mov_insert on public.estoque_movimentos
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists mov_update on public.estoque_movimentos;
create policy mov_update on public.estoque_movimentos
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists mov_delete on public.estoque_movimentos;
create policy mov_delete on public.estoque_movimentos
  for delete to authenticated using (auth.uid() = user_id);

revoke all on public.estoque_movimentos from anon;
