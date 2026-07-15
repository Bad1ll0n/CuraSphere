import { Body, Controller, Delete, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { IsArray, ArrayMinSize, IsString, IsUrl } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { WebhooksService } from './webhooks.service';

class CriarWebhookDto {
  @IsUrl() url!: string;
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) eventos!: string[];
}

@Controller('webhooks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ti', 'direcao')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  criar(@Body() dto: CriarWebhookDto, @Request() req: any) {
    return this.webhooksService.criar({ ...dto, criadoPorId: req.user.sub });
  }

  @Get()
  listar() {
    return this.webhooksService.listar();
  }

  @Delete(':id')
  remover(@Param('id') id: string) {
    return this.webhooksService.remover(id);
  }
}
