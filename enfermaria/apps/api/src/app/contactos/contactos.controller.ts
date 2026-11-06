import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ContactosService } from './contactos.service';
import { CriarContactoDto } from './dto/criar-contacto.dto';
import { AcessoDoentePor } from '../doentes/acesso-doente.decorator';

// QA-12: sem RolesGuard, qualquer papel (incluindo operacional/facilities) criava e apagava
// contactos de emergência. Ler continua aberto a quem tem acesso ao doente.
@UseGuards(JwtAuthGuard, RolesGuard)
@AcessoDoentePor('contactoEmergencia')
@Controller('contactos')
export class ContactosController {
  constructor(private readonly service: ContactosService) {}

  @Get(':doenteId')
  listar(@Param('doenteId') doenteId: string) {
    return this.service.listar(doenteId);
  }

  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'administrativo')
  @Post(':doenteId')
  criar(@Param('doenteId') doenteId: string, @Body() dto: CriarContactoDto) {
    return this.service.criar(doenteId, dto);
  }

  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'administrativo')
  @Delete(':id')
  remover(@Param('id') id: string, @Request() req: { user: { sub: string } }) {
    return this.service.remover(id, req.user.sub);
  }
}
