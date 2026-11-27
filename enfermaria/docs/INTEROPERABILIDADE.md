# Interoperabilidade — estado real e roteiro

> PROD-14. Este documento diz o que **funciona hoje**, o que é **simulado** e o que **falta** para
> uma "integração mínima viável" num hospital do SNS. Não anunciar como feito o que não está.

## Resumo

| Integração | Estado | Notas |
|---|---|---|
| HL7 v2 ADT de entrada (HIS → CuraSphere) | **Funciona** | A01, A02, A03, A04, A08; emparelhamento pelo identificador do HIS; ACK |
| HL7 v2 ADT de saída (CuraSphere → HIS) | **Funciona (pull)** | A01 e A03 numa fila; o motor de integração recolhe-as |
| HL7 v2 ORU^R01 (laboratório) | **Funciona** | resultados em `ResultadoAnalise` |
| FHIR R4 — exportação do doente | **Estruturalmente conforme** | Bundle `document` com Composition; falta validar contra os perfis SPMS |
| FHIR R4 — ingestão de dispositivos | **Funciona** | leituras pendentes de validação (PROD-15) |
| RNU (identificação do utente) | **Não integrado** | responde `nao_configurado`; requer contrato e certificados SPMS |
| PEM (receita eletrónica) | **Não integrado** | simulador só fora de produção; em produção a emissão falha com mensagem clara |
| RSE (Registo de Saúde Eletrónico) | **Não integrado** | — |
| SINAVE (doenças de declaração obrigatória) | **Não integrado** | — |
| NOTIFICA (incidentes e eventos adversos) | **Não integrado** | os incidentes ficam no CuraSphere |

## HL7 v2

### Entrada — `POST /v1/hl7/receive`

Autenticação: cabeçalho `x-hl7-token` igual a `HL7_API_TOKEN` (comparação em tempo constante).
Corpo: a mensagem HL7 (ER7, segmentos separados por `\r`; `\n` e os delimitadores MLLP também
são aceites). A resposta é JSON com `processado`, `efeito`, `erro`, `doenteId` e `ack` (o ACK HL7:
`MSA|AA`, `AE` ou `AR`).

**Emparelhamento do doente** (por esta ordem):
1. `PID-3` com tipo `PI`/`MR` → `Doente.identificadorHis` (o número de processo do HIS);
2. `PID-3` com tipo `NH`/`SS`/`SNS` (ou autoridade SNS/RNU) → número de utente na ficha pessoal;
3. doentes migrados sem identificador do HIS cujo `numeroProcesso` é o número do HIS.

O `numeroProcesso` do CuraSphere (`AAAA-NNNNNNNN`) **não** é a chave: é gerado pelo CuraSphere e
nunca coincide com o do HIS.

**Efeito de cada evento:**

| Evento | Efeito |
|---|---|
| A01 / A04 | doente desconhecido → registado **pendente de cama** (a cama atribui-se na gestão de camas do CuraSphere); conhecido → identificação atualizada |
| A08 | identificação atualizada (nome, nascimento, sexo, SNS, identificador do HIS); doente desconhecido → `AE` |
| A02 | serviço do episódio atualizado e alerta à equipa para confirmar a cama |
| A03 | se o CuraSphere já deu alta → conciliada; se o doente continua internado → alerta à equipa. **A alta clínica não se faz por mensagem**: exige reconciliação, sumário e nota de enfermagem |
| outro | recusado (`AR`), registado como não processado |

Todas as mensagens ficam em `hl7_mensagens` com o efeito e o doente.

### Saída — fila por pull

A admissão e a alta feitas no CuraSphere geram `ADT^A01` e `ADT^A03` (com os identificadores do
HIS, do CuraSphere e SNS). As mensagens ficam numa fila; **o CuraSphere não abre ligações para a
rede interna**. O motor de integração do hospital (Mirth, Rhapsody, o próprio HIS):

```
GET  /v1/hl7/saida?limite=50            (x-hl7-token)  → mensagens por entregar, mais antigas primeiro
POST /v1/hl7/saida/:id/entregue  {}     (x-hl7-token)  → confirma a entrega
POST /v1/hl7/saida/:id/entregue  { "erro": "..." }     → regista a falha (fica na fila)
```

## FHIR R4 — exportação

`GET /v1/fhir/doentes/:doenteId/exportar-fhir` devolve um Bundle `document`:
- a primeira entrada é uma `Composition` (LOINC 60591-5, *Patient summary*) com secções de alergias, medicação, problemas e sinais vitais;
- o `Patient` traz o número de utente SNS, o identificador do HIS, o `gender` e o `birthDate`;
- os recursos usam a estrutura R4: `MedicationStatement.medicationCodeableConcept`, `Observation.status`, UCUM com `code`, `AllergyIntolerance` com `clinicalStatus`, `verificationStatus`, `criticality` e reações com `manifestation` e `severity` (mild/moderate/severe).

Configuração: `FHIR_BASE_URL`, `FHIR_SISTEMA_SNS`, `FHIR_SISTEMA_HIS`, `FHIR_SISTEMA_PROCESSO`, `FHIR_ORGANIZACAO`.

**Falta:**
- alinhar os `system` dos identificadores e os perfis com os publicados pela SPMS;
- codificar alergias e problemas (SNOMED CT / ICD-10), que hoje vão só em texto;
- validar no CI com o validador oficial (`validator_cli.jar`) contra esses perfis.

## RNU e PEM

- **RNU:** `GET /v1/fhir/doentes/lookup-sns` devolvia sempre "encontrado" com dados fictícios. Agora responde `encontrado: false, fonte: 'nao_configurado'`. O simulador só existe fora de produção (`RNU_MODO=simulado`) e diz que é simulado.
- **PEM:** em produção, sem `SNS_PEM_MODE` explícito, usa-se o cliente real. Sem endpoint e certificados, este recusa a emissão com uma mensagem clara (a receita fica registada como erro). O simulador, que gerava um número de receita que nenhuma farmácia dispensaria, só corre com `SNS_PEM_MODE=sandbox`.

## Roteiro da integração mínima viável

1. **HIS:** identificar o HIS do hospital (SONHO, SClínico ou outro) e o motor de integração; configurar `HL7_API_TOKEN`; mapear `PID-3` (tipos de identificador) e `PV1-3` (serviços e camas).
2. **RNU:** contrato SPMS e certificados; implementar o cliente (`fhir.service.ts › lookupSns`).
3. **PEM:** registo na SPMS, certificados, ambiente de qualidade e certificação; implementar `SpmsPemClient`.
4. **FHIR:** perfis nacionais SPMS e validação no CI.
5. **RSE:** partilha da nota de alta e do resumo do doente.
6. **Notificações obrigatórias:** SINAVE (DDO) a partir dos diagnósticos; NOTIFICA a partir dos incidentes.
