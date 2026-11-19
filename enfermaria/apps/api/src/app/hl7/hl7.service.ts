import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from '../alertas/alertas.service';
import { campo, componente, construirAck, lerMensagem, lerPid, lerPv1, type IdentificacaoPid, type Segmento } from './hl7-mensagem';

export interface ResultadoHl7 { processado: boolean; tipo: string; efeito?: string; erro?: string; doenteId?: string; ack: string }

/** Os eventos ADT que têm efeito no CuraSphere. Os restantes são recusados (AR), não ignorados em silêncio. */
const ADT_SUPORTADOS = ['A01', 'A02', 'A03', 'A04', 'A08'];

/**
 * PROD-14 — receção de mensagens HL7 v2 do HIS (ADT) e dos laboratórios (ORU).
 *
 * Antes, A01 e A03 só escreviam no log, e o emparelhamento era pelo numeroProcesso — que o
 * CuraSphere gera no seu formato e nunca coincide com o do HIS. Agora:
 *  - o doente é emparelhado pelo identificador do HIS (PID-3 tipo PI/MR), depois pelo número de
 *    utente SNS, e só por último pelo numeroProcesso do CuraSphere;
 *  - A01/A04 cria o doente (pendente de cama) ou atualiza a identificação; A08 atualiza;
 *  - A02 atualiza o serviço do episódio e avisa a equipa para confirmar a cama;
 *  - A03 concilia: se o CuraSphere ainda tem o doente internado, avisa a equipa — a alta
 *    clínica estruturada (reconciliação, sumário, nota de enfermagem) não se faz por mensagem;
 *  - todas as mensagens ficam registadas com o efeito, e cada uma tem ACK (AA/AE/AR).
 */
@Injectable()
export class Hl7Service {
  private readonly logger = new Logger(Hl7Service.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertas: AlertasService,
  ) {}

  async receberMensagem(raw: string): Promise<ResultadoHl7> {
    const segmentos = lerMensagem(raw);
    const msh = segmentos.find((s) => s.id === 'MSH');
    if (!msh) throw new BadRequestException('Mensagem HL7 inválida: MSH ausente');

    const tipo = campo(msh, 9).split('^').slice(0, 2).join('^');
    const [msgType, evento] = tipo.split('^');
    const remetente = componente(campo(msh, 3), 0);
    let r: { efeito: string; doenteId?: string } | null = null;
    let erro: string | undefined;
    let codigo: 'AA' | 'AE' | 'AR' = 'AA';

    try {
      if (msgType === 'ORU' && evento === 'R01') r = await this.processarOru(segmentos);
      else if (msgType === 'ADT' && ADT_SUPORTADOS.includes(evento)) r = await this.processarAdt(evento, segmentos);
      else { codigo = 'AR'; erro = `Tipo HL7 não suportado: ${tipo || '(vazio)'}`; }
    } catch (e: any) {
      codigo = 'AE';
      erro = e?.message ?? 'Erro desconhecido';
      this.logger.error(`Erro a processar HL7 ${tipo}: ${erro}`);
    }

    await this.prisma.hl7Mensagem.create({
      data: { tipo, remetente: remetente || null, conteudoRaw: raw, processado: codigo === 'AA', erroMsg: erro, efeito: r?.efeito ?? null, doenteId: r?.doenteId ?? null, direcao: 'entrada' },
    });
    return { processado: codigo === 'AA', tipo, efeito: r?.efeito, erro, doenteId: r?.doenteId, ack: construirAck(segmentos, codigo, erro ?? r?.efeito ?? '') };
  }

  /** Emparelhamento: identificador do HIS → número de utente SNS → numeroProcesso do CuraSphere. */
  private async encontrarDoente(id: IdentificacaoPid) {
    const sel = { id: true, nome: true, identificadorHis: true, estadoRegisto: true, ativo: true } as const;
    if (id.identificadorHis) {
      const d = await this.prisma.doente.findUnique({ where: { identificadorHis: id.identificadorHis }, select: sel });
      if (d) return d;
    }
    if (id.numeroSNS) {
      const f = await this.prisma.ficheiroPessoalDoente.findFirst({ where: { numeroSNS: id.numeroSNS }, select: { doente: { select: sel } } });
      if (f?.doente) return f.doente;
    }
    if (id.identificadorHis) {
      // Doentes migrados antes de haver identificador do HIS, com o número do HIS como processo.
      return this.prisma.doente.findFirst({ where: { numeroProcesso: id.identificadorHis, identificadorHis: null }, select: sel });
    }
    return null;
  }

  private dadosIdentificacao(id: IdentificacaoPid) {
    return {
      ...(id.nome ? { nome: id.nome } : {}),
      ...(id.dataNascimento ? { dataNascimento: id.dataNascimento } : {}),
      ...(id.sexo ? { sexo: id.sexo } : {}),
      ...(id.identificadorHis ? { identificadorHis: id.identificadorHis } : {}),
    };
  }

