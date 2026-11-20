# TLS e acesso de rede (OPS-18, OPS-19)

## Configuração do nginx

`nginx/templates/nginx.conf.template` passa a `/etc/nginx/nginx.conf` no arranque do contentor
(envsubst da imagem oficial). Só se substituem duas variáveis, ambas do `.env.prod`:

| Variável | O que é | Exemplo |
|---|---|---|
| `DOMINIO` | `server_name` (obrigatória) | `curasphere.hospital.pt` |
| `TLS_DIR` | onde estão `fullchain.pem`, `privkey.pem` e `chain.pem` | `/etc/letsencrypt/live/curasphere` (omissão) ou `/etc/nginx/ssl` |

Antes de arrancar, `nginx/entrypoint.d/05-curasphere-validar.sh` confirma que existem o domínio,
`nginx/rede-interna.conf` e os três ficheiros do certificado, e diz o que falta.

## Quem chega a quê

| Rota | De onde |
|---|---|
| Aplicação do pessoal (`/`, `/api/v1/*`, `/socket.io/`) | Só da LAN/VPN do hospital (`nginx/rede-interna.conf`) |
| Portal do doente (`/portal`, `/api/v1/portal/*`), acesso da família (`/familia/*`, `/api/v1/familia/*`), `/api/v1/csrf-token`, recursos estáticos | De qualquer rede |

Fora da rede do hospital, o resto devolve 403.

As redes estão em `nginx/rede-interna.conf`, fora do repositório (copiar de
`nginx/rede-interna.conf.example`), e têm de coincidir com `https_redes_permitidas` no Ansible.
Para o portal chegar de fora, `acesso_publico: true` no Ansible abre 80/443 na firewall do host;
a restrição da aplicação do pessoal fica no nginx. Antes, a allowlist cobria o bloco HTTPS
inteiro e o portal e a família, feitos para quem está em casa, só funcionavam dentro do hospital.

## Certificado

**Let's Encrypt** (o DNS do domínio aponta para o host e a porta 80 chega da Internet):

1. Primeira emissão:
   `ACME_EMAIL=ti@hospital.pt ACEITAR_TERMOS_ACME=sim ./scripts/emitir-certificado.sh`.
   Ensaiar antes com `ACME_TESTE=sim` (CA de testes).
2. O serviço `certbot` (perfil `acme`) tenta renovar de 12 em 12 h; renova a 30 dias do fim,
   pelo desafio HTTP-01 que o nginx serve.
3. O nginx recarrega o certificado de 6 em 6 h, sem paragem.
4. O alerta `CertificadoAExpirar` (blackbox, 14 dias) apanha uma renovação que falhe.

**CA interna do hospital:** pôr `fullchain.pem`, `privkey.pem` e `chain.pem` em `nginx/ssl/`,
definir `TLS_DIR=/etc/nginx/ssl` e não arrancar o perfil `acme`. A renovação é manual: o mesmo
alerta avisa a 14 dias.

**OCSP stapling:** estava ligado mas não funcionava, por falta de `resolver` e de
`ssl_trusted_certificate`. Agora usa o DNS do Docker (`127.0.0.11`) e o `chain.pem`. Verificar com:
`openssl s_client -connect <domínio>:443 -status </dev/null | grep -A2 "OCSP response"`.
