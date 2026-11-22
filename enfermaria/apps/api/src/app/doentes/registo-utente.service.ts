import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { nifValido, nomeProvisorio, numeroSnsValido, telefoneValido, PREFIXO_PROVISORIO } from '@org/shared';
import { PrismaService } from '../prisma/prisma.service';
import { filtroNif, filtroPesquisaNome } from '../prisma/encryption.middleware';
import { chaveDiaClinico } from '../common/dia-clinico.helper';
import { gerarNumeroProcesso } from './numero-processo';
import type { RegistroRapidoDto } from './dto/registro-rapido.dto';

export interface PossivelDuplicado {
  id: string;
  nome: string;
  numeroProcesso: string;
  dataNascimento: Date | null;
  motivo: 'nif' | 'sns' | 'nome_e_data';
}

/**
 * UX-23 — registo administrativo de um utente (receção).
 *
 * Antes: NIF, nº SNS e telefone obrigatórios (o doente não identificado e o estrangeiro sem SNS
 * não se registavam; inventava-se "999999999"), NIF só com "9 dígitos", e nenhuma pesquisa de
 * utente existente — ficavam duplicados. Agora:
 *  - só o nome e a data de nascimento são obrigatórios; NIF (com dígito de controlo), SNS e
 *    telefone são validados quando vêm;
 *  - utente não identificado: identificação provisória "Desconhecido AAAA-MM-DD #N", sem mais
 *    nenhum dado obrigatório (a fusão com o processo verdadeiro faz-se depois);
 *  - antes de criar, a receção vê os possíveis duplicados (NIF, SNS, ou nome + data);
 *    NIF ou SNS iguais recusam a criação (é a mesma pessoa).
 */
@Injectable()
export class RegistoUtenteService {
  constructor(private readonly prisma: PrismaService) {}

  async possiveisDuplicados(q: { nome?: string; dataNascimento?: string; nif?: string; numeroSNS?: string }): Promise<PossivelDuplicado[]> {
    const sel = { id: true, nome: true, numeroProcesso: true, dataNascimento: true } as const;
    const achados = new Map<string, PossivelDuplicado>();
    const juntar = (lista: { id: string; nome: string; numeroProcesso: string; dataNascimento: Date | null }[], motivo: PossivelDuplicado['motivo']) =>
      lista.forEach((d) => { if (!achados.has(d.id)) achados.set(d.id, { ...d, motivo }); });

    if (q.nif && nifValido(q.nif)) {
      juntar(await this.prisma.doente.findMany({ where: { ativo: true, ficheiroPessoal: { is: filtroNif(q.nif) } }, select: sel, take: 5 }), 'nif');
    }
    if (q.numeroSNS && numeroSnsValido(q.numeroSNS)) {
      juntar(await this.prisma.doente.findMany({ where: { ativo: true, ficheiroPessoal: { is: { numeroSNS: q.numeroSNS.replace(/\s/g, '') } } }, select: sel, take: 5 }), 'sns');
    }
    const porNome = q.nome && q.nome.trim().length >= 3 ? filtroPesquisaNome(q.nome) : null;
    if (porNome && q.dataNascimento && /^\d{4}-\d{2}-\d{2}$/.test(q.dataNascimento)) {
      const dia = new Date(`${q.dataNascimento}T00:00:00.000Z`);
      juntar(await this.prisma.doente.findMany({
        where: { ativo: true, ...porNome, dataNascimento: { gte: dia, lt: new Date(dia.getTime() + 86_400_000) } },
        select: sel, take: 5,
      }), 'nome_e_data');
    }
    return [...achados.values()];
  }

