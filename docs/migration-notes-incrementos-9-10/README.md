# Migration Incrementos 9–10

O schema Prisma contém os modelos do Portal do Cliente e fechamento funcional (fornecedores/compras). Antes de produção execute `prisma migrate dev --name incremento_9_10` em PostgreSQL de homologação e revise o SQL gerado. Não aplique diretamente em produção sem backup e homologação.
