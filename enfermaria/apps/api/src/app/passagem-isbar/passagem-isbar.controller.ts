import { Body, Controller, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AcessoDoentePor } from '../doentes/acesso-doente.decorator';
import { PassagemIsbarService } from './passagem-isbar.service';

export class PassagemIsbarDto {
  @ApiProperty() @IsString() @MaxLength(4000) identificacao!: string;
  @ApiProperty() @IsString() @MaxLength(4000) situacao!: string;
  @ApiProperty() @IsString() @MaxLength(4000) antecedentes!: string;
  @ApiProperty() @IsString() @MaxLength(4000) avaliacao!: string;
  @ApiProperty() @IsString() @MaxLength(4000) recomendacoes!: string;
  @ApiPropertyOptional({ description: 'true = entregar (deixa de ser rascunho)' }) @IsBoolean() @IsOptional() entregar?: boolean;
}

/**
 * UX-22 — passagem de turno ISBAR. As rotas com `:doenteId` passam pela verificação de acesso
 * ao doente (AcessoDoenteInterceptor); a de receção resolve o doente pela passagem.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('passagem-isbar')
export class PassagemIsbarController {
  constructor(private readonly service: PassagemIsbarService) {}

  @Get()
  @Roles('enfermeiro', 'medico')
  listar(@Request() req: any, @Query('servico') servico?: string) {
    return this.service.listar(req.user, servico || undefined);
  }

  @Get('doente/:doenteId/sugestao')
  @Roles('enfermeiro', 'medico')
  sugestao(@Param('doenteId') doenteId: string) {
    return this.service.sugestao(doenteId);
  }

  @Get('doente/:doenteId/historico')
  @Roles('enfermeiro', 'medico')
  historico(@Param('doenteId') doenteId: string) {
    return this.service.historico(doenteId);
  }

  @Put('doente/:doenteId')
  @Roles('enfermeiro', 'medico')
  guardar(@Param('doenteId') doenteId: string, @Body() dto: PassagemIsbarDto, @Request() req: any) {
    return this.service.guardar(doenteId, req.user.sub, dto);
  }

  @Post(':id/receber')
  @Roles('enfermeiro', 'medico')
  @AcessoDoentePor('passagemIsbar')
  receber(@Param('id') id: string, @Request() req: any) {
    return this.service.receber(id, req.user.sub);
  }
}
