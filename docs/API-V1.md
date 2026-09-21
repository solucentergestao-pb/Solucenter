# Solucenter API V1 — contrato implementado
Base: `/api/v1`. Autenticação: `Authorization: Bearer <JWT>`. Erros seguem `{ "error": { "code", "message", "details?" } }`.

| Endpoint | Método | Regra / validação | Sucesso | Erros principais |
|---|---|---|---|---|
| `/auth/login` | POST | e-mail válido, senha >=6 | 200 token + usuário | 401 INVALID_CREDENTIALS, 422 VALIDATION_ERROR |
| `/auth/me` | GET | JWT | 200 claims | 401 |
| `/customers` | GET | JWT/company scope; `search?` | 200 lista | 401 |
| `/customers` | POST | type PF/PJ, name >=2, email válido | 201 cliente | 409 CUSTOMER_CONFLICT, 422 |
| `/customers/:id` | GET | pertence à empresa | 200 cliente/unidades/equipamentos | 404 |
| `/customers/:id/units` | POST | cliente da empresa, name >=2, UF <=2 | 201 unidade | 404, 422 |
| `/units/:id/environments` | POST | unidade da empresa, name >=2 | 201 ambiente | 404, 422 |
| `/equipment` | GET | company scope | 200 lista | 401 |
| `/equipment` | POST | relações válidas, BTU/tensão positivos | 201 equipamento + QR | 422 INVALID_RELATION |
| `/materials` | GET | company scope | 200 materiais | 401 |
| `/service-orders` | GET | company scope | 200 OS | 401 |
| `/service-orders` | POST | cliente/unidade, problema >=3, prioridade válida | 201 OS | 422 |
| `/service-orders/:id/measurements` | POST | números opcionais; ΔT calculado | 201 medição | 422 |
| `/service-orders/:id/materials` | POST | quantidade >0, estoque suficiente | 201 consumo + baixa atômica | 404, 409 INSUFFICIENT_STOCK |
| `/service-orders/:id/photos` | POST | categoria + fileUrl | 201 foto | 422 |
| `/service-orders/:id/complete` | POST | diagnóstico/serviço >=3, valores >=0 | 200 OS concluída | 404, 409 INVALID_STATUS_TRANSITION, 422 |
| `/service-orders/:id/profitability` | GET | company scope | 200 receita/custos/lucro/margem | 404 |

## Nova OS — payload mínimo
```json
{"customerId":"uuid","unitId":"uuid","priority":"NORMAL","reportedProblem":"Equipamento não refrigera"}
```
## Medição
```json
{"voltage":220,"current":7.8,"returnTemperature":27,"supplyTemperature":14}
```
O backend calcula `deltaT=13`.
## Material
```json
{"materialId":"uuid","quantity":3.5}
```
Executa em transação: cria item da OS + decrementa estoque + cria `InventoryMovement`.
## Conclusão
```json
{"technicalDiagnosis":"Capacitor fora da faixa","performedService":"Substituição e testes","finalValue":650,"laborCost":120,"travelCost":40,"feesCost":0,"otherCost":0}
```
## Rentabilidade
```json
{"revenue":650,"costs":{"materials":95,"labor":120,"travel":40,"fees":0,"other":0},"totalCost":255,"profit":395,"margin":60.77}
```

## Ciclo comercial (Incremento 4)
### POST /quotes
Cria orçamento e calcula no servidor custo/lucro/margem previstos.
### POST /quotes/:id/send
DRAFT -> SENT. Erros: 404 QUOTE_NOT_FOUND; 409 INVALID_QUOTE_STATUS.
### POST /quotes/:id/approve
SENT/VIEWED -> APPROVED. Erros: QUOTE_EXPIRED, INVALID_QUOTE_STATUS.
### POST /quotes/:id/convert-to-service-order
Cria uma OS vinculada ao orçamento aprovado. Erros: QUOTE_NOT_APPROVED, UNIT_REQUIRED, QUOTE_ALREADY_CONVERTED.
### POST /service-orders/:id/start
Move a OS para IN_PROGRESS.
### POST /service-orders/:id/invoice
Body `{ "dueDate":"2026-09-30" }`. Exige OS COMPLETED e cria conta a receber, mudando OS para INVOICED.
### POST /finance/receivables/:id/payments
Body `{ "amount":500, "paymentMethod":"PIX" }`. Atualiza saldo/status; ao zerar, conta fica PAID e OS vinculada fica RECEIVED.
### GET /dashboard
Resumo mensal: receita efetivamente recebida, custos operacionais, resultado, margem, saldo a receber, OS concluídas e orçamentos pendentes.
