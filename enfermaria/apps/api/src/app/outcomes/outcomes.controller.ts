import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { OutcomesService, CriarOutcomeDto } from './outcomes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('outcomes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OutcomesController {
  constructor(private readonly service: OutcomesService) {}

  @Post()
  @Roles('medico', 'enfermeiro', 'direcao')
  criar(@Body() dto: CriarOutcomeDto, @Request() req: any) {
    return this.service.criar(dto, req.user.userId);
  }

  @Get('dashboard')
  @Roles('medico', 'direcao', 'qualidade', 'ti')
  dashboard() {
    return this.service.dashboard();
  }

  // S-01: com `:id` a rota escapava à verificação global de acesso ao doente. O URL é o mesmo.
  @Get('doente/:doenteId')
  @Roles('medico', 'enfermeiro', 'direcao', 'qualidade')
  listarPorDoente(@Param('doenteId') doenteId: string) {
    return this.service.listarPorDoente(doenteId);
  }
}
