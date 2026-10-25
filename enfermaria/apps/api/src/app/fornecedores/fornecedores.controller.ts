import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { FornecedoresService } from './fornecedores.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CriarFornecedorDto } from './dto/criar-fornecedor.dto';
import { AtualizarFornecedorDto } from './dto/atualizar-fornecedor.dto';
import { CriarEncomendaDto } from './dto/criar-encomenda.dto';
import { ReceberEncomendaDto } from './dto/receber-encomenda.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fornecedores')
export class FornecedoresController {
  constructor(private readonly fornecedoresService: FornecedoresService) {}

  @Get()
  listar() {
    return this.fornecedoresService.listar();
  }

  @Roles('farmaceutico', 'administrativo')
  @Post()
  criar(@Body() dto: CriarFornecedorDto) {
    return this.fornecedoresService.criar(dto);
  }

  @Roles('farmaceutico', 'administrativo')
  @Patch(':id')
  atualizar(@Param('id') id: string, @Body() dto: AtualizarFornecedorDto) {
    return this.fornecedoresService.atualizar(id, dto);
  }

  @Roles('farmaceutico', 'administrativo')
  @Delete(':id')
  desativar(@Param('id') id: string) {
    return this.fornecedoresService.desativar(id);
  }

  @Get('encomendas')
  listarEncomendas(@Query('estado') estado?: string) {
    return this.fornecedoresService.listarEncomendas(estado);
  }

  @Roles('farmaceutico', 'administrativo')
  @Post('encomendas')
  criarEncomenda(@Body() dto: CriarEncomendaDto) {
    return this.fornecedoresService.criarEncomenda(dto);
  }

  @Roles('farmaceutico', 'administrativo')
  @Patch('encomendas/:id/receber')
  receberEncomenda(
    @Param('id') id: string,
    @Body() dto: ReceberEncomendaDto,
    @Request() req: any,
  ) {
    return this.fornecedoresService.receberEncomenda(id, dto.quantidadeRecebida, req.user.sub);
  }
}
