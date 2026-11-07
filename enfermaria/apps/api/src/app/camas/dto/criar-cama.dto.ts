import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsIn, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CriarCamaDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  numero: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  quarto: string;

  // PROD-03: atributos da cama.
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(80) servico?: string;
  @ApiPropertyOptional({ enum: ['masculino', 'feminino'], description: 'Sem valor = enfermaria mista' })
  @IsIn(['masculino', 'feminino']) @IsOptional() sexo?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isolamento?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(80) especialidade?: string;
}
