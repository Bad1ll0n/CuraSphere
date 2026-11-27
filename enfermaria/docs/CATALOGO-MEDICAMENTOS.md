# Catálogo de medicamentos, interacções e ajuste renal (PROD-05)

A prescrição liga-se ao catálogo de medicamentos pela **DCI** (substância activa) e pelo
código **ATC**. As regras de segurança — alergia, duplicação terapêutica, dose máxima,
interacções e ajuste renal — passam a assentar em dados codificados, não em texto livre.

## 1. Catálogo nacional (INFARMED / CHNM)

O CuraSphere traz uma **amostra de arranque** (cerca de 70 apresentações de uso hospitalar
corrente, `apps/api/src/app/catalogo/catalogo-amostra.json`). Serve para começar a trabalhar,
mas **não substitui o ficheiro oficial**.

### Importar o ficheiro do INFARMED

1. Exportar a lista de medicamentos (Infomed) e/ou o Código Hospitalar Nacional do
   Medicamento em CSV/TSV.
2. Importar (idempotente: actualiza pelo código CHNM, ou por DCI + forma + dosagem + via):

   ```bash
   cd apps/api
   DATABASE_URL=... npx ts-node --transpile-only src/prisma/importar-catalogo.ts infomed-2026-11.csv 2026-11
   ```

   O ficheiro tem de ter, pelo menos, as colunas da **DCI/substância activa** e da **forma
   farmacêutica**. As restantes são opcionais: dosagem, via, ATC, CHNM, embalagem e nome do
   medicamento. O script mostra as colunas reconhecidas e as linhas rejeitadas. Os sinónimos
   dos nomes de colunas estão em `catalogo-nacional.ts`.
3. Validar pela Comissão de Farmácia e Terapêutica. A página **Catálogo** mostra a origem
   (INFARMED, amostra, local), a versão e o número de itens.

### Prescrição em texto livre

- O prescritor escolhe o medicamento no autocomplete do catálogo. Se escrever um nome, a
  API reconhece a DCI, incluindo marcas comerciais (`Ben-u-ron` → paracetamol).
- O que não é reconhecido fica marcado `foraCatalogo` e é sinalizado à farmácia.
- Com `PRESCRICAO_EXIGIR_CATALOGO=true`, a prescrição fora do catálogo só é aceite com
  justificação. Ligar esta opção **depois** de importar o INFARMED.

### Duplicação terapêutica

A mesma DCI já prescrita (por exemplo, Paracetamol oral e Ben-u-ron) é recusada com
`409 DUPLICACAO`. Só passa com justificação, que fica registada na prescrição
(`overrideDuplicacao`).

## 2. Interacções medicamentosas

- A verificação é **determinística**. A base interna tem 51 pares e compara por substância,
  com marcas expandidas e classes como opioides, benzodiazepinas ou antibióticos.
- Interacções `grave` ou `contraindicada` são recusadas com `409 INTERACAO`, com a fonte e a
  versão. Só passam com justificação (`overrideInteracao`).
- **Base licenciada:** `INTERACOES_FICHEIRO=/caminho/base.json`, no formato:

  ```json
  { "fonte": "Nome da base", "versao": "7.1", "data": "2026-10-01",
    "interacoes": [{ "med1": "...", "med2": "...", "severidade": "grave", "descricao": "..." }] }
  ```

  Um ficheiro inválido é registado no log e a API volta à base interna.
- **LLM:** nunca decide nem bloqueia. Com `IA_DECISAO_CLINICA` a incluir
  `interacoes_medicacao`, apenas **explica** alertas que a base já deu (`explicacaoIA`).

## 3. Ajuste renal

- A TFG é calculada pela CKD-EPI 2021, com o sexo do doente, e acompanhada do estádio KDIGO.
- A orientação vem de uma tabela determinística (`medicacao/ajuste-renal.ts`) para fármacos
  de eliminação renal frequentes (metformina, enoxaparina, DOAC, aminoglicosídeos,
  vancomicina, aciclovir, gabapentina…), com a fonte indicada.
- Na prescrição, o aviso aparece em `avisoRenal`. A dose deixou de ser pedida a um LLM.
- A tabela é orientação: prevalecem o RCM do medicamento dispensado e o farmacêutico clínico.
