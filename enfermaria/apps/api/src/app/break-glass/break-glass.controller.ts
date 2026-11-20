import { Controller, Get, Post, Patch, Body, Param, ParseUUIDPipe, Query, UseGuards, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BreakGlassService } from './break-glass.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AtivarBreakGlassDto, ReverBreakGlassDto } from './dto/ativar-break-glass.dto';
import { AcessoDoenteIsento } from '../doentes/acesso-doente.decorator';
import { AtribuicoesService } from '../atribuicoes/atribuicoes.service';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class PedidoAtribuicaoDto {
  @IsUUID() doenteId: string;
  @IsOptional() @IsString() @MaxLength(300) nota?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@AcessoDoenteIsento('break-glass: é o pedido de acesso de emergência ao próprio doente')
@Controller('break-glass')
export class BreakGlassController {
  constructor(
    private readonly service: BreakGlassService,
    private readonly atribuicoes: AtribuicoesService,
  ) {}

  /**
   * UX-10 — a alternativa não urgente ao break-glass: pedir à chefia que o atribua ao doente.
   * Fica aqui porque é, como o break-glass, um pedido de acesso de quem ainda não o tem.
   */
  @Throttle({ default: { ttl: 3600000, limit: 20 } })
  @Roles('medico', 'enfermeiro', 'auxiliar', 'tecnico_saude')
  @Post('pedido-atribuicao')
  pedirAtribuicao(@Body() dto: PedidoAtribuicaoDto, @Request() req: any) {
    return this.atribuicoes.pedirAtribuicao(dto.doenteId, req.user.sub, dto.nota);
  }

  @Throttle({ default: { ttl: 86400000, limit: 10 } })
  // SEC-14 / QA-11: a TI não tem acesso clínico, nem de emergência.
  @Roles('medico', 'enfermeiro', 'auxiliar', 'tecnico_saude', 'direcao', 'chefe_enfermeiros')
  @Post()
  ativar(
    @Body() dto: AtivarBreakGlassDto,
    @Request() req: any,
  ) {
    const ip = req.ip ?? ''; // SEC-08: o cabeçalho é falsificável; o req.ip vem do trust proxy
    return this.service.ativar(req.user.sub, dto.doenteId, dto.motivo, ip);
  }

  @Roles('direcao', 'ti', 'qualidade', 'chefe_enfermeiros')
  @Get()
  listar(@Query('doenteId') doenteId?: string) {
    return this.service.listar(doenteId);
  }

  /** SEC-14: os acessos de emergência por rever. */
  @Roles('direcao', 'qualidade', 'chefe_enfermeiros')
  @Get('por-rever')
  porRever() {
    return this.service.porRever();
  }

  /** SEC-14: rever um acesso (justificado / injustificado) — nunca o próprio. */
  @Roles('direcao', 'qualidade', 'chefe_enfermeiros')
  @Patch(':id/revisao')
  rever(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReverBreakGlassDto, @Request() req: any) {
    return this.service.rever(id, req.user.sub, dto.resultado, dto.nota);
  }
}
