import { Controller, Get, UseGuards } from '@nestjs/common';
import { PendenciasService } from './pendencias.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

// ARQ-19: pendências operacionais (prescrições por validar, medicação sem registo no MAR, pedidos
// parados). Não é a reconciliação medicamentosa (`reconciliacao-medicacao/`); a rota mantém o nome
// antigo para não partir a web.
@Controller('reconciliacao')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('medico', 'farmaceutico', 'enfermeiro', 'chefe_enfermeiros', 'direcao')
export class PendenciasController {
  constructor(private readonly service: PendenciasService) {}

  @Get()
  resumo() {
    return this.service.resumo();
  }

  @Get('itens')
  itens() {
    return this.service.verificar();
  }
}
