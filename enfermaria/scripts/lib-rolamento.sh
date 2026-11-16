#!/bin/sh
# OPS-09 — substituição em rolamento de um serviço do docker compose, sem paragem.
#
# Usado pelo scripts/deploy.sh e ensaiado pelo scripts/ensaio-rolamento.sh (CI). Quem o carrega
# (`. scripts/lib-rolamento.sh`) tem de definir:
#   dc <args>            → docker compose do projecto
#   pronto_url <serviço> → URL de prontidão DENTRO do contentor (lida com wget)
#   replicas_de <serviço>→ número de réplicas desejado
#   contentor_lb         → id do contentor do nginx (para confirmar o que o DNS lhe devolve)

# esperar_contentor <id> <serviço>: healthy (liveness) e depois pronto (readiness).
esperar_contentor() {
  id="$1"; servico="$2"; tentativas=0
  until docker inspect --format='{{.State.Health.Status}}' "$id" 2>/dev/null | grep -q '^healthy$'; do
    tentativas=$((tentativas + 1))
    if [ "$tentativas" -ge 40 ]; then
      echo ""
      echo "ERRO: $servico ($id) não ficou healthy em $((tentativas * 3))s. Logs:"
      docker logs "$id" --tail 30
      return 1
    fi
    printf "."
    sleep 3
  done
  echo ""
  if ! docker exec "$id" wget -qO- "$(pronto_url "$servico")" >/dev/null 2>&1; then
    echo "ERRO: $servico ($id) está vivo mas não pronto ($(pronto_url "$servico")):"
    docker exec "$id" wget -qO- "$(pronto_url "$servico")" 2>&1 | head -c 600; echo
    return 1
  fi
}


# Rede de balanceamento partilhada com o nginx (ver docker-compose.prod.yml). O DNS do Docker
# lista um contentor assim que arranca; fora desta rede, o nginx não o vê.
REDE_LB="${REDE_LB:-curasphere-lb}"
# Depois de o nginx recarregar com as réplicas novas, uns segundos para os pedidos que ainda
# estavam a caminho das antigas terminarem antes de lhes mandar SIGTERM.
ESPERA_DNS="${ESPERA_DNS:-3}"

# recarregar_lb: `nginx -s reload` (gracioso: os workers antigos acabam os pedidos em curso).
# A recarga volta a resolver `api`/`web` no DNS do Docker, com as réplicas que estiverem na
# rede de balanceamento nesse instante.
recarregar_lb() {
  lb=$(contentor_lb)
  [ -n "$lb" ] || return 0
  docker exec "$lb" nginx -s reload >/dev/null 2>&1
}

# ip_lb <id>: IP do contentor na rede de balanceamento.
ip_lb() {
  docker inspect -f "{{with index .NetworkSettings.Networks \"$REDE_LB\"}}{{.IPAddress}}{{end}}" "$1"
}

# esperar_dns <serviço> <ids...>: até o DNS do Docker, visto de dentro do nginx, devolver o IP
# de cada um dos contentores novos para o nome do serviço.
esperar_dns() {
  servico="$1"; shift; tentativas=0
  lb=$(contentor_lb)
  [ -n "$lb" ] || return 0  # sem nginx a correr, não há quem encaminhe para os antigos
  while :; do
    resolvidos=$(docker exec "$lb" getent ahostsv4 "$servico" 2>/dev/null | awk '{print $1}' | sort -u)
    falta=""
    for c in "$@"; do
      echo "$resolvidos" | grep -qx "$(ip_lb "$c")" || falta="$falta $c"
    done
    [ -z "$falta" ] && return 0
    tentativas=$((tentativas + 1))
    if [ "$tentativas" -ge 30 ]; then
      echo "ERRO: o DNS não devolve as réplicas novas de $servico ao nginx ao fim de 30 s."
      return 1
    fi
    sleep 1
  done
}

# OPS-09 — substituição em rolamento, sem paragem:
#   1. CRIAR N contentores da versão nova ao lado dos antigos (--scale --no-recreate
#      --no-start), tirá-los da rede de balanceamento e só então arrancá-los — o nginx nunca
#      os vê antes de estarem prontos;
#   2. esperar que todos fiquem saudáveis e prontos. Se algum falhar, removem-se os novos e os
#      antigos continuam a servir: uma versão doente nunca recebe um pedido;
#   3. ligar os novos à rede de balanceamento com o nome do serviço, confirmar que o DNS os
#      devolve ao nginx e recarregá-lo (gracioso) — passa a encaminhar para antigos e novos;
#   4. parar os antigos com SIGTERM (o Nest termina os pedidos em curso), removê-los e voltar
#      a recarregar o nginx, que fica só com os novos.
rolar() {
  servico="$1"
  n=$(replicas_de "$servico")
  antigos=$(dc ps -q "$servico" 2>/dev/null || true)
  if [ -z "$antigos" ]; then
    dc up -d --no-deps --scale "$servico=$n" "$servico"
    for c in $(dc ps -q "$servico"); do esperar_contentor "$c" "$servico" || return 1; done
    return 0
  fi
  echo "  → $servico: $n contentor(es) novo(s) ao lado de $(echo "$antigos" | wc -l | tr -d ' ') em serviço"
  dc up -d --no-deps --no-recreate --no-start --scale "$servico=$((n + $(echo "$antigos" | wc -l)))" "$servico"
  novos=$(dc ps -a -q "$servico" | grep -v -F "$antigos" || true)
  if [ -z "$novos" ]; then
    echo "ERRO: não foi criado nenhum contentor novo de $servico."
    return 1
  fi
  for c in $novos; do docker network disconnect "$REDE_LB" "$c" >/dev/null 2>&1 || true; done
  # shellcheck disable=SC2086
  docker start $novos >/dev/null
  for c in $novos; do
    if ! esperar_contentor "$c" "$servico"; then
      echo "  → A remover os contentores novos de $servico; a versão anterior continua a servir."
      # shellcheck disable=SC2086  # lista de ids, separada por espaços de propósito
      docker rm -f $novos >/dev/null 2>&1 || true
      return 1
    fi
  done
  for c in $novos; do docker network connect --alias "$servico" "$REDE_LB" "$c"; done
  # shellcheck disable=SC2086
  if ! esperar_dns "$servico" $novos; then
    echo "  → A remover os contentores novos de $servico; a versão anterior continua a servir."
    # shellcheck disable=SC2086
    docker rm -f $novos >/dev/null 2>&1 || true
    return 1
  fi
  recarregar_lb
  echo "  → $servico novo(s) pronto(s) e no balanceamento; a retirar os antigos..."
  sleep "$ESPERA_DNS"
  # shellcheck disable=SC2086
  docker stop -t 30 $antigos >/dev/null
  # shellcheck disable=SC2086
  docker rm $antigos >/dev/null
  recarregar_lb
}
