# SOLUCENTER — Plano e acompanhamento de conclusão
Data-base: 03/10/2026, America/Fortaleza.
Repositório: solucentergestao-pb/Solucenter.
Entrega atual: https://github.com/solucentergestao-pb/Solucenter/pull/1 (aberta, ainda não integrada nem publicada).

## O que o percentual significa
Índice de cumprimento de marcos de entrega da V1, com pesos definidos hoje. Não é estimativa de horas, quantidade de código correta nem porcentagem de funcionalidades operacionais. A existência de código recebe crédito apenas no marco de estrutura disponível; não implica funcionamento. Não há percentual global histórico anterior confiável para comparação. A linha de base é conservadora e provisória: 40/100 pontos reconhecidos e 60/100 ainda não comprovados. Pode ser revisada para baixo se a auditoria invalidar marcos. Não converter ausência de evidência em confirmação de falha.

## Régua de 100 pontos
Dez frentes de igual peso: autenticação/permissões; clientes/unidades/ambientes; equipamentos/QR/fotos; OS/execução/materiais; orçamentos/ciclo comercial; financeiro; documentos/dashboard; agenda/técnicos/preventivas; notificações; portal.
Para cada frente:
- 3 pontos: estrutura de código de interface/API correspondente presente no repositório e identificada.
- 1 ponto: verificação de tipos e compilação do projeto aprovada.
- 3 pontos: fluxo principal e casos negativos relevantes verificados por testes de integração/E2E do código real, com banco isolado quando necessário. Testes que reproduzem fórmulas em funções locais não bastam.
- 2 pontos: versão efetivamente publicada, migrations/rotas validadas e fluxo principal testado no ambiente real, com registros de teste controlados.
Total nas dez frentes: 90 pontos.
Últimos 10 pontos: 2 cada para restauração de backup comprovada; armazenamento privado/upload autorizado; configuração HTTPS/secrets/logs sem vazamento; autorização/isolamento entre clientes comprovado no ambiente real; aceite final do ciclo completo com roteiro reproduzível.

## Linha de base
Dez frentes com estrutura identificada: 30 pontos. Typecheck aprovado e builds web/API aprovados: 10 pontos.
Testes integrados completos por frente: 0 pontos reconhecidos nesta auditoria. Os 29 testes existentes passaram, mas não demonstram todos os fluxos reais.
Publicação validada por frente: 0 pontos reconhecidos nesta auditoria (o sistema existente não foi inspecionado no ambiente real).
Prontidão operacional: 0 pontos reconhecidos nesta auditoria.
Total: 40/100. Restante a comprovar: 60/100.
Não atribuir ganho diário às correções de hoje sem antes demonstrar um novo critério. Hoje estabelece a primeira linha de base, não um avanço artificial de zero a 40.

## Evidências de 03/10
- Código de dez frentes disponível em apps/web/app e apps/api/src/routes; schema Prisma disponível.
- Correções em unidades/ambientes: erros visíveis, tentativa de recarregar, validação de nome/UF/unidade e bloqueio de salvamento repetido.
- Equipamentos: erros de carregar/salvar visíveis e descarte de respostas antigas ao trocar unidade ou cliente.
- Prisma Client gerado; typecheck API/web aprovado; 11 arquivos/29 testes existentes aprovados; build Next.js aprovado; build API aprovado.
- Runtime de validação Node 24.19, enquanto o projeto declara Node 22; repetir a homologação no runtime declarado.
- PR #1 aberto; não confundir correção em branch com publicação no Render.
- Encontrada uma divergência para investigar: novo orçamento consulta /units/customer/:id; essa rota não consta no arquivo units.ts examinado.
- docs/INCREMENTO-11.md exige E2E com banco; docs/INCREMENTO-12-START.md lista dependências de produção ainda a confirmar.

## Rotina e meta
Executar um bloco técnico delimitado por ciclo, corrigir, validar e salvar código e evidências no GitHub. Meta de referência: até 10 pontos percentuais por dia, somente quando os critérios forem realmente atingidos; não é promessa de ganho fixo, execução contínua ou prazo garantido.
Relatório: pontuação anterior, atual, ganho em pontos percentuais, restante, meta/entrega do ciclo, links de commits/PRs, testes executados, publicação separada e dependências específicas.
Se não houver ganho comprovado, informar +0 p.p. e o motivo. Não pedir prints ou comandos que possam ser executados diretamente. Preservar trabalho existente e usar branches; não alterar registros reais sem dados de teste controlados e autorização pertinente.

## Cronograma inicial
03/10: linha de base, primeiras correções e plano — entregue.
04/10: cadastros de clientes/unidades/ambientes e equipamentos; investigar rotas divergentes e criar testes relevantes.
05/10: orçamento → OS → execução; coerência de relações, materiais e estados.
06/10: financeiro, PDFs e dashboard; valores/recebimentos e acesso.
07/10: agenda, preventivas, notificações e portal; escopo e integração.
08/10: integração completa e testes de segurança em ambiente isolado.
09/10: publicação e validação operacional, se os acessos e infraestrutura estiverem disponíveis.
Datas são sequência-alvo, não garantia. Se uma etapa não fechar, manter sua pendência e replanejar sem contabilizar pontos fictícios. O objetivo de 100% é atender todos os critérios, não apenas chegar à última data.

## Dependências
Acesso GitHub confirmado. Acesso ao Render, PostgreSQL de homologação, object storage e provedores de mensagens ainda não confirmado nesta sessão. Avançar no código/testes independentes desses acessos. Solicitar somente a dependência concreta quando necessária. Nunca incluir credenciais no relatório.
