import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CriarNotaClinicaDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  subjetivo: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  objetivo: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  avaliacao: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  plano: string;
}
