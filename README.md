# Solucenter V1 — incremento 2
Implementa a base ponta a ponta para Login, Clientes, Unidades, Ambientes, Equipamentos e Nova OS em 4 etapas, com materiais, medições, fotos por referência de storage e rentabilidade.

## Subir localmente
1. `docker compose up -d`
2. `npm install`
3. defina `DATABASE_URL=postgresql://solucenter:solucenter@localhost:5432/solucenter` e `JWT_SECRET`.
4. `npx prisma generate --schema packages/db/schema.prisma`
5. `npx prisma db push --schema packages/db/schema.prisma`
6. `npm run dev:api` e `npm run dev:web`

## Estado atual
- Schema Prisma ampliado com RBAC, auditoria, índices e relacionamentos.
- API real com JWT e Prisma para os módulos principais desta entrega.
- Interface Next.js para login, clientes, equipamentos e Nova OS em 4 etapas.
- Consumo de material usa transação e baixa estoque.
- ΔT e rentabilidade são calculados no backend.

## Próximo incremento recomendado
Seed de empresa/admin/permissões; upload real de fotos (S3 compatível); CRUD visual de unidades/ambientes/equipamentos; testes automatizados; orçamento/financeiro.


## Incremento 3
```bash
docker compose up -d
npm install
npm --workspace packages/db run generate
npm --workspace packages/db run push
SEED_ADMIN_EMAIL=admin@solucenter.com.br SEED_ADMIN_PASSWORD='uma-senha-forte' npm --workspace packages/db run seed
npm run dev:api
npm run dev:web
npm --workspace apps/api test
```
Veja `docs/INCREMENTO-3.md`.

## Incremento 5
Interface móvel profissional, geração de PDFs de orçamento/OS/relatório, base de compartilhamento por token, contas a pagar, despesas, fluxo de caixa, DRE gerencial e previsto x realizado. Consulte `docs/INCREMENTO-5.md`.


## Incremento 6
Documentos comerciais com identidade/fotos/assinatura, compartilhamento por link, WhatsApp/e-mail/Web Share e dashboard mensal real previsto x realizado. Veja `docs/INCREMENTO-6.md`.
