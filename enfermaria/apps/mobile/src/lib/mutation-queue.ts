import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const QUEUE_KEY = 'curasphere:mutation_queue';
const MAX_TENTATIVAS = 3;

export interface QueuedOp {
  id: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  url: string;
  body?: any;
  timestamp: number;
}

export async function enqueue(op: Omit<QueuedOp, 'id' | 'timestamp'>): Promise<void> {
  const queue = await getQueue();
  const newOp: QueuedOp = {
    ...op,
    id: Math.random().toString(36).slice(2),
    timestamp: Date.now(),
  };
  queue.push(newOp);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function getQueue(): Promise<QueuedOp[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function getQueueLength(): Promise<number> {
  return (await getQueue()).length;
}

async function tentarReplay(op: QueuedOp, tentativa = 0): Promise<'ok' | 'fail'> {
  try {
    await (api as any)[op.method.toLowerCase()](op.url, op.body);
    return 'ok';
  } catch {
    if (tentativa < MAX_TENTATIVAS - 1) {
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, tentativa)));
      return tentarReplay(op, tentativa + 1);
    }
    return 'fail';
  }
}

export async function flushMutationQueue(): Promise<{ sucesso: number; falha: number }> {
  const queue = await getQueue();
  if (queue.length === 0) return { sucesso: 0, falha: 0 };

  let sucesso = 0;
  let falha = 0;
  const falhados: QueuedOp[] = [];

  for (const op of queue) {
    const resultado = await tentarReplay(op);
    if (resultado === 'ok') {
      sucesso++;
    } else {
      falha++;
      falhados.push(op);
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(falhados));
  return { sucesso, falha };
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}
