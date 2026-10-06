# SOLUCENTER — Plano e acompanhamento de conclusão
Data-base: 03/10/2026, America/Fortaleza.
Repositório: solucentergestao-pb/Solucenter.
Entrega atual: https://github.com/solucentergestao-pb/Solucenter/pull/3 (branch fix/financial-integrity, baseada no PR #2; ainda não integrada nem publicada).

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
- Validação inicial local Node 24.19; segunda validação completa em CI com Node 22.23.3 e PostgreSQL 16, conforme runtime declarado.
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

## Prioridade de execução — 03/10, após orientação financeira
Até 10/10 priorizar ferramentas/autonomia para segurança, banco, testes de integração, migrations e fluxo mínimo de operação. Não contratar infraestrutura nem comprar créditos. Recursos acessórios ficam depois.

Nova entrega em fix/operational-security, PR #2, baseada no PR #1:
- Rota de unidades exigida pelo orçamento implementada com escopo de empresa.
- Operações da OS protegidas por consulta à empresa proprietária antes de gravações.
- Criação de OS valida vínculos de cliente, unidade, ambiente, equipamento, serviço e responsáveis ativos.
- Rentabilidade exige profit.read.
- Conversão de orçamento valida vínculos e reivindica atomicamente o orçamento na transação.
- 18 testes de rotas adicionados; 47 testes locais passaram, typecheck e build API aprovados.
- Teste PostgreSQL do ciclo operacional adicionado, com URL local isolada obrigatória. Workflow GitHub com PostgreSQL 16/Node 22 aprovado: migrations aplicadas, 48 testes aprovados (incluindo ciclo real PostgreSQL), typecheck e builds web/API aprovados. Evidência: https://github.com/solucentergestao-pb/Solucenter/actions/runs/37142651010. Commit cb634e8abb339d92d0a3de4ad665bfb57ce8235a. API básica ponta a ponta verificada; telas, uploads, estoque e demais casos negativos ainda não integralmente homologados. Não alterar a pontuação das frentes completas antes de cumprir seus critérios.
- Integração Render localizada, ainda sem conexão confirmada. Necessária para verificar logs, deploys e dados reais de produção.

Pontos difíceis restantes para auditoria: concorrência em pagamentos e faturamento; propriedade de relações nas cobranças manuais; armazenamento de fotos em produção; migrations no banco existente; integridade dos caminhos de navegação do fluxo operacional.

Atualização adicional: Next.js fixado em 16.3.8, removendo a versão afetada pelo aviso GHSA-vcvr-r3jv-pc5j. Build web e typecheck locais aprovados. Não se encontrou uso de next/og ImageResponse neste projeto. Pendência de auditoria: deepmerge-ts na cadeia do Prisma CLI; investigar atualização compatível, sem downgrade forçado do Prisma.

## Execução de 04/10/2026 — integridade financeira
Meta do ciclo: eliminar pagamento com saldo sobrescrito, faturamento duplicado e cobrança com vínculos de cliente/empresa incorretos.
- Pagamento reivindica atomicamente saldo/status dentro da transação antes de gravar o registro. Requisição desatualizada recebe 409.
- Faturamento de OS e cobrança manual compartilham a transição condicional COMPLETED → INVOICED; somente uma requisição pode gerar cobrança.
- Cobrança manual valida cliente, OS e orçamento dentro da transação e preserva histórico.
- Endpoint de faturamento exige finance.write; técnico sem essa permissão é bloqueado.
- Valores monetários devem respeitar Decimal(12,2); frações de centavo são rejeitadas.
- Cenários PostgreSQL novos: pagamentos integrais concorrentes, parciais com conservação de saldo, corrida entre dois endpoints de faturamento, vínculos estrangeiros/inconsistentes, isolamento/permissões e centavos exatos.
- Primeira revisão passou PostgreSQL16/Node22 (53 testes e builds) em https://github.com/solucentergestao-pb/Solucenter/actions/runs/37200037544; revisão com precisão de centavos aprovada: 54 testes, migrations, typecheck e builds API/web em https://github.com/solucentergestao-pb/Solucenter/actions/runs/37200152116.
- PR #1 e PR #2 continuam abertos; último CI do PR #2 aprovado em https://github.com/solucentergestao-pb/Solucenter/actions/runs/37142899552.
- Nenhuma alteração no Render, nenhuma migration em produção e nenhum dado real de cliente modificado.

Pontuação anterior 40/100; atual 40/100; ganho +0 p.p.; restante 60/100. A correção e os testes comprovam o subfluxo de contas a receber; o marco de três pontos da frente financeiro exige também seus demais fluxos (contas a pagar, fluxo de caixa/DRE e testes negativos relevantes). Não creditá-lo parcialmente ou inventar percentual operacional.

Próxima meta: armazenamento privado de fotos e autorização de acesso, seguida por validação das telas do ciclo operacional. Acesso Render ainda não confirmado; nenhuma ferramenta Render conectada estava disponível nesta execução. Preservar a rotina: há trabalho de código independente desse acesso.

