import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RegrasCliniciasService } from './regras-clinicas.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('regras-clinicas')
export class RegrasCliniciasController {
  constructor(private readonly service: RegrasCliniciasService) {}

  @Get()
  @Roles('medico', 'chefe_enfermeiros', 'ti', 'direcao')
  listar(@Query('ativa') ativa?: string) {
    const ativaFilter = ativa !== undefined ? ativa === 'true' : undefined;
    return this.service.listar(ativaFilter);
  }

  @Post()
  @Roles('ti', 'direcao', 'chefe_enfermeiros')
  criar(
    @Body() dto: {
      nome: string;
      condicao: Record<string, any>;
      acoes: Array<Record<string, any>>;
      servicoId?: string;
    },
    @Request() req: any,
  ) {
    return this.service.criar(req.user.sub, dto);
  }

  @Patch(':id')
  @Roles('ti', 'direcao')
  atualizar(
    @Param('id') id: string,
    @Body() dto: {
      nome?: string;
      condicao?: Record<string, any>;
      acoes?: Array<Record<string, any>>;
      ativa?: boolean;
    },
  ) {
    return this.service.atualizar(id, dto);
  }

  @Delete(':id')
  @Roles('ti', 'direcao')
  apagar(@Param('id') id: string) {
    return this.service.apagar(id);
  }
}
