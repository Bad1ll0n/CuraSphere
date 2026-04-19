import { IsString, IsEnum, IsBoolean, IsOptional, MinLength } from 'class-validator';
import { TipoPedidoTI } from '../../../generated/prisma';

export class CriarPedidoDto {
  @IsString()
  @MinLength(3)
  titulo: string;

  @IsString()
  @MinLength(10)
  descricao: string;

  @IsEnum(TipoPedidoTI)
  tipo: TipoPedidoTI;

  @IsBoolean()
  @IsOptional()
  urgente?: boolean;
}
