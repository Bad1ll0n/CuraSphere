import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { MedicacaoService } from './medicacao.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/enums';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('medicacao')
export class MedicacaoController {
  constructor(private readonly medicacaoService: MedicacaoService) {}

  @Get('doente/:doenteId')
  listarPorDoente(@Param('doenteId') doenteId: string) {
    return this.medicacaoService.listarPorDoente(doenteId);
  }

  @Get('doente/:doenteId/historico')
  historicoAdministracao(@Param('doenteId') doenteId: string) {
    return this.medicacaoService.historicoAdministracao(doenteId);
  }

  @Roles(Role.medico, Role.chefe_medicos)
  @Post('prescrever')
  prescrever(@Body() body: {
    doenteId: string;
    nome: string;
    dose: string;
    via: string;
    frequencia: string;
  }, @Request() req: any) {
    return this.medicacaoService.prescrever({ ...body, prescritoPorId: req.user.sub });
  }

  @Roles(Role.enfermeiro, Role.chefe_turno)
  @Post(':id/administrar')
  registarAdministracao(
    @Param('id') id: string,
    @Body() body: { observacoes?: string },
    @Request() req: any,
  ) {
    return this.medicacaoService.registarAdministracao({
      medicacaoId: id,
      administradoPorId: req.user.sub,
      observacoes: body.observacoes,
    });
  }

  @Roles(Role.medico, Role.chefe_medicos, Role.chefe_turno)
  @Patch(':id/descontinuar')
  descontinuar(@Param('id') id: string) {
    return this.medicacaoService.descontinuar(id);
  }

  @Get('mar')
  mar(@Request() req: any) {
    return this.medicacaoService.mar(req.user.sub);
  }

  @Get('pendentes-validacao')
  pendentesValidacao(@Request() req: any) {
    const roles = ['farmaceutico', 'farmaceutico_clinico', 'tecnico_farmacia'];
    if (!roles.includes(req.user.role)) throw new ForbiddenException();
    return this.medicacaoService.pendentesValidacao();
  }

  @Patch(':id/validar')
  validar(@Param('id') id: string, @Request() req: any) {
    const roles = ['farmaceutico', 'farmaceutico_clinico'];
    if (!roles.includes(req.user.role)) throw new ForbiddenException();
    return this.medicacaoService.validarPrescricao(id, req.user.sub);
  }

  @Patch(':id/rejeitar')
  rejeitar(@Param('id') id: string, @Body() body: { motivoRejeicao: string }, @Request() req: any) {
    const roles = ['farmaceutico', 'farmaceutico_clinico'];
    if (!roles.includes(req.user.role)) throw new ForbiddenException();
    return this.medicacaoService.rejeitarPrescricao(id, req.user.sub, body.motivoRejeicao);
  }
}
