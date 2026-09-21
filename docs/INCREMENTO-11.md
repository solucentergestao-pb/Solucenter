# Incremento 11 — Homologação, Segurança e LGPD

## Etapa A — Schema/PostgreSQL
- PostgreSQL 16 de homologação definido em `infra/docker-compose.homolog.yml`.
- Ambiente separado em `.env.homolog.example`.
- `prisma migrate deploy`, `prisma validate` e `prisma generate` passam a ser gates obrigatórios do pipeline.
- Nenhuma credencial padrão é aceita em produção.

## Etapa B — autorização, segurança, LGPD e E2E
- Matriz RBAC centralizada em `lib/security.ts`, incluindo ADMIN, GESTOR, TECNICO e FINANCEIRO.
- Portal mantém token e escopo de cliente separados do JWT administrativo.
- Headers de segurança e CORS allowlist em produção.
- Uploads não devem ser publicados por diretório estático em produção; arquivos devem migrar para object storage privado/signed URL no Incremento 12.
- Documentos públicos devem ter expiração, revogação e token aleatório.
- Dados de custos/lucro/margem permanecem excluídos dos DTOs do portal.
- Política de retenção inicial documentada em `lib/lgpd.ts`; exclusão/anonymização operacional exige aprovação jurídica da política final.

## Gate E2E
1. Admin cria cliente/unidade/equipamento/QR.
2. Comercial cria e envia orçamento.
3. Cliente aprova no Portal.
4. OS é criada/agendada e técnico designado.
5. Técnico inicia, registra medição/material/fotos e conclui.
6. PDF é gerado e disponibilizado ao cliente.
7. Cobrança, pagamento e recibo são registrados.
8. Dashboard/DRE refletem realizado.
9. Preventiva e notificação são geradas.
10. Testes negativos: técnico sem `profit.read`; cliente A não acessa cliente B; token expirado/revogado falha; arquivo privado não é enumerável.

## Situação
Código de hardening incluído. A execução contra PostgreSQL externo/gerenciado depende das credenciais do ambiente de homologação e é gate antes da produção.
