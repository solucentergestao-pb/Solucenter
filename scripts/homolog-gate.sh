#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
: "${DATABASE_URL:?DATABASE_URL obrigatório}"
: "${JWT_SECRET:?JWT_SECRET obrigatório}"
[ ${#JWT_SECRET} -ge 48 ] || { echo 'JWT_SECRET deve ter >=48 caracteres'; exit 1; }
npx prisma validate --schema packages/db/schema.prisma
npx prisma generate --schema packages/db/schema.prisma
npx prisma migrate deploy --schema packages/db/schema.prisma
npm --workspace apps/api test
npm --workspace apps/api exec tsc -- --noEmit
