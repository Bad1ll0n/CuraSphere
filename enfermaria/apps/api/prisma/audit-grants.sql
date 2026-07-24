-- Separação de deveres (WORM) para a auditoria — aplicar em PRODUÇÃO.
--
-- Requisito HIPAA/GDPR: quem opera a app não pode apagar/alterar o próprio rasto. Isto SÓ tem
-- efeito se a app correr com um papel NÃO-superuser (um superuser ignora os grants). Em produção,
-- a app deve ligar-se como `curasphere_app` (ou equivalente), não como `postgres`.
--
-- Substituir :app_role pelo papel real. Executar como owner/superuser depois do db push + triggers.
--
--   psql "$DATABASE_URL" -v app_role=curasphere_app -f apps/api/prisma/audit-grants.sql

\set app_role :app_role

-- A app INSERE auditoria (via triggers) e LÊ para relatórios/verificação…
GRANT INSERT, SELECT ON audit_logs         TO :app_role;
GRANT INSERT, SELECT ON audit_checkpoints  TO :app_role;
GRANT INSERT, SELECT ON acessos_leitura    TO :app_role;

-- …mas NUNCA altera nem apaga o log de escritas nem as provas (append-only / WORM).
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs        FROM :app_role;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_checkpoints FROM :app_role;

-- Nota: o selador (checkpointer) corre com o papel da app e NÃO precisa de UPDATE em audit_logs —
-- o design é append-only: o hash-de-conteúdo é por-linha (posto pelo trigger) e a prova global
-- vive em audit_checkpoints (só INSERT). A remoção/retenção (fim dos 6 anos) é feita por um papel
-- separado e privilegiado, com autorização dupla — NUNCA pelo papel da app.
--
-- Opcional (defesa adicional): impedir mesmo o owner de UPDATE/DELETE via uma REGRA/trigger que
-- levanta exceção, deixando só a rotina de retenção autorizada a contornar. Fica como reforço.
