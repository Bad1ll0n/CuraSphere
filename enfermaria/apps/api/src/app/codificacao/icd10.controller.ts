import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Icd10Service } from './icd10.service';

@ApiTags('Codificação ICD-10')
@UseGuards(JwtAuthGuard)
@Controller('codificacao/icd10')
export class Icd10Controller {
  constructor(private readonly svc: Icd10Service) {}

  @Get()
  @ApiOperation({ summary: 'Pesquisa códigos ICD-10 por texto ou prefixo de código' })
  @ApiQuery({ name: 'q', required: true, description: 'Texto ou prefixo de código (mín. 2 chars)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Máximo de resultados (padrão 10, máx 20)' })
  buscar(
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ) {
    const n = Math.min(parseInt(limit ?? '10', 10) || 10, 20);
    return this.svc.buscar(q, n);
  }
}
