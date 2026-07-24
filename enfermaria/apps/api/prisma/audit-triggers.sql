-- Auditoria por triggers (append-only, tamper-evident por hash-de-conteúdo).
-- Idempotente: pode ser re-aplicado após cada `prisma db push`.
-- Requisitos: Postgres >= 13 (gen_random_uuid nativo) e >= 11 (sha256 nativo). SEM pgcrypto.
--
-- O "quem" vem de GUCs transaction-local definidos pelo PrismaService no início de cada
-- $transaction (SET LOCAL via set_config(...,true)). Escritas fora da app (SQL direto) não têm
-- os GUCs → ficam registadas com utilizador NULL (origem 'trigger', atribuição 'system').
-- NUNCA pode falhar a escrita de negócio: audit_logs.utilizadorId é nullable e sem FK que falhe.

CREATE OR REPLACE FUNCTION curasphere_fn_audit() RETURNS trigger AS $$
DECLARE
  v_user text := nullif(current_setting('curasphere.user_id', true), '');
  v_nome text := nullif(current_setting('curasphere.user_nome', true), '');
  v_role text := nullif(current_setting('curasphere.user_role', true), '');
  v_ip   text := nullif(current_setting('curasphere.ip', true), '');
  v_corr text := nullif(current_setting('curasphere.correlation', true), '');
  v_acao text;
  v_ent  text;
  v_new  jsonb;
  v_old  jsonb;
  v_det  text;
  v_now  timestamptz := now();
  v_hash text;
  v_payload text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW); v_acao := 'criar'; v_ent := v_new->>'id';
  ELSIF TG_OP = 'UPDATE' THEN
    v_new := to_jsonb(NEW); v_old := to_jsonb(OLD); v_acao := 'atualizar'; v_ent := v_new->>'id';
    -- Guarda só os NOMES das colunas alteradas — nunca os valores (não duplica PII).
    SELECT jsonb_build_object('alterou', coalesce(jsonb_agg(n.key ORDER BY n.key), '[]'::jsonb))::text
      INTO v_det
      FROM jsonb_each(v_new) n
      WHERE n.value IS DISTINCT FROM (v_old -> n.key);
  ELSE -- DELETE
    v_old := to_jsonb(OLD); v_acao := 'eliminar'; v_ent := v_old->>'id';
  END IF;

  -- Hash-de-conteúdo da própria entrada (tamper-evidence por-linha, independente, sem ordem/lock).
  v_payload := coalesce(v_user,'') || '|' || v_acao || '|' || TG_TABLE_NAME || '|' ||
               coalesce(v_ent,'') || '|' || v_now::text || '|' || coalesce(v_det,'');
  v_hash := encode(sha256(convert_to(v_payload, 'UTF8')), 'hex');

  INSERT INTO audit_logs (
    id, "utilizadorId", "utilizadorNome", "utilizadorRole", acao,
    "entidadeTipo", "entidadeId", detalhes, ip, "correlationId", origem, "createdAt", "contentHash"
  ) VALUES (
    gen_random_uuid()::text, v_user, v_nome, v_role, v_acao,
    TG_TABLE_NAME, v_ent, v_det, v_ip, v_corr, 'trigger', v_now, v_hash
  );

  RETURN NULL; -- AFTER trigger — valor de retorno ignorado
END;
$$ LANGUAGE plpgsql;
