# Validação do transporte HTTP — 11/10/2026

## Correção

O cliente central da API declarava `Content-Type: application/json` em requisições sem corpo. Fastify rejeita esse formato antes de executar a rota, incluindo a geração de PDFs pela tela Documentos. O cabeçalho agora é definido automaticamente apenas quando há corpo e não é FormData. Cabeçalhos fornecidos como Headers, tuplas ou objeto são preservados.

## Evidência desta execução

- Base revisada: `69b69d8cc2be30ba9948894dcc311f24614fd662`, confirmada Live no Render para painel e API.
- `npm test`: 54 aprovados; 15 ignorados por exigirem banco local descartável.
- Testes novos: geração de documento sem corpo contra Fastify real; payload JSON e cabeçalho de autorização; upload FormData sem interferir no boundary.
- `npm run typecheck`: aprovado para API e painel.
- `npm run build:web`: compilação de produção aprovada.

## Próximo ponto

O navegador de homologação foi redirecionado para login ao abrir `/os`. Não houve alteração em cobranças nem pagamentos reais nesta execução. Após autenticação, validar a abertura dos detalhes da OS 000001, sua situação financeira e o PDF; a geração de cobrança deve respeitar o valor e o vencimento definidos pelo responsável.
