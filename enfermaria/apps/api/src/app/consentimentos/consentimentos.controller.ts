import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ConsentimentosService } from './consentimentos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CriarConsentimentoDto } from './dto/criar-consentimento.dto';
import { AssinarConsentimentoDto } from './dto/assinar-consentimento.dto';
import { RecusarConsentimentoDto } from './dto/recusar-consentimento.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('consentimentos')
export class ConsentimentosController {
  constructor(private readonly service: ConsentimentosService) {}

  @Roles('medico', 'enfermeiro')
  @Post()
  criar(@Body() dto: CriarConsentimentoDto, @Request() req: any) {
    return this.service.criar({ ...dto, criadoPorId: req.user.sub });
  }

  @Get('doente/:doenteId')
  listarPorDoente(@Param('doenteId') doenteId: string) {
    return this.service.listarPorDoente(doenteId);
  }

  @Roles('medico', 'enfermeiro', 'administrativo')
  @Post(':id/assinar')
  assinar(
    @Param('id') id: string,
    @Body() dto: AssinarConsentimentoDto,
    @Request() req: any,
  ) {
    return this.service.assinar(id, dto.testemunhaId ?? req.user.sub);
  }

  @Roles('medico', 'enfermeiro', 'administrativo')
  @Post(':id/recusar')
  recusar(@Param('id') id: string, @Body() dto: RecusarConsentimentoDto) {
    return this.service.recusar(id, dto.motivo);
  }
}
