import { IsEnum, IsOptional, IsString } from 'class-validator';
import { EstadoPedidoTI } from '../../../generated/prisma';

export class AtualizarPedidoDto {
  @IsEnum(EstadoPedidoTI)
  @IsOptional()
  estado?: EstadoPedidoTI;

  @IsString()
  @IsOptional()
  responsavelId?: string;
}
