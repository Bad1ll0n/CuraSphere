import { Controller, Get, UseGuards } from '@nestjs/common';
import { ReconciliacaoService } from './reconciliacao.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('reconciliacao')
@UseGuards(JwtAuthGuard)
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