  private async processarAdt(evento: string, segmentos: Segmento[]) {
    const id = lerPid(segmentos.find((s) => s.id === 'PID'));
    if (!id.identificadorHis && !id.numeroSNS) throw new Error('PID-3 sem identificador do HIS nem número de utente');
    const pv1 = lerPv1(segmentos.find((s) => s.id === 'PV1'));
    const doente = await this.encontrarDoente(id);

    if (evento === 'A01' || evento === 'A04') {
      if (doente) {
        await this.prisma.doente.update({ where: { id: doente.id }, data: this.dadosIdentificacao(id) });
        await this.guardarSns(doente.id, id.numeroSNS);
        return { efeito: 'identificação atualizada a partir do HIS', doenteId: doente.id };
      }
      if (!id.nome) throw new Error('A01 sem nome (PID-5) — não é possível registar o doente');
      const novo = await this.prisma.$transaction(async (tx) => {
        const ano = new Date().getFullYear();
        const ultimo = await tx.doente.findFirst({ where: { numeroProcesso: { startsWith: `${ano}-` } }, orderBy: { numeroProcesso: 'desc' }, select: { numeroProcesso: true } });
        const n = ultimo ? parseInt(ultimo.numeroProcesso.split('-')[1], 10) + 1 : 1;
        return tx.doente.create({
          data: { ...this.dadosIdentificacao(id), nome: id.nome!, numeroProcesso: `${ano}-${String(n).padStart(8, '0')}`, estadoRegisto: 'pendente_cama' },
          select: { id: true },
        });
      }, { isolationLevel: 'Serializable' });
      await this.guardarSns(novo.id, id.numeroSNS);
      return { efeito: `doente registado a partir do HIS — pendente de cama${pv1.servico ? ` (${pv1.servico})` : ''}`, doenteId: novo.id };
    }

    if (!doente) throw new Error(`Doente não encontrado (HIS ${id.identificadorHis ?? '—'}, SNS ${id.numeroSNS ? 'indicado' : '—'})`);

    if (evento === 'A08') {
      await this.prisma.doente.update({ where: { id: doente.id }, data: this.dadosIdentificacao(id) });
      await this.guardarSns(doente.id, id.numeroSNS);
      return { efeito: 'identificação atualizada a partir do HIS', doenteId: doente.id };
    }

    const episodio = await this.prisma.episodioInternamento.findFirst({ where: { doenteId: doente.id, estado: 'ativo' }, orderBy: { numero: 'desc' }, select: { id: true, servico: true } });

    if (evento === 'A02') {
      if (!episodio) throw new Error('A02: o doente não tem internamento em curso no CuraSphere');
      if (pv1.servico && pv1.servico !== episodio.servico) {
        await this.prisma.episodioInternamento.update({ where: { id: episodio.id }, data: { servico: pv1.servico } });
      }
      const destino = [pv1.servico, pv1.quarto, pv1.cama].filter(Boolean).join(' / ') || 'localização não indicada';
      await this.alertas.criarAlerta(doente.id, 'adt_transferencia', `Transferência registada no HIS para ${destino}. Confirmar a cama no CuraSphere (gestão de camas).`, 2);
      return { efeito: `transferência no HIS para ${destino} — serviço do episódio atualizado, cama a confirmar`, doenteId: doente.id };
    }

    // A03 — alta administrativa no HIS.
    if (!episodio || doente.estadoRegisto !== 'internado') {
      return { efeito: 'alta já registada no CuraSphere — conciliada', doenteId: doente.id };
    }
    await this.alertas.criarAlerta(doente.id, 'adt_alta_sem_alta_clinica',
      'O HIS registou a alta administrativa, mas no CuraSphere o doente continua internado. Fazer a alta estruturada (reconciliação, sumário e nota de enfermagem) ou corrigir no HIS.', 3);
    return { efeito: 'alta no HIS sem alta no CuraSphere — equipa avisada', doenteId: doente.id };
  }

  private async guardarSns(doenteId: string, numeroSNS: string | null) {
    if (!numeroSNS) return;
    await this.prisma.ficheiroPessoalDoente.upsert({ where: { doenteId }, create: { doenteId, numeroSNS }, update: { numeroSNS } });
  }

  private async processarOru(segmentos: Segmento[]) {
    const id = lerPid(segmentos.find((s) => s.id === 'PID'));
    const doente = await this.encontrarDoente(id);
    if (!doente || !doente.ativo) throw new Error(`ORU^R01: doente não encontrado (HIS ${id.identificadorHis ?? '—'})`);

    let criados = 0;
    for (const obx of segmentos.filter((s) => s.id === 'OBX')) {
      const parametro = campo(obx, 3);
      const valorNum = parseFloat(campo(obx, 5).replace(',', '.'));
      if (isNaN(valorNum)) continue;
      const estado = campo(obx, 8);
      const referencia = campo(obx, 7);
      await this.prisma.resultadoAnalise.create({
        data: {
          doenteId: doente.id,
          parametro: componente(parametro, 1) || componente(parametro, 0) || parametro,
          valor: valorNum,
          unidade: campo(obx, 6) || '—',
          alterado: ['H', 'L', 'A'].includes(estado),
          critico: ['HH', 'LL', 'AA'].includes(estado),
          observacoes: referencia ? `Ref: ${referencia}` : null,
        },
      });
      criados++;
    }
    return { efeito: `${criados} resultado(s) de análise registado(s)`, doenteId: doente.id };
  }

  async listarMensagens(skip = 0, take = 50) {
    return this.prisma.hl7Mensagem.findMany({
      orderBy: { criadoEm: 'desc' },
      skip,
      take,
      select: { id: true, tipo: true, remetente: true, direcao: true, processado: true, efeito: true, erroMsg: true, doenteId: true, criadoEm: true },
    });
  }
}
