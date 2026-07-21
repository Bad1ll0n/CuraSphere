import { Controller, Post, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TriagemPortalService } from './triagem-portal.service';
import { OrientarDto } from './dto/orientar.dto';

/**
 * Assistente de orientação de sintomas para o portal do doente.
 * NÃO diagnostica — orienta sobre o nível de cuidado. Não guarda dados (stateless, sem PHI).
 * Rate-limit apertado para conter abuso/custo (é um endpoint público do portal).
 */
@Controller('triagem-portal')
export class TriagemPortalController {
  constructor(private readonly service: TriagemPortalService) {}

  @Throttle({ default: { ttl: 60000, limit: 8 } })
  @Post('orientar')
  orientar(@Body() dto: OrientarDto) {
    return this.service.orientar(dto);
  }
}
