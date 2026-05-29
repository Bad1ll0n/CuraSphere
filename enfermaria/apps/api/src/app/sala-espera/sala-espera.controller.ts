import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SalaEsperaService } from './sala-espera.service';
import { RegistarSalaEsperaDto } from './dto/registar-sala-espera.dto';

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
  @Roles('administrativo', 'auxiliar')
  registar(@Body() dto: RegistarSalaEsperaDto, @Request() req: any) {
    return this.service.registar(dto, req.user.sub);
  }

  @Patch(':id/chamar')
  @Roles('medico', 'enfermeiro')
  chamar(@Param('id') id: string, @Request() req: any) {
    return this.service.chamar(id, req.user.sub);
  }

  @Patch(':id/concluir')
  @Roles('medico', 'enfermeiro', 'administrativo')
  concluir(@Param('id') id: string, @Body('estado') estado: 'atendido' | 'desistiu' | 'ausente') {
    return this.service.concluir(id, estado);
  }
}
