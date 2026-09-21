# Solucenter V1 — Incremento 5

## Interface móvel
Nova linguagem visual responsiva azul/branco, AppShell, navegação inferior, cards financeiros, ações rápidas, DRE e visual previsto x realizado.

## Documentos PDF
Endpoints autenticados para gerar PDF de orçamento e OS/relatório técnico. Arquivos recebem token aleatório e são registrados em GeneratedDocument para futura página pública de compartilhamento. Em produção, migrar arquivos para object storage privado e usar URL assinada/expiração.

## Financeiro gerencial
Incluídos ExpenseCategory, Expense e GeneratedDocument. APIs de contas a pagar, baixa, despesas, fluxo de caixa, DRE e previsto x realizado.

### Endpoints
- POST /api/v1/documents/quotes/:id/pdf
- POST /api/v1/documents/service-orders/:id/pdf
- GET /api/v1/management-finance/payables
- POST /api/v1/management-finance/payables
- POST /api/v1/management-finance/payables/:id/pay
- GET /api/v1/management-finance/expense-categories
- POST /api/v1/management-finance/expenses
- GET /api/v1/management-finance/cash-flow?from=&to=
- GET /api/v1/management-finance/dre?from=&to=
- GET /api/v1/management-finance/planned-vs-actual

## Próximos hardenings antes de produção
Autorização por permission code nos novos endpoints, object storage, assinatura/expiração de compartilhamentos, migrations versionadas, integração de mensageria (WhatsApp/e-mail), testes de integração com PostgreSQL e testes E2E do fluxo comercial.
