import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class RegistoPartogramaDto {
  @IsOptional() @IsInt() @Min(0) @Max(10) dilatacaoCm?: number; // cm
  @IsOptional() @IsInt() @Min(0) @Max(300) fcFetal?: number; // bpm
  @IsOptional() @IsInt() @Min(0) @Max(10) contracoes10min?: number; // contrações / 10 min
  @IsOptional() @IsInt() @Min(-3) @Max(3) descidaApresentacao?: number; // estação
  @IsOptional() @IsString() notas?: string;
}
