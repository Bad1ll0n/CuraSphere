import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificacoesService } from './notificacoes.service';
import { RegistarTokenDto } from './dto/registar-token.dto';

@UseGuards(JwtAuthGuard)
@Controller('notificacoes')
export class NotificacoesController {
  constructor(private readonly service: NotificacoesService) {}

  @Post('registar-token')
  registar(@Body() dto: RegistarTokenDto, @Request() req: any) {
    return this.service.registarToken(req.user.sub, dto.token, dto.plataforma ?? 'unknown');
  }
}
