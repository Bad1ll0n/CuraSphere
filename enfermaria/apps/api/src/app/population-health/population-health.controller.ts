import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { IsString, IsNotEmpty, IsObject, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PopulationHealthService } from './population-health.service';

const PH_ROLES = ['medico', 'direcao', 'qualidade'] as const;

class CriarCoorteDto {
  @IsString() @IsNotEmpty() @MaxLength(200) nome!: string;
  @IsObject() filtros!: Record<string, any>;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PH_ROLES)
@Controller('population-health')
export class PopulationHealthController {
  constructor(private readonly service: PopulationHealthService) {}

  @Post('coortes')
  criarCoorte(
    @Body() dto: CriarCoorteDto,
    @Request() req: any,
  ) {
    return this.service.criarCoorte(req.user.sub, dto);
  }

  @Get('coortes')
  listarCoortes() {
    return this.service.listarCoortes();
  }

  @Delete('coortes/:id')
  apagarCoorte(@Param('id') id: string) {
    return this.service.apagarCoorte(id);
  }

  @Get('coortes/:id/analise')
  analisarCoorte(@Param('id') id: string) {
    return this.service.analisarCoorte(id);
  }
}
