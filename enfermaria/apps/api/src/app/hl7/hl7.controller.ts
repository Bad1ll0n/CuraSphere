import { Controller, Post, Get, Body, Headers, Ip, Param, Query, ForbiddenException, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { timingSafeEqual } from 'crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { Hl7Service } from './hl7.service';
import { confirmarEntrega, filaSaida } from './hl7-saida.service';
import { OrigensPermitidas } from '../common/seguranca/origens-permitidas';

export class EntregaHl7Dto {
  /** Se a entrega ao HIS falhou, o motivo (a mensagem continua na fila). */
  @IsOptional() @IsString() @MaxLength(500) erro?: string;
}

@Controller('hl7')
export class Hl7Controller {
  private readonly hl7Token: string;
  private readonly origens: OrigensPermitidas;

  constructor(
    private readonly service: Hl7Service,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.hl7Token = this.config.get<string>('HL7_API_TOKEN', '');
    this.origens = new OrigensPermitidas(this.config.get<string>('HL7_ORIGENS_PERMITIDAS', ''));
  }

  /**
   * O motor de integração do hospital autentica-se com o token HL7 (comparação em tempo constante)
   * e, SEC-22, tem de chamar de uma origem permitida (HL7_ORIGENS_PERMITIDAS; obrigatória em
   * produção — sem lista, só fora de produção é que qualquer origem passa).
   */
  private exigirToken(token: string | undefined, ip: string) {
    if (!this.origens.vazia && !this.origens.permite(ip)) throw new ForbiddenException('Origem não autorizada para HL7');
    const a = Buffer.from(token ?? '');
    const b = Buffer.from(this.hl7Token);
    if (!this.hl7Token || a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException('Token HL7 inválido');
  }

  /** Entrada (HIS → CuraSphere): ADT A01/A02/A03/A04/A08 e ORU R01. A resposta traz o ACK HL7. */
  @Post('receive')
  async receberMensagem(
    @Body() body: string | Buffer,
    @Headers('x-hl7-token') token: string,
    @Ip() ip: string,
  ) {
    this.exigirToken(token, ip);
    const raw = Buffer.isBuffer(body) ? body.toString('utf-8') : String(body);
    return this.service.receberMensagem(raw);
  }

  /** PROD-14 — saída (CuraSphere → HIS), por pull: ADT por entregar, mais antigas primeiro. */
  @Get('saida')
  saida(@Headers('x-hl7-token') token: string, @Ip() ip: string, @Query('limite') limite?: string) {
    this.exigirToken(token, ip);
    return filaSaida(this.prisma, limite ? parseInt(limite, 10) || 50 : 50);
  }

  @Post('saida/:id/entregue')
  entregue(@Headers('x-hl7-token') token: string, @Ip() ip: string, @Param('id') id: string, @Body() dto: EntregaHl7Dto) {
    this.exigirToken(token, ip);
    return confirmarEntrega(this.prisma, id, dto.erro);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ti', 'direcao')
  @Get('mensagens')
  listar(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.service.listarMensagens(
      skip ? parseInt(skip, 10) : 0,
      take ? Math.min(parseInt(take, 10), 100) : 50,
    );
  }
}
