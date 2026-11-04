import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from '../alertas/alertas.service';
import { ganhoInterdialitico, ufObjetivoMl, ganhoExcessivo } from '../common/dialise.helper';
import { RegistarSessaoDto } from './dto/registar-sessao.dto';

@Injectable()
export class DialiseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alertas: AlertasService,
  ) {}

  /** Regista uma sessão de diálise, calcula ganho interdialítico e alerta se excessivo. */
  async registarSessao(doenteId: string, dto: RegistarSessaoDto, registadoPorId: string) {
    const sessao = await this.prisma.sessaoDialise.create({
      data: {
        doenteId,
        modalidade: dto.modalidade,
        data: dto.data ? new Date(dto.data) : new Date(),
        duracaoMin: dto.duracaoMin ?? null,
        pesoSecoKg: dto.pesoSecoKg ?? null,
        pesoPreKg: dto.pesoPreKg ?? null,
        pesoPosKg: dto.pesoPosKg ?? null,
        ultrafiltracaoMl: dto.ultrafiltracaoMl ?? null,
        fluxoSangueMlMin: dto.fluxoSangueMlMin ?? null,
        acessoVascular: dto.acessoVascular ?? null,
        paSistolicaPre: dto.paSistolicaPre ?? null,
        paSistolicaPos: dto.paSistolicaPos ?? null,
        complicacoes: dto.complicacoes ?? null,
        notas: dto.notas ?? null,
        registadoPorId,
      },
    });

    // Ganho interdialítico face à sessão anterior (peso pós registado).
    let ganho: number | null = null;
    if (dto.pesoPreKg != null) {
      const anterior = await this.prisma.sessaoDialise.findFirst({
        where: { doenteId, data: { lt: sessao.data }, pesoPosKg: { not: null } },
        orderBy: { data: 'desc' },
        select: { pesoPosKg: true },
      });
      if (anterior?.pesoPosKg != null) {
        ganho = ganhoInterdialitico(dto.pesoPreKg, anterior.pesoPosKg);
        if (ganhoExcessivo(ganho, dto.pesoSecoKg)) {
          await this.alertas.criarAlerta(
            doenteId,
            'dialise',
            `Ganho interdialítico ${ganho} kg — excessivo. Rever restrição hídrica / peso seco.`,
          );
        }
      }
    }

    const ufObjetivo = dto.pesoPreKg != null && dto.pesoSecoKg != null ? ufObjetivoMl(dto.pesoPreKg, dto.pesoSecoKg) : null;
    return { ...sessao, ganhoInterdialitico: ganho, ufObjetivoMl: ufObjetivo };
  }

  /** Sessões do doente (mais recente primeiro) com ganho interdialítico e UF objetivo. */
  async listarSessoes(doenteId: string) {
    const sessoes = await this.prisma.sessaoDialise.findMany({
      where: { doenteId },
      orderBy: { data: 'asc' },
      take: 50,
    });
    let posAnterior: number | null = null;
    const comMetricas = sessoes.map((s) => {
      const ganho = s.pesoPreKg != null && posAnterior != null ? ganhoInterdialitico(s.pesoPreKg, posAnterior) : null;
      const uf = s.pesoPreKg != null && s.pesoSecoKg != null ? ufObjetivoMl(s.pesoPreKg, s.pesoSecoKg) : null;
      if (s.pesoPosKg != null) posAnterior = s.pesoPosKg;
      return { ...s, ganhoInterdialitico: ganho, ufObjetivoMl: uf };
    });
    return comMetricas.reverse();
  }
}