  async registroRapido(dto: RegistroRapidoDto, criadoPorId: string) {
    const provisorio = dto.provisorio === true;
    if (!provisorio) {
      if (!dto.nome?.trim()) throw new BadRequestException('Nome é obrigatório');
      if (!dto.dataNascimento) throw new BadRequestException('Data de nascimento é obrigatória');
    }
    if (dto.nif && !nifValido(dto.nif)) throw new BadRequestException('NIF inválido — confirme os 9 dígitos (o último é de controlo)');
    if (dto.numeroSNS && !numeroSnsValido(dto.numeroSNS)) throw new BadRequestException('Número SNS inválido — deve ter 9 dígitos');
    if (dto.telefone && !telefoneValido(dto.telefone)) throw new BadRequestException('Telefone inválido — 9 dígitos, começa com 2, 3 ou 9');
    if (dto.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.email)) throw new BadRequestException('Email inválido');
    if (dto.tipoCobertura === 'seguro') {
      if (!dto.entidadeSeguradora?.trim()) throw new BadRequestException('Entidade seguradora obrigatória para seguro');
      if (!dto.numeroApolice?.trim()) throw new BadRequestException('Número de apólice obrigatório para seguro');
    }
    const numeroSNS = dto.numeroSNS?.replace(/\s/g, '') || undefined;

    return this.prisma.$transaction(async (tx) => {
      if (dto.nif) {
        const existente = await tx.ficheiroPessoalDoente.findFirst({ where: filtroNif(dto.nif), select: { doente: { select: { numeroProcesso: true } } } });
        if (existente) throw new ConflictException(`Já existe um utente com o NIF ${dto.nif} (processo ${existente.doente.numeroProcesso})`);
      }
      if (numeroSNS) {
        const existente = await tx.ficheiroPessoalDoente.findFirst({ where: { numeroSNS }, select: { doente: { select: { numeroProcesso: true } } } });
        if (existente) throw new ConflictException(`Já existe um utente com o número SNS ${numeroSNS} (processo ${existente.doente.numeroProcesso})`);
      }

      let nome = dto.nome?.trim() ?? '';
      if (provisorio) {
        // "Desconhecido 2026-11-05 #3": a ordem conta os provisórios já criados nesse dia.
        const dia = chaveDiaClinico(new Date());
        const inicio = new Date(`${dia}T00:00:00.000Z`);
        const hoje = await tx.doente.count({ where: { identificacaoProvisoria: true, dataAdmissao: { gte: inicio } } });
        nome = nomeProvisorio(dia, hoje + 1);
      }

      const numeroProcesso = await gerarNumeroProcesso(tx);
      // Internamento → pendente_cama (aguarda cama clínica); tudo o resto → ambulatorio
      const estadoRegisto = dto.tipoVisita === 'internamento' ? 'pendente_cama' : 'ambulatorio';
      const doente = await tx.doente.create({
        data: {
          nome,
          dataNascimento: dto.dataNascimento ? new Date(dto.dataNascimento) : null,
          numeroProcesso,
          estadoRegisto,
          tipoVisita: dto.tipoVisita ?? null,
          identificacaoProvisoria: provisorio,
          administrativoAdmissaoId: criadoPorId,
        },
      });

      const temDadosAdmin = dto.nif || numeroSNS || dto.telefone || dto.email
        || dto.morada || dto.codigoPostal || dto.localidade
        || dto.entidadeSeguradora || dto.numeroApolice;
      if (temDadosAdmin) {
        await tx.ficheiroPessoalDoente.create({
          data: {
            doenteId: doente.id,
            nif: dto.nif ?? null,
            numeroSNS: numeroSNS ?? null,
            telefone: dto.telefone ?? null,
            email: dto.email ?? null,
            tipoCobertura: dto.tipoCobertura ?? null,
            morada: dto.morada ?? null,
            codigoPostal: dto.codigoPostal ?? null,
            localidade: dto.localidade ?? null,
            entidadeSeguradora: dto.entidadeSeguradora ?? null,
            numeroApolice: dto.numeroApolice ?? null,
            atualizadoPorId: criadoPorId,
          },
        });
      }
      return doente;
    });
  }
}

export { PREFIXO_PROVISORIO };
