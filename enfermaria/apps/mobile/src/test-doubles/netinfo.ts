/** Duplo mínimo do NetInfo — os testes da fila não dependem de rede real. */
export default {
  addEventListener: () => () => undefined,
  fetch: async () => ({ isConnected: true, isInternetReachable: true }),
};
