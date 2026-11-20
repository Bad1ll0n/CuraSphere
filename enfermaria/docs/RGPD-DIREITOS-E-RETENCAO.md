# Direitos do titular e retenção de dados (SEC-20)

Este documento descreve o que o CuraSphere faz pelos direitos dos titulares (RGPD), que prazos de
retenção aplica e o que cabe ao Encarregado de Proteção de Dados (DPO) da instituição decidir.

> Os prazos são **configuráveis**. Os valores por omissão são conservadores (não se apaga nada
> clínico antes do prazo), mas não substituem o regulamento interno nem o enquadramento legal que
> o DPO fixar. Confirme-os antes de ligar a anonimização automática.

## Direito de acesso e portabilidade (art.º 15.º e 20.º)

| Quem pede | Como | O que recebe |
|---|---|---|
| Titular com portal | Portal → Exportar → JSON (`GET /v1/portal/exportar/json`) | Todos os dados do titular e quem consultou o processo |
| Titular ao balcão | DPO/qualidade → Conformidade & RGPD → "Pedido de acesso aos dados" (`GET /v1/rgpd/titular/:doenteId/exportacao`) | O mesmo ficheiro, para entregar ao titular |

A exportação é **completa por construção**: percorre o modelo de dados e inclui todas as tabelas
com `doenteId`, além do registo do doente. Uma tabela nova entra sem alterar código. Fica de fora
só o que não é dado do titular ou é segredo técnico:

- credenciais do portal (`PortalDoente`), mensagens HL7 em bruto, trilho de auditoria;
- campos de hash, token, segredo, password e índices cegos (`nomeBusca`, `nifBusca`).

"Quem consultou o processo" vai na mesma exportação (`acessos`), sem IP nem rota técnica. Cada
exportação fica auditada (`RGPD_EXPORTACAO_TITULAR`, com a via: portal ou DPO).

## Retenção

| Dados | Prazo (omissão) | Variável | O que acontece |
|---|---|---|---|
| Processo clínico | 20 anos após a última alta | `RETENCAO_PROCESSO_ANOS` | A **identificação** é anonimizada; o conteúdo clínico fica, sem ligação à pessoa |
| Senhas do quiosque (nome, telefone) | 30 dias | `RETENCAO_QUIOSQUE_DIAS` | Nome e telefone apagados |
| Check-ins da sala de espera (nome, data de nascimento, n.º de utente) | 30 dias | `RETENCAO_QUIOSQUE_DIAS` | Substituídos por "Titular anonimizado" |

Uma tarefa diária (03:30, uma só instância) limpa os dados de atendimento e verifica os processos
fora do prazo:

- com `ANONIMIZACAO_AUTOMATICA=true`, anonimiza-os;
- sem ela (omissão), avisa a qualidade/DPO, que decide caso a caso em Conformidade & RGPD.

### Anonimização de um processo

Só é possível em processos **inativos com a última alta antes do prazo**. Dentro do prazo, o
apagamento não se aplica a dados de saúde (art.º 17.º, n.º 3, al. c) RGPD). É irreversível, exige
motivo e fica auditada (`RGPD_TITULAR_ANONIMIZADO`).

- **Doente:** o nome passa a "Titular anonimizado"; a data de nascimento fica só com o ano; o número
  de processo passa a `ANON-…`; o identificador do HIS e a fotografia são apagados; é preenchido
  `anonimizadoEm`.
- **Ficha pessoal:** NIF, n.º SNS, morada, código postal, localidade, telefone, e-mail e apólice são
  apagados.
- **Contactos de emergência, consultas e lista de espera:** os nomes copiados são substituídos.
- **Credenciais:** o acesso ao portal e os acessos de família são apagados.
- **Conteúdo clínico:** diagnósticos, registos, medicação, sinais vitais e o resto ficam, para
  estatística e qualidade, sem ligação à pessoa.

## Proteção em repouso

- Nome do doente, contactos, morada, telefone, e-mail e NIF são cifrados (AES-256-GCM) com a
  `ENCRYPTION_KEY`. O nome e o NIF têm índices cegos (HMAC) para pesquisa.
- A semente TOTP e o segredo dos webhooks são cifrados, e os refresh tokens são guardados em hash
  (SEC-11).
- Os dados antigos em claro cifram-se com
  `node apps/api/scripts/cifrar-dados-existentes.mjs` (primeiro sem `--aplicar`, para contar).
