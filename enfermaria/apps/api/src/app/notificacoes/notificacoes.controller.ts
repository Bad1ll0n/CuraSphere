import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
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
}
