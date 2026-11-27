import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { IndicadoresService } from './indicadores.service';
import { DEFINICOES } from './indicadores.definicoes';

const QUALIDADE = ['direcao', 'chefe_enfermeiros', 'chefe_medicos', 'qualidade'] as const;

/** PROD-18 — indicadores sensíveis aos cuidados de enfermagem (definição versionada, drill-down, CSV). */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('indicadores')
export class IndicadoresController {
  constructor(private readonly service: IndicadoresService) {}

  @Get('definicoes')
  @Roles(...QUALIDADE)
  definicoes() {
    return DEFINICOES;
  }

  /** ?inicio=AAAA-MM-DD&fim=AAAA-MM-DD&servico=…; com &codigo=…, só esse indicador e os casos. */
  @Get()
  @Roles(...QUALIDADE)
  calcular(@Query('inicio') inicio?: string, @Query('fim') fim?: string, @Query('servico') servico?: string, @Query('codigo') codigo?: string) {
    return this.service.calcular({ inicio, fim, servico, codigo });
  }

  @Get('exportar')
  @Roles(...QUALIDADE)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="indicadores.csv"')
  exportar(@Query('inicio') inicio?: string, @Query('fim') fim?: string, @Query('servico') servico?: string, @Query('codigo') codigo?: string) {
    return this.service.exportarCsv({ inicio, fim, servico, codigo });
  }
}
