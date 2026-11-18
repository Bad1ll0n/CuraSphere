import { Controller, Get, Post, Patch, Body, Param, Headers, Request, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { MonitorizacaoService } from './monitorizacao.service';
import { RegistarDispositivoDto } from './dto/registar-dispositivo.dto';
import { IngerirVitalDto } from './dto/ingerir-vital.dto';
import { RejeitarLeiturasDto, ValidarLeiturasDto } from './dto/validar-leituras.dto';
import { LeiturasMonitorService } from './leituras-monitor.service';

@Controller('monitorizacao')
export class MonitorizacaoController {
  constructor(
    private readonly service: MonitorizacaoService,
    private readonly leituras: LeiturasMonitorService,
  ) {}

  // ── Gestão de dispositivos (JWT + role) ──────────────────────────────────────
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ti', 'chefe_enfermeiros', 'direcao')
  @Post('dispositivos')
  registar(@Body() dto: RegistarDispositivoDto) {
    return this.service.registarDispositivo(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ti', 'chefe_enfermeiros', 'direcao', 'enfermeiro', 'medico')
  @Get('dispositivos')
  listar() {
    return this.service.listarDispositivos();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ti', 'chefe_enfermeiros', 'direcao')
  @Patch('dispositivos/:id/revogar')
  revogar(@Param('id') id: string) {
    return this.service.revogarDispositivo(id);
  }

  // ── Ingestão (autenticada por chave de dispositivo, NÃO JWT) ──────────────────
  // Header: X-Device-Key: <id>.<secret>. Rate-limit generoso para monitorização contínua.
  @Throttle({ default: { ttl: 60000, limit: 240 } })
  @Post('ingerir')
  ingerir(@Headers('x-device-key') deviceKey: string, @Body() dto: IngerirVitalDto) {
    return this.service.ingerir(deviceKey, dto);
  }

  // ── PROD-15: leituras pendentes de validação de enfermagem (por doente) ───────
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('enfermeiro', 'chefe_enfermeiros', 'chefe_turno', 'medico')
  @Get('doente/:doenteId/leituras-pendentes')
  pendentes(@Param('doenteId') doenteId: string) {
    return this.leituras.pendentes(doenteId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('enfermeiro', 'chefe_enfermeiros', 'chefe_turno')
  @Post('doente/:doenteId/leituras/validar')
  validar(@Param('doenteId') doenteId: string, @Body() dto: ValidarLeiturasDto, @Request() req: any) {
    return this.leituras.validar(doenteId, dto.ids, req.user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('enfermeiro', 'chefe_enfermeiros', 'chefe_turno')
  @Post('doente/:doenteId/leituras/rejeitar')
  rejeitar(@Param('doenteId') doenteId: string, @Body() dto: RejeitarLeiturasDto, @Request() req: any) {
    return this.leituras.rejeitar(doenteId, dto.ids, req.user.sub, dto.motivo);
  }
}
