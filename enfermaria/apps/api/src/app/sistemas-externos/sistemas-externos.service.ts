import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertUrlDestinoPublico } from '../common/ssrf-guard';

@Injectable()
export class SistemasExternosService {
  private readonly logger = new Logger(SistemasExternosService.name);

  constructor(private readonly prisma: PrismaService) {}

  listar() {
    return this.prisma.sistemaExternoSaude.findMany({
      orderBy: { criadoEm: 'desc' },
      select: {
        id: true, nome: true, tipo: true, endpoint: true,
        authTipo: true, ativo: true, ultimaSincronizacao: true, criadoEm: true,
      },
    });
  }

  obter(id: string) {
    return this.prisma.sistemaExternoSaude.findUniqueOrThrow({ where: { id } });
  }

  async criar(data: {
    nome: string; tipo: string; endpoint?: string;
    authTipo?: string; authConfig?: string; ativo?: boolean;
  }) {
    // SEC-05: validação preventiva na criação (lança BadRequestException).
    if (data.endpoint) await assertUrlDestinoPublico(data.endpoint);
    return this.prisma.sistemaExternoSaude.create({ data });
  }

  async atualizar(id: string, data: {
    nome?: string; tipo?: string; endpoint?: string;
    authTipo?: string; authConfig?: string; ativo?: boolean;
  }) {
    await this.prisma.sistemaExternoSaude.findUniqueOrThrow({ where: { id } });
    if (data.endpoint) await assertUrlDestinoPublico(data.endpoint);
    return this.prisma.sistemaExternoSaude.update({ where: { id }, data });
  }

  async remover(id: string) {
    await this.prisma.sistemaExternoSaude.findUniqueOrThrow({ where: { id } });
    await this.prisma.sistemaExternoSaude.delete({ where: { id } });
    return { sucesso: true };
  }

  async testarConectividade(id: string): Promise<{ sucesso: boolean; latenciaMs?: number; erro?: string }> {
    const sistema = await this.prisma.sistemaExternoSaude.findUnique({ where: { id } });
    if (!sistema || !sistema.endpoint) {
      return { sucesso: false, erro: 'Endpoint não configurado' };
    }

    if (!sistema.ativo) {
      return { sucesso: false, erro: 'Sistema inactivo' };
    }

    const url = `${sistema.endpoint}/metadata`;

    // SEC-05: revalidar em CADA disparo, não só na criação — a resolução DNS do hostname
    // pode mudar entre o registo e o pedido (DNS rebinding). Sem isto, um utilizador
    // `ti`/`direcao` regista um endpoint que resolve para um IP público e, depois, aponta
    // o mesmo hostname para 169.254.169.254 (metadata da cloud) ou para a rede interna do
    // hospital, e usa este endpoint como sonda.
    try {
      await assertUrlDestinoPublico(url);
    } catch {
      return { sucesso: false, erro: 'Endpoint não permitido' };
    }

    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const { default: fetch } = await import('node-fetch');
      const res = await fetch(url, {
        headers: { Accept: 'application/fhir+json' },
        signal: AbortSignal.timeout(5000),
        // Um redirect é uma segunda ligação, para um destino que o guard nunca viu.
        redirect: 'manual',
      });

      // SEC-05: NÃO devolver `e.message` nem a latência ao chamador. Ambos eram um oráculo
      // de varrimento: `ECONNREFUSED` imediato distingue-se de um timeout, e a latência
      // distingue uma porta aberta de uma filtrada — o que permite mapear a rede interna
      // mesmo com o destino bloqueado. O detalhe fica só no log do servidor.
      if (res.ok) return { sucesso: true };
      return { sucesso: false, erro: 'O sistema externo respondeu com erro' };
    } catch (e: any) {
      this.logger.warn(`Teste de conectividade falhou (sistema ${id}): ${e?.message ?? String(e)}`);
      return { sucesso: false, erro: 'Não foi possível contactar o sistema externo' };
    }
  }

  async adicionarIdentificadorDoente(
    doenteId: string,
    sistemaId: string,
    valorId: string,
    tipo: string,
  ) {
    const sistema = await this.prisma.sistemaExternoSaude.findUnique({ where: { id: sistemaId } });
    if (!sistema) throw new NotFoundException('Sistema não encontrado');

    return this.prisma.identificadorExterno.upsert({
      where: { doenteId_sistema_tipo: { doenteId, sistema: sistemaId, tipo } },
      create: { doenteId, sistema: sistemaId, valorId, tipo },
      update: { valorId },
    });
  }

  listarIdentificadoresDoente(doenteId: string) {
    return this.prisma.identificadorExterno.findMany({ where: { doenteId } });
  }
}
