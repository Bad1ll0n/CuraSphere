import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from '../alertas/alertas.service';
import { GuardarLaudoDto } from './dto/guardar-laudo.dto';

const MODALIDADES_IMAGEM = ['rx', 'eco', 'tc', 'rmn'];

@Injectable()
export class RadiologiaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alertas: AlertasService,
  ) {}

  /** Exames de imagem por reportar (sem laudo assinado), urgentes primeiro. */
  async worklist() {
    return this.prisma.exame.findMany({
      where: {
        tipo: { in: MODALIDADES_IMAGEM as never[] },
        estado: { not: 'cancelado' as never },
        OR: [{ laudo: { is: null } }, { laudo: { estado: 'rascunho' } }],
      },
      orderBy: [{ urgente: 'desc' }, { criadoEm: 'asc' }],
      include: {
        doente: { select: { id: true, nome: true } },
        laudo: { select: { id: true, estado: true } },
      },
    });
  }

  async laudoDoExame(exameId: string) {
    const exame = await this.prisma.exame.findUnique({
      where: { id: exameId },
      include: { laudo: true, doente: { select: { id: true, nome: true } } },
    });
    if (!exame) throw new NotFoundException('Exame não encontrado.');
    return exame;
  }

  /** Cria/atualiza o rascunho do laudo. Bloqueia se já estiver assinado ou se não for imagem. */
  async guardarLaudo(exameId: string, dto: GuardarLaudoDto, radiologistaId: string) {
    const exame = await this.prisma.exame.findUnique({
      where: { id: exameId },
      select: { id: true, tipo: true, laudo: { select: { estado: true } } },
    });
    if (!exame) throw new NotFoundException('Exame não encontrado.');
    if (!MODALIDADES_IMAGEM.includes(exame.tipo as string)) {
      throw new BadRequestException('Só exames de imagem (RX/Eco/TC/RMN) podem ter laudo radiológico.');
    }
    if (exame.laudo?.estado === 'assinado') {
      throw new BadRequestException('Laudo já assinado — não pode ser alterado.');
    }
    return this.prisma.laudoRadiologico.upsert({
      where: { exameId },
      create: { exameId, radiologistaId, tecnica: dto.tecnica ?? null, achados: dto.achados, conclusao: dto.conclusao },
      update: { radiologistaId, tecnica: dto.tecnica ?? null, achados: dto.achados, conclusao: dto.conclusao },
    });
  }

  /** Assina o laudo: bloqueia-o e alimenta o resultado do exame; alerta se urgente. */
  async assinarLaudo(laudoId: string, radiologistaId: string) {
    const laudo = await this.prisma.laudoRadiologico.findUnique({
      where: { id: laudoId },
      include: { exame: { select: { id: true, doenteId: true, urgente: true, tipo: true } } },
    });
    if (!laudo) throw new NotFoundException('Laudo não encontrado.');
    if (laudo.estado === 'assinado') throw new BadRequestException('Laudo já assinado.');

    const assinado = await this.prisma.laudoRadiologico.update({
      where: { id: laudoId },
      data: { estado: 'assinado', assinadoEm: new Date(), radiologistaId },
    });
    // Alimenta o fluxo de resultado existente — o clínico requisitante vê onde já olha.
    await this.prisma.exame.update({
      where: { id: laudo.exame.id },
      data: { estado: 'resultado_disponivel' as never, resultado: laudo.conclusao, dataResultado: new Date() },
    });
    if (laudo.exame.urgente) {
      await this.alertas.criarAlerta(
        laudo.exame.doenteId,
        'imagiologia',
        `Laudo de ${String(laudo.exame.tipo).toUpperCase()} (urgente) disponível.`,
      );
    }
    return assinado;
  }
}
