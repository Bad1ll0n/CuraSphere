import { Injectable, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { hashPassword, verifyPassword } from '../common/seguranca/password';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LeiturasMonitorService } from './leituras-monitor.service';
import { RegistarDispositivoDto } from './dto/registar-dispositivo.dto';
import { IngerirVitalDto } from './dto/ingerir-vital.dto';

@Injectable()
export class MonitorizacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leituras: LeiturasMonitorService,
  ) {}

  async registarDispositivo(dto: RegistarDispositivoDto) {
    const responsavel = await this.prisma.utilizador.findUnique({ where: { id: dto.responsavelId }, select: { id: true } });
    if (!responsavel) throw new BadRequestException('Utilizador responsável não encontrado');
    if (dto.doenteId) {
      const d = await this.prisma.doente.findUnique({ where: { id: dto.doenteId }, select: { id: true } });
      if (!d) throw new BadRequestException('Doente não encontrado');
    }
    if (dto.camaId) {
      const c = await this.prisma.cama.findUnique({ where: { id: dto.camaId }, select: { id: true } });
      if (!c) throw new BadRequestException('Cama não encontrada');
    }
    // Gera a chave uma única vez (o segredo só é devolvido agora; guardamos o hash).
    const secret = crypto.randomBytes(24).toString('hex');
    const apiKeyHash = await hashPassword(secret, 10);
    const disp = await this.prisma.dispositivoMonitor.create({
      data: { nome: dto.nome, localizacao: dto.localizacao, responsavelId: dto.responsavelId, doenteId: dto.doenteId, camaId: dto.camaId, apiKeyHash },
    });
    // A chave a enviar ao dispositivo é `<id>.<secret>` (o id serve de lookup; o secret é conferido por bcrypt).
    return { id: disp.id, nome: disp.nome, apiKey: `${disp.id}.${secret}`, aviso: 'Guarde a chave — não voltará a ser mostrada.' };
  }

  listarDispositivos() {
    return this.prisma.dispositivoMonitor.findMany({
      orderBy: { criadaEm: 'desc' },
      select: { id: true, nome: true, localizacao: true, responsavelId: true, doenteId: true, camaId: true, ativo: true, ultimaLeitura: true, criadaEm: true },
    });
  }

  async revogarDispositivo(id: string) {
    const d = await this.prisma.dispositivoMonitor.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Dispositivo não encontrado');
    return this.prisma.dispositivoMonitor.update({ where: { id }, data: { ativo: false } });
  }

  /** Valida a chave `<id>.<secret>` e devolve o dispositivo, ou lança 401. */
  private async autenticarDispositivo(apiKey?: string) {
    if (!apiKey || !apiKey.includes('.')) throw new UnauthorizedException('Chave de dispositivo em falta ou inválida');
    const [id, secret] = apiKey.split('.', 2);
    const disp = await this.prisma.dispositivoMonitor.findUnique({ where: { id } });
    if (!disp || !disp.ativo) throw new UnauthorizedException('Dispositivo não autorizado');
    const ok = await verifyPassword(secret, disp.apiKeyHash);
    if (!ok) throw new UnauthorizedException('Chave de dispositivo inválida');
    return disp;
  }

  /**
   * PROD-15: a leitura fica PENDENTE de validação de enfermagem (não entra logo no NEWS2) e o
   * doente vem do dispositivo — da cama a que está ligado —, nunca do payload.
   */
  async ingerir(apiKey: string | undefined, dto: IngerirVitalDto) {
    const disp = await this.autenticarDispositivo(apiKey);
    const doenteId = await this.leituras.doenteDoDispositivo(disp, dto.doenteId);
    const { doenteId: _omit, medidoEm, ...valores } = dto;
    const leitura = await this.leituras.receber({ dispositivoId: disp.id, canal: 'monitor', doenteId, valores, medidoEm });
    await this.prisma.dispositivoMonitor.update({ where: { id: disp.id }, data: { ultimaLeitura: new Date() } });
    return { ok: true, leituraId: leitura.id, estado: 'pendente_validacao', critica: leitura.critica };
  }
}
