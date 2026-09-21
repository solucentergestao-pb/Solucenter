# Incremento 3 — SoluCenter V1

## Entregue
- Seed idempotente da empresa, administrador, perfis ADMIN/GESTOR/TECNICO/FINANCEIRO e permissões granulares.
- Cadastro de unidade e ambiente pela ficha do cliente.
- Cadastro completo inicial de equipamento com dados de instalação.
- QR Code PNG gerado no backend a partir de token não sensível.
- Upload multipart real de fotos JPG/PNG/WEBP (até 8 MB) para equipamento e OS.
- Estrutura de auditoria e helper para registrar alterações críticas.
- Testes automatizados iniciais de rentabilidade e validação.

## Produção
O armazenamento local de `uploads/` serve ao desenvolvimento. Em produção, substituir por object storage privado (S3/R2/Azure Blob) com URLs assinadas. Nunca manter `JWT_SECRET` padrão. Definir `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD` antes do seed.

## Próximo incremento
Orçamento -> aprovação -> conversão transacional em OS -> contas a receber -> pagamentos -> painel financeiro.
