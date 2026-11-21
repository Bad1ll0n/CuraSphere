import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/** QA-14 — descontinuar uma prescrição é uma decisão terapêutica: fica o motivo. */
export class DescontinuarMedicacaoDto {
  @ApiProperty({ description: 'Porque se descontinua (ex.: "fim do tratamento", "reação adversa")', minLength: 5 })
  @IsString()
  @MinLength(5, { message: 'Indique o motivo da descontinuação (mínimo 5 caracteres)' })
  @MaxLength(500)
  motivo!: string;
}
