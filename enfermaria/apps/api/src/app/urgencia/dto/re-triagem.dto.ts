import { IsIn, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReTriagemDto {
  @ApiProperty({ enum: ['verde', 'amarelo', 'laranja', 'vermelho', 'azul'] })
  @IsIn(['verde', 'amarelo', 'laranja', 'vermelho', 'azul'])
  novaTriagem: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  motivo: string;
}
