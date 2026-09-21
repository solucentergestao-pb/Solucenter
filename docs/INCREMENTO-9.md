# Incremento 9 — Portal do Cliente

Implementação funcional do portal, sobre a base do Incremento 8.

## Entregue
- Autenticação JWT própria do cliente, separada da autenticação administrativa.
- Usuário de portal vinculado obrigatoriamente a `companyId` e `customerId`.
- Dashboard do cliente.
- Equipamentos e leitura de QR restrita ao proprietário.
- Solicitações de atendimento.
- Orçamentos sem exposição de custo/lucro/margem, com aprovação/recusa auditável e snapshot.
- Acompanhamento de OS sem custos internos.
- Planos/ocorrências de preventiva.
- Documentos PDF autorizados.
- Contas a receber, pagamentos e recibos existentes.
- Central de notificações do cliente.
- Tela mobile `/portal` e login `/portal/login`.

## Segurança
A API nunca confia em `customerId` enviado pelo navegador. O escopo vem do JWT do portal. Testes unitários verificam remoção de custos internos e bloqueio de acesso cruzado.
