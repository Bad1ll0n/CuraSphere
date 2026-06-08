import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface Hl7Segment {
  id: string;
  fields: string[];
}

function parseHl7(raw: string): Hl7Segment[] {
  // Normalise line endings; MLLP uses \r, HTTP bodies may use \n or \r\n
  const lines = raw.replace(/\r\n/g, '\r').replace(/\n/g, '\r').split('\r').filter(Boolean);
  return lines.map((line) => {
    const parts = line.split('|');
    return { id: parts[0], fields: parts };
  });
}

function field(seg: Hl7Segment, index: number): string {
  return seg.fields[index] ?? '';
}

function component(value: string, index: number): string {
  return value.split('^')[index] ?? '';
}

@Injectable()
export class Hl7Service {
  private readonly logger = new Logger(Hl7Service.name);

  constructor(private readonly prisma: PrismaService) {}

  async receberMensagem(raw: string): Promise<{ processado: boolean; tipo: string; erro?: string }> {
    const segments = parseHl7(raw);
    const msh = segments.find((s) => s.id === 'MSH');

    if (!msh) {
      throw new BadRequestException('Mensagem HL7 inválida: MSH ausente');
    }

    // MSH.9 = message type (e.g. "ORU^R01")
    const tipo = field(msh, 9);
    const remetente = field(msh, 3);
    let processado = false;
    let erroMsg: string | undefined;

    try {
      const msgType = component(tipo, 0);
      const triggerEvent = component(tipo, 1);

      if (msgType === 'ORU' && triggerEvent === 'R01') {
        await this.processarORU(segments);
      } else if (msgType === 'ADT' && triggerEvent === 'A01') {
        await this.processarADT_A01(segments);
      } else if (msgType === 'ADT' && triggerEvent === 'A03') {
        await this.processarADT_A03(segments);
      } else {
        this.logger.warn(`Tipo HL7 não suportado: ${tipo}`);
      }
      processado = true;
    } catch (e: any) {
      erroMsg = e?.message ?? 'Erro desconhecido';
      this.logger.error(`Erro a processar HL7 ${tipo}: ${erroMsg}`);
    }

    await this.prisma.hl7Mensagem.create({
      data: { tipo, remetente: remetente || null, conteudoRaw: raw, processado, erroMsg },
    });

    return { processado, tipo, erro: erroMsg };
  }

  private async processarORU(segments: Hl7Segment[]) {
    const pid = segments.find((s) => s.id === 'PID');
    const obxList = segments.filter((s) => s.id === 'OBX');

    if (!pid) return;

    // PID.3 = patient identifier list (first component = ID)
    const pidId = component(field(pid, 3), 0);
    const doente = await this.prisma.doente.findFirst({ where: { numeroProcesso: pidId, ativo: true } });
    if (!doente) {
      this.logger.warn(`ORU^R01: doente não encontrado para PID ${pidId}`);
      return;
    }

    // Create lab exam records from OBX segments
    for (const obx of obxList) {
      const parametro = field(obx, 3);        // OBX.3 = observation identifier
      const valor = field(obx, 5);            // OBX.5 = observation value
      const unidade = field(obx, 6);          // OBX.6 = units
      const referencia = field(obx, 7);       // OBX.7 = reference range
      const estado = field(obx, 8);           // OBX.8 = abnormal flags (H/L/N)
      const nome = component(parametro, 1) || component(parametro, 0);

      const valorNum = parseFloat(valor.replace(',', '.'));
      if (isNaN(valorNum)) continue;

      const alterado = estado === 'H' || estado === 'L' || estado === 'A';
      const critico = estado === 'HH' || estado === 'LL' || estado === 'AA';

      await this.prisma.resultadoAnalise.create({
        data: {
          doenteId: doente.id,
          parametro: nome || parametro,
          valor: valorNum,
          unidade: unidade || '—',
          alterado,
          critico,
          observacoes: referencia ? `Ref: ${referencia}` : null,
        },
      }).catch((e) => this.logger.warn(`Falha ao criar ResultadoAnalise: ${e.message}`));
    }
  }

  private async processarADT_A01(segments: Hl7Segment[]) {
    const pid = segments.find((s) => s.id === 'PID');
    if (!pid) return;

    const pidId = component(field(pid, 3), 0);
    const doente = await this.prisma.doente.findFirst({ where: { numeroProcesso: pidId } });

    if (doente) {
      this.logger.log(`ADT^A01: doente ${pidId} já existe (${doente.id})`);
    } else {
      this.logger.log(`ADT^A01: doente ${pidId} não encontrado no sistema — admissão via HIS registada`);
    }
  }

  private async processarADT_A03(segments: Hl7Segment[]) {
    const pid = segments.find((s) => s.id === 'PID');
    if (!pid) return;

    const pidId = component(field(pid, 3), 0);
    const doente = await this.prisma.doente.findFirst({ where: { numeroProcesso: pidId, ativo: true } });

    if (!doente) {
      this.logger.warn(`ADT^A03: doente ${pidId} não encontrado`);
      return;
    }

    this.logger.log(`ADT^A03: alta registada via HL7 para doente ${doente.id}`);
  }

  async listarMensagens(skip = 0, take = 50) {
    return this.prisma.hl7Mensagem.findMany({
      orderBy: { criadoEm: 'desc' },
      skip,
      take,
      select: { id: true, tipo: true, remetente: true, processado: true, erroMsg: true, criadoEm: true },
    });
  }
}
