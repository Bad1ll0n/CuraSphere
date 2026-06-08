import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface WidgetLayout {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
}

@Injectable()
export class DashboardConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(userId: string): Promise<WidgetLayout[] | null> {
    const config = await this.prisma.dashboardConfig.findUnique({ where: { userId } });
    if (!config) return null;
    return config.widgets as unknown as WidgetLayout[];
  }

  async saveConfig(userId: string, widgets: WidgetLayout[]): Promise<void> {
    await this.prisma.dashboardConfig.upsert({
      where: { userId },
      create: { userId, widgets: widgets as any },
      update: { widgets: widgets as any },
    });
  }

  async resetConfig(userId: string): Promise<void> {
    await this.prisma.dashboardConfig.deleteMany({ where: { userId } });
  }
}
