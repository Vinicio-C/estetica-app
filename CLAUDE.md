# CLAUDE.md — Estética Premium

## O que é o projeto
PWA de gestão para clínicas de estética. Sistema multi-tenant: cada profissional tem sua própria conta e vê apenas seus próprios dados. Backend no Supabase (projeto **Golden Derma**, ID: `frnwbcvcaacraliropsw`, região `sa-east-1`).

## Arquitetura
- **Frontend:** HTML/CSS/JS puro, sem framework. PWA instalável.
- **Backend:** Supabase (Auth + Postgres + Storage)
- **Email transacional:** Resend (DKIM e SPF já verificados e funcionando)
- **Hospedagem:** a definir (não deployado ainda)

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

## Tabelas no Supabase
`clientes`, `servicos`, `estoque`, `agendamentos`, `pagamentos`, `anamneses`, `disponibilidade`, `profiles`

Todas com RLS habilitado. Cada tabela tem `user_id` que referencia o usuário dono dos dados.

## Multi-tenancy
- RLS já configurado e corrigido — profissional autenticada vê **apenas seus próprios dados**
- Página pública (`agendar.html`) opera sem login via `?ref=user_id`
- O `fetchAPI` chama `select('*')` sem filtro — o isolamento é feito pelo RLS no banco

## RLS — estado atual (após correções desta sessão)
Migração aplicada: `fix_rls_multitenant_isolation`

Regra geral:
- **Autenticado:** vê e gerencia apenas `WHERE user_id = auth.uid()`
- **Não autenticado (página pública):** pode ler o necessário para agendamento (horários, serviços, clientes por telefone) e criar/atualizar clientes e agendamentos

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

## Intenção de venda
O projeto será vendido como SaaS para clínicas de estética. Modelo: **mensalidade** (não vitalício). Motivo: custos recorrentes de infra (Supabase) e necessidade de manutenção contínua.

## O que ainda falta para vender
- [ ] Sistema de cobrança / controle de assinatura (Stripe ou similar)
- [ ] Controle de expiração de plano (bloquear acesso se não pago)
- [ ] Landing page de vendas
- [ ] Google API Key (`js/app.js:8`) exposta no código — mover para variável de ambiente ou restringir no Google Cloud Console
