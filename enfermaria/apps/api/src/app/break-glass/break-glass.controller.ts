import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BreakGlassService } from './break-glass.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AtivarBreakGlassDto } from './dto/ativar-break-glass.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('break-glass')
export class BreakGlassController {
  constructor(private readonly service: BreakGlassService) {}

  @Throttle({ default: { ttl: 86400000, limit: 10 } })
  @Roles('medico', 'enfermeiro', 'direcao', 'ti', 'chefe_turno', 'chefe_enfermeiros')
  @Post()
  ativar(
    @Body() dto: AtivarBreakGlassDto,
    @Request() req: any,
  ) {
    const ip = req.headers['x-real-ip'] ?? req.ip ?? '';
    return this.service.ativar(req.user.sub, dto.doenteId, dto.motivo, ip);
  }

  @Roles('direcao', 'ti', 'chefe_turno')
  @Get()
  listar(@Query('doenteId') doenteId?: string) {
    return this.service.listar(doenteId);
  }
}
