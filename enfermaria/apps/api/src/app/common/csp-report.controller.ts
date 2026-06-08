import { Controller, Post, Body, HttpCode, Ip, Logger } from '@nestjs/common';

@Controller('csp-report')
export class CspReportController {
  private readonly logger = new Logger('CSPReport');

  @Post()
  @HttpCode(204)
  handle(@Body() body: Record<string, unknown>, @Ip() ip: string) {
    const report = (body['csp-report'] ?? body) as Record<string, unknown>;
    this.logger.warn(
      `CSP Violation [${ip}] blocked-uri="${report['blocked-uri']}" document-uri="${report['document-uri']}" violated-directive="${report['violated-directive']}"`,
    );
  }
}
