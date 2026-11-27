import type { Request } from 'express';

/**
 * ARQ-08 — o que o JwtStrategy põe em `req.user` numa sessão de pessoal. Os controladores tinham
 * `@Request() req: PedidoAutenticado` (mais de 300): um campo inventado passava sem aviso — `req.user.userId`,
 * que não existe, gravava o autor dos resultados de análises e dos outcomes como `undefined`.
 */
export interface UtilizadorAutenticado {
  sub: string;
  nome?: string;
  numeroFuncionario?: string;
  role: string;
  subRole?: string;
  servico: string;
  tenantId: string;
  tipoToken: 'pessoal';
}

/** Tokens intermédios (MFA por configurar, password expirada): identificam, mas não têm papel. */
export interface UtilizadorIntermedio {
  sub: string;
  tipoToken: 'mfa_setup' | 'password_expirada';
}

export interface PedidoAutenticado extends Request {
  user: UtilizadorAutenticado;
}

/** Pedido de um quiosque (QuiosqueGuard): sem utilizador, com o serviço do token do quiosque. */
export interface PedidoQuiosque extends Request {
  quiosque: { servicoId: string };
}

/** Pedido do portal do doente (PortalJwtStrategy): a conta do portal e o doente que ela representa. */
export interface PedidoPortal extends Request {
  user: { sub: string; doenteId: string; tipo: 'portal' };
}
