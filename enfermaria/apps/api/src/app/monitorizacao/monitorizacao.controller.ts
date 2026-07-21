import { Controller, Get, Post, Patch, Body, Param, Headers, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { MonitorizacaoService } from './monitorizacao.service';
import { RegistarDispositivoDto } from './dto/registar-dispositivo.dto';
import { IngerirVitalDto } from './dto/ingerir-vital.dto';

@Controller('monitorizacao')
export class MonitorizacaoController {
  constructor(private readonly service: MonitorizacaoService) {}

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
}
