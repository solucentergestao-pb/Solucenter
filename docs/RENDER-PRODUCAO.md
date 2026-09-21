# Render — produção da API Solucenter

## Estrutura esperada no GitHub

O conteúdo desta pasta `repo/` deve ser publicado na raiz da branch `main`.
Assim, `package.json`, `package-lock.json`, `apps/` e `packages/` ficam na raiz
do repositório, sem uma pasta `repo/` adicional.

## Web Service

- Runtime: Node
- Region: Ohio (US East)
- Root Directory: vazio
- Build Command: `npm install && npx prisma generate && npm run build`
- Start Command: `npx prisma migrate deploy && npm start`

O `package.json` da raiz aponta o Prisma para
`packages/db/schema.prisma`, portanto os comandos configurados no Render
localizam o schema sem argumentos adicionais.

## Variáveis obrigatórias

- `DATABASE_URL`: URL interna do PostgreSQL no Render.
- `JWT_SECRET`: segredo forte, com pelo menos 48 caracteres.
- `NODE_ENV`: `production`.

Não registre os valores dessas variáveis no GitHub ou em documentos.

## Verificação após o deploy

1. Confirmar que `prisma migrate deploy` aplicou as migrations.
2. Confirmar que a API iniciou usando a porta fornecida por `PORT`.
3. Abrir `/health` e verificar a resposta com `status: "ok"`.
