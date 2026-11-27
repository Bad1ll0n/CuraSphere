import { Body, Controller, Get, Param, Patch, Request, UseGuards } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ResumoDoenteService } from './resumo-doente.service';

export class NaoReanimarDto {
  @ApiProperty() @IsBoolean() ativo!: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(1000) notas?: string;
}

/** UX-29 / UX-30 — faixa de identificação e "O meu turno". Rotas com :doenteId verificam o acesso ao doente. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('resumo')
export class ResumoDoenteController {
  constructor(private readonly service: ResumoDoenteService) {}

  @Get('meu-turno')
  @Roles('enfermeiro', 'auxiliar', 'medico')
  meuTurno(@Request() req: any) {
    return this.service.meuTurno(req.user.sub);
  }

  @Get('doente/:doenteId/faixa')
  faixa(@Param('doenteId') doenteId: string) {
    return this.service.faixa(doenteId);
  }

  @Patch('doente/:doenteId/nao-reanimar')
  @Roles('medico')
  naoReanimar(@Param('doenteId') doenteId: string, @Body() dto: NaoReanimarDto, @Request() req: any) {
    return this.service.definirNaoReanimar(doenteId, req.user.sub, dto);
  }
}
