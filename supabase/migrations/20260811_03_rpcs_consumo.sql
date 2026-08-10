-- Migração: consumo e estorno de estoque por atendimento
-- Fases 2.3 e 2.4 do módulo financeiro.
--
-- Hoje a baixa é feita pelo navegador, item a item, sem nenhuma guarda: dois
-- cliques, duas abas abertas ou um retry de rede debitam o estoque de novo.
-- O estorno é pior — soma sem teto nenhum.

-- ---------------------------------------------------------------------------
-- 2.3 Guarda de idempotência
-- ---------------------------------------------------------------------------
alter table public.agendamentos
  add column if not exists estoque_baixado boolean not null default false;

-- Os que já estão concluídos tiveram o estoque debitado pelo fluxo antigo.
-- Os que o bug marcou como 'cancelado' ficam false de propósito: o botão
-- "Concluir" só aparece para 'pendente', então não serão reprocessados.
update public.agendamentos
   set estoque_baixado = true
 where status = 'concluido' and estoque_baixado = false;

-- ---------------------------------------------------------------------------
-- 2.4 RPCs
--
-- SECURITY INVOKER de propósito: a RLS da usuária continua valendo dentro da
-- função, então não há como tocar no tenant de outra pessoa e não criamos mais
-- um SECURITY DEFINER para auditar depois.
-- ---------------------------------------------------------------------------

create or replace function public.registrar_consumo_agendamento(p_agendamento_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_servico_id uuid;
  v_produto    jsonb;
  v_itens      jsonb := '[]'::jsonb;
  v_custo      numeric(12,2) := 0;
  v_saldo      numeric(12,3);
  v_nome       text;
begin
  -- A condição `estoque_baixado = false` é a idempotência: o lock de linha do
  -- Postgres garante que só a primeira chamada casa. A segunda não acha nada.
  update public.agendamentos
     set estoque_baixado = true,
         status          = 'concluido'
   where id = p_agendamento_id
     and estoque_baixado = false
  returning servico_id into v_servico_id;

  if not found then
    return jsonb_build_object('ok', true, 'ja_baixado', true, 'status', 'concluido');
  end if;

  if v_servico_id is not null then
    for v_produto in
      select jsonb_array_elements(coalesce(produtos_vinculados, '[]'::jsonb))
      from public.servicos where id = v_servico_id
    loop
      insert into public.estoque_movimentos
        (estoque_id, tipo, origem, quantidade_delta, agendamento_id, observacao)
      select (v_produto->>'estoque_id')::uuid,
             'saida', 'atendimento',
             -1 * (v_produto->>'quantidade')::numeric,
             p_agendamento_id,
             'Consumo do atendimento'
      where exists (select 1 from public.estoque e
                     where e.id = (v_produto->>'estoque_id')::uuid)
      returning saldo_apos, custo_total into v_saldo, v_custo;

      select nome into v_nome from public.estoque
       where id = (v_produto->>'estoque_id')::uuid;

      if v_nome is not null then
        v_itens := v_itens || jsonb_build_object(
          'nome', v_nome,
          'quantidade', (v_produto->>'quantidade')::numeric,
          'saldo_apos', v_saldo);
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'ok', true, 'ja_baixado', false, 'status', 'concluido', 'itens', v_itens);
end;
$$;


create or replace function public.estornar_consumo_agendamento(p_agendamento_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_mov   record;
  v_itens jsonb := '[]'::jsonb;
begin
  update public.agendamentos
     set estoque_baixado = false,
         status          = 'cancelado'
   where id = p_agendamento_id
     and estoque_baixado = true;

  if not found then
    return jsonb_build_object('ok', true, 'ja_estornado', true, 'status', 'cancelado');
  end if;

  -- Devolve a partir dos MOVIMENTOS originais, não de produtos_vinculados.
  -- Se o serviço for editado entre a conclusão e o estorno, ler o vínculo atual
  -- devolveria quantidade diferente da que saiu — furo de estoque silencioso.
  for v_mov in
    select estoque_id, quantidade_delta, custo_unitario
      from public.estoque_movimentos
     where agendamento_id = p_agendamento_id
       and origem = 'atendimento'
  loop
    insert into public.estoque_movimentos
      (estoque_id, tipo, origem, quantidade_delta, custo_unitario, agendamento_id, observacao)
    values (v_mov.estoque_id, 'entrada', 'estorno_atendimento',
            abs(v_mov.quantidade_delta), v_mov.custo_unitario,
            p_agendamento_id, 'Estorno do atendimento');

    v_itens := v_itens || jsonb_build_object(
      'estoque_id', v_mov.estoque_id,
      'quantidade', abs(v_mov.quantidade_delta));
  end loop;

  return jsonb_build_object(
    'ok', true, 'ja_estornado', false, 'status', 'cancelado', 'itens', v_itens);
end;
$$;


-- Auto-conclusão em lote. O front hoje faz 1 + N*M requisições, e refaz isso a
-- cada navegação de página.
create or replace function public.auto_concluir_passados()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id    uuid;
  v_total int := 0;
begin
  for v_id in
    select id from public.agendamentos
     where status = 'pendente'
       and estoque_baixado = false
       and data < (now() at time zone 'America/Sao_Paulo')::date::text
  loop
    perform public.registrar_consumo_agendamento(v_id);
    v_total := v_total + 1;
  end loop;

  return jsonb_build_object('ok', true, 'concluidos', v_total);
end;
$$;

revoke all on function public.registrar_consumo_agendamento(uuid) from public, anon;
revoke all on function public.estornar_consumo_agendamento(uuid) from public, anon;
revoke all on function public.auto_concluir_passados()          from public, anon;

grant execute on function public.registrar_consumo_agendamento(uuid) to authenticated;
grant execute on function public.estornar_consumo_agendamento(uuid) to authenticated;
grant execute on function public.auto_concluir_passados()           to authenticated;
