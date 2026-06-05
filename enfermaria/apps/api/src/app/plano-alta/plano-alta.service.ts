import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class AtualizarPlanoAltaDto {
  @IsOptional() @IsDateString() dataAlvoDia?: string;
  @IsOptional() @IsBoolean() afebrилApenas24h?: boolean;
  @IsOptional() @IsBoolean() mobilidadeAdequada?: boolean;
  @IsOptional() @IsBoolean() alimentacaoOral?: boolean;
  @IsOptional() @IsBoolean() doresControladas?: boolean;
  @IsOptional() @IsBoolean() familiaInformada?: boolean;
  @IsOptional() @IsBoolean() transporteAssegurado?: boolean;
  @IsOptional() @IsBoolean() medicacaoPreparada?: boolean;
  @IsOptional() @IsBoolean() consultaSegAlt?: boolean;
  @IsOptional() @IsString() @MaxLength(1000) notas?: string;
}

@Injectable()
export class PlanoAltaService {
  constructor(private readonly prisma: PrismaService) {}

  async criarSeNaoExiste(doenteId: string) {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId }, select: { id: true } });
    if (!doente) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);
    return this.prisma.planoAlta.upsert({
      where: { doenteId },
      create: { doenteId },
      update: {},
    });
  }

  async buscar(doenteId: string) {
    await this.criarSeNaoExiste(doenteId);
    return this.prisma.planoAlta.findUnique({ where: { doenteId } });
  }

  async atualizar(doenteId: string, dto: AtualizarPlanoAltaDto) {
    await this.criarSeNaoExiste(doenteId);
    const { dataAlvoDia, ...campos } = dto;
    return this.prisma.planoAlta.update({
      where: { doenteId },
      data: {
        ...campos,
        ...(dataAlvoDia ? { dataAlvoDia: new Date(dataAlvoDia) } : {}),
      },
    });
  }

  calcularProgresso(plano: Record<string, unknown>) {
    const criterios = [
      'afebrилApenas24h', 'mobilidadeAdequada', 'alimentacaoOral',
      'doresControladas', 'familiaInformada', 'transporteAssegurado',
      'medicacaoPreparada', 'consultaSegAlt',
    ];
    const cumpridos = criterios.filter(c => plano[c] === true).length;
    return { cumpridos, total: criterios.length };
  }
}
