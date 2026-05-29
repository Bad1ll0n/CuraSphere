import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ContactosService } from './contactos.service';
import { CriarContactoDto } from './dto/criar-contacto.dto';

@UseGuards(JwtAuthGuard)
@Controller('contactos')
export class ContactosController {
  constructor(private readonly service: ContactosService) {}

  @Get(':doenteId')
  listar(@Param('doenteId') doenteId: string) {
    return this.service.listar(doenteId);
  }

  @Post(':doenteId')
  criar(@Param('doenteId') doenteId: string, @Body() dto: CriarContactoDto) {
    return this.service.criar(doenteId, dto);
  }

  @Delete(':id')
  remover(@Param('id') id: string) {
    return this.service.remover(id);
  }
}
