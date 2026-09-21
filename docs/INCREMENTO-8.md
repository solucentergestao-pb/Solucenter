# Incremento 8 — Central de Notificações

## Entregue
- Templates por empresa, evento e canal.
- Fila persistente no PostgreSQL com tentativas, backoff e limite de retries.
- Histórico `NotificationDelivery`.
- Adaptador WhatsApp Business Cloud API via HTTP.
- Adaptador de e-mail transacional HTTP (compatível com endpoint Resend por padrão).
- API para listar fila/histórico, editar templates, processar e reenfileirar falhas.
- Tela móvel inicial `/notificacoes`.

## Eventos previstos
QUOTE_SENT, QUOTE_APPROVED, MAINTENANCE_DUE, APPOINTMENT_SCHEDULED, TECHNICIAN_ON_THE_WAY, SERVICE_ORDER_COMPLETED, RECEIVABLE_CREATED, PAYMENT_RECEIVED e RECEIPT_ISSUED.

## Variáveis de ambiente
WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_GRAPH_VERSION, EMAIL_API_KEY, EMAIL_FROM e opcional EMAIL_API_URL.

## Produção
Executar `processNotificationQueue()` por worker/cron separado. Webhooks dos provedores devem atualizar SENT/DELIVERED/READ/FAILED. Credenciais nunca devem ser gravadas no frontend.
