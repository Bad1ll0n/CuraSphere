import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';

export class RegistarPartoDto {
  @IsIn(['eutocico', 'cesariana', 'ventosa', 'forceps']) tipo!: string;
  @IsOptional() @IsDateString() dataHora?: string;
  @IsOptional() @IsString() complicacoes?: string;
  @IsOptional() @IsInt() @Min(0) @Max(10) apgar1?: number;
  @IsOptional() @IsInt() @Min(0) @Max(10) apgar5?: number;
  @IsOptional() @IsNumber() @IsPositive() pesoRN?: number; // kg
  @IsOptional() @IsString() sexoRN?: string;
}
