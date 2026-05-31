import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ChamarTicketDto } from './dto/chamar-ticket.dto';
import { TicketsService } from './tickets.service';

@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('administrativo', 'enfermeiro', 'medico', 'direcao')
export class TicketsController {
  constructor(private readonly service: TicketsService) {}

  @Get('fila')
  fila() {
    return this.service.listarFila();
  }

  @Get('ultimos')
  ultimos() {
    return this.service.ultimos(20);
  }

  @Get('stats')
  stats() {
    return this.service.statsHoje();
  }

  @Post('chamar')
  chamar(@Body() dto: ChamarTicketDto) {
    return this.service.chamarProximo(dto.balcao ?? '1');
  }

  @Patch(':id/rechamar')
  rechamar(@Param('id') id: string, @Body() dto: ChamarTicketDto) {
    return this.service.rechamar(id, dto.balcao ?? '1');
  }

  @Patch(':id/concluir')
  concluir(@Param('id') id: string) {
    return this.service.concluir(id);
  }

  @Patch(':id/desistiu')
  desistiu(@Param('id') id: string) {
    return this.service.marcarDesistiu(id);
  }
}
