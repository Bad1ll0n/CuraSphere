# Módulos da API sem interface (ARQ-16)

Levantamento de 2026-11-24: controllers da API cujo prefixo nenhum ecrã da web nem da app móvel chama. A guarda `estrutura — módulos sem consumidor` (em `apps/api/src/app/common/estrutura.spec.ts`) falha se aparecer um módulo novo nesta situação sem ser acrescentado aqui e à lista dela.

## Integrações externas (o consumidor não é a web nem o mobile)

| Prefixo | Quem chama |
|---|---|
| `fhir` | Sistemas externos (FHIR R4, PROD-14) |
| `hl7` | HIS / motor de integração (HL7 v2 ADT, SEC-22) |
| `sns-pem` | Integração PEM (PROD-14) |
| `webhooks` | Configuração de subscritores externos |

## Usados por outros módulos ou por indicadores

| Prefixo | Estado |
|---|---|
| `episodios` | O núcleo (`episodios.core`) é usado por admissão, alta e camas; o controller só expõe `indicadores/reinternamentos`, ainda sem ecrã. |
| `ficheiros` (comunicação) | Anexos da comunicação interna, sem ecrã próprio. |
| `protocolos` | Serviço importado por 2 módulos; as rotas não têm ecrã. |

## Sem consumidor — decisão de produto (PROD-20)

| Prefixo | Linhas | O que faz | Testes |
|---|---|---|---|
| `population-health` | ~210 | Análise populacional (agregados por diagnóstico) | nenhum |
| `regras-clinicas` | ~170 | Regras de apoio à decisão configuráveis | nenhum |
| `triagem-portal` | ~135 | Triagem de sintomas no portal do doente | nenhum |
| `lista-espera` (agenda-fluxo) | ~290 | Lista de espera de consultas | nenhum |
| `transferencias` | ~190 | Transferências entre hospitais | integração |
| `outcomes` | ~130 | Registo de resultados clínicos | integração |

Para cada um: ligar a um ecrã (se fizer parte do núcleo de enfermagem) ou remover. Até essa decisão, ficam como estão: não há rota exposta que contorne as guardas (todos têm `@Roles` e passam pelo `AcessoDoenteInterceptor`).
