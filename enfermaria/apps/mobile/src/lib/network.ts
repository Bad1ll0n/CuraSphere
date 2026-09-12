import { useEffect, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { flushMutationQueue } from './mutation-queue';
import { registarFalhaSilenciosa } from './erros';

/**
 * Estado de rede partilhado (MB-02).
 *
 * `useNetworkStatus` era um hook que registava a sua própria escuta do NetInfo. Cada
 * componente montado tinha a sua — e na reconexão todas disparavam `flushMutationQueue()`
 * ao mesmo tempo, reenviando as mesmas administrações de medicação. Pior: o flush era
 * chamado de dentro do updater do `setState`, que o React pode invocar mais do que uma
 * vez para o mesmo evento.
 *
 * Agora existe uma única escuta por processo. Os componentes só a observam.
 */

type Ouvinte = (online: boolean) => void;

const ouvintes = new Set<Ouvinte>();
let estadoActual = true;
let cancelarEscuta: (() => void) | null = null;

function avaliar(state: NetInfoState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

function aoMudar(state: NetInfoState) {
  const online = avaliar(state);
  const transitouParaOnline = !estadoActual && online;
  estadoActual = online;

  for (const ouvinte of ouvintes) ouvinte(online);

  if (transitouParaOnline) {
    // Efeito fora de qualquer updater de estado do React, e protegido por disparo único
    // dentro do próprio `flushMutationQueue`.
    // Uma operação descartada é um acto clínico que o enfermeiro julga registado e não
    // está. Não pode desaparecer sem deixar rasto: o comprimento da fila volta a zero e
    // o sinal fica indistinguível de 'sincronizou tudo'.
    void flushMutationQueue()
      .then(({ descartadas }) => {
        if (descartadas > 0) {
          registarFalhaSilenciosa(
            'mutation-queue',
            new Error(`${descartadas} operação(ões) clínica(s) descartada(s) na sincronização`),
          );
        }
      })
      .catch((e) => registarFalhaSilenciosa('mutation-queue.flush', e));
  }
}

function garantirEscuta() {
  if (cancelarEscuta) return;
  cancelarEscuta = NetInfo.addEventListener(aoMudar);
}

function libertarSeVazio() {
  if (ouvintes.size === 0 && cancelarEscuta) {
    cancelarEscuta();
    cancelarEscuta = null;
  }
}

export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = useState(estadoActual);

  useEffect(() => {
    const ouvinte: Ouvinte = (online) => setIsOnline(online);
    ouvintes.add(ouvinte);
    garantirEscuta();

    // Alinha o estado inicial com a realidade, em vez de assumir "online".
    NetInfo.fetch()
      .then((state) => {
        estadoActual = avaliar(state);
        setIsOnline(estadoActual);
      })
      .catch(() => undefined);

    return () => {
      ouvintes.delete(ouvinte);
      libertarSeVazio();
    };
  }, []);

  return isOnline;
}
