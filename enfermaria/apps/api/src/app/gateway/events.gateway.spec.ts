import { ForbiddenException } from '@nestjs/common';
import { EventsGateway } from './events.gateway';

/**
 * S-07 / S-08: o handshake do websocket autenticava a ligação, mas nenhum handler autorizava
 * o que era pedido depois dela. Até esta suite, nenhum teste exercitava o gateway — os que o
 * referenciavam limitavam-se a fazer mock dele.
 */
function novoGateway() {
  const doentes = { assertAcessoDoente: jest.fn().mockResolvedValue(undefined) };
  const prisma = {
    notaClinica: { findUnique: jest.fn() },
    passagemTurno: {
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    horarioTurnoProfissional: { findFirst: jest.fn() },
    atribuicaoDoente: { findMany: jest.fn().mockResolvedValue([]) },
    atribuicaoHorarioTurno: { findMany: jest.fn().mockResolvedValue([]) },
    turno: { findMany: jest.fn().mockResolvedValue([]) },
    utilizador: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const redis = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() };
  const moduleRef = { get: jest.fn(() => doentes) };

  const gateway = new EventsGateway(
    {} as any,
    {} as any,
    prisma as any,
    redis as any,
    moduleRef as any,
  );

  // Cada emissão fica registada com as salas de destino e as excluídas, para os testes
  // afirmarem QUEM recebe o quê — que é exactamente o que o S-09 corrigiu.
  const emissoes: Array<{ salas: string[]; exceto: string[]; evento: string; payload: any }> = [];
  const lista = (s: string | string[]) => (Array.isArray(s) ? s : [s]);
  const operador = (salas: string[], exceto: string[]): any => ({
    to: (s: string | string[]) => operador([...salas, ...lista(s)], exceto),
    except: (s: string | string[]) => operador(salas, [...exceto, ...lista(s)]),
    emit: (evento: string, payload: unknown) => {
      emissoes.push({ salas, exceto, evento, payload });
      return true;
    },
  });
  const to = jest.fn((s: string | string[]) => operador(lista(s), []));
  (gateway as any).server = { to };

  return { gateway, to, emissoes, doentes, prisma, redis };
}

/** Socket já autenticado: é o estado em que o handshake deixa um cliente. */
function ligado(gateway: EventsGateway, user = 'enf-1', papel: string | null = 'enfermeiro') {
  const client = { id: 'sock-1', join: jest.fn(), emit: jest.fn(), disconnect: jest.fn() };
  (gateway as any).clientUsers.set(client.id, user);
  (gateway as any).clientNames.set(client.id, 'Enf. Teste');
  if (papel) (gateway as any).clientRoles.set(client.id, papel);
  return client as any;
}

describe('EventsGateway — autorização depois da ligação', () => {
  describe('nota:join-doente', () => {
    it('não entra na sala de um doente a que não tem acesso', async () => {
      const { gateway, doentes } = novoGateway();
      doentes.assertAcessoDoente.mockRejectedValue(new ForbiddenException());
      const client = ligado(gateway);

      await gateway.handleNotaJoinDoente(client, { doenteId: 'd-alheio' });

      expect(client.join).not.toHaveBeenCalled();
      expect(client.emit).toHaveBeenCalledWith('nota:acesso-negado', { doenteId: 'd-alheio' });
    });

    it('entra na sala quando tem acesso', async () => {
      const { gateway, doentes } = novoGateway();
      const client = ligado(gateway);

      await gateway.handleNotaJoinDoente(client, { doenteId: 'd1' });

      expect(doentes.assertAcessoDoente).toHaveBeenCalledWith('enf-1', 'enfermeiro', 'd1');
      expect(client.join).toHaveBeenCalledWith('doente:d1');
    });

    it('recusa um socket sem papel registado, em vez de assumir acesso', async () => {
      const { gateway } = novoGateway();
      const client = ligado(gateway, 'enf-1', null);

      await gateway.handleNotaJoinDoente(client, { doenteId: 'd1' });

      expect(client.join).not.toHaveBeenCalled();
    });
  });

  describe('nota:edit-start', () => {
    it('recusa bloquear uma nota que pertence a outro doente', async () => {
      // Com acesso ao doente d1, declarar d1 no pedido para bloquear uma nota de d2.
      const { gateway, prisma, redis } = novoGateway();
      prisma.notaClinica.findUnique.mockResolvedValue({ doenteId: 'd2' });
      const client = ligado(gateway);

      await gateway.handleNotaEditStart(client, { notaId: 'n1', doenteId: 'd1' });

      expect(redis.set).not.toHaveBeenCalled();
      expect(client.emit).toHaveBeenCalledWith(
        'nota:acesso-negado',
        expect.objectContaining({ notaId: 'n1' }),
      );
    });
  });

  describe('nota:edit-stop', () => {
    it('não liberta o bloqueio de outra pessoa', async () => {
      const { gateway, redis, to } = novoGateway();
      redis.get.mockResolvedValue({ userId: 'outra-enf', nome: 'Outra' });
      const client = ligado(gateway);

      await gateway.handleNotaEditStop(client, { notaId: 'n1', doenteId: 'd1' });

      expect(redis.del).not.toHaveBeenCalled();
      expect(to).not.toHaveBeenCalled();
    });

    it('liberta o próprio bloqueio e avisa a sala do doente registado no bloqueio', async () => {
      const { gateway, redis, to } = novoGateway();
      redis.get.mockResolvedValue({ userId: 'enf-1', nome: 'Enf. Teste' });
      const client = ligado(gateway);
      (gateway as any).clientLocks.set(client.id, [{ notaId: 'n1', doenteId: 'd1' }]);

      // O cliente declara outro doente: o aviso segue o registo do bloqueio, não o pedido.
      await gateway.handleNotaEditStop(client, { notaId: 'n1', doenteId: 'd-qualquer' });

      expect(redis.del).toHaveBeenCalledWith('nota:lock:n1');
      expect(to).toHaveBeenCalledWith('doente:d1');
    });
  });

  describe('turno:passagem-aceite', () => {
    const passagemPendente = {
      id: 'p1',
      estadoDesafio: 'pendente',
      turnoAtual: {
        dataInicio: new Date('2026-09-11T08:00:00Z'),
        dataFim: new Date('2026-09-11T16:00:00Z'),
      },
      turnoAnterior: { chefeTurnoId: 'chefe-noite' },
    };

    it('recusa quem não está escalado no turno que recebe', async () => {
      const { gateway, prisma } = novoGateway();
      prisma.passagemTurno.findUnique.mockResolvedValue(passagemPendente);
      prisma.horarioTurnoProfissional.findFirst.mockResolvedValue(null);
      const client = ligado(gateway, 'intruso');

      await gateway.handlePassagemAceite(client, { passagemId: 'p1' });

      expect(prisma.passagemTurno.updateMany).not.toHaveBeenCalled();
      expect(client.emit).toHaveBeenCalledWith(
        'turno:passagem-recusada',
        expect.objectContaining({ passagemId: 'p1' }),
      );
    });

    it('aceita quem está escalado e avisa QUEM ENTREGA, não só quem aceita', async () => {
      const { gateway, prisma, to } = novoGateway();
      prisma.passagemTurno.findUnique.mockResolvedValue(passagemPendente);
      prisma.horarioTurnoProfissional.findFirst.mockResolvedValue({ horarioTurnoId: 'h1' });
      const client = ligado(gateway, 'enf-manha');

      await gateway.handlePassagemAceite(client, { passagemId: 'p1' });

      expect(prisma.passagemTurno.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'p1', estadoDesafio: 'pendente' } }),
      );
      expect(to).toHaveBeenCalledWith('user:chefe-noite');
      expect(to).toHaveBeenCalledWith('user:enf-manha');
    });

    it('quando outro profissional aceitou primeiro, não confirma a segunda aceitação', async () => {
      const { gateway, prisma, to } = novoGateway();
      prisma.passagemTurno.findUnique.mockResolvedValue(passagemPendente);
      prisma.horarioTurnoProfissional.findFirst.mockResolvedValue({ horarioTurnoId: 'h1' });
      prisma.passagemTurno.updateMany.mockResolvedValue({ count: 0 });
      const client = ligado(gateway, 'enf-manha');

      await gateway.handlePassagemAceite(client, { passagemId: 'p1' });

      expect(to).not.toHaveBeenCalled();
    });
  });
});

