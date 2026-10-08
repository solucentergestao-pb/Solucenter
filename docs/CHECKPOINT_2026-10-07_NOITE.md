# Solucenter — checkpoint de retomada (07/10/2026, noite)

Este arquivo existe para impedir retrabalho na próxima conversa. Retomar daqui, sem repetir os testes e correções já concluídos.

## Estado confirmado em produção
- O painel web publicado abriu corretamente.
- O fluxo Cliente -> Unidade -> Ambiente -> Equipamento foi destravado.
- O ambiente "sala teste" passou a abrir o cadastro de equipamento após a correção já integrada ao `main`.
- A correção de navegação de ambiente está no `main` pelo PR #11 / commit `0dd73a3`.

## Regra funcional definida nesta conversa
A sequência operacional deve ser:
1. Cadastrar cliente.
2. No mesmo fluxo, registrar os dados comerciais do cliente e sua primeira unidade/endereço.
3. Criar ambiente.
4. Criar equipamento já vinculado a cliente + unidade + ambiente.
5. Ao salvar o equipamento, gerar automaticamente um QR Code exclusivo.
6. O QR deve abrir a ficha daquele equipamento, preservando o vínculo com cliente, unidade e ambiente.
7. Disponibilizar arquivos para impressão:
   - PDF da etiqueta.
   - PNG do QR Code.

## Cliente — estado e próximo ajuste
O backend já aceita:
- PF/PJ
- Nome / razão social
- Nome fantasia / razão legal
- CPF/CNPJ
- Telefone
- WhatsApp
- E-mail
- Observações

O endereço já é modelado corretamente como `CustomerUnit`, permitindo vários endereços por cliente.

A tela atual de cliente ainda está simplificada demais (tipo, nome e WhatsApp).
Próximo trabalho: transformar o primeiro cadastro em "dados do cliente + primeira unidade/endereço", sem duplicar endereço no modelo.

Existe a branch:
- `feat/customer-registration-flow-20261007`

Ela foi criada para esse ajuste, mas o formulário novo ainda não foi implementado.

## Equipamento + QR — trabalho já salvo
Branch:
- `feat/equipment-qr-link-20261007`

Commits salvos:
- `fe38e319` — geração de PDF de etiqueta QR.
- `90e94b9` — botões de download de PDF e PNG na tela de novo equipamento.
- `c18929a` — etiqueta padrão reduzida para 60 x 40 mm.

Decisões:
- Tamanho padrão da etiqueta: 60 x 40 mm.
- QR visualmente discreto, aproximadamente 25 mm.
- Etiqueta deve mostrar apenas o essencial: Solucenter, código do equipamento, tipo/capacidade e QR.
- PDF é o formato principal para gráfica.
- PNG é a alternativa rápida.
- DOCX não é prioridade para impressão.

## Ponto pendente mais importante do QR
O backend já cria o token do QR automaticamente junto com o equipamento.
O QR hoje aponta para:
- `/q/<token>`

Mas a tela pública/rota de destino desse QR ainda não foi implementada.
Portanto, NÃO considerar o QR concluído até existir uma página que abra a ficha correta do equipamento ao escanear.

## Próxima sequência de trabalho
Retomar nesta ordem:
1. Finalizar a rota/tela `/q/<token>` para o QR abrir a ficha do equipamento.
2. Validar o PDF 60 x 40 mm e o download PNG.
3. Rodar typecheck/build/testes apenas das mudanças novas de QR/etiqueta.
4. Abrir/validar PR da branch `feat/equipment-qr-link-20261007`.
5. Depois voltar para `feat/customer-registration-flow-20261007` e implementar o formulário completo de cliente + primeira unidade/endereço.
6. Integrar o fluxo Cliente -> Unidade -> Ambiente -> Equipamento -> QR.
7. Só então publicar e fazer um teste de ponta a ponta novo, sem repetir os testes antigos já aprovados.

## Regra de retomada
Na próxima conversa:
- Não recomeçar por Render.
- Não refazer teste de clique em cliente.
- Não refazer teste de unidade.
- Não refazer teste de ambiente.
- Não refazer a correção "sala teste não abre".
- Não recriar QR do zero.
- Continuar diretamente do item "rota/tela /q/<token> + finalizar etiqueta QR" e depois concluir o novo fluxo de cadastro de cliente.
