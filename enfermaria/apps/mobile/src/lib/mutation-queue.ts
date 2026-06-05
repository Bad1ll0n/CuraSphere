import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const QUEUE_KEY = 'curasphere:mutation_queue';

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

export async function flushMutationQueue(): Promise<{ sucesso: number; falha: number }> {
  const queue = await getQueue();
  if (queue.length === 0) return { sucesso: 0, falha: 0 };

  let sucesso = 0;
  let falha = 0;
  const restantes: QueuedOp[] = [];

  for (const op of queue) {
    try {
      await (api as any)[op.method.toLowerCase()](op.url, op.body);
      sucesso++;
    } catch {
      falha++;
      restantes.push(op);
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(restantes));
  return { sucesso, falha };
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}
