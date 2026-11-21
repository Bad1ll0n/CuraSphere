import { Controller, Post, Get, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificacoesService } from './notificacoes.service';
import { RegistarTokenDto } from './dto/registar-token.dto';
import type { PedidoAutenticado } from '../auth/pedido-autenticado';

@UseGuards(JwtAuthGuard)
@Controller('notificacoes')
export class NotificacoesController {
  constructor(private readonly service: NotificacoesService) {}

  @Post('registar-token')
  registar(@Body() dto: RegistarTokenDto, @Request() req: PedidoAutenticado) {
    return this.service.registarToken(req.user.sub, dto.token, dto.plataforma ?? 'unknown');
  }

  @Get()
  listar(@Request() req: PedidoAutenticado, @Query('page') page = '1') {
    return this.service.listar(req.user.sub, +page, 20);
  }

  @Get('nao-lidas')
  contarNaoLidas(@Request() req: PedidoAutenticado) {
    return this.service.contarNaoLidas(req.user.sub);
  }

  @Patch('marcar-todas-lidas')
  marcarTodasLidas(@Request() req: PedidoAutenticado) {
    return this.service.marcarTodasLidas(req.user.sub);
  }

  @Patch(':id/ler')
  marcarLida(@Param('id') id: string, @Request() req: PedidoAutenticado) {
    return this.service.marcarLida(id, req.user.sub);
  }
}
