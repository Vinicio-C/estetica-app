# CLAUDE.md — Estética Premium

## O que é o projeto
PWA de gestão para clínicas de estética. Sistema multi-tenant: cada profissional tem sua própria conta e vê apenas seus próprios dados. Backend no Supabase (projeto **Golden Derma**, ID: `frnwbcvcaacraliropsw`, região `sa-east-1`).

## Arquitetura
- **Frontend:** HTML/CSS/JS puro, sem framework. PWA instalável.
- **Backend:** Supabase (Auth + Postgres + Storage)
- **Email transacional:** Resend (DKIM e SPF já verificados e funcionando)
- **Hospedagem:** Cloudflare Pages, deploy automático a cada push na `main`
  - Produção: **https://esteticaapp.com.br** (também em `estetica-app.pages.dev`)
  - O GitHub Pages do repo (`vinicio-c.github.io/estetica-app`) também está ligado e responde, mas **não é** a produção — cuidado para não confundir

## Arquivos principais
| Arquivo | Função |
|---|---|
| `index.html` | App principal (dashboard, agenda, clientes, etc.) |
| `login.html` | Login com email/senha + link "Esqueci senha" + link "Criar conta" |
| `signup.html` | Cadastro de novas profissionais (cria auth + perfil) |
| `agendar.html` | Página pública de agendamento (`?ref=user_id`) |
| `nova-senha.html` | Redefinição de senha via link do email |
| `welcome.html` | Página de boas-vindas |
| `js/supabase-client.js` | Inicializa o cliente Supabase e expõe `fetchAPI` |
| `js/app.js` | Lógica principal: dashboard, clientes, serviços, estoque |
| `js/app-agenda.js` | Lógica da agenda |
| `js/app-publico.js` | Lógica da página pública de agendamento |
| `js/app-anamnese.js` | Lógica de anamneses |
| `js/app-relatorios.js` | Lógica de relatórios |
| `js/perfil.js` | Lógica do perfil da profissional |
| `js/financeiro-core.js` | Helpers puros de data (`parseDataLocal`, `hojeISO`, `ehDoMes`). **Carregar antes** dos demais |
| `js/app-compras.js` | Compras: importação de NF-e, compra manual, histórico e ajuste de estoque |
| `js/app-financeiro.js` | Caixa: recebimentos, despesas e fechamento do período |

## Tabelas no Supabase
`clientes`, `servicos`, `estoque`, `estoque_movimentos`, `compras`, `compra_itens`, `estoque_fornecedor_ref`, `agendamentos`, `pagamentos`, `despesas`, `anamneses`, `anamnese_templates`, `disponibilidade`, `profiles`

Todas com RLS habilitado. Cada tabela tem `user_id` que referencia o usuário dono dos dados.

## Anamnese — modelos múltiplos
Migrações: `anamnese_multiplos_modelos_e_anexos`, `anamnese_anexos_storage_bucket`

- `anamnese_templates`: cada profissional pode ter **vários modelos nomeados** (`nome`, `is_padrao`, `ordem`, `campos` jsonb). Índice único em `(user_id, lower(nome))` — nome duplicado devolve erro `23505`.
- `anamneses`: ganhou `template_id`, `template_nome`, `anexos` (jsonb) e `atualizado_em`. Agora a cliente pode ter **várias fichas** (uma por procedimento).
- Cada ficha salva um snapshot da estrutura em `respostas.__campos`, para que a impressão continue fiel mesmo se o modelo mudar depois.
- Migração `anamnese_backfill_snapshot_fichas_legadas`: as 7 fichas criadas antes dessa mudança não tinham snapshot e cairiam no modelo padrão novo (ids diferentes → respostas em branco). O snapshot do modelo antigo foi gravado nelas. **Qualquer ficha sem `__campos` e sem `template_id` tem esse mesmo risco.**

Tipos de campo (`campos[].tipo`): `titulo` (tópico/seção), `texto`, `textarea`, `checkbox`, `checkbox_texto` (marcou "sim" → abre campo de detalhe, rótulo em `labelCondicional`), `select` (com `opcoes[]`), `data`, `numero`.

### Storage — fichas escaneadas
Bucket **`anamnese-anexos`**, **privado** (dado de saúde), limite 10MB, aceita imagem e PDF.
Caminho: `<user_id>/<cliente_id>/<arquivo>`. Políticas em `storage.objects` liberam apenas a própria pasta.
Leitura é feita via `createSignedUrl` (1h) — nunca URL pública.

