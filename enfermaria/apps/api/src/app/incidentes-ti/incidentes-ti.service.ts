import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TipoIncidenteTI } from '../../generated/prisma';
import { CriarIncidenteDto } from './dto/criar-incidente.dto';
import { AtualizarIncidenteDto } from './dto/atualizar-incidente.dto';

const TIPO_PARA_SUBROLE: Partial<Record<TipoIncidenteTI, string>> = {
  [TipoIncidenteTI.infraestrutura]: 'sysadmin',
  [TipoIncidenteTI.rede]:           'sysadmin',
  [TipoIncidenteTI.his_erp]:        'his_erp',
  [TipoIncidenteTI.base_dados]:     'database_admin',
  [TipoIncidenteTI.seguranca]:      'security_officer',
  [TipoIncidenteTI.dados_clinicos]: 'dados_clinicos',
};

const ROLES_TI = ['it_admin', 'diretor_ti', 'analista_sistemas', 'dba', 'ciberseguranca', 'bi_analyst'];

@Injectable()
export class IncidentesTIService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(dto: CriarIncidenteDto, criadoPorId: string) {
    const subRoleAlvo = TIPO_PARA_SUBROLE[dto.tipo] ?? null;
    return this.prisma.incidenteTI.create({
      data: {
        titulo: dto.titulo,
        descricao: dto.descricao,
        tipo: dto.tipo,
        subRoleAlvo,
        prioridade: dto.prioridade ?? 'media',
        criadoPorId,
      },
      include: {
        criadoPor: { select: { id: true, nome: true, role: true } },
        responsavel: { select: { id: true, nome: true, role: true } },
      },
    });
  }

  async listar(utilizadorId: string, role: string) {
    const eTI = ROLES_TI.includes(role);
    return this.prisma.incidenteTI.findMany({
      where: eTI ? undefined : { criadoPorId: utilizadorId },
      orderBy: [{ estado: 'asc' }, { criadoEm: 'desc' }],
      include: {
        criadoPor: { select: { id: true, nome: true, role: true } },
        responsavel: { select: { id: true, nome: true, role: true } },
      },
    });
  }

  async detalhe(id: string) {
    const inc = await this.prisma.incidenteTI.findUnique({
      where: { id },
      include: {
        criadoPor: { select: { id: true, nome: true, role: true } },
        responsavel: { select: { id: true, nome: true, role: true } },
      },
    });
    if (!inc) throw new NotFoundException(`Incidente TI (ID ${id}) não encontrado`);
    return inc;
  }

  async atualizar(id: string, dto: AtualizarIncidenteDto, role: string) {
    if (!ROLES_TI.includes(role)) throw new ForbiddenException('Sem permissão para atualizar incidentes');
    await this.detalhe(id);
    return this.prisma.incidenteTI.update({
      where: { id },
      data: {
        ...(dto.estado && { estado: dto.estado }),
        ...(dto.prioridade && { prioridade: dto.prioridade }),
        ...(dto.responsavelId !== undefined && { responsavelId: dto.responsavelId || null }),
      },
      include: {
        criadoPor: { select: { id: true, nome: true, role: true } },
        responsavel: { select: { id: true, nome: true, role: true } },
      },
    });
  }

  async eliminar(id: string) {
    await this.detalhe(id);
    return this.prisma.incidenteTI.delete({ where: { id } });
  }
}