describe('EventsGateway — S-09: quem recebe dados de doente', () => {
  const sos = (e: { evento: string }) => e.evento === 'sos:alerta';

  describe('alertas críticos', () => {
    it('o nome vai só para a equipa do doente; os restantes recebem tipo e localização', async () => {
      const { gateway, emissoes, prisma } = novoGateway();
      prisma.atribuicaoDoente.findMany.mockResolvedValue([{ enfermeiroId: 'enf-atribuida' }]);
      prisma.atribuicaoHorarioTurno.findMany.mockResolvedValue([{ utilizadorId: 'med-escalado' }]);
      prisma.turno.findMany.mockResolvedValue([{ chefeTurnoId: 'chefe' }]);
      prisma.utilizador.findUnique.mockResolvedValue({ nome: 'Enf. Ana' });

      await gateway.emitirSOS('d1', 'Maria Silva', 'Quarto 3, Cama 12', 'enf-ana');

      const [equipa, restantes] = emissoes.filter(sos);
      expect(equipa.salas).toEqual(
        expect.arrayContaining(['doente:d1', 'user:enf-atribuida', 'user:med-escalado', 'user:chefe']),
      );
      expect(equipa.payload).toMatchObject({
        doenteNome: 'Maria Silva',
        identificado: true,
        acionadoPorNome: 'Enf. Ana',
      });

      expect(restantes.salas).toEqual(['role:medico', 'role:enfermeiro']);
      // Sem a exclusão, quem é da equipa recebia o alerta duas vezes.
      expect(restantes.exceto).toEqual(equipa.salas);
      expect(restantes.payload).not.toHaveProperty('doenteNome');
      expect(restantes.payload).toMatchObject({ quarto: 'Quarto 3, Cama 12', identificado: false });
    });

    it('o detalhe clínico da sépsis também fica só na equipa', async () => {
      const { gateway, emissoes } = novoGateway();

      await gateway.emitirAlertaCritico({
        tipo: 'sepsis',
        doenteId: 'd1',
        doenteNome: 'Maria Silva',
        localizacao: 'Quarto 3, Cama 12',
        detalhe: { criterio: 'qsofa', score: 2 },
      });

      const [equipa, restantes] = emissoes.filter(sos);
      expect(equipa.payload).toMatchObject({ tipo: 'sepsis', criterio: 'qsofa', score: 2 });
      expect(restantes.payload).not.toHaveProperty('criterio');
      expect(restantes.payload).not.toHaveProperty('score');
    });

    it('se a equipa não puder ser resolvida, o SOS não fica calado nem expõe o nome', async () => {
      const { gateway, emissoes, prisma } = novoGateway();
      prisma.atribuicaoDoente.findMany.mockRejectedValue(new Error('base de dados em baixo'));
      jest.spyOn((gateway as any).logger, 'error').mockImplementation(() => undefined);

      await expect(gateway.emitirSOS('d1', 'Maria Silva', 'Quarto 3', 'enf-ana')).resolves.toBeUndefined();

      const [equipa, restantes] = emissoes.filter(sos);
      // Só as sessões que já passaram a verificação de acesso a este doente.
      expect(equipa.salas).toEqual(['doente:d1']);
      expect(restantes.salas).toEqual(['role:medico', 'role:enfermeiro']);
      expect(restantes.payload).not.toHaveProperty('doenteNome');
    });
  });

  describe('urgência', () => {
    it('SLA excedido: o nome só vai para o serviço de urgência', () => {
      const { gateway, emissoes } = novoGateway();

      gateway.emitirSLAExcedido({
        episodioId: 'e1',
        triagem: 'laranja',
        minutosEspera: 25,
        slaMax: 10,
        nomeDoente: 'Maria Silva',
      });

      const [servico, restantes] = emissoes;
      expect(servico.salas).toEqual(['servico:urgencia']);
      expect(servico.payload).toMatchObject({ nomeDoente: 'Maria Silva' });
      expect(restantes.exceto).toEqual(['servico:urgencia']);
      expect(restantes.payload).not.toHaveProperty('nomeDoente');
      expect(restantes.payload).toMatchObject({ episodioId: 'e1', minutosEspera: 25 });
    });

    it('pré-notificação: a queixa só vai para o serviço de urgência', () => {
      const { gateway, emissoes } = novoGateway();

      gateway.emitirPreNotificacao('e1', 'vermelho', 8, 'Homem, 34 anos, queda de mota');

      const [servico, restantes] = emissoes;
      expect(servico.payload).toMatchObject({ queixa: 'Homem, 34 anos, queda de mota' });
      expect(restantes.exceto).toEqual(['servico:urgencia']);
      expect(restantes.payload).not.toHaveProperty('queixa');
    });

    it('actualização de episódio: fora do serviço só segue o identificador', () => {
      const { gateway, emissoes } = novoGateway();

      gateway.emitirUrgenciaUpdate({
        id: 'e1',
        novaAtualizacao: { texto: 'Consciente, dor torácica', registadoPor: { nome: 'INEM' } },
      });

      const [servico, restantes] = emissoes;
      expect(servico.payload).toHaveProperty('novaAtualizacao');
      expect(Object.keys(restantes.payload).sort()).toEqual(['id', 'ts']);
    });
  });
});
