import { Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { QuiosqueGuard } from '../common/quiosque.guard';
import { DoenteService } from './doentes.service';

@Controller('doentes')
export class QuiosqueController {
  constructor(private readonly doenteService: DoenteService) {}

  // S-05: esta rota validava o token por conta própria e ficava fora do tecto de idade e da
  // revogação do QuiosqueGuard — um tablet perdido abria-a durante os 365 dias do token. O
  // guard também confirma que o `?servicoId=` pedido, quando vem, é o do token.
  @Get('quiosque-dados')
  @UseGuards(QuiosqueGuard)
  @Throttle({ default: { ttl: 30000, limit: 2 } })
  dadosQuiosque(@Req() req: { quiosque: { servicoId: string } }) {
    return this.doenteService.dadosQuiosque(req.quiosque.servicoId);
  }

  @Post('quiosque-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('direcao', 'ti', 'administrativo')
  gerarTokenQuiosque(@Query('servicoId') servicoId: string) {
    const token = this.doenteService.gerarTokenQuiosque(servicoId);
    return { token, servicoId };
  }
}
