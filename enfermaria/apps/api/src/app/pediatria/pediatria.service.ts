import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { calcularDosePediatrica } from '../common/dosing.helper';
import { CalcularDoseDto } from './dto/calcular-dose.dto';

@Injectable()
export class PediatriaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calcula uma dose pediátrica por peso. Se `pesoKg` não vier mas `doenteId` sim, usa o último
   * peso registado nos sinais vitais do doente. Apoio à decisão — verificar contra o formulário.
   */
  async calcularDose(dto: CalcularDoseDto) {
    let pesoKg = dto.pesoKg ?? null;
    let fontePeso: string = 'fornecido';
    if (pesoKg == null && dto.doenteId) {
      const ultimo = await this.prisma.sinalVital.findFirst({
        where: { doenteId: dto.doenteId, peso: { not: null } },
        orderBy: { data: 'desc' },
        select: { peso: true, data: true },
      });
      if (ultimo?.peso != null) {
        pesoKg = ultimo.peso;
        fontePeso = `último registo (${ultimo.data.toISOString().slice(0, 10)})`;
      }
    }
    if (pesoKg == null) {
      throw new BadRequestException('Peso não fornecido e sem peso registado para o doente.');
    }
    const resultado = calcularDosePediatrica({
      mgPorKg: dto.mgPorKg,
      pesoKg,
      doseMaximaMg: dto.doseMaximaMg,
      frequenciaDia: dto.frequenciaDia,
    });
    return { ...resultado, pesoKg, fontePeso };
  }

  /** Tendência de PEWS de um doente (últimos registos com PEWS calculado). */
  async pewsTendencia(doenteId: string) {
    return this.prisma.sinalVital.findMany({
      where: { doenteId, pews: { not: null } },
      orderBy: { data: 'desc' },
      take: 20,
      select: {
        data: true,
        pews: true,
        frequenciaRespiratoria: true,
        pulso: true,
        saturacaoO2: true,
        temperatura: true,
      },
    });
  }
}
