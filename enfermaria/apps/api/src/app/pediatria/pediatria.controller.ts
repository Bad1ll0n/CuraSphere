import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { PediatriaService } from './pediatria.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CalcularDoseDto } from './dto/calcular-dose.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pediatria')
export class PediatriaController {
  constructor(private readonly service: PediatriaService) {}

  // Calculadora de dose por peso — quem prescreve/administra/valida medicação.
  @Post('calcular-dose')
  @Roles('medico', 'enfermeiro', 'farmaceutico')
  calcularDose(@Body() dto: CalcularDoseDto) {
    return this.service.calcularDose(dto);
  }

  // Tendência de PEWS de um doente pediátrico.
  @Get('pews/:doenteId')
  @Roles('medico', 'enfermeiro', 'auxiliar', 'tecnico_saude')
  pewsTendencia(@Param('doenteId') doenteId: string) {
    return this.service.pewsTendencia(doenteId);
  }
}
