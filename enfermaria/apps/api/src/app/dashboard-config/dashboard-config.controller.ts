import { Controller, Get, Put, Delete, Body, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardConfigService, WidgetLayout } from './dashboard-config.service';

@UseGuards(JwtAuthGuard)
@Controller('dashboard-config')
export class DashboardConfigController {
  constructor(private readonly service: DashboardConfigService) {}

  @Get()
  getConfig(@Request() req: any) {
    return this.service.getConfig(req.user.sub ?? req.user.id);
  }

  @Put()
  saveConfig(@Body() body: { widgets: WidgetLayout[] }, @Request() req: any) {
    return this.service.saveConfig(req.user.sub ?? req.user.id, body.widgets);
  }

  @Delete()
  resetConfig(@Request() req: any) {
    return this.service.resetConfig(req.user.sub ?? req.user.id);
  }
}
