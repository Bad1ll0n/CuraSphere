import * as Sentry from '@sentry/node';
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';

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
    const errorCode = HTTP_CODE_MAP[status] ?? 'UNKNOWN_ERROR';

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
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

    response.status(status).json(body);
  }
}
