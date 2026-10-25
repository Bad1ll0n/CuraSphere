import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EstadoDoente } from '../../common/enums';

export class AtualizarEstadoDto {
  @ApiProperty({ enum: EstadoDoente })
  @IsEnum(EstadoDoente)
  @IsNotEmpty()
  estado: EstadoDoente;
}
