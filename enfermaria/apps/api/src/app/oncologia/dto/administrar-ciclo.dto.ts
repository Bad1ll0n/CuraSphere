import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AdministrarCicloDto {
  @IsOptional() @IsInt() @Min(0) @Max(4) toxicidadeGrau?: number; // CTCAE
  @IsOptional() @IsString() notas?: string;
}
