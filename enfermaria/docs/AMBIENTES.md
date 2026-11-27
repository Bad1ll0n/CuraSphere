# Ambientes, promoção e infraestrutura como código (OPS-21)

## 1. Os ambientes

| Ambiente | Para quê | Dados | Como se cria |
|---|---|---|---|
| **Desenvolvimento** | Programar | Seeds locais | `docker compose up` (BD e Redis) + `nx serve` |
| **Efémero (CI)** | Provar que o stack de produção **arranca e serve** em cada PR de infraestrutura, e todas as noites | Utilizadores de teste sintéticos | `scripts/ambiente-efemero.sh` (workflow "Ambiente efémero") |
| **Staging** | Validar uma release candidate com o mesmo deploy, as mesmas imagens assinadas e a mesma configuração da produção | **Só sintéticos** | Ansible (`infra/ansible`) + workflow "Staging" |
| **Produção** | Serviço clínico | Reais | Ansible + `scripts/deploy.sh vX.Y.Z` |

**Regra de dados (RGPD, art. 9.º).** Staging e o ambiente efémero **nunca** recebem uma cópia da base de produção, nem anonimizada à mão. Os testes de carga ou de restauro com volume usam os dados sintéticos do `ensaio-pitr.sh`.

## 2. Ambiente efémero (no CI e localmente)

`sh scripts/ambiente-efemero.sh` (com Docker; cerca de 10 min, sobretudo builds). O script:

- gera segredos aleatórios descartáveis e um certificado autoassinado;
- constrói as imagens a partir dos mesmos Dockerfiles da release;
- arranca o `docker-compose.prod.yml` sem alterações às imagens nem à configuração, mais o `docker-compose.efemero.yml`, que acrescenta uma rede "cliente" 10.x e reduz réplicas e limites;
- aplica as migrações e os triggers de auditoria e cria os utilizadores de teste;
- verifica, como um posto do hospital:
  - TLS, HSTS e CSP;
  - `/api/v1/health/ready`;
  - login e quiosque;
  - 401 sem sessão;
  - 20 pedidos repartidos pelas 2 réplicas;
  - a BD inalcançável da rede cliente;
  - a allowlist recusa um IP de fora;
  - `DELETE` em `audit_logs` recusado.

`MANTER=1` deixa o ambiente a correr para inspecção (`docker compose -p curasphere-efemero ...`).

## 3. Promoção: release candidate → staging → produção

1. **Tag `vX.Y.Z-rc.N`** num commit da `main`. O workflow de release constrói as imagens com as variáveis do environment `staging`, passa o Trivy, publica com SBOM e proveniência, assina com cosign e cria uma pré-release.
2. O workflow **Staging** instala a rc no servidor de staging, por SSH, com o mesmo `scripts/deploy.sh` da produção (`ENV_FILE=.env.staging`). Isso inclui rolamento sem paragem, migrações, triggers e verificação das assinaturas. Sem os segredos `STAGING_SSH_*`, avisa e não instala.
3. **Validação em staging:** smoke manual nos fluxos clínicos e E2E apontado a staging, se houver.
4. **Tag `vX.Y.Z`** no **mesmo commit**. As imagens são reconstruídas com as variáveis de `producao` (o web coze os `NEXT_PUBLIC_*` no bundle).
5. **Produção:** `./scripts/deploy.sh vX.Y.Z`. O `deploy.sh` recusa uma rc com o `.env.prod` (só `FORCAR_RC=1`, num incidente documentado).

## 4. Infraestrutura como código (`infra/ansible`)

O playbook `site.yml` deixa um servidor Debian 12 / Ubuntu 24.04 pronto e endurecido. É idempotente: correr de novo repõe o que se desviou.

| Papel | O que faz |
|---|---|
| `base` | Pacotes, fuso horário, chrony com NTP de referência, actualizações automáticas **só de segurança e sem reboot automático** |
| `endurecimento` | SSH só com chave, sem root, sem encaminhamentos e só para o utilizador de administração; ufw a recusar tudo excepto SSH da rede de administração e 80/443 da LAN/VPN; regras `DOCKER-USER` (as portas publicadas pelo Docker não passam ao lado da firewall); fail2ban; sysctl; auditd (contas, sudo, SSH, Docker, `.env`, compose) |
| `docker` | Docker Engine do repositório oficial; daemon com `live-restore`, limites de logs, `no-new-privileges`, `userland-proxy: false` (o nginx vê o IP real do posto) e `icc: false` |
| `curasphere` | Código numa tag concreta em `/opt/curasphere`; `.env` do ambiente **só a partir do ansible-vault** (0600); deploy com `scripts/deploy.sh` |

```sh
cd enfermaria/infra/ansible
cp inventario.exemplo.yml inventario.yml        # preencher IPs (não versionado)
ansible-galaxy collection install -r requirements.yml
ansible-vault create group_vars/staging/segredos.yml   # curasphere_env: { DB_PASSWORD: ..., ... }
ansible-playbook site.yml --limit staging --check --diff --ask-vault-pass   # ver o que mudaria
ansible-playbook site.yml --limit staging --ask-vault-pass -e curasphere_versao=v1.4.0-rc.1
```

O CI valida a sintaxe e corre o `ansible-lint` (perfil *production*). **O que o CI não prova:** a aplicação real das regras de firewall, sysctl e auditd, porque não correm num contentor. A primeira execução num servidor deve ser feita com `--check --diff` e acompanhada, com uma sessão SSH aberta à parte: se a regra de SSH da rede de administração estiver errada, o ufw corta o acesso.

## 5. Limites conhecidos

- Ambientes de *preview* por PR com URL própria **não existem**: o ambiente efémero prova o stack, mas não fica acessível depois do CI. Requer um host ou cluster para *previews*. Ver `docs/ALTA-DISPONIBILIDADE.md` §3.
- O servidor de staging tem de ser provisionado (Ansible) e os segredos `STAGING_SSH_*` configurados no environment `staging` do GitHub para a instalação automática funcionar.
