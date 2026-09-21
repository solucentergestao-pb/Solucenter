# Solucenter V1 — Incremento 4: ciclo comercial completo

## Fluxo implementado
1. Criar orçamento com itens, custo unitário e preço de venda.
2. Backend calcula subtotal, desconto, custo previsto, lucro previsto e margem.
3. Enviar orçamento (`DRAFT -> SENT`).
4. Aprovar orçamento (`SENT/VIEWED -> APPROVED`), respeitando validade.
5. Converter uma única vez em OS, preservando vínculo `quoteId` e valor aprovado.
6. Iniciar execução (`OPEN/SCHEDULED/ASSIGNED/ON_THE_WAY -> IN_PROGRESS`).
7. Registrar materiais, medições e fotos; concluir OS com custos reais.
8. Consultar rentabilidade real da OS.
9. Gerar cobrança da OS concluída (`COMPLETED -> INVOICED`).
10. Registrar pagamentos parciais ou totais. Saldo zero fecha a cobrança e a OS (`RECEIVED`).
11. Dashboard mensal consolida recebido, custos operacionais das OS concluídas, resultado, margem, saldo a receber e orçamentos pendentes.

## Novos endpoints
- GET/POST `/api/v1/quotes`
- GET `/api/v1/quotes/:id`
- POST `/api/v1/quotes/:id/send`
- POST `/api/v1/quotes/:id/approve`
- POST `/api/v1/quotes/:id/convert-to-service-order`
- POST `/api/v1/service-orders/:id/start`
- POST `/api/v1/service-orders/:id/invoice`
- GET `/api/v1/finance/receivables`
- POST `/api/v1/finance/receivables`
- POST `/api/v1/finance/receivables/:id/payments`
- GET `/api/v1/dashboard`

## Regras críticas
- Cálculos comerciais ficam no backend.
- Orçamento vencido não pode ser aprovado.
- Orçamento não aprovado não pode virar OS.
- Conversão é idempotente: um orçamento não gera duas OS.
- Cobrança exige OS concluída e valor positivo.
- Pagamento maior que o saldo é bloqueado.
- Pagamento parcial mantém saldo e status `PARTIALLY_PAID`.
- Pagamento integral define `PAID`; OS faturada vinculada passa a `RECEIVED`.