### Impressão / exportação
- `imprimirModeloEmBranco()` e `imprimirEditorEmBranco()` geram a ficha **vazia** com linhas e caixinhas para preencher à mão.
- Exportação: PDF (html2pdf), Word (.doc) e **JSON** (backup fiel, reimportável sem perdas).
- Importação aceita `.json`, `.pdf`, `.docx`, `.txt`. O PDF é reconstruído por posição vertical dos fragmentos (pdf.js entrega texto solto); a heurística reconhece tópicos, checkboxes e perguntas do tipo "se sim, quais?".

## Multi-tenancy
- RLS já configurado e corrigido — profissional autenticada vê **apenas seus próprios dados**
- Página pública (`agendar.html`) opera sem login via `?ref=user_id`
- O `fetchAPI` chama `select('*')` sem filtro — o isolamento é feito pelo RLS no banco

## Página pública — acesso via RPC (não mexer sem ler isto)
Migrações: `agenda_publica_rpcs`, `agenda_publica_criar_agendamento`, `rls_fecha_leitura_anonima`

O anônimo **não tem mais SELECT/INSERT/UPDATE em nenhuma tabela**. Antes existiam policies com `USING ((auth.uid() IS NULL) OR (auth.uid() = user_id))` — o primeiro ramo significa "se não estiver logado, veja tudo", e com a chave publicável (visível no fonte da página) dava para ler 78 clientes com CPF, 519 agendamentos e o `zapi_token` das profissionais.

`agendar.html` usa só estas funções `SECURITY DEFINER`, todas escopadas ao `?ref=`:

| Função | Devolve |
|---|---|
| `agenda_perfil_publico(user_id)` | nome, especialidade, endereço — **nunca** zapi_token/Stripe |
| `agenda_servicos_publicos(user_id)` | serviços daquela profissional |
| `agenda_disponibilidade_publica(user_id, dia_semana)` | regra do dia |
| `agenda_horarios_ocupados(user_id, data)` | só `hora` e `duracao` |
| `agenda_buscar_cliente(user_id, email)` | reconhece cliente, dentro do tenant |
| `agenda_criar_agendamento(...)` | cria cliente + agendamento |

`agenda_criar_agendamento` valida o serviço, recusa horário ocupado e tira `valor`/`duracao` do cadastro — o navegador não define preço.

## Proteção do plano (`profiles`)
Migração: `profiles_protege_campos_de_assinatura`

Trigger `profiles_protege_assinatura` reverte `plano_status`, `trial_expira_em`, `stripe_customer_id` e `stripe_subscription_id` quando quem edita é `authenticated`. Service role (webhook do Stripe) e acesso via SQL passam.

**Por que trigger e não policy:** existia `profiles_update_own` tentando isso, mas era PERMISSIVE e convivia com `Doutora gerencia seu perfil` (ALL, também PERMISSIVE). Postgres faz **OR** entre policies permissivas — bastava uma autorizar, e a profissional conseguia se dar plano vitalício. A policy foi removida por criar confiança falsa.

## RLS — estado atual (após correções desta sessão)
Migração aplicada: `fix_rls_multitenant_isolation`

Regra geral:
- **Autenticado:** vê e gerencia apenas `WHERE user_id = auth.uid()`
- **Não autenticado:** **nenhum acesso direto a tabela.** A página pública usa só as funções `agenda_*` (ver seção acima). A descrição antiga — "pode ler o necessário e criar/atualizar clientes e agendamentos" — foi o que permitiu ler 78 clientes com CPF com a chave publicável.

Tabelas corrigidas:
- `agendamentos`: removida política `qual: true` que expunha tudo
- `clientes`: removida leitura e edição global
- `servicos`: removida leitura global para autenticados
- `anamneses` e `pagamentos`: adicionado `WITH CHECK` ausente

## Profiles — FK corrigida
Migração aplicada: `fix_profiles_cascade_delete`

`profiles.id` referencia `auth.users(id) ON DELETE CASCADE` — ao deletar o usuário no painel do Supabase, o perfil é removido automaticamente (sem isso dava erro "Database error deleting user").

## Fluxo de cadastro
1. Usuário preenche `signup.html` (nome, especialidade, email, senha)
2. `supabase.auth.signUp()` cria o usuário
3. Perfil inserido em `profiles` via `upsert`
4. Supabase envia email de confirmação via **Resend**
5. Modal de confirmação aparece na tela informando o email e alertando sobre spam
6. Usuário clica no link → Supabase autentica e redireciona para `index.html`

## Email (Resend)
- Já configurado e funcionando (password reset entrega OK)
- Se email aparecer como "Suppressed" no Resend → ir em **Resend → Suppressions** e remover o endereço
- Confirmação de email está **ativada** no Supabase (não desativar)

