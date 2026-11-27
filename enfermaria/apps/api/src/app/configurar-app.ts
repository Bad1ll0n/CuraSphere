import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as helmet from 'helmet';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import { json, urlencoded, text } from 'express';
import { AllExceptionsFilter } from './common/exception.filter';

/**
 * QA-20 — a configuração HTTP da aplicação num só sítio: segurança (helmet, CORS, trust proxy),
 * parsers, filtro de excepções, validação e versionamento. O `main.ts` usa-a para arrancar e os
 * testes de integração usam a MESMA, para testarem a app como ela corre — e não uma aproximação
 * montada à mão, que deixaria passar exactamente as diferenças que interessam.
 */
export function configurarApp(app: NestExpressApplication): void {
  // Esconder fingerprint Express
  app.disable('x-powered-by');
  // SEC-08/PERF-02: sem isto, atrás do nginx o `req.ip` é o IP do nginx para TODOS — os
  // limites de login/MFA eram um único balde para o hospital e a auditoria não tinha o IP
  // real. Confia-se só em proxies de redes privadas (o nginx na rede Docker); o nginx
  // reescreve o X-Forwarded-For com o $remote_addr, por isso o cliente não o falsifica.
  app.set('trust proxy', process.env['TRUST_PROXY'] ?? 'loopback, linklocal, uniquelocal');

  // Graceful shutdown: garante que SIGTERM/SIGINT (ex.: `docker stop` durante um deploy)
  // drena pedidos em curso e chama onModuleDestroy/beforeApplicationShutdown (Prisma, Redis)
  // antes do processo terminar, em vez de derrubar ligações a meio.
  app.enableShutdownHooks();

  // S-02: os anexos clínicos DEIXARAM de ser servidos como ficheiros estáticos.
  //
  // `useStaticAssets` entrega fora do pipeline do Nest — logo fora dos guards, fora do
  // interceptor de auditoria e fora do limitador de tentativas. Qualquer pessoa com o URL
  // descarregava o anexo de um doente, e nada ficava registado sobre quem o leu. Passaram
  // a ser servidos pelo `FicheirosController`, que verifica o acesso contra a mensagem a
  // que o anexo pertence.

  app.use((compression as any).default());
  app.use((helmet as any).default({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        reportUri: [`${process.env['API_URL'] ?? 'http://localhost:3333'}/csp-report`],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
    permissionsPolicy: {
      policy: {
        camera: [],
        microphone: ['self'],
        geolocation: [],
        payment: [],
        'display-capture': ['self'],
      },
    },
  }));
  app.use((cookieParser as any).default());
  // Os browsers enviam os relatórios de CSP como `application/csp-report` (report-uri) ou
  // `application/reports+json` (Reporting API). O parser por omissão só aceita
  // `application/json`, e o `CspReportController` recebia sempre um corpo vazio.
  app.use(json({ limit: '500kb', type: ['application/json', 'application/csp-report', 'application/reports+json'] }));
  app.use(urlencoded({ limit: '500kb', extended: true }));
  // Raw text for HL7 v2 messages (MLLP transport over HTTP)
  app.use('/v1/hl7/receive', text({ type: ['text/plain', 'application/hl7-v2'], limit: '100kb' }));

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  const origensPermitidas = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : null;

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      if (origensPermitidas) {
        return origensPermitidas.includes(origin) ? callback(null, true) : callback(new Error('Not allowed by CORS'));
      }
      // sem ALLOWED_ORIGINS definido: permite apenas localhost (dev)
      if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Correlation-ID', 'X-CSRF-Token', 'X-Break-Glass-Reason'],
    exposedHeaders: ['X-Correlation-ID'],
  });

}
