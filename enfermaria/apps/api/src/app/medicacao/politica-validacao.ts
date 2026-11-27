import { ConflictException } from '@nestjs/common';

/**
 * QA-15 — administração antes da validação farmacêutica.
 *
 * Antes, `registarAdministracao` não olhava para `estadoValidacao`: uma prescrição por validar
 * (e até uma REJEITADA pela farmácia) era administrada com 201. O circuito
 * "prescrição → validação → administração" ficava como sugestão.
 *
 * Agora é uma regra do hospital (`VALIDACAO_ANTES_DE_ADMINISTRAR`):
 *  - `bloquear`      → só se administra o que a farmácia aprovou;
 *  - `primeira_dose` → (omissão) por validar, só a 1.ª dose, como urgente e com justificação;
 *                      as seguintes esperam pela validação;
 *  - `avisar`        → administra-se, e a resposta leva o aviso (o MAR mostra "por validar").
 * Em qualquer modo, uma prescrição REJEITADA não se administra.
 *
 * A assinatura (TOTP) da prescrição não entra aqui: não é exigida a todas as prescrições e não
 * tem fluxo na interface — fica no aviso, para a enfermagem saber que falta.
 */
export type ModoValidacao = 'bloquear' | 'primeira_dose' | 'avisar';

export function modoValidacao(valor = process.env['VALIDACAO_ANTES_DE_ADMINISTRAR']): ModoValidacao {
  return valor === 'bloquear' || valor === 'avisar' ? valor : 'primeira_dose';
}

export interface EstadoPrescricao {
  estadoValidacao: string | null;
  assinadoEm: Date | null;
  /** Já há alguma toma registada desta prescrição? */
  jaAdministrada: boolean;
}

export interface ResultadoValidacao {
  /** Justificação a guardar no registo (administração por validar ao abrigo da 1.ª dose). */
  justificacaoNaoValidada: string | null;
  avisos: string[];
}

const MIN_JUSTIFICACAO = 10;

export function verificarValidacaoFarmaceutica(
  p: EstadoPrescricao,
  justificacao: string | undefined,
  modo: ModoValidacao = modoValidacao(),
): ResultadoValidacao {
  const avisos: string[] = [];
  if (!p.assinadoEm) avisos.push('Prescrição ainda não assinada pelo médico.');

  if (p.estadoValidacao === 'rejeitada') {
    throw new ConflictException('VALIDACAO: a farmácia rejeitou esta prescrição — não administrar. Contacte o prescritor.');
  }
  if (p.estadoValidacao === 'aprovada') return { justificacaoNaoValidada: null, avisos };

  // Por validar (null) ou à espera do médico.
  if (modo === 'avisar') {
    return { justificacaoNaoValidada: null, avisos: [...avisos, 'Prescrição ainda não validada pela farmácia.'] };
  }
  if (modo === 'bloquear') {
    throw new ConflictException('VALIDACAO: prescrição ainda não validada pela farmácia — aguarde a validação antes de administrar.');
  }
  if (p.jaAdministrada) {
    throw new ConflictException(
      'VALIDACAO: a 1.ª dose já foi dada sem validação; as seguintes esperam pela validação da farmácia.',
    );
  }
  const texto = (justificacao ?? '').trim();
  if (texto.length < MIN_JUSTIFICACAO) {
    throw new ConflictException(
      `VALIDACAO: prescrição ainda não validada pela farmácia. Só a 1.ª dose, se urgente — indique porquê (justificacaoNaoValidada, mínimo ${MIN_JUSTIFICACAO} caracteres).`,
    );
  }
  return { justificacaoNaoValidada: texto.slice(0, 500), avisos: [...avisos, 'Administrada antes da validação farmacêutica (1.ª dose urgente).'] };
}
