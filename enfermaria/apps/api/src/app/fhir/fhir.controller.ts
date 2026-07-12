import { Controller, Get, Post, Delete, Param, Body, Headers, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { FhirService, CriarDispositivoDto } from './fhir.service';

@Controller('fhir')
export class FhirController {
  constructor(private readonly service: FhirService) {}

  // Endpoint público (autenticação via API key, não JWT)
  @Post('Observation')
  receberObservation(
    @Body() body: unknown,
    @Headers('x-device-api-key') apiKey: string,
  ) {
    return this.service.receberObservation(body, apiKey);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('dispositivos')
  @Roles('admin', 'it_admin', 'direcao')
  listar() {
    return this.service.listarDispositivos();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('dispositivos')
  @Roles('admin', 'it_admin')
  criar(@Body() dto: CriarDispositivoDto) {
    return this.service.criarDispositivo(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete('dispositivos/:id')
  @Roles('admin', 'it_admin')
  remover(@Param('id') id: string) {
    return this.service.removerDispositivo(id);
  }

  // ── FHIR R4 Export ──────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('doentes/lookup-sns')
  @Roles('medico', 'enfermeiro', 'admin', 'direcao', 'chefe_enfermeiros')
  lookupSns(@Query('numeroSNS') numeroSNS: string) {
    return this.service.lookupSns(numeroSNS);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('doentes/:id/exportar-fhir')
  @Roles('medico', 'enfermeiro', 'admin', 'direcao', 'chefe_enfermeiros')
  exportarFhir(@Param('id') id: string) {
    return this.service.exportarBundleDoente(id);
  }

  // ── SPMS Integration ────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('spms/:nsns')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros')
  buscarDadosSPMS(@Param('nsns') nsns: string) {
    return this.service.buscarDadosSPMS(nsns);
  }
}
