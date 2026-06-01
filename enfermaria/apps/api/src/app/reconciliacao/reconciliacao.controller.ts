import { Controller, Get, UseGuards } from '@nestjs/common';
import { ReconciliacaoService } from './reconciliacao.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('reconciliacao')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('medico', 'farmaceutico', 'enfermeiro', 'chefe_enfermeiros', 'direcao')
export class ReconciliacaoController {
  constructor(private readonly service: ReconciliacaoService) {}

  @Get()
  resumo() {
    return this.service.resumo();
  }

  @Get('itens')
  itens() {
    return this.service.verificar();
  }
}
