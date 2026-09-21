# Incremento 6 — Documentos, compartilhamento e dashboard real

## Entregas
- PDF comercial com identidade Solucenter, logomarca configurável (`Company.logoUrl`), cabeçalho, rodapé e paginação.
- Relatório de OS com fotos do atendimento e assinatura do cliente quando existentes.
- Link público por token para documentos gerados, sem expor IDs internos.
- Compartilhamento web por WhatsApp, e-mail (`mailto`) e Web Share API/clipboard.
- Dashboard consumindo `/api/v1/dashboard` e série mensal em `/api/v1/dashboard/monthly`.
- Gráfico responsivo Previsto × Realizado para faturamento, lucro e margem.

## Regra do previsto x realizado
Previsto: orçamentos SENT/VIEWED/APPROVED criados no mês, usando total e estimatedCost.
Realizado: pagamentos recebidos no mês menos custos diretos de OS concluídas no mês.

## Produção
Para envio transacional de e-mail (em vez de abrir o cliente de e-mail), conectar um provedor de e-mail e fila. Para WhatsApp Business automático, conectar a API oficial e templates aprovados. Arquivos devem migrar do disco local para object storage privado com URL assinada/expiração.
