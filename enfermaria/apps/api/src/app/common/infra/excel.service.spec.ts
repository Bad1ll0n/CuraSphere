import { Test, TestingModule } from '@nestjs/testing';
import { ExcelService } from './excel.service';

describe('ExcelService', () => {
  let service: ExcelService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExcelService],
    }).compile();
    service = module.get<ExcelService>(ExcelService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('enviarXlsx()', () => {
    it('escreve workbook e termina response', async () => {
      const chunks: Buffer[] = [];
      const mockRes = {
        setHeader: jest.fn(),
        write: jest.fn((chunk: Buffer) => chunks.push(chunk)),
        end: jest.fn(),
      } as any;

      await service.enviarXlsx(mockRes, 'relatorio.xlsx', 'Relatório', ['Col A', 'Col B'], [['val1', 123], ['val2', null]]);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('relatorio.xlsx'),
      );
      expect(mockRes.end).toHaveBeenCalled();
    });
  });
});
