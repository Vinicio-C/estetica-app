-- Pedido de avaliação no Google depois do atendimento.
--
-- A profissional cola o link "Pedir avaliações" do Perfil da Empresa no Google
-- e personaliza o texto. Ao concluir um atendimento, o app abre o WhatsApp dela
-- com a mensagem pronta (api.whatsapp.com/send) — nada é enviado pelo servidor.

alter table public.profiles
  add column if not exists link_avaliacao_google text,
  add column if not exists mensagem_avaliacao    text;

-- Quando o pedido foi aberto no WhatsApp. Serve para o botão mostrar
-- "pedido em dd/mm" e evitar mandar duas vezes para a mesma cliente.
-- É só um registro de que o WhatsApp foi aberto: o app não tem como saber
-- se ela de fato apertou "enviar".
alter table public.agendamentos
  add column if not exists avaliacao_solicitada_em timestamptz;
