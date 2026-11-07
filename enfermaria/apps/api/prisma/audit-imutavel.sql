-- Trilho de auditoria imutável (WORM) — aplicado por scripts/apply-audit-triggers.mjs.
--
-- O audit-grants.sql retira UPDATE/DELETE/TRUNCATE ao papel da app, mas isso só vale se a app
-- NÃO correr como superuser — e o docker-compose.prod.yml liga-a como POSTGRES_USER, que é
-- superuser e ignora grants. Encontrado pelo teste de integração (QA-20): um `DELETE FROM
-- audit_logs` passava. Este trigger vale para TODOS os papéis, superuser incluído (só um
-- `ALTER TABLE ... DISABLE TRIGGER`, ele próprio auditado pelo Postgres, o contorna).
--
-- A única excepção é a rotina de retenção autorizada (fim do prazo legal), que o declara
-- explicitamente na sua transacção:
--   SELECT set_config('curasphere.retencao_autorizada', 'sim', true);
CREATE OR REPLACE FUNCTION curasphere_fn_audit_imutavel() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('curasphere.retencao_autorizada', true) = 'sim' THEN
    RETURN COALESCE(OLD, NEW);
  END IF;
  RAISE EXCEPTION 'O trilho de auditoria (%) é append-only: % recusado.', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS curasphere_audit_imutavel ON audit_logs;
CREATE TRIGGER curasphere_audit_imutavel BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION curasphere_fn_audit_imutavel();
DROP TRIGGER IF EXISTS curasphere_audit_imutavel_truncate ON audit_logs;
CREATE TRIGGER curasphere_audit_imutavel_truncate BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION curasphere_fn_audit_imutavel();

DROP TRIGGER IF EXISTS curasphere_audit_imutavel ON audit_checkpoints;
CREATE TRIGGER curasphere_audit_imutavel BEFORE UPDATE OR DELETE ON audit_checkpoints
  FOR EACH ROW EXECUTE FUNCTION curasphere_fn_audit_imutavel();
DROP TRIGGER IF EXISTS curasphere_audit_imutavel_truncate ON audit_checkpoints;
CREATE TRIGGER curasphere_audit_imutavel_truncate BEFORE TRUNCATE ON audit_checkpoints
  FOR EACH STATEMENT EXECUTE FUNCTION curasphere_fn_audit_imutavel();
