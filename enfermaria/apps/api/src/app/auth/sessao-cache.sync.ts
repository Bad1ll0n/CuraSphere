import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BarramentoService } from '../redis/barramento.service';
import { apagarCacheSessaoLocal, ligarDifusaoSessao } from './sessao-cache';

const CANAL = 'sessao:invalidar';

/**
 * ARQ-17/OPS-09 — revogar uma sessão (terminar sessões, desativar utilizador, mudar a password)
 * invalida a cache de sessões em TODAS as réplicas da API, pelo barramento, em vez de esperar
 * pelo TTL de 10 s nas outras.
 */
@Injectable()
export class SessaoCacheSincronizacao implements OnModuleInit, OnModuleDestroy {
  private cancelar: (() => void) | null = null;

  constructor(private readonly barramento: BarramentoService) {}

  onModuleInit() {
    this.cancelar = this.barramento.subscrever<string>(CANAL, (id) => apagarCacheSessaoLocal(id));
    ligarDifusaoSessao((id) => this.barramento.publicar(CANAL, id));
  }

  onModuleDestroy() {
    ligarDifusaoSessao(null);
    this.cancelar?.();
  }
}
