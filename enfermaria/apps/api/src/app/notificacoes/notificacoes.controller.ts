import { Controller, Post, Patch, Get, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificacoesService } from './notificacoes.service';

@UseGuards(JwtAuthGuard)
@Controller('notificacoes')
export class NotificacoesController {
  constructor(private readonly service: NotificacoesService) {}

  @Post('registar-token')
  registar(@Body() body: Record<string, any>, @Request() req: any) {
    return this.service.registarToken(req.user.sub, body.token, body.plataforma ?? 'unknown');
  }

  @Get()
  listar(@Request() req: any, @Query('page') page = '1') {
    return this.service.listar(req.user.sub, parseInt(page));
  }

  @Get('nao-lidas')
  contarNaoLidas(@Request() req: any) {
    return this.service.contarNaoLidas(req.user.sub).then(count => ({ count }));
  }

  @Patch('marcar-todas-lidas')
  marcarTodasLidas(@Request() req: any) {
    return this.service.marcarTodasLidas(req.user.sub);
  }

  @Patch(':id/ler')
  marcarLida(@Param('id') id: string, @Request() req: any) {
    return this.service.marcarLida(id, req.user.sub);
  }
}
