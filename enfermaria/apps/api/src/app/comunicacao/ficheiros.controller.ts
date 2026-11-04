import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { join } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

/** Só nomes que o próprio servidor gera. Fecha travessia de caminho e nomes com barras. */
const NOME_SEGURO = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/;

/**
 * Entrega de anexos clínicos (S-02).
 *
 * Antes, a pasta `uploads/` era servida por `app.useStaticAssets()` — **fora do pipeline
 * do Nest**. Isso significa fora dos guards, fora do interceptor de auditoria e fora do
 * limitador de tentativas: qualquer pessoa com o URL descarregava o anexo, e nada ficava
 * registado sobre quem o leu. Num sistema onde o registo de acessos a dados clínicos é
 * requisito legal, a leitura invisível é tão grave como a leitura indevida.
 *
 * O único segredo era o nome do ficheiro, gerado com `Math.random()` — que em V8 é um
 * gerador não criptográfico cujo estado interno se reconstrói a partir de alguns valores
 * observados. Quem recebesse dois ou três anexos legítimos conseguia prever os seguintes.
 *
 * Aqui o ficheiro passa pelo guard, o acesso é verificado contra a mensagem a que
 * pertence, e o pedido entra no trilho de auditoria como qualquer outro.
 */
@Controller('ficheiros')
@UseGuards(JwtAuthGuard)
export class FicheirosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('mensagens/:ficheiro')
  async anexoDeMensagem(
    @Param('ficheiro') ficheiro: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    if (!NOME_SEGURO.test(ficheiro)) {
      throw new BadRequestException('Nome de ficheiro inválido');
    }

    // O anexo é localizado pelo registo, nunca pelo sistema de ficheiros: um ficheiro que
    // não tenha linha na base de dados não é servido, mesmo que exista em disco.
    const anexo = await this.prisma.anexoMensagem.findFirst({
      where: { url: { endsWith: `/${ficheiro}` } },
      include: { mensagem: { select: { remetenteId: true, destinatarioId: true } } },
    });
    if (!anexo) throw new NotFoundException('Anexo não encontrado');

    const utilizador = req.user?.sub;
    const participa =
      anexo.mensagem.remetenteId === utilizador || anexo.mensagem.destinatarioId === utilizador;
    if (!participa) {
      throw new ForbiddenException('Sem acesso a este anexo');
    }

    const caminho = join(UPLOAD_DIR, 'mensagens', ficheiro);
    try {
      await stat(caminho);
    } catch {
      // A linha existe e o ficheiro não: sinal de que o volume não sobreviveu a um deploy.
      throw new NotFoundException('Ficheiro indisponível');
    }

    // Sempre como transferência, nunca inline: fecha XSS por SVG ou HTML embutido.
    res.setHeader('Content-Type', anexo.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(anexo.nome)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Cache-Control', 'private, no-store');

    createReadStream(caminho).pipe(res);
  }
}
