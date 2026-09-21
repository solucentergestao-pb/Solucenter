# Incremento 12 — Produção (iniciado)

A fase de produção foi iniciada com configuração de ambiente, gates de deploy e checklist. Pendências que exigem infraestrutura/credenciais reais: banco PostgreSQL gerenciado, object storage privado, domínio/DNS/TLS, WhatsApp Business Cloud, provedor de e-mail, secrets manager, backup/PITR, observabilidade e execução do smoke test pós-deploy.

## Critérios de go-live
- migrations aplicadas com backup e plano de rollback;
- HTTPS obrigatório e CORS restrito;
- JWT_SECRET forte em secret manager;
- arquivos privados em object storage com signed URLs;
- webhooks WhatsApp/e-mail com assinatura validada;
- backup automático e restauração testada;
- logs sem senhas/tokens/dados sensíveis desnecessários;
- E2E crítico verde no ambiente de produção antes da abertura aos clientes.
