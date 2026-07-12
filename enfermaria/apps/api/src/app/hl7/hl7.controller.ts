import { Controller, Post, Get, Body, Headers, Query, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Hl7Service } from './hl7.service';

@Controller('hl7')
export class Hl7Controller {
  private readonly hl7Token: string;

  constructor(
    private readonly service: Hl7Service,
    private readonly config: ConfigService,
  ) {
    this.hl7Token = this.config.get<string>('HL7_API_TOKEN', '');
  }

  @Post('receive')
  async receberMensagem(
    @Body() body: string | Buffer,
    @Headers('x-hl7-token') token: string,
    @Headers('content-type') contentType: string,
  ) {
    if (!this.hl7Token || token !== this.hl7Token) {
      throw new UnauthorizedException('Token HL7 inválido');
    }
    const raw = Buffer.isBuffer(body) ? body.toString('utf-8') : String(body);
    return this.service.receberMensagem(raw);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('it_admin', 'direcao', 'admin')
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
