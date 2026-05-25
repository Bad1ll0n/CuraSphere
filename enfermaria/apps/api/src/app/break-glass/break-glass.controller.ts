import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { BreakGlassService } from './break-glass.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('break-glass')
export class BreakGlassController {
  constructor(private readonly service: BreakGlassService) {}

  @Roles('medico', 'enfermeiro', 'direcao', 'ti', 'chefe_turno', 'chefe_enfermeiros')
  @Post()
  ativar(
    @Body() body: { doenteId: string; motivo: string },
    @Request() req: any,
  ) {
    const ip = req.headers['x-real-ip'] ?? req.ip ?? '';
    return this.service.ativar(req.user.sub, body.doenteId, body.motivo, ip);
  }

  @Roles('direcao', 'ti', 'chefe_turno')
  @Get()
  listar(@Query('doenteId') doenteId?: string) {
    return this.service.listar(doenteId);
  }
}
