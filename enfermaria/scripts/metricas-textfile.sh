#!/bin/sh
# Escreve uma métrica para o textfile collector do node-exporter (OPS-05).
# Uso (como biblioteca): . metricas-textfile.sh; metrica_escrever <ficheiro> <nome> <valor> [ajuda]
# Escrita atómica (ficheiro temporário + mv), para o node-exporter nunca ler meio ficheiro.
# Sem METRICAS_DIR (ou sem o directório), não faz nada: as métricas são acessórias.

metrica_escrever() {
  _dir="${METRICAS_DIR:-/metricas}"
  [ -d "$_dir" ] && [ -w "$_dir" ] || return 0
  _tmp="$_dir/.$1.$$"
  {
    [ -n "${4:-}" ] && echo "# HELP $2 $4"
    echo "# TYPE $2 gauge"
    echo "$2 $3"
  } > "$_tmp" && mv -f "$_tmp" "$_dir/$1.prom"
}
