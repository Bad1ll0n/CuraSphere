import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AI_MODELS } from '../common/ai-models';
import { OrientarDto } from './dto/orientar.dto';

const DISCLAIMER =
  'Esta orientação é informativa e NÃO substitui uma avaliação médica. Em caso de dúvida ou agravamento, contacte o SNS 24 (808 24 24 24) ou dirija-se a um serviço de urgência. Perante sinais de emergência (dor no peito, dificuldade em respirar, perda de consciência), ligue 112.';

const SYSTEM = `És um assistente de ORIENTAÇÃO de cuidados para doentes (não és médico e NÃO diagnosticas).
A tua função é orientar a pessoa sobre o nível de cuidado adequado, com prudência e segurança.
Regras:
- NUNCA dês um diagnóstico nem nomeies uma doença específica.
- Na dúvida, encaminha para um nível de cuidado MAIS elevado (segurança primeiro).
- Perante sinais de alarme (dor torácica, dispneia, alteração do estado de consciência, hemorragia, défice neurológico súbito), recomenda urgência/112.
Responde APENAS com JSON no formato:
{"nivelUrgencia":"auto_cuidado|marcar_consulta|urgencia|emergencia","titulo":"...","recomendacao":"2-4 frases","sinaisAlarme":["..."]}`;

@Injectable()
export class TriagemPortalService {
  private readonly logger = new Logger(TriagemPortalService.name);
  private readonly client = new Anthropic();

  async orientar(dto: OrientarDto) {
    const contexto = [
      dto.idade ? `Idade: ${dto.idade}` : '',
      dto.duracaoDias ? `Duração: ${dto.duracaoDias} dia(s)` : '',
      `Sintomas: ${dto.sintomas}`,
    ].filter(Boolean).join('\n');

    try {
      const msg = await this.client.messages.create({
        model: AI_MODELS.CLINICAL,
        max_tokens: 400,
        temperature: 0.2 as any,
        system: SYSTEM,
        messages: [{ role: 'user', content: contexto }],
      });
      const texto = (msg.content?.[0] as any)?.text ?? '';
      const json = JSON.parse(texto.slice(texto.indexOf('{'), texto.lastIndexOf('}') + 1));
      return {
        nivelUrgencia: json.nivelUrgencia ?? 'marcar_consulta',
        titulo: json.titulo ?? 'Recomendação de cuidados',
        recomendacao: json.recomendacao ?? '',
        sinaisAlarme: Array.isArray(json.sinaisAlarme) ? json.sinaisAlarme : [],
        disclaimer: DISCLAIMER,
      };
    } catch (e: any) {
      this.logger.warn('Symptom checker indisponível — fallback seguro', e?.message ?? String(e));
      // Fallback conservador quando a IA não está disponível (ex.: sem ANTHROPIC_API_KEY).
      return {
        nivelUrgencia: 'marcar_consulta',
        titulo: 'Aconselhamento de cuidados',
        recomendacao: 'Não foi possível analisar os sintomas automaticamente neste momento. Recomendamos que contacte o SNS 24 (808 24 24 24) ou marque uma consulta para avaliação.',
        sinaisAlarme: ['Dor no peito', 'Dificuldade em respirar', 'Perda de consciência', 'Hemorragia que não pára'],
        disclaimer: DISCLAIMER,
        indisponivel: true,
      };
    }
  }
}
