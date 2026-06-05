import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

  criar(data: {
    nome: string; tipo: string; endpoint?: string;
    authTipo?: string; authConfig?: string; ativo?: boolean;
  }) {
    return this.prisma.sistemaExternoSaude.create({ data });
  }

  async atualizar(id: string, data: {
    nome?: string; tipo?: string; endpoint?: string;
    authTipo?: string; authConfig?: string; ativo?: boolean;
  }) {
    await this.prisma.sistemaExternoSaude.findUniqueOrThrow({ where: { id } });
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

    try {
      const { default: fetch } = await import('node-fetch');
      const url = `${sistema.endpoint}/metadata`;
      const inicio = Date.now();
      const res = await fetch(url, {
        headers: { Accept: 'application/fhir+json' },
        signal: AbortSignal.timeout(5000),
      });
      const latenciaMs = Date.now() - inicio;

      if (res.ok) {
        return { sucesso: true, latenciaMs };
      }
      return { sucesso: false, erro: `HTTP ${res.status}: ${res.statusText}`, latenciaMs };
    } catch (e: any) {
      return { sucesso: false, erro: e.message };
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
