import { Test, TestingModule } from '@nestjs/testing';
import { LembretesService } from './lembretes.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { MailerService } from '../mailer/mailer.service';

const mockPrisma = {
  tryBecomeLeader: jest.fn().mockResolvedValue(true), // líder por omissão → o corpo do cron corre
  consulta: { findMany: jest.fn(), update: jest.fn().mockResolvedValue({}) },
};
const mockNotificacoes = { enviarParaUtilizador: jest.fn().mockResolvedValue(undefined) };
const mockMailer = { enviar: jest.fn().mockResolvedValue(undefined) };

describe('LembretesService', () => {
  let service: LembretesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.consulta.update.mockResolvedValue({});
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LembretesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificacoesService, useValue: mockNotificacoes },
        { provide: MailerService, useValue: mockMailer },
      ],
    }).compile();
    service = module.get(LembretesService);
  });

  it('sem consultas a lembrar: não notifica ninguém', async () => {
    mockPrisma.consulta.findMany.mockResolvedValue([]);
    await service.enviarLembretes();
    expect(mockNotificacoes.enviarParaUtilizador).not.toHaveBeenCalled();
  });

  it('notifica o médico (push) e o doente (email) e marca lembreteEnviadoEm', async () => {
    mockPrisma.consulta.findMany.mockResolvedValue([
      {
        id: 'c1', especialidade: 'Cardiologia', medicoId: 'med-1', tipo: 'presencial',
        dataHora: new Date('2026-05-01T10:00:00Z'),
        doente: { nome: 'João', portalDoente: { email: 'joao@ex.pt' } },
        medico: { id: 'med-1', nome: 'Dra. Ana' },
      },
    ]);
    await service.enviarLembretes();
    expect(mockNotificacoes.enviarParaUtilizador).toHaveBeenCalledWith('med-1', expect.any(String), expect.stringContaining('Cardiologia'), expect.objectContaining({ consultaId: 'c1' }));
    expect(mockMailer.enviar).toHaveBeenCalledWith(expect.objectContaining({ para: 'joao@ex.pt' }));
    expect(mockPrisma.consulta.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'c1' }, data: expect.objectContaining({ lembreteEnviadoEm: expect.any(Date) }) }));
  });

  it('não envia email quando o doente não tem conta de portal', async () => {
    mockPrisma.consulta.findMany.mockResolvedValue([
      { id: 'c2', especialidade: 'Ortopedia', medicoId: 'med-2', tipo: 'presencial', dataHora: new Date('2026-05-02T09:00:00Z'), doente: { nome: 'Rui', portalDoente: null }, medico: { id: 'med-2', nome: 'Dr. X' } },
    ]);
    await service.enviarLembretes();
    expect(mockMailer.enviar).not.toHaveBeenCalled();
  });
});
