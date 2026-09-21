# Incremento 7 — Implantação operacional

## Entregue nesta etapa
- Configuração persistente da empresa e identidade comercial.
- Agenda operacional por técnico, com bloqueio de conflito de horário.
- Base de planos de manutenção preventiva por cliente/equipamento.
- Ocorrências futuras de preventiva e consulta dos próximos 30 dias.
- Interfaces móveis para Configuração da Empresa, Agenda e Preventivas.
- Testes unitários da regra de sobreposição de agenda.

## API
- GET/PUT `/api/v1/operations/company-settings`
- GET `/api/v1/operations/technicians`
- GET/POST `/api/v1/operations/schedule`
- GET/POST `/api/v1/operations/maintenance-plans`
- GET `/api/v1/operations/maintenance-due`

## Próximo incremento
Central de notificações com templates, fila e histórico de entrega; adaptadores de WhatsApp Business e e-mail; eventos de orçamento, agenda, preventiva, cobrança e OS; depois Portal do Cliente.