## Módulo financeiro (não mexer sem ler isto)
Migrações: `20260811_01` a `20260811_07` em `supabase/migrations/`

### O saldo do estoque é derivado, não digitado
`estoque.quantidade` é mantido pelo **trigger** de `estoque_movimentos`, que faz
`SELECT ... FOR UPDATE` no produto, aplica o delta e recalcula o **custo médio ponderado**.

Nunca escreva `quantidade` direto em `estoque` — isso apaga movimentos e quebra a conciliação.
Para conferir se o razão fecha:

```sql
select e.nome, e.quantidade,
       (select sum(m.quantidade_delta) from estoque_movimentos m where m.estoque_id = e.id) as soma
from estoque e;
```

**Saldo negativo é permitido de propósito.** O código antigo travava em zero, o que fazia
`sum(movimentos) ≠ quantidade`. Negativo significa "consumiu sem entrada registrada" e a tela
mostra em vermelho.

### Custo: snapshot, não valor atual
Cada movimento de **saída** grava `custo_unitario` com o custo médio daquele momento. O CMV dos
relatórios usa esse valor gravado, **nunca** `estoque.custo_medio` atual — é isso que torna um mês
fechado imutável quando o preço de compra sobe depois.

`estoque.valor_unitario` está **DEPRECADO** (migrado para `custo_medio`); mantido por um release
como rede de segurança.

### Baixa de estoque por atendimento
Sempre via RPC, nunca por loop no navegador:
`registrar_consumo_agendamento(id)` / `estornar_consumo_agendamento(id)` / `auto_concluir_passados()`.

São `SECURITY INVOKER` (a RLS da usuária continua valendo). A idempotência vem de
`update ... where estoque_baixado = false` — o lock de linha do Postgres resolve dois cliques,
duas abas e retry de rede. **O estorno lê as quantidades dos movimentos originais**, não de
`servicos.produtos_vinculados`: editar o serviço entre concluir e estornar devolveria quantidade
errada.

### Compra ≠ despesa
Compra de material vira **ativo** (estoque) e só afeta o resultado como CMV quando o produto é
usado. Lançar compra como despesa afundaria o lucro no mês da compra e o inflaria nos seguintes.
No **caixa** ela aparece como saída, porque o dinheiro saiu de fato. Por isso Financeiro e
Relatórios mostram números diferentes — de propósito.

### `status_pagamento` é cache derivado
O trigger `sincronizar_status_pagamento` recalcula `agendamentos.status_pagamento` a partir da soma
de `pagamentos`. Isso mantém funcionando as ~10 comparações de string exata em `app.js`,
`app-relatorios.js`, `app-agenda.js` e o CSS `.status-badge`.

**Não crie o status `parcial`** — quebraria todas elas. Recebimento parcial mantém `devendo`;
o detalhe aparece só na tela Financeiro.

### Importação de NF-e
`lerXmlNfe()` usa `DOMParser` nativo, comparando por `localName` (alguns emissores usam prefixo
de namespace). Ler a **chave de acesso** não serve: a consulta pública sem certificado digital
devolve só o resumo, sem itens.

O ponto crítico é `estoque_fornecedor_ref`: o fornecedor vende "CX/100" e ela controla em unidades.
O `fator_conversao` memorizado por (CNPJ, código) evita que o estoque suba 2 em vez de 200 e que o
custo unitário fique 100× errado. A tela mostra o resultado da conversão **antes** de confirmar.

## ⚠️ Teto de 1000 linhas no `fetchAPI`
`js/supabase-client.js:59` **descarta** o `?limit=1000` da URL e a linha 75 faz `select('*')` sem
`.limit()` nem `.range()` — vale o `max-rows` do PostgREST (1000). Com mais de 1000 agendamentos,
`carregarDadosIniciais` trunca **em silêncio** e todo relatório fica errado sem aviso.

O `fetchAPI` também engole erro e devolve `{data: []}` (linhas 106-118): uma policy quebrada vira
"R$ 0,00" em vez de erro. **As telas financeiras não usam `fetchAPI`** por causa disso — consultam
`_supabase.from(...)` direto e tratam `error`.

## Intenção de venda
O projeto será vendido como SaaS para clínicas de estética. Modelo: **mensalidade** (não vitalício). Motivo: custos recorrentes de infra (Supabase) e necessidade de manutenção contínua.

## O que ainda falta para vender
- [ ] Sistema de cobrança / controle de assinatura (Stripe ou similar)
- [ ] Controle de expiração de plano (bloquear acesso se não pago)
- [ ] Landing page de vendas
- [ ] Google API Key (`js/app.js:8`) exposta no código — mover para variável de ambiente ou restringir no Google Cloud Console
