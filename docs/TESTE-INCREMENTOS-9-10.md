# Plano de teste — Incrementos 9 e 10

1. Criar usuário de portal para Cliente A; autenticar e confirmar que equipamentos/OS/orçamentos do Cliente B nunca aparecem.
2. Tentar QR de equipamento do Cliente B com token autenticado do Cliente A: deve retornar 404.
3. Aprovar e recusar orçamento: somente SENT/VIEWED; conferir CustomerQuoteDecision com snapshot, IP e user-agent.
4. Confirmar que respostas do portal não contêm estimatedCost, estimatedProfit, estimatedMargin, laborCost, travelCost, feesCost, otherCost ou custo dos materiais.
5. Abrir solicitação somente em unidade pertencente ao cliente.
6. Registrar compra e confirmar estoque incrementado, lastCost atualizado e InventoryMovement PURCHASE criado na mesma transação.
7. Testar pesquisa global e readiness por empresa.
8. Rodar `npm test` e `prisma validate` no ambiente com dependências instaladas e PostgreSQL de homologação antes de promover.
