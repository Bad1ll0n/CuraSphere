import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { FornecedoresService } from './fornecedores.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

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
  criar(@Body() body: { nome: string; nif?: string; email?: string; telefone?: string; morada?: string }) {
    return this.fornecedoresService.criar(body);
  }

  @Roles('farmaceutico', 'administrativo')
  @Patch(':id')
  atualizar(@Param('id') id: string, @Body() body: Partial<{ nome: string; nif: string; email: string; telefone: string; morada: string }>) {
    return this.fornecedoresService.atualizar(id, body);
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
  criarEncomenda(@Body() body: {
    fornecedorId: string;
    stockItemId: string;
    quantidadeEncomendada: number;
    precoUnitario?: number;
    dataEntregaPrevista?: string;
    observacoes?: string;
  }) {
    return this.fornecedoresService.criarEncomenda(body);
  }

  @Roles('farmaceutico', 'administrativo')
  @Patch('encomendas/:id/receber')
  receberEncomenda(
    @Param('id') id: string,
    @Body() body: { quantidadeRecebida: number },
    @Request() req: any,
  ) {
    return this.fornecedoresService.receberEncomenda(id, body.quantidadeRecebida, req.user.sub);
  }
}
