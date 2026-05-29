import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { RelatoriosService } from './relatorios.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('direcao', 'administrativo', 'ti')
@Controller('relatorios')
export class RelatoriosController {
  constructor(private readonly service: RelatoriosService) {}

  private parseDatas(inicio?: string, fim?: string): { inicio: Date; fim: Date } {
    const agora = new Date();
    const inicioDate = inicio ? new Date(inicio) : new Date(agora.getFullYear(), agora.getMonth(), 1);
    const fimDate = fim ? new Date(fim) : agora;
    return { inicio: inicioDate, fim: fimDate };
  }

  @Get('internamento')
  async internamento(@Query('inicio') inicio?: string, @Query('fim') fim?: string, @Res() res?: Response) {
    const datas = this.parseDatas(inicio, fim);
    const data = await this.service.internamento(datas.inicio, datas.fim);
    if (res?.req?.headers?.accept?.includes('text/csv')) {
      res.set('Content-Type', 'text/csv');
      res.set('Content-Disposition', 'attachment; filename="internamento.csv"');
      return res.send(this.service.toCSV(data.resumoPorServico));
    }
    return res ? res.json(data) : data;
  }

  @Get('ocupacao')
  async ocupacao(@Query('inicio') inicio?: string, @Query('fim') fim?: string, @Res() res?: Response) {
    const datas = this.parseDatas(inicio, fim);
    const data = await this.service.ocupacao(datas.inicio, datas.fim);
    if (res?.req?.headers?.accept?.includes('text/csv')) {
      res.set('Content-Type', 'text/csv');
      res.set('Content-Disposition', 'attachment; filename="ocupacao.csv"');
      return res.send(this.service.toCSV(data.estadoAtualCamas));
    }
    return res ? res.json(data) : data;
  }

  @Get('diagnosticos')
  async diagnosticos(@Query('inicio') inicio?: string, @Query('fim') fim?: string, @Res() res?: Response) {
    const datas = this.parseDatas(inicio, fim);
    const data = await this.service.diagnosticos(datas.inicio, datas.fim);
    if (res?.req?.headers?.accept?.includes('text/csv')) {
      res.set('Content-Type', 'text/csv');
      res.set('Content-Disposition', 'attachment; filename="diagnosticos.csv"');
      return res.send(this.service.toCSV(data.top20));
    }
    return res ? res.json(data) : data;
  }

  @Get('medicamentos')
  async medicamentos(@Query('inicio') inicio?: string, @Query('fim') fim?: string, @Res() res?: Response) {
    const datas = this.parseDatas(inicio, fim);
    const data = await this.service.medicamentos(datas.inicio, datas.fim);
    if (res?.req?.headers?.accept?.includes('text/csv')) {
      res.set('Content-Type', 'text/csv');
      res.set('Content-Disposition', 'attachment; filename="medicamentos.csv"');
      return res.send(this.service.toCSV(data.top20));
    }
    return res ? res.json(data) : data;
  }

  @Get('urgencia')
  async urgencia(@Query('inicio') inicio?: string, @Query('fim') fim?: string, @Res() res?: Response) {
    const datas = this.parseDatas(inicio, fim);
    const data = await this.service.urgencia(datas.inicio, datas.fim);
    if (res?.req?.headers?.accept?.includes('text/csv')) {
      res.set('Content-Type', 'text/csv');
      res.set('Content-Disposition', 'attachment; filename="urgencia.csv"');
      return res.send(this.service.toCSV(data.distribuicaoPorTriagem));
    }
    return res ? res.json(data) : data;
  }

  @Get('produtividade')
  async produtividade(@Query('inicio') inicio?: string, @Query('fim') fim?: string, @Res() res?: Response) {
    const datas = this.parseDatas(inicio, fim);
    const data = await this.service.produtividade(datas.inicio, datas.fim);
    if (res?.req?.headers?.accept?.includes('text/csv')) {
      res.set('Content-Type', 'text/csv');
      res.set('Content-Disposition', 'attachment; filename="produtividade.csv"');
      return res.send(this.service.toCSV(data.linhas));
    }
    return res ? res.json(data) : data;
  }
}
