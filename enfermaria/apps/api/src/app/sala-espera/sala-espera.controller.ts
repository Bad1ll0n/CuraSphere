import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SalaEsperaService } from './sala-espera.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sala-espera')
export class SalaEsperaController {
  constructor(private readonly service: SalaEsperaService) {}

  @Get()
  listar(@Query('todos') todos?: string) {
    return this.service.listar(todos === 'true');
  }

  @Get('estatisticas')
  estatisticas() {
    return this.service.estatisticas();
  }

  @Post()
  @Roles('administrativo', 'rececionista', 'chefe_turno', 'auxiliar_saude')
  registar(@Body() dto: any, @Request() req: any) {
    return this.service.registar(dto, req.user.sub);
  }

  @Patch(':id/chamar')
  @Roles('medico', 'medico_especialista', 'chefe_medicos', 'enfermeiro', 'enfermeiro_especialista')
  chamar(@Param('id') id: string, @Request() req: any) {
    return this.service.chamar(id, req.user.sub);
  }

  @Patch(':id/concluir')
  @Roles('medico', 'medico_especialista', 'chefe_medicos', 'enfermeiro', 'enfermeiro_especialista', 'administrativo', 'rececionista')
  concluir(@Param('id') id: string, @Body('estado') estado: 'atendido' | 'desistiu' | 'ausente') {
    return this.service.concluir(id, estado);
  }
}
