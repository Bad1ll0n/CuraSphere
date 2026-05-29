import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';

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

    const errorCode = HTTP_CODE_MAP[status] ?? 'UNKNOWN_ERROR';

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: Record<string, unknown> = {
      statusCode: status,
      error: errorCode,
      message: Array.isArray(message) ? message[0] : message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    if (errors) body.errors = errors;

    response.status(status).json(body);
  }
}
