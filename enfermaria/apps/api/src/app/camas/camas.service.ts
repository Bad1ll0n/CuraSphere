import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { EstadoCama } from '../common/enums';

const KEY_LISTA = 'camas:lista';
const KEY_OCUPACAO = 'camas:ocupacao';
const CACHE_TTL = 30; // 30 segundos

@Injectable()
export class CamasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async listar() {
    const cached = await this.redis.get<unknown[]>(KEY_LISTA);
    if (cached) return cached;

    const result = await this.prisma.cama.findMany({
      include: { doente: { select: { id: true, nome: true, estado: true, diagnosticoPrincipal: true } } },
      orderBy: [{ quarto: 'asc' }, { numero: 'asc' }],
    });

    await this.redis.set(KEY_LISTA, result, CACHE_TTL);
    return result;
  }

  async criar(data: { numero: string; quarto: string }) {
    const existe = await this.prisma.cama.findUnique({ where: { numero: data.numero } });
    if (existe) throw new ConflictException('Número de cama já existe');

    const cama = await this.prisma.cama.create({ data });
    await this.redis.del(KEY_LISTA, KEY_OCUPACAO);
    return cama;
  }

  async atualizarEstado(id: string, estado: EstadoCama) {
    const cama = await this.prisma.cama.findUnique({ where: { id } });
    if (!cama) throw new NotFoundException(`Cama (ID ${id}) não encontrada`);

    const result = await this.prisma.cama.update({
      where: { id },
      data: { estado },
      include: { doente: { select: { id: true, nome: true } } },
    });
    await this.redis.del(KEY_LISTA, KEY_OCUPACAO);
    return result;
  }

  async confirmarLimpeza(id: string) {
    const cama = await this.prisma.cama.findUnique({ where: { id } });
    if (!cama) throw new NotFoundException(`Cama (ID ${id}) não encontrada`);
    if (cama.estado !== 'em_limpeza') throw new ConflictException('A cama não está em estado de limpeza');

    const result = await this.prisma.cama.update({
      where: { id },
      data: { estado: 'livre' },
      include: { doente: { select: { id: true, nome: true } } },
    });
    await this.redis.del(KEY_LISTA, KEY_OCUPACAO);
    return result;
  }

  async ocupacao() {
    const cached = await this.redis.get<Record<string, number>>(KEY_OCUPACAO);
    if (cached) return cached;

    const [total, ocupadas, livres, emLimpeza, reservadas] = await Promise.all([
      this.prisma.cama.count(),
      this.prisma.cama.count({ where: { estado: 'ocupada' } }),
      this.prisma.cama.count({ where: { estado: 'livre' } }),
      this.prisma.cama.count({ where: { estado: 'em_limpeza' } }),
      this.prisma.cama.count({ where: { estado: 'reservada' } }),
    ]);

    const result = { total, ocupadas, livres, emLimpeza, reservadas };
    await this.redis.set(KEY_OCUPACAO, result, CACHE_TTL);
    return result;
  }
}
