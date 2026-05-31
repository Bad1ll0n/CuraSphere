import { IsString, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AdministrarMedicacaoDto {
  @ApiPropertyOptional({ description: 'ID do doente — usado para validar "doente certo" nas 5 certas' })
  @IsUUID()
  @IsOptional()
  doenteId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  observacoes?: string;
}
