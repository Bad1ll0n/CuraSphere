import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { Response } from 'express';

const AZUL_HEADER = 'FF1E40AF';
const BRANCO = 'FFFFFFFF';

@Injectable()
export class ExcelService {
  async enviarXlsx(
    res: Response,
    filename: string,
    titulo: string,
    headers: string[],
    rows: (string | number | null | undefined)[][],
  ): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CuraSphere';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(titulo);

    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: BRANCO } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_HEADER } };
    headerRow.alignment = { horizontal: 'center' };

    for (const row of rows) {
      sheet.addRow(row);
    }

    sheet.columns = headers.map(() => ({ width: 22 }));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  }
}
