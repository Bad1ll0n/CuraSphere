# Registo das funções de IA

A fonte de verdade em código é [`apps/api/src/app/common/funcoes-ia.ts`](../apps/api/src/app/common/funcoes-ia.ts).
Este documento acrescenta o que o código não diz: porque cada função está ligada ou desligada,
que dados saem do hospital e quem revê o resultado.

## Enquadramento

Software que influencia diagnóstico ou terapêutica é **dispositivo médico** (Reg. (UE) 2017/745, Regra 11).
Com um modelo de IA, é também **sistema de alto risco** no Regulamento da IA (Reg. (UE) 2024/1689).
O CuraSphere não tem marcação CE nem avaliação clínica destas funções. Por isso:

- **Produtividade** (rascunhos e resumos que um profissional revê antes de usar): **ligadas**.
- **Decisão clínica** (o modelo classifica, prevê, prioriza ou recomenda): **desligadas por omissão**.

Para ligar uma função de decisão, a instituição tem de o decidir explicitamente, com a decisão registada
(responsável, data e fundamento: estudo, protocolo de validação ou uso apenas em investigação).
Depois disso, configura:

```
IA_DECISAO_CLINICA=diagnostico_diferencial,triagem_portal   # ou: todas
```

Uma função que não esteja no registo é tratada como decisão clínica, ou seja, fica desligada.

Quando uma função está desligada:

| Função | Comportamento |
|---|---|
| Endpoints de análise, triagem, diagnóstico, previsões, análise de feridas | `403` com referência a este documento |
| `triagem_portal` | orientação conservadora fixa (SNS 24, sinais de alarme); o texto do doente não sai do servidor |
| `watchdog`, `staffing` (crons) | não correm |
| `interacoes_medicacao` | não bloqueia. A tabela determinística de interacções continua activa |
| `ajuste_renal` | devolve a TFG (CKD-EPI, determinística) sem dose sugerida |
| `stewardship` | alerta determinístico por dias de terapia, sem texto do modelo |

## Funções

| Função | Tipo | Finalidade | Revisão humana |
|---|---|---|---|
| `turno` | produtividade | Narrativa de passagem de turno | Enfermeiro que passa o turno |
| `carta_alta` | produtividade | Rascunho da carta de alta | Médico edita e assina (TOTP) |
| `nlq` | produtividade | Pesquisa em linguagem natural → filtros | O utilizador vê os filtros aplicados |
| `icd10_sugestao` | produtividade | Sugestão de códigos ICD-10 | Codificador escolhe |
| `feedback_analysis` | produtividade | Análise agregada do feedback à IA | Qualidade |
| `guidelines_resumo` | produtividade | Resumo/pesquisa de normas internas | Utilizador consulta a norma original |
| `analisar`, `triagem`, `protocolo`, `los`, `readmissao`, `diagnostico_diferencial`, `staffing`, `watchdog` | decisão clínica | Ver `funcoes-ia.ts` | — (desligadas) |
| `interacoes_medicacao`, `ajuste_renal`, `stewardship` | decisão clínica | Apoio à prescrição | — (desligadas) |
| `analise_ferida` | decisão clínica | Classificação de feridas por fotografia | — (desligada) |
| `triagem_portal` | decisão clínica | Orientação de sintomas ao público | — (desligada; maior risco) |

## Dados enviados (minimização — ARQ-05)

- **Nunca** são enviados o nome, o NIF, o n.º SNS, a morada ou os contactos do doente.
  Nos prompts, o doente aparece como `Doente A` (ou `Doente 1..n` no turno).
  Na carta de alta, o modelo escreve o marcador `[NOME_DO_DOENTE]`, que só é substituído pelo nome real no servidor.
  O teste estrutural `common/ia-rgpd.spec.ts` impede que o nome seja interpolado em template strings.
- São enviados os dados clínicos necessários à função: idade, diagnósticos, sinais vitais, medicação, notas.
- **Feridas**: a fotografia segue para o modelo. Não deve mostrar o rosto nem tatuagens.
- **Triagem do portal**: segue o texto livre escrito pelo doente, que pode conter dados identificativos.

**Oposição do doente (SEC-19)**: o doente pode opor-se à IA clínica, no portal ou presencialmente.
Com oposição registada, as funções por doente respondem `403`. Esse doente também fica de fora da
passagem de turno por IA (a narrativa indica quantos ficaram de fora) e do watchdog.

Os subcontratantes (Anthropic, OpenAI) e a base contratual estão em [SUBPROCESSADORES.md](SUBPROCESSADORES.md).

## Monitorização

Cada chamada fica em `ai_metricas` (função, latência, tokens, erro). As respostas são validadas contra
schemas (`ai-response-schemas.ts`), e uma resposta fora do schema é descartada.
O feedback dos profissionais (útil / não útil) é revisto pela Qualidade.
