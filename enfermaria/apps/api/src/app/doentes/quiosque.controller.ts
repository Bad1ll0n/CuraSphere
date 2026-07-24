import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DoenteService } from './doentes.service';

@Controller('doentes')
export class QuiosqueController {
  constructor(private readonly doenteService: DoenteService) {}

  @Get('quiosque-dados')
  @Throttle({ default: { ttl: 30000, limit: 2 } })
  dadosQuiosque(@Query('token') token: string, @Query('servicoId') servicoId: string) {
    return this.doenteService.dadosQuiosque(token, servicoId);
  }

  @Post('quiosque-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('direcao', 'ti', 'administrativo')
  gerarTokenQuiosque(@Query('servicoId') servicoId: string) {
    const token = this.doenteService.gerarTokenQuiosque(servicoId);
    return { token, servicoId };
  }
}