A tela de contas a receber foi ajustada para exibir falhas/sucesso, atualizar o saldo após tentativa de pagamento, bloquear cliques repetidos e ocultar pagamento em cobranças canceladas. Build web local com Next.js 16.3.8 e typecheck aprovados; não equivale a teste de uso da tela em produção.

## Execução de 05/10/2026 — fotos privadas e autorização
Meta do ciclo: retirar caminhos públicos/arbitrários das fotos de equipamento e OS e comprovar isolamento na API.
- Novos uploads usam chaves internas `private://` e diretório não público com permissões restritas; a resposta apresenta somente endpoint autenticado de download.
- Leitura de foto exige JWT, empresa proprietária e, no portal, o cliente proprietário. Perfil interno também precisa da permissão de leitura correspondente.
- Upload exige permissão específica, categoria válida, limite de 8 MB e assinatura binária coerente com JPG, PNG ou WEBP; apenas declarar o MIME não é suficiente.
- A rota antiga de foto da OS não aceita mais `fileUrl` fornecida pelo cliente, eliminando referência arbitrária a arquivos externos ou de outro atendimento.
- Falha ao persistir o registro remove o arquivo recém-criado. Em produção sem `PRIVATE_UPLOAD_ROOT`, o endpoint responde indisponibilidade e não grava em disco efêmero por engano.
- PDF técnico consegue ler internamente as novas chaves privadas sem publicar o arquivo original. Listagens de equipamentos e portal substituem a chave por URL autenticada.
- Teste PostgreSQL acrescentado: upload real multipart de equipamento e OS, download autorizado, bloqueio de empresa estrangeira, isolamento entre clientes do portal, rejeição sem autenticação, rejeição de conteúdo falso e bloqueio da rota arbitrária.
- Revisão integrada sobre a PR #7 aprovada no PostgreSQL 16/Node 22: migrations, 54 testes, typecheck e builds API/web em https://github.com/solucentergestao-pb/Solucenter/actions/runs/37304143340.
- Configuração Render documentada para Persistent Disk privado, mas não aplicada: integração Render e disco persistente continuam sem acesso confirmado. Fotos antigas com caminhos legados ainda exigem migração controlada antes da publicação.

Pontuação anterior 40/100; atual 40/100; ganho +0 p.p.; restante 60/100. O código e o teste isolado não satisfazem os 2 pontos de armazenamento privado porque ainda faltam disco/object storage real, migração dos arquivos legados e validação após deploy.

Próxima meta: migrar fotos legadas de forma segura quando houver ambiente e testar pelas telas o ciclo equipamento → OS → foto → relatório. Não alterar dados de produção sem acesso e cópia de segurança confirmados.

## Execução de 06/10/2026 — PDFs privados e dashboard isolado
Meta do ciclo: fechar o fluxo real de documentos/dashboard com casos negativos e retirar a exposição direta dos PDFs.
- PDFs de orçamento e relatório técnico agora são gravados no armazenamento privado; API e tela não recebem o caminho físico.
- Link público usa token aleatório de 48 caracteres hexadecimais, expira por padrão em 7 dias e entrega o PDF somente após validar token, prazo e arquivo. A validade pode ser configurada entre 1 e 90 dias.
- Geração exige `document.write`; consulta autenticada exige `document.read`. Empresa estrangeira e técnico sem permissão são bloqueados.
- Falha ao registrar o documento remove o PDF recém-criado para evitar arquivo órfão.
- Tela de documentos substituiu a digitação de UUID pela seleção de orçamento ou OS cadastrados e informa a expiração do link.
- Dashboard exige `dashboard.read`. Teste isolado cria uma segunda empresa e comprova receita, custos, lucro, série mensal e bloqueio do perfil sem permissão.
- PostgreSQL 16/Node 22 aprovou migrations, 56 testes, typecheck e builds API/web. Evidência: https://github.com/solucentergestao-pb/Solucenter/actions/runs/37457067231.
- Os testes geram e leem PDFs reais (`%PDF`), validam orçamento e relatório de OS, token adulterado, link expirado, tenant estrangeiro e dashboard com totais exatos.
- Não houve deploy no Render, uso de banco de produção ou alteração de registros reais.

Pontuação anterior 40/100; atual 43/100; ganho +3 p.p.; restante 57/100. Os 3 pontos correspondem ao fluxo real e aos casos negativos de integração da frente documentos/dashboard. Os 2 pontos de publicação dessa frente continuam pendentes; build ou número de testes não foram contados novamente.

Próxima meta: fechar contas a pagar/fluxo de caixa/DRE com integração PostgreSQL e casos negativos, completando a parte financeira ainda pendente. Em seguida, avançar agenda/preventivas/notificações/portal. A migração de fotos antigas e o smoke test de produção continuam dependentes de acesso ao ambiente persistente.
