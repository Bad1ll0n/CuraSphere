import * as Sentry from '@sentry/node';
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { sanitizarUrlParaLog } from './sanitizar-url-log';
import { eConflitoDeSerializacao } from './transacao';

const HTTP_CODE_MAP: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_SERVER_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    // QA-09: um conflito de serialização que esgotou as retentativas (comRetentativas) não é um erro
    // interno — outra pessoa registou ao mesmo tempo. Com 500, o enfermeiro repetia o pedido e
    // agravava a duplicação; com 409, a UI pede para actualizar e ver o que ficou registado.
    if (eConflitoDeSerializacao(exception)) {
      this.logger.warn(`${request.method} ${sanitizarUrlParaLog(request.url)} → 409 (conflito de serialização esgotado)`);
      return response.status(409).json({
        statusCode: 409,
        error: 'CONFLICT',
        errorCode: 'REGISTO_CONCORRENTE',
        message: 'Registo em curso por outro utilizador — actualize e confirme antes de repetir',
        timestamp: new Date().toISOString(),
      });
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        const campo = (exception.meta?.target as string[])?.[0] ?? 'campo';
        return response.status(409).json({
          statusCode: 409,
          error: 'CONFLICT',
          message: `${campo} já existe`,
          timestamp: new Date().toISOString(),
        });
      }
      if (exception.code === 'P2025') {
        return response.status(404).json({
          statusCode: 404,
          error: 'NOT_FOUND',
          message: 'Registo não encontrado',
          timestamp: new Date().toISOString(),
        });
      }
      // Other Prisma errors → 500
      this.logger.error(`Prisma error ${exception.code}`, exception.message);
      return response.status(500).json({
        statusCode: 500,
        error: 'DATABASE_ERROR',
        message: 'Erro de base de dados',
        timestamp: new Date().toISOString(),
      });
    }

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawMessage = exception instanceof HttpException
      ? exception.getResponse()
      : 'Erro interno do servidor';

    const message = typeof rawMessage === 'object'
      ? (rawMessage as any).message ?? rawMessage
      : rawMessage;

    const errors = typeof rawMessage === 'object' && Array.isArray((rawMessage as any).message)
      ? (rawMessage as any).message
      : undefined;

    const customErrorCode = typeof rawMessage === 'object' ? (rawMessage as any).errorCode : undefined;
    // Dados que o cliente precisa para resolver o erro (ex.: o id do doente a reinternar).
    const contexto = typeof rawMessage === 'object' && (rawMessage as any).contexto && typeof (rawMessage as any).contexto === 'object'
      ? (rawMessage as any).contexto : undefined;
    const errorCode = HTTP_CODE_MAP[status] ?? 'UNKNOWN_ERROR';

    if (status >= 500) {
      this.logger.error(
        // O URL pode trazer o token da família ou um NIF: ver sanitizarUrlParaLog.
        `${request.method} ${sanitizarUrlParaLog(request.url)} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      // Reportar erros 5xx ao Sentry (não reportar 4xx que são input do utilizador)
      if (!(exception instanceof HttpException)) {
        Sentry.captureException(exception);
      }
    }

    const body: Record<string, unknown> = {
      statusCode: status,
      error: errorCode,
      message: Array.isArray(message) ? message[0] : message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    if (errors) body.errors = errors;
    if (customErrorCode) body.errorCode = customErrorCode;
    if (contexto && status < 500) body.contexto = contexto;

    response.status(status).json(body);
  }
}
