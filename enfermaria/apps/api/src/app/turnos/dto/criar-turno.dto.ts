import { IsString, IsNotEmpty, IsDateString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum TipoTurnoEnum {
  manha = 'manha',
  tarde = 'tarde',
  noite = 'noite',
}

export class CriarTurnoDto {
  @ApiProperty({ enum: TipoTurnoEnum })
  @IsEnum(TipoTurnoEnum)
  tipo: string;

  @ApiProperty()
  @IsDateString()
  dataInicio: string;

  @ApiProperty()
  @IsDateString()
  dataFim: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  chefeTurnoId: string;
}
