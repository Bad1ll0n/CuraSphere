import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { verificarTotpAssinatura } from '../common/totp-assinatura';

export const ESTADOS_CARTA_ALTA = ['rascunho', 'revista', 'assinada'] as const;
export type EstadoCartaAlta = (typeof ESTADOS_CARTA_ALTA)[number];

/**
 * PROD-11 — ciclo de vida da carta de alta enviada ao médico de família.
 *
 * A IA produz apenas um **rascunho** (`AiClinicoService.gerarCartaAlta`). Um médico revê o
 * texto (edita ou aceita) e assina-o com o código TOTP do seu autenticador. Só a carta
 * assinada é descarregável em PDF, e a partir daí o texto não muda.
 */
@Injectable()
export class CartaAltaService {
  constructor(private readonly prisma: PrismaService) {}

  private async sumario(doenteId: string) {
    const s = await this.prisma.sumarioAlta.findUnique({
      where: { doenteId },
      select: { id: true, cartaAlta: true, cartaAltaEstado: true },
    });
    if (!s) throw new NotFoundException('Sumário de alta não encontrado');
    return s;
  }

  /** O médico guarda o texto revisto (editado ou aceite tal como está). */
  async rever(doenteId: string, utilizadorId: string, texto: string) {
    const s = await this.sumario(doenteId);
    if (s.cartaAltaEstado === 'assinada') {
      throw new ConflictException('A carta já está assinada e não pode ser alterada.');
    }
    return this.prisma.sumarioAlta.update({
      where: { doenteId },
      data: {
        cartaAlta: texto,
        cartaAltaEstado: 'revista',
        cartaAltaRevistaPorId: utilizadorId,
        cartaAltaRevistaEm: new Date(),
      },
      select: { cartaAlta: true, cartaAltaEstado: true, cartaAltaRevistaEm: true },
    });
  }

  /** Assinatura com TOTP. Só uma carta revista pode ser assinada. */
  async assinar(doenteId: string, utilizadorId: string, totpCode: string) {
    const s = await this.sumario(doenteId);
    if (s.cartaAltaEstado === 'assinada') throw new ConflictException('A carta já está assinada.');
    if (s.cartaAltaEstado !== 'revista' || !s.cartaAlta?.trim()) {
      throw new BadRequestException('Reveja e guarde o texto da carta antes de a assinar.');
    }

    await verificarTotpAssinatura(this.prisma, utilizadorId, totpCode, 'carta-alta');

    // Condicional ao estado: dois pedidos concorrentes não assinam duas vezes.
    const r = await this.prisma.sumarioAlta.updateMany({
      where: { doenteId, cartaAltaEstado: 'revista' },
      data: { cartaAltaEstado: 'assinada', cartaAltaAssinadaPorId: utilizadorId, cartaAltaAssinadaEm: new Date() },
    });
    if (r.count !== 1) throw new ConflictException('A carta mudou entretanto. Recarregue e tente de novo.');
    return this.prisma.sumarioAlta.findUnique({
      where: { doenteId },
      select: { cartaAltaEstado: true, cartaAltaAssinadaEm: true, cartaAltaAssinadaPorId: true },
    });
  }

  /** Lança se a carta não estiver assinada — o PDF só existe para a versão assinada. */
  async garantirAssinada(doenteId: string) {
    const s = await this.sumario(doenteId);
    if (s.cartaAltaEstado !== 'assinada') {
      throw new ConflictException('A carta de alta só pode ser descarregada depois de revista e assinada por um médico.');
    }
  }
}
