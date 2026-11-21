import { Controller, Get, Put, Delete, Body, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardConfigService } from './dashboard-config.service';
import { GuardarConfigDto } from './dto/guardar-config.dto';
import type { PedidoAutenticado } from '../auth/pedido-autenticado';

@UseGuards(JwtAuthGuard)
@Controller('dashboard-config')
export class DashboardConfigController {
  constructor(private readonly service: DashboardConfigService) {}

  @Get()
  getConfig(@Request() req: PedidoAutenticado) {
    return this.service.getConfig(req.user.sub);
  }

  @Put()
  saveConfig(@Body() dto: GuardarConfigDto, @Request() req: PedidoAutenticado) {
    return this.service.saveConfig(req.user.sub, dto.widgets);
  }

  @Delete()
  resetConfig(@Request() req: PedidoAutenticado) {
    return this.service.resetConfig(req.user.sub);
  }
}
