import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ConsentimentosService } from './consentimentos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('consentimentos')
export class ConsentimentosController {
  constructor(private readonly service: ConsentimentosService) {}

  @Roles('medico', 'enfermeiro')
  @Post()
  criar(@Body() body: { doenteId: string; tipo: string; descricao: string }, @Request() req: any) {
    return this.service.criar({ ...body, criadoPorId: req.user.sub });
  }

  @Get('doente/:doenteId')
  listarPorDoente(@Param('doenteId') doenteId: string) {
    return this.service.listarPorDoente(doenteId);
  }

  @Roles('medico', 'enfermeiro', 'administrativo')
  @Post(':id/assinar')
  assinar(
    @Param('id') id: string,
    @Body() body: { testemunhaId?: string },
    @Request() req: any,
  ) {
    return this.service.assinar(id, body.testemunhaId ?? req.user.sub);
  }

  @Roles('medico', 'enfermeiro', 'administrativo')
  @Post(':id/recusar')
  recusar(@Param('id') id: string, @Body() body: { motivo: string }) {
    return this.service.recusar(id, body.motivo);
  }
}
