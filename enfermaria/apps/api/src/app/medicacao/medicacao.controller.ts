import { Controller, Get, Post, Patch, Body, Param, Query, Res, UseGuards, Request } from '@nestjs/common';
import type { Response } from 'express';
import { MedicacaoService } from './medicacao.service';
import { DoenteService } from '../doentes/doentes.service';
import { PdfService } from '../common/pdf.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PrescreverMedicacaoDto } from './dto/prescrever-medicacao.dto';
import { ProporMedicacaoDto } from './dto/propor-medicacao.dto';
import { RejeitarMedicacaoDto } from './dto/rejeitar-medicacao.dto';
import { AdministrarMedicacaoDto } from './dto/administrar-medicacao.dto';
import { NaoAdministrarDto } from './dto/nao-administrar.dto';
import { TotpCodeDto } from './dto/totp-code.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('medicacao')
export class MedicacaoController {
  constructor(
    private readonly medicacaoService: MedicacaoService,
    private readonly doenteService: DoenteService,
    private readonly pdfService: PdfService,
  ) {}

  @Get('doente/:doenteId')
  async listarPorDoente(@Param('doenteId') doenteId: string, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.medicacaoService.listarPorDoente(doenteId);
  }

  @Get('doente/:doenteId/historico')
  async historicoAdministracao(@Param('doenteId') doenteId: string, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.medicacaoService.historicoAdministracao(doenteId);
  }

  @Roles('medico')
  @Post('prescrever')
  prescrever(@Body() dto: PrescreverMedicacaoDto, @Request() req: any) {
    return this.medicacaoService.prescrever({ ...dto, prescritoPorId: req.user.sub });
  }

  @Roles('enfermeiro')
  @Post('propor')
  proporPrescricao(@Body() dto: ProporMedicacaoDto, @Request() req: any) {
    return this.medicacaoService.proporPrescricao({ ...dto, prescritoPorId: req.user.sub });
  }

  @Roles('medico', 'direcao')
  @Get('pendentes-aprovacao-medico')
  pendentesAprovacaoMedico(@Query('servico') servico?: string) {
    return this.medicacaoService.pendentesAprovacaoMedico(servico);
  }

  @Roles('medico', 'direcao')
  @Patch(':id/aprovar-medico')
  aprovarPrescricaoMedico(@Param('id') id: string, @Request() req: any) {
    return this.medicacaoService.aprovarPrescricaoMedico(id, req.user.sub);
  }

  @Roles('medico', 'direcao')
  @Patch(':id/rejeitar-medico')
  rejeitarPrescricaoMedico(
    @Param('id') id: string,
    @Body() dto: RejeitarMedicacaoDto,
    @Request() req: any,
  ) {
    return this.medicacaoService.rejeitarPrescricaoMedico(id, req.user.sub, dto.motivoRejeicao);
  }

  @Roles('enfermeiro')
  @Post(':id/administrar')
  registarAdministracao(
    @Param('id') id: string,
    @Body() dto: AdministrarMedicacaoDto,
    @Request() req: any,
  ) {
    return this.medicacaoService.registarAdministracao({
      medicacaoId: id,
      doenteId: dto.doenteId,
      administradoPorId: req.user.sub,
      observacoes: dto.observacoes,
    });
  }

  @Roles('enfermeiro')
  @Post(':id/nao-administrar')
  naoAdministrar(
    @Param('id') id: string,
    @Body() dto: NaoAdministrarDto,
    @Request() req: any,
  ) {
    return this.medicacaoService.naoAdministrar({
      medicacaoId: id,
      registadoPorId: req.user.sub,
      motivo: dto.motivo,
    });
  }

  @Roles('medico', 'enfermeiro')
  @Patch(':id/descontinuar')
  descontinuar(@Param('id') id: string) {
    return this.medicacaoService.descontinuar(id);
  }

  @Get('doente/:id/mar/pdf')
  @Roles('medico', 'enfermeiro', 'farmaceutico', 'chefe_enfermeiros', 'chefe_turno')
  async marPdf(
    @Param('id') id: string,
    @Query('data') data: string | undefined,
    @Res() res: Response,
    @Request() req: any,
  ) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, id);
    const buffer = await this.pdfService.gerarMar(id, data);
    const dataLabel = data ? data.slice(0, 10) : new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="MAR_${id}_${dataLabel}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('mar')
  mar(@Request() req: any) {
    return this.medicacaoService.mar(req.user.sub);
  }

  @Roles('farmaceutico')
  @Get('pendentes-validacao')
  pendentesValidacao() {
    return this.medicacaoService.pendentesValidacao();
  }

  @Roles('farmaceutico')
  @Patch(':id/validar')
  validar(@Param('id') id: string, @Request() req: any) {
    return this.medicacaoService.validarPrescricao(id, req.user.sub);
  }

  @Roles('farmaceutico')
  @Patch(':id/rejeitar')
  rejeitar(@Param('id') id: string, @Body() dto: RejeitarMedicacaoDto, @Request() req: any) {
    return this.medicacaoService.rejeitarPrescricao(id, req.user.sub, dto.motivoRejeicao);
  }

  @Roles('medico', 'enfermeiro')
  @Post(':id/assinar')
  assinar(@Param('id') id: string, @Body() dto: TotpCodeDto, @Request() req: any) {
    return this.medicacaoService.assinar(id, req.user.sub, dto.totpCode);
  }

  @Get('interacoes')
  async verificarInteracoes(@Query('doenteId') doenteId: string, @Query('nome') nome: string, @Request() req: any) {
    if (doenteId) {
      await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    }
    return this.medicacaoService.verificarInteracoes(doenteId, nome);
  }

  @Post('verificar-5-certos')
  @Roles('medico', 'enfermeiro', 'chefe_turno', 'chefe_enfermeiros', 'auxiliar', 'tecnico_saude')
  verificar5Certos(@Body() body: { qrPayload: string; doenteIdEsperado: string }) {
    return this.medicacaoService.verificar5Certos(body.qrPayload, body.doenteIdEsperado);
  }

  @Get('timeline')
  @Roles('medico', 'enfermeiro', 'chefe_turno', 'chefe_enfermeiros', 'farmaceutico')
  timeline(
    @Query('servico') servico: string,
    @Query('turno') turno: 'manha' | 'tarde' | 'noite',
    @Query('data') data?: string,
  ) {
    return this.medicacaoService.timeline(servico, turno ?? 'manha', data);
  }

  @Get('prescricoes-ativas')
  @Roles('medico', 'farmaceutico', 'chefe_enfermeiros', 'direcao')
  listarPrescricoesAtivas(@Query('servico') servico?: string) {
    return this.medicacaoService.listarPrescricoesAtivas(servico);
  }

  @Get('doente/:doenteId/interacoes')
  @Roles('medico', 'enfermeiro', 'farmaceutico', 'chefe_enfermeiros')
  async listarInteracoesPorDoente(@Param('doenteId') doenteId: string, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.medicacaoService.listarInteracoesPorDoente(doenteId);
  }

  @Get('ajuste-renal')
  @Roles('medico', 'farmaceutico', 'chefe_enfermeiros')
  async ajusteRenal(
    @Query('doenteId') doenteId: string,
    @Query('medicamento') medicamento: string,
    @Request() req: any,
  ) {
    if (doenteId) {
      await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    }
    return this.medicacaoService.calcularAjusteRenal(doenteId, medicamento);
  }
}
