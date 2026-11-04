import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { MedicacaoService } from './medicacao.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { RedisService } from '../redis/redis.service';
import { StewardshipService } from '../stewardship/stewardship.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { AlertasService } from '../alertas/alertas.service';

const mockPrisma = {
  $transaction: jest.fn(),
  doente: { findUnique: jest.fn() },
  alergia: { findMany: jest.fn() },
  medicacao: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  registoMedicacao: { create: jest.fn(), findMany: jest.fn() },
  atribuicaoHorarioTurno: { findMany: jest.fn() },
};

const mockNotificacoes = {
  enviarParaUtilizador: jest.fn().mockResolvedValue(undefined),
  enviarParaUtilizadores: jest.fn().mockResolvedValue(undefined),
  enviarParaRole: jest.fn().mockResolvedValue(undefined),
  notificarRole: jest.fn().mockResolvedValue(undefined),
};

const mockAlertas = {
  criarAlerta: jest.fn().mockResolvedValue(undefined),
};

const mockRedis = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  incr: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
};

const mockStewardship = {
  registarSeAntibiotico: jest.fn().mockResolvedValue(undefined),
};

describe('MedicacaoService', () => {
  let service: MedicacaoService;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockStewardship.registarSeAntibiotico.mockResolvedValue(undefined);
    mockNotificacoes.enviarParaUtilizador.mockResolvedValue(undefined);
    mockNotificacoes.enviarParaUtilizadores.mockResolvedValue(undefined);
    mockNotificacoes.notificarRole.mockResolvedValue(undefined);
    mockNotificacoes.enviarParaRole.mockResolvedValue(undefined);
    mockAlertas.criarAlerta.mockResolvedValue(undefined);
    // Defaults para métodos que retornam arrays (usados com .map antes da transação)
    mockPrisma.medicacao.findMany.mockResolvedValue([]);
    mockPrisma.alergia.findMany.mockResolvedValue([]);
    mockPrisma.registoMedicacao.findMany.mockResolvedValue([]);
    mockPrisma.atribuicaoHorarioTurno.findMany.mockResolvedValue([]);
    mockRedis.get.mockResolvedValue(null);
    mockPrisma.$transaction.mockImplementation((arg: any) => {
      if (typeof arg === 'function') return arg(mockPrisma);
      return Promise.all(arg);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedicacaoService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificacoesService, useValue: mockNotificacoes },
        { provide: RedisService, useValue: mockRedis },
        { provide: StewardshipService, useValue: mockStewardship },
        { provide: TenantContextService, useValue: { tenantId: 'default', run: (_id: string, fn: () => unknown) => fn() } },
        { provide: WebhooksService, useValue: { dispatcharEvento: jest.fn().mockResolvedValue(undefined) } },
        { provide: AlertasService, useValue: mockAlertas },
      ],
    }).compile();

    service = module.get<MedicacaoService>(MedicacaoService);
  });

  // ── prescrever() ─────────────────────────────────────────────────────────────

  describe('prescrever()', () => {
    const dadosBase = {
      doenteId: 'doente-1',
      nome: 'Paracetamol 1g',
      dose: '1g',
      via: 'oral',
      frequencia: '8/8h',
      prescritoPorId: 'medico-1',
    };

    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);

      await expect(service.prescrever(dadosBase)).rejects.toThrow(NotFoundException);
    });

    it('lança ConflictException quando medicamento coincide com alergia registada', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1', nome: 'João' });
      mockPrisma.alergia.findMany.mockResolvedValue([
        { alergenio: 'paracetamol', severidade: 'moderada', doenteId: 'doente-1' },
      ]);

      await expect(service.prescrever(dadosBase)).rejects.toThrow(ConflictException);
    });

    // BA-03: com override as alergias continuam a ser consultadas — sem isso não há como
    // registar O QUE foi ultrapassado. (Antes o teste exigia o contrário.)
    it('consulta sempre as alergias, mesmo com forcarApesarDeAlergia=true', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1', nome: 'João' });
      mockPrisma.alergia.findMany.mockResolvedValue([]);
      mockPrisma.medicacao.findMany.mockResolvedValue([]);
      mockPrisma.medicacao.create.mockResolvedValue({
        id: 'med-1', nome: 'Paracetamol 1g', prescritoPor: { id: 'medico-1', nome: 'Dr. Silva' },
      });

      const resultado = await service.prescrever({
        ...dadosBase,
        forcarApesarDeAlergia: true,
        justificativaOverride: 'Benefício clínico supera o risco documentado.',
      });

      expect(resultado.id).toBe('med-1');
      expect(mockPrisma.alergia.findMany).toHaveBeenCalled();
    });

    it('sem alergia real, forcar=true não marca override', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1', nome: 'João' });
      mockPrisma.alergia.findMany.mockResolvedValue([]);
      mockPrisma.medicacao.findMany.mockResolvedValue([]);
      mockPrisma.medicacao.create.mockResolvedValue({ id: 'med-1', prescritoPor: {} });

      await service.prescrever({ ...dadosBase, forcarApesarDeAlergia: true });

      const chamada = mockPrisma.medicacao.create.mock.calls[0][0];
      expect(chamada.data.overrideAlergia).toBe(false);
      expect(mockAlertas.criarAlerta).not.toHaveBeenCalled();
    });

    it('cria medicação e devolve avisoInteracoes vazio quando sem interações', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1', nome: 'João' });
      mockPrisma.alergia.findMany.mockResolvedValue([]);
      mockPrisma.medicacao.findMany.mockResolvedValue([]);
      mockPrisma.medicacao.create.mockResolvedValue({
        id: 'med-1', nome: 'Paracetamol 1g', prescritoPor: {},
      });

      const resultado = await service.prescrever(dadosBase);

      expect(resultado.id).toBe('med-1');
      expect(resultado.avisoInteracoes).toHaveLength(0);
    });

    it('detecta interação grave warfarina + aspirina', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1', nome: 'João' });
      mockPrisma.alergia.findMany.mockResolvedValue([]);
      // Doente já tem Warfarina activa
      mockPrisma.medicacao.findMany.mockResolvedValue([{ nome: 'Warfarina 5mg' }]);
      mockPrisma.medicacao.create.mockResolvedValue({
        id: 'med-2', nome: 'Aspirina 100mg', prescritoPor: {},
      });

      const resultado = await service.prescrever({ ...dadosBase, nome: 'Aspirina 100mg' });

      expect(resultado.avisoInteracoes.length).toBeGreaterThan(0);
      expect(resultado.avisoInteracoes[0]).toMatchObject({ severidade: 'grave' });
    });

    // ── BA-03: o override de alergia é persistido, não descartado ────────────

    describe('override de alergia', () => {
      const alergiaPenicilina = [
        { id: 'alg-1', alergenio: 'Penicilina', severidade: 'grave', doenteId: 'doente-1' },
      ];
      const dadosAmoxi = { ...dadosBase, nome: 'Amoxicilina 500mg' };
      const justificacaoValida = 'Sem alternativa terapêutica; alergia antiga e ligeira, doente vigiado.';

      beforeEach(() => {
        mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1', nome: 'João' });
        mockPrisma.alergia.findMany.mockResolvedValue(alergiaPenicilina);
        mockPrisma.medicacao.findMany.mockResolvedValue([]);
        mockPrisma.medicacao.create.mockResolvedValue({ id: 'med-1', prescritoPor: {} });
      });

      it('bloqueia por classe farmacológica (penicilina → amoxicilina) sem override', async () => {
        await expect(service.prescrever(dadosAmoxi)).rejects.toThrow(ConflictException);
      });

      it('persiste overrideAlergia, motivo e alergénio nos dados criados', async () => {
        await service.prescrever({
          ...dadosAmoxi,
          forcarApesarDeAlergia: true,
          justificativaOverride: justificacaoValida,
        });

        const chamada = mockPrisma.medicacao.create.mock.calls[0][0];
        expect(chamada.data.overrideAlergia).toBe(true);
        expect(chamada.data.overrideMotivo).toContain(justificacaoValida);
        expect(chamada.data.overrideAlergenioId).toBe('alg-1');
        // Os campos de controlo continuam a não ir para a BD como colunas próprias.
        expect(chamada.data).not.toHaveProperty('forcarApesarDeAlergia');
        expect(chamada.data).not.toHaveProperty('justificativaOverride');
      });

      it('exige justificação com pelo menos 20 caracteres', async () => {
        await expect(
          service.prescrever({ ...dadosAmoxi, forcarApesarDeAlergia: true, justificativaOverride: 'porque sim' }),
        ).rejects.toThrow(BadRequestException);

        await expect(
          service.prescrever({ ...dadosAmoxi, forcarApesarDeAlergia: true }),
        ).rejects.toThrow(BadRequestException);
      });

      it('gera alerta clínico e notifica o farmacêutico', async () => {
        await service.prescrever({
          ...dadosAmoxi,
          forcarApesarDeAlergia: true,
          justificativaOverride: justificacaoValida,
        });

        expect(mockAlertas.criarAlerta).toHaveBeenCalledWith(
          'doente-1',
          'override_alergia',
          expect.stringContaining('Penicilina'),
          3,
        );
        expect(mockNotificacoes.enviarParaRole).toHaveBeenCalledWith(
          'farmaceutico',
          expect.stringContaining('Override de alergia'),
          expect.stringContaining('Amoxicilina'),
          expect.objectContaining({ tipo: 'override_alergia' }),
        );
      });
    });
  });

  // ── registarAdministracao() ──────────────────────────────────────────────────

  describe('registarAdministracao()', () => {
    const medAtiva = {
      id: 'med-1', ativo: true, doenteId: 'doente-1', nome: 'Paracetamol 1g',
      dose: '1g', via: 'oral', frequencia: 'SOS', overrideAlergia: false, registos: [],
    };
    const base = { medicacaoId: 'med-1', doenteId: 'doente-1', administradoPorId: 'enf-1' };

    beforeEach(() => {
      mockPrisma.registoMedicacao.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'reg-1', ...data, administradoPor: {}, medicacao: {} }),
      );
    });

    // BA-06: doenteId deixa de ser opcional.
    it('rejeita quando doenteId não é indicado', async () => {
      await expect(
        service.registarAdministracao({ medicacaoId: 'med-1', administradoPorId: 'enf-1' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.medicacao.findUnique).not.toHaveBeenCalled();
    });

    it('rejeita quando a medicação não pertence ao doente indicado', async () => {
      mockPrisma.medicacao.findUnique.mockResolvedValue(medAtiva);

      await expect(
        service.registarAdministracao({ ...base, doenteId: 'doente-OUTRO' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança NotFoundException quando medicação não existe', async () => {
      mockPrisma.medicacao.findUnique.mockResolvedValue(null);

      await expect(
        service.registarAdministracao({ ...base, medicacaoId: 'med-x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança NotFoundException quando medicação está descontinuada', async () => {
      mockPrisma.medicacao.findUnique.mockResolvedValue({ ...medAtiva, ativo: false });

      await expect(service.registarAdministracao(base)).rejects.toThrow(NotFoundException);
    });

    // BA-06: dose e via comparadas com o prescrito.
    it('rejeita dose diferente da prescrita', async () => {
      mockPrisma.medicacao.findUnique.mockResolvedValue(medAtiva);

      await expect(
        service.registarAdministracao({ ...base, dose: '2g' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita via diferente da prescrita', async () => {
      mockPrisma.medicacao.findUnique.mockResolvedValue(medAtiva);

      await expect(
        service.registarAdministracao({ ...base, via: 'endovenosa' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('aceita dose/via equivalentes ignorando espaços e acentuação', async () => {
      mockPrisma.medicacao.findUnique.mockResolvedValue(medAtiva);

      const r: any = await service.registarAdministracao({ ...base, dose: ' 1 g ', via: 'Oral' });
      expect(r.verificacao5Certas).toBe(true);
    });

    // BA-06/QA-03: verificacao5Certas passa a ser o resultado real.
    it('grava verificacao5Certas=true SÓ quando dose e via foram confirmadas', async () => {
      mockPrisma.medicacao.findUnique.mockResolvedValue(medAtiva);

      const r: any = await service.registarAdministracao({ ...base, dose: '1g', via: 'oral' });

      expect(r.verificacao5Certas).toBe(true);
      expect(r.certosVerificados).toEqual({
        doente: 'verificado', medicamento: 'verificado', dose: 'verificado',
        via: 'verificado', hora: 'verificado',
      });
    });

    it('grava verificacao5Certas=false quando dose e via não foram declaradas', async () => {
      mockPrisma.medicacao.findUnique.mockResolvedValue(medAtiva);

      const r: any = await service.registarAdministracao(base);

      expect(r.verificacao5Certas).toBe(false);
      expect(r.certosVerificados).toMatchObject({
        dose: 'nao_confirmado', via: 'nao_confirmado', doente: 'verificado',
      });
    });

    // A distinção que impede o registo de mentir: o enfermeiro percorreu a lista à
    // cabeceira, mas o sistema não comparou nada. Isso é uma atestação, e colapsá-la em
    // 'verificado' era exactamente o defeito original por outro caminho.
    it('atestação do enfermeiro NÃO conta como verificação do sistema', async () => {
      mockPrisma.medicacao.findUnique.mockResolvedValue(medAtiva);

      const r: any = await service.registarAdministracao({
        ...base,
        atestadoPeloEnfermeiro: true,
      });

      expect(r.verificacao5Certas).toBe(false);
      expect(r.certosVerificados).toMatchObject({ dose: 'atestado', via: 'atestado' });
    });

    it('a dose comparada vem da etiqueta assinada, não do que o cliente diz ter lido', async () => {
      // Se a etiqueta e a prescrição divergirem, a administração é recusada — é assim que
      // se apanha uma etiqueta impressa antes de uma alteração de dose.
      mockPrisma.medicacao.findUnique.mockResolvedValueOnce({
        id: 'med-1', doenteId: 'doente-1', nome: 'Paracetamol 1g', dose: '1g', via: 'oral',
      });
      const { qrPayload } = await service.gerarPayloadQR('med-1');
      mockPrisma.medicacao.findUnique.mockResolvedValue({ ...medAtiva, dose: '500mg' });

      await expect(
        service.registarAdministracao({ ...base, qrPayload }),
      ).rejects.toThrow(/dose incorrecta/i);
    });

    // BA-06: alergia verificada no momento da administração.
    it('bloqueia administração de fármaco com alergia documentada entretanto', async () => {
      mockPrisma.medicacao.findUnique.mockResolvedValue({ ...medAtiva, nome: 'Amoxicilina 500mg' });
      mockPrisma.alergia.findMany.mockResolvedValue([
        { id: 'alg-1', alergenio: 'Penicilina', severidade: 'grave' },
      ]);

      await expect(service.registarAdministracao(base)).rejects.toThrow(BadRequestException);
    });

    it('permite administrar quando a prescrição tem override de alergia registado', async () => {
      mockPrisma.medicacao.findUnique.mockResolvedValue({
        ...medAtiva, nome: 'Amoxicilina 500mg', overrideAlergia: true,
      });
      mockPrisma.alergia.findMany.mockResolvedValue([
        { id: 'alg-1', alergenio: 'Penicilina', severidade: 'grave' },
      ]);

      await expect(service.registarAdministracao(base)).resolves.toBeDefined();
    });
  });

  // ── descontinuar() ───────────────────────────────────────────────────────────

  describe('descontinuar()', () => {
    it('lança NotFoundException quando medicação não existe', async () => {
      mockPrisma.medicacao.findUnique.mockResolvedValue(null);

      await expect(service.descontinuar('id-inexistente')).rejects.toThrow(NotFoundException);
    });

    it('marca medicação como inativa com terminadoEm preenchido', async () => {
      mockPrisma.medicacao.findUnique.mockResolvedValue({ id: 'med-1', nome: 'Metformina', ativo: true });
      mockPrisma.medicacao.update.mockResolvedValue({ id: 'med-1', ativo: false, terminadoEm: new Date() });

      const resultado = await service.descontinuar('med-1');

      expect(resultado.ativo).toBe(false);
      expect(mockPrisma.medicacao.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'med-1' },
          data: expect.objectContaining({ ativo: false }),
        }),
      );
    });
  });

  // ── verificarInteracoes() ────────────────────────────────────────────────────

  describe('verificarInteracoes()', () => {
    it('devolve array vazio quando não há medicações ativas', async () => {
      mockPrisma.medicacao.findMany.mockResolvedValue([]);

      const resultado = await service.verificarInteracoes('doente-1', 'Aspirina 100mg');

      expect(resultado).toHaveLength(0);
    });

    it('detecta interação tramadol + sertralina (síndrome serotonérgica)', async () => {
      mockPrisma.medicacao.findMany.mockResolvedValue([{ nome: 'Sertralina 50mg' }]);

      const resultado = await service.verificarInteracoes('doente-1', 'Tramadol 50mg');

      expect(resultado.length).toBeGreaterThan(0);
      expect(resultado[0]).toMatchObject({ severidade: 'grave' });
    });
  });

  // ── verificar5Certos() ────────────────────────────────────────────────────────

  describe('verificar5Certos()', () => {
    const medAtiva = {
      id: 'med-1', doenteId: 'doente-1', nome: 'Paracetamol 1g', dose: '1g', via: 'oral',
      frequencia: '8/8h', ativo: true, overrideAlergia: false,
      registos: [],
    };

    /** Payload assinado pelo servidor, como o cliente o receberia de `gerarPayloadQR`. */
    const payloadAssinado = async (medicacaoId = 'med-1', doenteId = 'doente-1') => {
      mockPrisma.medicacao.findUnique.mockResolvedValueOnce({
        id: medicacaoId, doenteId, nome: 'Paracetamol 1g', dose: '1g', via: 'oral',
      });
      const { qrPayload } = await service.gerarPayloadQR(medicacaoId);
      return qrPayload;
    };

    it('devolve valido=true quando os CINCO certos são confirmados', async () => {
      const qr = await payloadAssinado();
      // Uma administração anterior há 9h torna a janela de 8/8h verificável. Sem ela, a
      // hora certa não é confirmável e o resultado não pode ser 'válido'.
      mockPrisma.medicacao.findUnique.mockResolvedValue({
        ...medAtiva,
        registos: [{ administradoEm: new Date(Date.now() - 9 * 3_600_000) }],
      });

      const r = await service.verificar5Certos(qr, 'doente-1');

      expect(r.valido).toBe(true);
      expect(r.falhas).toHaveLength(0);
      expect(r.porVerificar).toHaveLength(0);
      expect(r.certos.map(c => c.estado)).toEqual(['ok', 'ok', 'ok', 'ok', 'ok']);
      expect(r.medicacao!.nome).toBe('Paracetamol 1g');
    });

    // MB-04: o defeito central. Dose e via nunca eram avaliadas e o ecrã pintava-as a
    // verde na mesma, porque só recebia a lista de falhas.
    it('os cinco certos vêm SEMPRE com estado explícito, nunca por omissão', async () => {
      const qr = await payloadAssinado();
      mockPrisma.medicacao.findUnique.mockResolvedValue(medAtiva);

      const r = await service.verificar5Certos(qr, 'doente-1');

      expect(r.certos).toHaveLength(5);
      expect(r.certos.map(c => c.certo)).toEqual([
        'Doente certo', 'Medicamento certo', 'Dose certa', 'Via certa', 'Hora certa',
      ]);
      expect(r.certos.every(c => ['ok', 'falha', 'nao_verificado'].includes(c.estado))).toBe(true);
    });

    it('não dá por válido quando um certo fica por verificar', async () => {
      const qr = await payloadAssinado();
      mockPrisma.medicacao.findUnique.mockResolvedValue(medAtiva); // sem administração anterior

      const r = await service.verificar5Certos(qr, 'doente-1');

      expect(r.valido).toBe(false);
      expect(r.falhas).toHaveLength(0); // nada falhou — apenas não foi tudo confirmado
      expect(r.porVerificar).toContain('Hora certa');
    });

    it('apanha uma etiqueta impressa antes de uma alteração de dose', async () => {
      const qr = await payloadAssinado(); // etiqueta emitida com dose '1g'
      mockPrisma.medicacao.findUnique.mockResolvedValue({
        ...medAtiva,
        dose: '500mg', // a prescrição mudou depois de a etiqueta ser impressa
        registos: [{ administradoEm: new Date(Date.now() - 9 * 3_600_000) }],
      });

      const r = await service.verificar5Certos(qr, 'doente-1');

      expect(r.valido).toBe(false);
      const dose = r.certos.find(c => c.certo === 'Dose certa')!;
      expect(dose.estado).toBe('falha');
      expect(dose.motivo).toContain('500mg');
    });

    it('uma etiqueta antiga sem dose/via fica por verificar, não confirmada', async () => {
      // Etiqueta do formato anterior, sem dose nem via impressas.
      const corpo = Buffer.from(
        JSON.stringify({ medicacaoId: 'med-1', doenteId: 'doente-1' }),
      ).toString('base64url');
      const assinatura = (service as any).assinarQR(corpo);
      mockPrisma.medicacao.findUnique.mockResolvedValue(medAtiva);

      const r = await service.verificar5Certos(`${corpo}.${assinatura}`, 'doente-1');

      expect(r.certos.find(c => c.certo === 'Dose certa')!.estado).toBe('nao_verificado');
      expect(r.certos.find(c => c.certo === 'Via certa')!.estado).toBe('nao_verificado');
      expect(r.valido).toBe(false);
    });

    it('etiqueta ilegível deixa os CINCO por verificar, não um deles em falha', async () => {
      const r = await service.verificar5Certos('não é json', 'doente-1');

      expect(r.erroEtiqueta).toBeTruthy();
      expect(r.certos.every(c => c.estado === 'nao_verificado')).toBe(true);
      expect(r.valido).toBe(false);
    });

    // QA-03: o doente certo passa a ser conferido contra a BD, não contra o próprio QR.
    it('falha no Certo 1 quando a medicação não é do doente à cabeceira', async () => {
      const qr = await payloadAssinado();
      mockPrisma.medicacao.findUnique.mockResolvedValue(medAtiva);

      const r = await service.verificar5Certos(qr, 'doente-OUTRO');

      expect(r.valido).toBe(false);
      expect(r.falhas.some(f => f.certo === 'Doente certo')).toBe(true);
    });

    it('rejeita QR não assinado (JSON simples fabricado pelo cliente)', async () => {
      const r = await service.verificar5Certos(
        JSON.stringify({ medicacaoId: 'med-1', doenteId: 'doente-1' }),
        'doente-1',
      );

      expect(r.valido).toBe(false);
      expect(r.medicacao).toBeNull();
      expect(r.falhas[0].certo).toBe('QR');
    });

    it('rejeita QR com assinatura adulterada', async () => {
      const qr = await payloadAssinado();
      const [corpo] = qr.split('.');
      const adulterado = `${corpo}.assinaturaFalsa`;

      const r = await service.verificar5Certos(adulterado, 'doente-1');

      expect(r.valido).toBe(false);
      expect(r.falhas[0].certo).toBe('QR');
    });

    it('rejeita QR cujo corpo foi trocado mantendo a assinatura antiga', async () => {
      const qr = await payloadAssinado();
      const [, assinatura] = qr.split('.');
      const outroCorpo = Buffer.from(
        JSON.stringify({ medicacaoId: 'med-FALSA', doenteId: 'doente-1' }),
      ).toString('base64url');

      const r = await service.verificar5Certos(`${outroCorpo}.${assinatura}`, 'doente-1');

      expect(r.valido).toBe(false);
      expect(r.falhas[0].certo).toBe('QR');
    });

    it('falha no Certo 2 quando medicação está inactiva', async () => {
      const qr = await payloadAssinado();
      mockPrisma.medicacao.findUnique.mockResolvedValue({ ...medAtiva, ativo: false });

      const r = await service.verificar5Certos(qr, 'doente-1');

      expect(r.valido).toBe(false);
      expect(r.falhas.some(f => f.certo === 'Medicamento certo')).toBe(true);
    });

    it('assinala alergia documentada como falha do Certo 2', async () => {
      const qr = await payloadAssinado();
      mockPrisma.medicacao.findUnique.mockResolvedValue({ ...medAtiva, nome: 'Amoxicilina 500mg' });
      mockPrisma.alergia.findMany.mockResolvedValue([
        { id: 'alg-1', alergenio: 'Penicilina', severidade: 'grave' },
      ]);

      const r = await service.verificar5Certos(qr, 'doente-1');

      expect(r.valido).toBe(false);
      expect(r.falhas.some(f => f.motivo.includes('Alergia'))).toBe(true);
    });

    it('falha no Certo 5 quando administração é prematura', async () => {
      const qr = await payloadAssinado();
      const ultimaAdm = new Date(Date.now() - 2 * 3_600_000); // há 2h (cedo para 8/8h com 1h tolerância)
      mockPrisma.medicacao.findUnique.mockResolvedValue({
        ...medAtiva,
        registos: [{ administradoEm: ultimaAdm }],
      });

      const r = await service.verificar5Certos(qr, 'doente-1');

      expect(r.valido).toBe(false);
      expect(r.falhas.some(f => f.certo === 'Hora certa')).toBe(true);
    });

    it('devolve valido=false e medicacao=null quando o QR é lixo', async () => {
      const r = await service.verificar5Certos('não é json', 'doente-1');

      expect(r.valido).toBe(false);
      expect(r.medicacao).toBeNull();
    });

    it('devolve valido=false quando medicação não existe na BD', async () => {
      const qr = await payloadAssinado();
      mockPrisma.medicacao.findUnique.mockResolvedValue(null);

      const r = await service.verificar5Certos(qr, 'doente-1');

      expect(r.valido).toBe(false);
      expect(r.falhas.some(f => f.certo === 'Medicamento certo')).toBe(true);
    });
  });
});
