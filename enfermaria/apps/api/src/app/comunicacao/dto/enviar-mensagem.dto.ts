import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EnviarMensagemDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  destinatarioId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assunto?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  texto: string;
}
