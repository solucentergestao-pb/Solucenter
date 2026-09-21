# Incremento 10 — Fechamento funcional V1

## Entregue
- Cadastro de fornecedores.
- Compras com itens, custo e entrada transacional no estoque.
- Atualização de último custo do material e movimento `PURCHASE`.
- Pesquisa global por cliente, equipamento, OS e orçamento.
- Provisionamento administrativo de usuários do Portal do Cliente.
- Endpoint de prontidão (`/api/v1/closing/readiness`) para localizar configurações faltantes antes da homologação.
- Teste de cálculo de compras.

## Próxima fase
O Incremento 11 deve ser homologação/segurança: migrations reais em PostgreSQL de homologação, RBAC em todos os endpoints, LGPD, webhooks assinados, testes E2E e revisão de falhas. O Incremento 12 fica reservado à infraestrutura e produção.
