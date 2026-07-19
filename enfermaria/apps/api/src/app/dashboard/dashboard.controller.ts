import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('analytics')
  analytics() {
    return this.service.analytics();
  }

  @Get('ti')
  @Roles('ti', 'direcao')
  dashboardTI() {
    return this.service.dashboardTI();
  }

  @Get('executivo')
  @Roles('direcao', 'administrativo')
  dashboardExecutivo() {
    return this.service.dashboardExecutivo();
  }

  @Get('pessoal')
  @Roles('direcao', 'administrativo')
  dashboardPessoal() {
    return this.service.dashboardPessoal();
  }

  @Get('workload-turno')
  @Roles('enfermeiro', 'medico', 'auxiliar')
  workloadTurno(@Request() req: any) {
    return this.service.workloadTurno(req.user.sub);
  }

  @Get('qualidade')
  @Roles('qualidade', 'direcao', 'medico', 'enfermeiro')
  dashboardQualidade() {
    return this.service.dashboardQualidade();
  }

  @Get('news2')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'direcao', 'qualidade')
  news2Distribuicao() {
    return this.service.news2Distribuicao();
  }
}
