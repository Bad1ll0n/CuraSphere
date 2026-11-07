import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { episodioAtualOuUltimo } from '../episodios/episodios.core';

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

  /**
   * PROD-02: o plano de alta é do EPISÓDIO. Lê-se o do internamento em curso (ou, depois da
   * alta, o do último); só se altera o do internamento em curso.
   */
  private async episodio(doenteId: string) {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId }, select: { id: true } });
    if (!doente) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);
    return episodioAtualOuUltimo(this.prisma as any, doenteId);
  }

  async criarSeNaoExiste(doenteId: string) {
    const ep = await this.episodio(doenteId);
    if (!ep) return null;
    return this.prisma.planoAlta.upsert({
      where: { episodioId: ep.id },
      create: { doenteId, episodioId: ep.id },
      update: {},
    });
  }

  /** null quando o doente nunca esteve internado (ambulatório). */
  async buscar(doenteId: string) {
    return this.criarSeNaoExiste(doenteId);
  }

  async atualizar(doenteId: string, dto: AtualizarPlanoAltaDto) {
    const ep = await this.episodio(doenteId);
    if (!ep || ep.estado !== 'ativo') throw new BadRequestException('O doente não tem um internamento em curso.');
    await this.criarSeNaoExiste(doenteId);
    const { dataAlvoDia, ...campos } = dto;
    return this.prisma.planoAlta.update({
      where: { episodioId: ep.id },
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
