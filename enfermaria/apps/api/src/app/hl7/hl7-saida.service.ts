import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { construirAdt } from './hl7-mensagem';

/**
 * PROD-14 — ADT de saída para o HIS: admissão (A01) e alta (A03) feitas no CuraSphere.
 *
 * Disparado pelos mesmos eventos de domínio dos webhooks (`doente.admitido`, `doente.alta`).
 * Cada mensagem fica numa fila de saída (direção 'saida'). O motor de integração do hospital
 * (Mirth, Rhapsody, o próprio HIS) recolhe-a por pull — `GET /hl7/saida`, com o token HL7 — e
 * confirma a entrega. Assim o CuraSphere não abre ligações para a rede interna: é o motor de
 * integração, configurado pelo hospital, que liga ao CuraSphere.
 */
@Injectable()
export class Hl7SaidaService {
  constructor(private readonly prisma: PrismaService) {}

  async enfileirar(evento: 'A01' | 'A03', doenteId: string): Promise<void> {
    const d = await this.prisma.doente.findUnique({
      where: { id: doenteId },
      select: {
        nome: true, numeroProcesso: true, identificadorHis: true, dataNascimento: true, sexo: true, dataAlta: true,
        cama: { select: { numero: true, quarto: true, servico: true } },
        ficheiroPessoal: { select: { numeroSNS: true } },
      },
    });
    if (!d) return;
    const controlo = randomUUID().replace(/-/g, '').slice(0, 20);
    const raw = construirAdt(evento, {
      controlo, identificadorHis: d.identificadorHis, numeroProcesso: d.numeroProcesso, numeroSNS: d.ficheiroPessoal?.numeroSNS ?? null,
      nome: d.nome, dataNascimento: d.dataNascimento, sexo: d.sexo,
      servico: d.cama?.servico, quarto: d.cama?.quarto, cama: d.cama?.numero, quando: evento === 'A03' ? d.dataAlta ?? undefined : undefined,
    });

    // Fica na fila de saída; o motor de integração do hospital recolhe-a (GET /hl7/saida) e
    // confirma a entrega (POST /hl7/saida/:id/entregue).
    await this.prisma.hl7Mensagem.create({
      data: { tipo: `ADT^${evento}`, remetente: 'CURASPHERE', conteudoRaw: raw, direcao: 'saida', doenteId, processado: false, efeito: 'na fila de saída' },
    });
  }
}

/** Fila de saída: as mensagens por entregar, mais antigas primeiro, e a confirmação de entrega. */
export async function filaSaida(prisma: PrismaService, limite = 50) {
  return prisma.hl7Mensagem.findMany({
    where: { direcao: 'saida', processado: false },
    orderBy: { criadoEm: 'asc' },
    take: Math.min(Math.max(limite, 1), 200),
    select: { id: true, tipo: true, conteudoRaw: true, criadoEm: true },
  });
}

export async function confirmarEntrega(prisma: PrismaService, id: string, erro?: string) {
  const r = await prisma.hl7Mensagem.updateMany({
    where: { id, direcao: 'saida', processado: false },
    data: erro ? { erroMsg: erro.slice(0, 500), efeito: 'entrega falhou (motor de integração)' } : { processado: true, erroMsg: null, efeito: 'entregue ao HIS' },
  });
  return { atualizada: r.count === 1 };
}
