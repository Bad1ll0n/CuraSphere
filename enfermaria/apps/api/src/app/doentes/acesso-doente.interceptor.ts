import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { DoenteService } from './doentes.service';

/**
 * Verificação de acesso ao doente aplicada a TODAS as rotas (S-01).
 *
 * O `assertAcessoDoente` é um bom controlo — papéis de supervisão passam, clínicos precisam
 * de atribuição ou de break-glass activo. O problema nunca foi a regra: foi estar aplicada
 * à mão, controlador a controlador. Estava em 26 de 44. Nos restantes, um auxiliar lia e
 * apagava os contactos de emergência de qualquer doente, e o mesmo em alergias, exames e
 * documentos. Este projecto já corrigiu este defeito três vezes, sempre caso a caso — e o
 * caso seguinte voltava a escapar.
 *
 * Por isso a verificação deixou de depender de alguém se lembrar dela. Qualquer rota que
 * receba `doenteId` no caminho ou na query passa por aqui.
 *
 * Porquê interceptor e não guard: na ordem de execução do Nest, um guard global corre ANTES
 * do `JwtAuthGuard` de cada controlador — ainda não haveria utilizador para verificar. Um
 * interceptor corre depois de todos os guards, com a identidade já resolvida, e continua a
 * poder recusar antes de o handler executar.
 *
 * Âmbito, e o que fica de fora de propósito:
 *  - Caminho e query: sim. É por aí que se lê um doente pelo identificador.
 *  - Corpo do pedido: não. Há 29 DTOs com `doenteId` e vários são fluxos em que a relação
 *    ainda não existe (auto-atribuição, admissão). Verificar o corpo às cegas partia-os.
 *  - A activação de break-glass NÃO é bloqueada: faz-se por `POST /break-glass` com o doente
 *    no corpo, e a entrada principal do doente usa `:id`. Nenhuma das duas passa aqui.
 */
@Injectable()
export class AcessoDoenteInterceptor implements NestInterceptor {
  constructor(private readonly doentes: DoenteService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest();
    const alvos = doentesReferidos(req);
    if (alvos.length === 0) return next.handle();

    const utilizador = req.user;

    // Sem identidade: rota pública ou autenticada por outro mecanismo (o quiosque coloca
    // `req.quiosque`, não `req.user`). A responsabilidade é do guard dessa rota — e o teste
    // estrutural garante que nenhum controlador existe sem guard ou declaração de público.
    if (!utilizador) return next.handle();

    // Sessão do portal do doente: só o próprio doente.
    if (utilizador.tipo === 'portal') {
      if (alvos.some((id) => id !== utilizador.doenteId)) {
        throw new ForbiddenException('Sem acesso aos dados de outro doente');
      }
      return next.handle();
    }

    // Tokens intermédios (MFA por configurar, password expirada) nunca têm razão para ler
    // um doente. O `JwtAuthGuard` já os filtra; isto é a segunda camada, e falha fechado.
    if (utilizador.tipoToken !== 'pessoal') {
      throw new ForbiddenException('Sessão incompleta — conclua a autenticação');
    }

    for (const doenteId of alvos) {
      await this.doentes.assertAcessoDoente(utilizador.sub, utilizador.role, doenteId);
    }

    return next.handle();
  }
}

/** Identificadores de doente no caminho e na query, sem repetições. */
function doentesReferidos(req: any): string[] {
  const valores: unknown[] = [req.params?.doenteId];
  const daQuery = req.query?.doenteId;
  // `?doenteId=a&doenteId=b` chega como array: verificam-se todos, não só o primeiro.
  if (Array.isArray(daQuery)) valores.push(...daQuery);
  else valores.push(daQuery);

  return [
    ...new Set(valores.filter((v): v is string => typeof v === 'string' && v.length > 0)),
  ];
}
