import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DoenteService } from './doentes.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { AiClinicoService } from '../ai-clinico/ai-clinico.service';
import { StorageService } from '../common/storage.service';
import { ConfigService } from '@nestjs/config';
import { TenantContextService } from '../prisma/tenant-context.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { BreakGlassService } from '../break-glass/break-glass.service';

const mockPrisma = {
  $transaction: jest.fn(),
  doente: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  cama: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  alertaClinico: {
    count: jest.fn(),
  },
  ficheiroPessoalDoente: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  atribuicaoDoente: {
    findFirst: jest.fn(),
  },
  atribuicaoHorarioTurno: {
    findFirst: jest.fn(),
  },
  horarioTurnoProfissional: {
    findFirst: jest.fn(),
  },
  notaTurno: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  tarefa: { create: jest.fn() },
  planoAlta: { upsert: jest.fn().mockResolvedValue({}) },
  followUpAgendado: {
    createMany: jest.fn().mockResolvedValue({ count: 2 }),
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  sumarioAlta: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  utilizador: {
    findFirst: jest.fn(),
  },
  problemaClinico: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockNotificacoes = {
  criarNotificacao: jest.fn(),
  notificarRoleNaEnfermaria: jest.fn(),
  enviarParaUtilizador: jest.fn().mockResolvedValue(undefined),
  enviarParaRole: jest.fn().mockResolvedValue(undefined),
};

const mockAiClinico = {
  analisar: jest.fn().mockResolvedValue({ observacoes: [] }),
  gerarCartaAlta: jest.fn().mockResolvedValue({}),
  calcularRiscoReadmissao: jest.fn().mockResolvedValue({}),
};
const mockStorage = {
  upload: jest.fn().mockResolvedValue({ key: 'test-key' }),
  uploadFoto: jest.fn().mockResolvedValue('https://example.com/foto.jpg'),
  deleteFoto: jest.fn().mockResolvedValue(undefined),
  getSignedUrl: jest.fn().mockResolvedValue('https://presigned.url'),
  getPresignedUrl: jest.fn().mockResolvedValue('https://presigned.url'),
};
const mockConfig = { get: jest.fn().mockReturnValue('test-value') };

describe('DoenteService', () => {
  let service: DoenteService;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockPrisma.$transaction.mockImplementation((arg: any) => {
      if (typeof arg === 'function') return arg(mockPrisma);
      return Promise.all(arg);
    });
    mockPrisma.planoAlta.upsert.mockResolvedValue({});
    mockPrisma.followUpAgendado.createMany.mockResolvedValue({ count: 2 });
    mockPrisma.followUpAgendado.findMany.mockResolvedValue([]);
    mockNotificacoes.enviarParaUtilizador.mockResolvedValue(undefined);
    mockNotificacoes.enviarParaRole.mockResolvedValue(undefined);
    mockAiClinico.gerarCartaAlta.mockResolvedValue({});
    mockAiClinico.calcularRiscoReadmissao.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DoenteService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificacoesService, useValue: mockNotificacoes },
        { provide: AiClinicoService, useValue: mockAiClinico },
        { provide: StorageService, useValue: mockStorage },
        { provide: ConfigService, useValue: mockConfig },
        { provide: TenantContextService, useValue: { tenantId: 'default', run: (_id: string, fn: () => unknown) => fn() } },
        { provide: WebhooksService, useValue: { dispatcharEvento: jest.fn().mockResolvedValue(undefined) } },
        { provide: BreakGlassService, useValue: { ativar: jest.fn().mockResolvedValue(undefined), verificarAtivoParaDoente: jest.fn().mockResolvedValue(false) } },
      ],
    }).compile();

    service = module.get<DoenteService>(DoenteService);
  });

  // ── dadosQuiosque() — S-05 ───────────────────────────────────────────────────

  describe('dadosQuiosque()', () => {
    beforeEach(() => {
      mockPrisma.cama.findMany.mockResolvedValue([
        { estado: 'ocupada' }, { estado: 'ocupada' }, { estado: 'livre' }, { estado: 'em_limpeza' },
      ]);
      mockPrisma.alertaClinico.count.mockResolvedValue(2);
      mockPrisma.doente.findMany.mockResolvedValue([
        { sinaisVitais: [{ news2: 1 }] },
        { sinaisVitais: [{ news2: 7 }] },
        { sinaisVitais: [] }, // sem NEWS2 nas últimas 12 horas
      ]);
    });

    it('conta os alertas urgentes por acusar, pelos campos que existem', async () => {
      const r = await service.dadosQuiosque('internamento');

      expect(r.alertasCriticosCount).toBe(2);
      expect(mockPrisma.alertaClinico.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ urgencia: true, acusadoEm: null }),
      });
    });

    it('distribui o NEWS2 por doente e deixa de fora quem não tem avaliação recente', async () => {
      const r = await service.dadosQuiosque('internamento');

      expect(r.news2Counts).toEqual({ normal: 1, medio: 0, alto: 0, critico: 1 });
    });

    it('conta as camas por estado', async () => {
      const r = await service.dadosQuiosque('internamento');

      expect(r).toMatchObject({ camasTotal: 4, camasOcupadas: 2, camasLivres: 1, camasLimpeza: 1 });
    });

    it('uma falha na base de dados não se disfarça de "zero alertas"', async () => {
      mockPrisma.alertaClinico.count.mockRejectedValue(new Error('coluna inexistente'));

      await expect(service.dadosQuiosque('internamento')).rejects.toThrow('coluna inexistente');
    });
  });

  // ── admitir() ────────────────────────────────────────────────────────────────

  describe('admitir()', () => {
    const dadosBase = {
      nome: 'Maria Teste',
      dataNascimento: new Date('1990-01-01'),
      diagnosticoPrincipal: 'Pneumonia',
      camaId: 'cama-1',
      administrativoAdmissaoId: 'admin-1',
    };

    it('lança NotFoundException quando a cama não existe', async () => {
      mockPrisma.cama.findUnique.mockResolvedValue(null);

      await expect(service.admitir(dadosBase)).rejects.toThrow(NotFoundException);
    });

    it('lança BadRequestException quando a cama está ocupada', async () => {
      mockPrisma.cama.findUnique.mockResolvedValue({ id: 'cama-1', estado: 'ocupada' });

      await expect(service.admitir(dadosBase)).rejects.toThrow(BadRequestException);
    });

    it('lança BadRequestException quando a cama está em limpeza', async () => {
      mockPrisma.cama.findUnique.mockResolvedValue({ id: 'cama-1', estado: 'em_limpeza' });

      await expect(service.admitir(dadosBase)).rejects.toThrow(BadRequestException);
    });

    it('aceita cama com estado reservada', async () => {
      mockPrisma.cama.findUnique.mockResolvedValue({ id: 'cama-1', estado: 'reservada' });
      mockPrisma.ficheiroPessoalDoente.findFirst.mockResolvedValue(null);
      mockPrisma.doente.findFirst.mockResolvedValue(null);
      mockPrisma.doente.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'doente-1', ...data, cama: {} }),
      );
      mockPrisma.cama.update.mockResolvedValue({});

      await expect(service.admitir(dadosBase)).resolves.toBeDefined();
    });

    it('lança ConflictException quando NIF já está registado', async () => {
      mockPrisma.cama.findUnique.mockResolvedValue({ id: 'cama-1', estado: 'livre' });
      mockPrisma.ficheiroPessoalDoente.findFirst.mockResolvedValue({ id: 'ficha-1', nif: '123456789' });

      await expect(service.admitir({ ...dadosBase, nif: '123456789' })).rejects.toThrow(ConflictException);
    });

    it('lança ConflictException quando número SNS já está registado', async () => {
      mockPrisma.cama.findUnique.mockResolvedValue({ id: 'cama-1', estado: 'livre' });
      mockPrisma.ficheiroPessoalDoente.findFirst
        .mockResolvedValueOnce({ id: 'ficha-1', numeroSNS: '111222333444' });

      await expect(service.admitir({ ...dadosBase, numeroSNS: '111222333444' })).rejects.toThrow(ConflictException);
    });

    it('cria doente e marca cama como ocupada em caso de sucesso', async () => {
      mockPrisma.cama.findUnique.mockResolvedValue({ id: 'cama-1', estado: 'livre' });
      mockPrisma.ficheiroPessoalDoente.findFirst.mockResolvedValue(null);
      mockPrisma.doente.findFirst.mockResolvedValue(null);
      mockPrisma.doente.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'doente-1', ...data, cama: {} }),
      );
      mockPrisma.cama.update.mockResolvedValue({});

      const resultado = await service.admitir(dadosBase);

      expect(mockPrisma.doente.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.cama.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'cama-1' }, data: { estado: 'ocupada' } }),
      );
      expect(resultado).toMatchObject({ nome: 'Maria Teste' });
    });

    it('gera numeroProcesso YYYY-00000001 para o primeiro doente do ano', async () => {
      mockPrisma.cama.findUnique.mockResolvedValue({ id: 'cama-1', estado: 'livre' });
      mockPrisma.ficheiroPessoalDoente.findFirst.mockResolvedValue(null);
      mockPrisma.doente.findFirst.mockResolvedValue(null);
      mockPrisma.doente.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'doente-1', ...data, cama: {} }),
      );
      mockPrisma.cama.update.mockResolvedValue({});

      await service.admitir(dadosBase);

      const ano = new Date().getFullYear();
      const criado = mockPrisma.doente.create.mock.calls[0][0];
      expect(criado.data.numeroProcesso).toBe(`${ano}-00000001`);
    });

    it('incrementa numeroProcesso quando já existe registo no ano corrente', async () => {
      const ano = new Date().getFullYear();
      mockPrisma.cama.findUnique.mockResolvedValue({ id: 'cama-1', estado: 'livre' });
      mockPrisma.ficheiroPessoalDoente.findFirst.mockResolvedValue(null);
      mockPrisma.doente.findFirst.mockResolvedValue({ numeroProcesso: `${ano}-00000042` });
      mockPrisma.doente.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'doente-2', ...data, cama: {} }),
      );
      mockPrisma.cama.update.mockResolvedValue({});

      await service.admitir(dadosBase);

      const criado = mockPrisma.doente.create.mock.calls[0][0];
      expect(criado.data.numeroProcesso).toBe(`${ano}-00000043`);
    });

    it('cria ficheiro pessoal quando dados opcionais são fornecidos', async () => {
      mockPrisma.cama.findUnique.mockResolvedValue({ id: 'cama-1', estado: 'livre' });
      mockPrisma.ficheiroPessoalDoente.findFirst.mockResolvedValue(null);
      mockPrisma.doente.findFirst.mockResolvedValue(null);
      mockPrisma.doente.create.mockResolvedValue({ id: 'doente-1', cama: {} });
      mockPrisma.cama.update.mockResolvedValue({});
      mockPrisma.ficheiroPessoalDoente.create.mockResolvedValue({});

      await service.admitir({ ...dadosBase, nif: '987654321', telefone: '912345678' });

      expect(mockPrisma.ficheiroPessoalDoente.create).toHaveBeenCalledTimes(1);
    });
  });

  // ── darAlta() ────────────────────────────────────────────────────────────────

  describe('darAlta()', () => {
    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);

      await expect(service.darAlta('id-inexistente', 'admin-1')).rejects.toThrow(NotFoundException);
    });

    it('marca doente como inativo e cama em limpeza', async () => {
      const doente = { id: 'doente-1', nome: 'João', camaId: 'cama-1', ativo: true };
      mockPrisma.doente.findUnique.mockResolvedValue(doente);
      mockPrisma.doente.update.mockResolvedValue({ ...doente, ativo: false });
      mockPrisma.cama.update.mockResolvedValue({ id: 'cama-1', estado: 'em_limpeza' });

      const resultado = await service.darAlta('doente-1', 'admin-1');

      expect(resultado).toMatchObject({ mensagem: 'Alta registada com sucesso' });
      expect(mockPrisma.doente.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'doente-1' },
          data: expect.objectContaining({ ativo: false }),
        }),
      );
      expect(mockPrisma.cama.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { estado: 'em_limpeza' } }),
      );
    });

    it('liberta o vínculo doente→cama na alta (camaId=null)', async () => {
      const doente = { id: 'doente-1', nome: 'João', camaId: 'cama-1', ativo: true };
      mockPrisma.doente.findUnique.mockResolvedValue(doente);
      mockPrisma.doente.update.mockResolvedValue({ ...doente, ativo: false, camaId: null });
      mockPrisma.cama.update.mockResolvedValue({ id: 'cama-1', estado: 'em_limpeza' });

      await service.darAlta('doente-1', 'admin-1');

      expect(mockPrisma.doente.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'doente-1' },
          data: expect.objectContaining({ ativo: false, camaId: null }),
        }),
      );
    });

    it('alta → readmissão na mesma cama: a cama deixa de estar presa ao doente anterior', async () => {
      // 1. Alta do doente que ocupa a cama-1.
      const anterior = { id: 'doente-1', nome: 'João', camaId: 'cama-1', ativo: true };
      mockPrisma.doente.findUnique.mockResolvedValue(anterior);
      mockPrisma.doente.update.mockResolvedValue({ ...anterior, ativo: false, camaId: null });
      mockPrisma.cama.update.mockResolvedValue({ id: 'cama-1', estado: 'em_limpeza' });

      await service.darAlta('doente-1', 'admin-1');

      const dadosAlta = mockPrisma.doente.update.mock.calls[0][0].data;
      expect(dadosAlta.camaId).toBeNull(); // sem isto o passo 2 violaria o @unique de camaId

      // 2. A mesma cama, já limpa, é usada para admitir outro doente.
      jest.clearAllMocks();
      mockPrisma.cama.findUnique.mockResolvedValue({ id: 'cama-1', estado: 'livre' });
      mockPrisma.doente.findFirst.mockResolvedValue(null);
      mockPrisma.doente.create.mockResolvedValue({ id: 'doente-2', nome: 'Maria', camaId: 'cama-1' });
      mockPrisma.cama.update.mockResolvedValue({ id: 'cama-1', estado: 'ocupada' });

      const novo = await service.admitir({
        nome: 'Maria',
        dataNascimento: '1950-01-01',
        camaId: 'cama-1',
        administrativoAdmissaoId: 'admin-1',
      } as never);

      expect(novo).toMatchObject({ id: 'doente-2', camaId: 'cama-1' });
      expect(mockPrisma.doente.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ camaId: 'cama-1' }) }),
      );
    });

    it('não actualiza cama quando doente não tem cama atribuída', async () => {
      const doente = { id: 'doente-1', nome: 'João', camaId: null, ativo: true };
      mockPrisma.doente.findUnique.mockResolvedValue(doente);
      mockPrisma.doente.update.mockResolvedValue({ ...doente, ativo: false });

      await service.darAlta('doente-1', 'admin-1');

      expect(mockPrisma.cama.update).not.toHaveBeenCalled();
    });

    it('agenda follow-ups quando há médico disponível', async () => {
      const doente = { id: 'doente-1', nome: 'Maria', camaId: null, ativo: true };
      mockPrisma.doente.findUnique.mockResolvedValue(doente);
      mockPrisma.doente.update.mockResolvedValue({});
      mockPrisma.utilizador.findFirst.mockResolvedValue({ id: 'medico-1', nome: 'Dr. Silva' });
      mockPrisma.followUpAgendado.createMany.mockResolvedValue({ count: 2 });

      await service.darAlta('doente-1', 'admin-1');
      // Flush fire-and-forget
      await Promise.resolve();
      await Promise.resolve();

      expect(mockPrisma.followUpAgendado.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.arrayContaining([expect.objectContaining({ tipo: '7_dias' })]) }),
      );
    });

    it('não agenda follow-ups quando não há médico disponível', async () => {
      const doente = { id: 'doente-1', nome: 'Maria', camaId: null, ativo: true };
      mockPrisma.doente.findUnique.mockResolvedValue(doente);
      mockPrisma.doente.update.mockResolvedValue({});
      mockPrisma.utilizador.findFirst.mockResolvedValue(null);

      await service.darAlta('doente-1', 'admin-1');
      await Promise.resolve();
      await Promise.resolve();

      expect(mockPrisma.followUpAgendado.createMany).not.toHaveBeenCalled();
    });
  });

  // ── SEC-08: upload da foto do doente ─────────────────────────────────────────

  describe('uploadFoto()', () => {
    const jpegValido = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.alloc(20)]);
    const pngValido = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47]), Buffer.alloc(20)]);

    const ficheiro = (over: Record<string, unknown> = {}) => ({
      buffer: jpegValido, mimetype: 'image/jpeg', size: jpegValido.length, originalname: 'f.jpg', ...over,
    }) as never;

    beforeEach(() => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1', ativo: true });
      mockPrisma.doente.update.mockResolvedValue({ id: 'doente-1', fotoUrl: 'https://presigned.url' });
      mockStorage.upload.mockResolvedValue({ key: 'doentes/doente-1/foto_1.jpg' });
      mockStorage.getSignedUrl.mockResolvedValue('https://presigned.url');
    });

    it('aceita JPEG válido e guarda o URL', async () => {
      const r: any = await service.uploadFoto('doente-1', ficheiro(), 'admin-1', 'direcao');
      expect(r.fotoUrl).toBe('https://presigned.url');
    });

    it('rejeita ficheiro em falta', async () => {
      await expect(
        service.uploadFoto('doente-1', undefined as never, 'admin-1', 'direcao'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita tipo não permitido', async () => {
      await expect(
        service.uploadFoto('doente-1', ficheiro({ mimetype: 'application/pdf' }), 'admin-1', 'direcao'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita ficheiro acima do limite de tamanho', async () => {
      await expect(
        service.uploadFoto('doente-1', ficheiro({ size: 20 * 1024 * 1024 }), 'admin-1', 'direcao'),
      ).rejects.toThrow(BadRequestException);
    });

    // O mimetype é declarado pelo cliente — só os magic bytes dizem o que o ficheiro é.
    it('rejeita executável disfarçado de imagem', async () => {
      const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(30)]);
      await expect(
        service.uploadFoto('doente-1', ficheiro({ buffer: exe, size: exe.length }), 'admin-1', 'direcao'),
      ).rejects.toThrow(BadRequestException);
      expect(mockStorage.upload).not.toHaveBeenCalled();
    });

    it('rejeita PNG declarado como JPEG', async () => {
      await expect(
        service.uploadFoto('doente-1', ficheiro({ buffer: pngValido }), 'admin-1', 'direcao'),
      ).rejects.toThrow(BadRequestException);
    });

    it('usa a extensão real do ficheiro na chave de armazenamento', async () => {
      await service.uploadFoto(
        'doente-1',
        ficheiro({ buffer: pngValido, mimetype: 'image/png', size: pngValido.length }),
        'admin-1', 'direcao',
      );
      expect(mockStorage.upload).toHaveBeenCalledWith(
        expect.any(Buffer), expect.stringMatching(/\.png$/), 'image/png',
      );
    });
  });

  // ── buscarPorId() ────────────────────────────────────────────────────────────

  describe('buscarPorId()', () => {
    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);

      await expect(service.buscarPorId('id-inexistente')).rejects.toThrow(NotFoundException);
    });

    it('devolve o doente quando encontrado', async () => {
      const doente = { id: 'doente-1', nome: 'Ana' };
      mockPrisma.doente.findUnique.mockResolvedValue(doente);

      await expect(service.buscarPorId('doente-1')).resolves.toMatchObject({ id: 'doente-1' });
    });
  });

  // ── assertAcessoDoente() ──────────────────────────────────────────────────────

  describe('assertAcessoDoente()', () => {
    it('retorna sem erro para role de oversight (direcao)', async () => {
      await expect(service.assertAcessoDoente('user-1', 'direcao', 'doente-1')).resolves.toBeUndefined();
      expect(mockPrisma.doente.findUnique).not.toHaveBeenCalled();
    });

    it('lança NotFoundException quando doente não existe para role clínico', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);

      await expect(service.assertAcessoDoente('user-1', 'medico', 'doente-x')).rejects.toThrow(NotFoundException);
    });

    it('retorna sem erro quando existe atribuição directa', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1' });
      mockPrisma.atribuicaoDoente.findFirst.mockResolvedValue({ id: 'atrib-1' });

      await expect(service.assertAcessoDoente('user-1', 'enfermeiro', 'doente-1')).resolves.toBeUndefined();
    });

    it('retorna sem erro quando existe atribuição via turno', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1' });
      mockPrisma.atribuicaoDoente.findFirst.mockResolvedValue(null);
      mockPrisma.atribuicaoHorarioTurno.findFirst.mockResolvedValue({ id: 'turno-atrib-1' });

      await expect(service.assertAcessoDoente('user-1', 'medico', 'doente-1')).resolves.toBeUndefined();
    });

    it('lança ForbiddenException sem nenhuma atribuição', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1' });
      mockPrisma.atribuicaoDoente.findFirst.mockResolvedValue(null);
      mockPrisma.atribuicaoHorarioTurno.findFirst.mockResolvedValue(null);

      await expect(service.assertAcessoDoente('user-1', 'enfermeiro', 'doente-1')).rejects.toThrow(ForbiddenException);
    });
  });

  // ── listar() ─────────────────────────────────────────────────────────────────

  describe('listar()', () => {
    beforeEach(() => {
      mockPrisma.doente.findMany.mockResolvedValue([]);
      mockPrisma.doente.count.mockResolvedValue(0);
    });

    it('não filtra por atribuições para role não-clínico (ti)', async () => {
      await service.listar('user-1', 'ti');

      const callArgs = mockPrisma.doente.findMany.mock.calls[0][0];
      expect(callArgs.where).not.toHaveProperty('atribuicoesHorario');
    });

    it('não filtra por atribuições para role clínico com search', async () => {
      await service.listar('user-1', 'enfermeiro', 1, 25, 'maria');

      const callArgs = mockPrisma.doente.findMany.mock.calls[0][0];
      expect(callArgs.where).not.toHaveProperty('atribuicoesHorario');
    });

    it('filtra por turnos activos para role clínico sem search', async () => {
      await service.listar('user-1', 'enfermeiro');

      const callArgs = mockPrisma.doente.findMany.mock.calls[0][0];
      expect(callArgs.where).toHaveProperty('atribuicoesHorario');
    });

    it('limita o resultado a 100 quando limit=500 é pedido', async () => {
      await service.listar('user-1', 'ti', 1, 500);

      const callArgs = mockPrisma.doente.findMany.mock.calls[0][0];
      expect(callArgs.take).toBeLessThanOrEqual(100);
    });
  });

  // ── editar() ──────────────────────────────────────────────────────────────────

  describe('editar()', () => {
    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);

      await expect(service.editar('id-x', { diagnosticoPrincipal: 'Gripe' })).rejects.toThrow(NotFoundException);
    });

    it('actualiza diagnosticoPrincipal', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1', nome: 'Ana' });
      mockPrisma.doente.update.mockResolvedValue({ id: 'doente-1', diagnosticoPrincipal: 'Gripe' });

      await service.editar('doente-1', { diagnosticoPrincipal: 'Gripe' });

      expect(mockPrisma.doente.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'doente-1' },
          data: expect.objectContaining({ diagnosticoPrincipal: 'Gripe' }),
        }),
      );
    });

    it('aceita dataAltaPrevista como null', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1', nome: 'Ana' });
      mockPrisma.doente.update.mockResolvedValue({ id: 'doente-1', dataAltaPrevista: null });

      await service.editar('doente-1', { dataAltaPrevista: null });

      expect(mockPrisma.doente.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ dataAltaPrevista: null }),
        }),
      );
    });
  });

  // ── atualizarEstado() ─────────────────────────────────────────────────────────

  describe('atualizarEstado()', () => {
    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);

      await expect(service.atualizarEstado('id-x', 'critico' as any)).rejects.toThrow(NotFoundException);
    });

    it('actualiza estado do doente', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1', nome: 'Ana' });
      mockPrisma.doente.update.mockResolvedValue({ id: 'doente-1', estado: 'critico' });

      await service.atualizarEstado('doente-1', 'critico' as any);

      expect(mockPrisma.doente.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'doente-1' },
          data: { estado: 'critico' },
        }),
      );
    });
  });

  // ── adicionarNota() ───────────────────────────────────────────────────────────

  describe('adicionarNota()', () => {
    it('lança ForbiddenException quando não há turno activo', async () => {
      mockPrisma.horarioTurnoProfissional.findFirst.mockResolvedValue(null);

      await expect(service.adicionarNota('doente-1', 'user-1', 'texto da nota')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.horarioTurnoProfissional.findFirst.mockResolvedValue({ id: 'turno-1' });
      mockPrisma.doente.findUnique.mockResolvedValue(null);

      await expect(service.adicionarNota('doente-x', 'user-1', 'texto')).rejects.toThrow(NotFoundException);
    });

    it('cria nota quando turno está activo e doente existe', async () => {
      mockPrisma.horarioTurnoProfissional.findFirst.mockResolvedValue({ id: 'turno-1' });
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1', nome: 'Ana' });
      mockPrisma.notaTurno.create.mockResolvedValue({
        id: 'nota-1', doenteId: 'doente-1', autorId: 'user-1', texto: 'texto da nota',
        autor: { id: 'user-1', nome: 'Dr. Teste', role: 'medico' },
      });

      const resultado = await service.adicionarNota('doente-1', 'user-1', 'texto da nota');

      expect(mockPrisma.notaTurno.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { doenteId: 'doente-1', autorId: 'user-1', texto: 'texto da nota' },
        }),
      );
      expect(resultado).toHaveProperty('id', 'nota-1');
    });
  });

  // ── editarNota() ──────────────────────────────────────────────────────────────

  describe('editarNota()', () => {
    beforeEach(() => {
      // turno ativo por defeito
      mockPrisma.horarioTurnoProfissional.findFirst.mockResolvedValue({ id: 'turno-1' });
    });

    it('lança NotFoundException quando nota não existe', async () => {
      mockPrisma.notaTurno.findUnique.mockResolvedValue(null);

      await expect(service.editarNota('nota-x', 'user-1', 'novo texto')).rejects.toThrow(NotFoundException);
    });

    it('lança ForbiddenException quando utilizador não é o autor', async () => {
      mockPrisma.notaTurno.findUnique.mockResolvedValue({
        id: 'nota-1', autorId: 'outro-user', criadaEm: new Date(),
      });

      await expect(service.editarNota('nota-1', 'user-1', 'novo texto')).rejects.toThrow(
        /Sem permissão para editar/i,
      );
    });

    it('lança ForbiddenException quando nota está fora da janela do turno', async () => {
      // Nota criada há 11 horas → fora da janela de 10 h
      const notaAntiga = new Date(Date.now() - 11 * 60 * 60 * 1000);
      mockPrisma.notaTurno.findUnique.mockResolvedValue({
        id: 'nota-1', autorId: 'user-1', criadaEm: notaAntiga,
      });

      await expect(service.editarNota('nota-1', 'user-1', 'novo texto')).rejects.toThrow(
        /turno já passou/i,
      );
    });

    it('actualiza nota quando autor e janela são válidos', async () => {
      mockPrisma.notaTurno.findUnique.mockResolvedValue({
        id: 'nota-1', autorId: 'user-1', criadaEm: new Date(),
      });
      mockPrisma.notaTurno.update.mockResolvedValue({
        id: 'nota-1', texto: 'novo texto', autor: { id: 'user-1', nome: 'Dr.', role: 'medico' },
      });

      const resultado = await service.editarNota('nota-1', 'user-1', 'novo texto');

      expect(mockPrisma.notaTurno.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'nota-1' },
          data: { texto: 'novo texto' },
        }),
      );
      expect(resultado).toHaveProperty('id', 'nota-1');
    });
  });

  // ── altaEstruturada() ─────────────────────────────────────────────────────────

  describe('altaEstruturada()', () => {
    it('lança ForbiddenException para role enfermeiro', async () => {
      await expect(
        service.altaEstruturada('doente-1', 'user-1', 'enfermeiro', { motivoAlta: 'Recuperado', resumoClinical: 'OK' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);

      await expect(
        service.altaEstruturada('doente-x', 'medico-1', 'medico', { motivoAlta: 'Recuperado', resumoClinical: 'OK' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('cria sumário de alta e liberta cama quando doente tem camaId', async () => {
      const doente = { id: 'doente-1', nome: 'João', camaId: 'cama-1' };
      mockPrisma.doente.findUnique.mockResolvedValue(doente);
      mockPrisma.sumarioAlta.create.mockResolvedValue({ id: 'sumario-1', doenteId: 'doente-1' });
      mockPrisma.doente.update.mockResolvedValue({});
      mockPrisma.cama.update.mockResolvedValue({ id: 'cama-1', quarto: 'A', numero: '101' });

      const resultado = await service.altaEstruturada('doente-1', 'medico-1', 'medico', {
        motivoAlta: 'Recuperado', resumoClinical: 'Bom estado',
      });

      expect(mockPrisma.sumarioAlta.create).toHaveBeenCalled();
      expect(mockPrisma.cama.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { estado: 'em_limpeza' } }),
      );
      expect(resultado).toHaveProperty('id', 'sumario-1');
    });
  });

  // ── exportarCsv() ─────────────────────────────────────────────────────────────

  describe('exportarCsv()', () => {
    it('retorna string com cabeçalhos CSV correctos', async () => {
      mockPrisma.doente.findMany.mockResolvedValue([]);

      const csv = await service.exportarCsv();

      expect(typeof csv).toBe('string');
      expect(csv).toContain('Nome');
      expect(csv).toContain('Diagnóstico');
    });

    it('inclui linha de dados para cada doente activo', async () => {
      mockPrisma.doente.findMany.mockResolvedValue([
        { id: 'd1', nome: 'Maria Silva', diagnosticoPrincipal: 'Pneumonia', estado: 'estavel', cama: null, dataAdmissao: new Date('2025-01-01') },
      ]);

      const csv = await service.exportarCsv();

      expect(csv).toContain('Maria Silva');
      expect(csv).toContain('Pneumonia');
    });
  });

  // ── criarProblema() / atualizarProblema() ─────────────────────────────────────

  describe('criarProblema()', () => {
    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);

      await expect(
        service.criarProblema('doente-x', { descricao: 'HTA' }, 'medico-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('cria problema clínico quando doente existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1' });
      mockPrisma.problemaClinico.create.mockResolvedValue({
        id: 'problema-1', doenteId: 'doente-1', descricao: 'HTA',
        registadoPor: { nome: 'Dr.', role: 'medico' },
      });

      const resultado = await service.criarProblema('doente-1', { descricao: 'HTA' }, 'medico-1');

      expect(mockPrisma.problemaClinico.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ doenteId: 'doente-1', descricao: 'HTA' }),
        }),
      );
      expect(resultado).toHaveProperty('id', 'problema-1');
    });
  });

  describe('atualizarProblema()', () => {
    it('lança NotFoundException quando problema não existe', async () => {
      mockPrisma.problemaClinico.findUnique.mockResolvedValue(null);

      await expect(
        service.atualizarProblema('doente-1', 'problema-x', { estado: 'resolvido' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança ForbiddenException quando problema não pertence ao doente', async () => {
      mockPrisma.problemaClinico.findUnique.mockResolvedValue({
        id: 'problema-1', doenteId: 'outro-doente',
      });

      await expect(
        service.atualizarProblema('doente-1', 'problema-1', { estado: 'resolvido' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('actualiza estado do problema clínico', async () => {
      mockPrisma.problemaClinico.findUnique.mockResolvedValue({
        id: 'problema-1', doenteId: 'doente-1',
      });
      mockPrisma.problemaClinico.update.mockResolvedValue({
        id: 'problema-1', estado: 'resolvido',
        registadoPor: { nome: 'Dr.', role: 'medico' },
      });

      await service.atualizarProblema('doente-1', 'problema-1', { estado: 'resolvido' });

      expect(mockPrisma.problemaClinico.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'problema-1' },
          data: expect.objectContaining({ estado: 'resolvido' }),
        }),
      );
    });
  });
});
