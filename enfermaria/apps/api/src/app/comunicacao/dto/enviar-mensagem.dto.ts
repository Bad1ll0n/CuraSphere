import { IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EnviarMensagemDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  destinatarioId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  assunto?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(10000)
  texto: string;
}
