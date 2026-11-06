#!/bin/sh
# Funções de cifra dos backups (OPS-01). Incluído com `. backup-cifra.sh` por
# backup-db.sh, backup-all.sh e restore-db.sh — não se corre sozinho.
#
# Antes, os dumps (diagnósticos, prescrições, notas clínicas) e o arquivo de uploads
# (DICOM, fotografias, cartas de alta) eram escritos EM CLARO no mesmo host, e a
# `BACKUP_ENCRYPTION_KEY` documentada no .env.example não era lida por nenhum script.
#
# Dois modos, por ordem de preferência:
#   1. age (assimétrico) — BACKUP_AGE_RECIPIENT=age1… (chave PÚBLICA). O host de produção
#      só consegue cifrar: quem roubar o host ou o disco de backups não decifra nada. Para
#      repor, BACKUP_AGE_IDENTITY aponta para o ficheiro da chave PRIVADA, guardada fora.
#   2. openssl (simétrico) — BACKUP_ENCRYPTION_KEY (openssl rand -hex 32). AES-256-CBC
#      com PBKDF2; a integridade confirma-se decifrando e validando o gzip a seguir.
#
# Sem nenhum dos dois, a rotina FALHA — a menos que BACKUP_PERMITIR_EM_CLARO=sim (só para
# desenvolvimento). Um backup em claro de dados de saúde não é um mal menor silencioso.

# Extensão do ficheiro cifrado, ou vazio em claro.
backup_extensao_cifra() {
  if [ -n "${BACKUP_AGE_RECIPIENT:-}" ]; then echo ".age"
  elif [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then echo ".enc"
  else echo ""
  fi
}

# Falha se não houver cifra configurada (e o modo em claro não estiver autorizado).
backup_exigir_cifra() {
  if [ -z "$(backup_extensao_cifra)" ] && [ "${BACKUP_PERMITIR_EM_CLARO:-}" != "sim" ]; then
    echo "[$(date)] ERRO: backups sem cifra recusados. Defina BACKUP_AGE_RECIPIENT (recomendado) ou" >&2
    echo "           BACKUP_ENCRYPTION_KEY. Só em desenvolvimento: BACKUP_PERMITIR_EM_CLARO=sim." >&2
    return 1
  fi
  if [ -n "${BACKUP_AGE_RECIPIENT:-}" ] && ! command -v age >/dev/null 2>&1; then
    echo "[$(date)] ERRO: BACKUP_AGE_RECIPIENT definido mas o binário 'age' não está instalado." >&2
    return 1
  fi
  if [ -z "${BACKUP_AGE_RECIPIENT:-}" ] && [ -n "${BACKUP_ENCRYPTION_KEY:-}" ] && ! command -v openssl >/dev/null 2>&1; then
    echo "[$(date)] ERRO: BACKUP_ENCRYPTION_KEY definida mas o 'openssl' não está instalado." >&2
    return 1
  fi
}

# stdin → stdout cifrado (ou igual, em claro autorizado).
backup_cifrar() {
  if [ -n "${BACKUP_AGE_RECIPIENT:-}" ]; then
    age -r "$BACKUP_AGE_RECIPIENT"
  elif [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
    openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_ENCRYPTION_KEY
  else
    cat
  fi
}

# Ficheiro ($1) → stdout decifrado, pela extensão.
backup_decifrar() {
  # O tipo vem da extensão final; o sufixo `.parcial` (ficheiro ainda por validar) não conta.
  case "${1%.parcial}" in
    *.age)
      if [ -z "${BACKUP_AGE_IDENTITY:-}" ]; then
        echo "[$(date)] ERRO: para decifrar $1 defina BACKUP_AGE_IDENTITY (ficheiro da chave privada age)." >&2
        return 1
      fi
      age -d -i "$BACKUP_AGE_IDENTITY" "$1" ;;
    *.enc)
      if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
        echo "[$(date)] ERRO: para decifrar $1 defina BACKUP_ENCRYPTION_KEY." >&2
        return 1
      fi
      openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_ENCRYPTION_KEY -in "$1" ;;
    *)
      cat "$1" ;;
  esac
}

# Verificação depois de escrever: só é possível decifrar com o modo simétrico ou com a
# identidade age disponível. Com age sem identidade (o normal em produção) confirma-se
# apenas o cabeçalho — a verificação completa faz-se no ensaio de restauro.
backup_pode_verificar_conteudo() {
  case "${1%.parcial}" in
    *.age) [ -n "${BACKUP_AGE_IDENTITY:-}" ] ;;
    *) return 0 ;;
  esac
}

backup_cabecalho_age_valido() {
  head -c 21 "$1" | grep -q '^age-encryption.org/v1'
}
