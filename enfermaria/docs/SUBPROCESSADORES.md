# Subcontratantes (RGPD art. 28.º) e transferências internacionais

Lista dos serviços externos que podem receber dados pessoais, o que recebe cada um, e as mitigações
aplicadas em código (SEC-18). Antes de pôr o sistema em produção, o responsável pelo tratamento (o hospital) tem de:

1. celebrar um **acordo de subcontratação (DPA)** com cada fornecedor activo;
2. para fornecedores fora do EEE, confirmar a base da transferência: EU-US Data Privacy Framework
   ou cláusulas contratuais-tipo, com avaliação de impacto da transferência;
3. incluir esta lista na **AIPD** e na informação aos titulares.

Um serviço só fica activo quando a respectiva variável de ambiente está definida.

| Serviço | Variável | Localização | Dados que recebe | Mitigações |
|---|---|---|---|---|
| **Anthropic** (Claude) | `ANTHROPIC_API_KEY` | EUA | Dados clínicos pseudonimizados; fotografias de feridas e texto do portal só se as funções estiverem activadas | Pseudonimização ([REGISTO-IA.md](REGISTO-IA.md)); decisão clínica desligada por omissão; usar conta com *zero data retention* |
| **OpenAI** (embeddings) | `OPENAI_API_KEY` | EUA | Texto das normas/guidelines internas e das pesquisas | Sem dados de doentes por desenho; opcional (há fallback local) |
| **Resend** (email) | `RESEND_API_KEY` | EUA | Endereço e nome do destinatário; lembretes de consulta (especialidade, data/hora) | O relatório de turno **já não segue em anexo** (só link para a aplicação, que exige sessão); HTML escapado |
| **Expo Push** | (tokens dos dispositivos) | EUA | Título e corpo das notificações | Conteúdo **genérico por omissão** ("Tem uma nova notificação — abra a aplicação para a ver."); o detalhe só se vê na app. `PUSH_CONTEUDO_COMPLETO=true` repõe o texto completo e exige avaliação própria |
| **Sentry** | `SENTRY_DSN` | UE ou EUA, conforme a região da conta | Erros e stack traces | `dataCollection` restritivo (sem utilizador, cookies, corpos, query params, inputs/outputs de IA nem queries à BD); `beforeSend` remove corpo e cookies. Preferir região UE ou self-hosted |
| **Armazenamento S3** | `STORAGE_PROVIDER=s3`, `S3_*` | Conforme a região | Documentos e fotografias clínicas; cópias de backup | Backups cifrados (age ou AES-256) antes de sair; usar região UE ou MinIO on-premises |
| **Jitsi** (teleconsulta) | `JITSI_SERVER` | Servidor do hospital | Áudio/vídeo da consulta | Nunca `meet.jit.si` em produção (ver SEC-16) |

## Rever esta lista

Qualquer PR que acrescente uma chamada de rede a um serviço externo tem de actualizar esta tabela.
Uma nova função de IA também tem de ser acrescentada a `funcoes-ia.ts` e ao [REGISTO-IA.md](REGISTO-IA.md).
