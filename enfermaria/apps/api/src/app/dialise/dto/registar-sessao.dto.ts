import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';

export class RegistarSessaoDto {
  @IsIn(['hemodialise', 'dialise_peritoneal']) modalidade!: string;
  @IsOptional() @IsDateString() data?: string;
  @IsOptional() @IsInt() @Min(1) duracaoMin?: number;
  @IsOptional() @IsNumber() @IsPositive() pesoSecoKg?: number;
  @IsOptional() @IsNumber() @IsPositive() pesoPreKg?: number;
  @IsOptional() @IsNumber() @IsPositive() pesoPosKg?: number;
  @IsOptional() @IsInt() @Min(0) ultrafiltracaoMl?: number;
  @IsOptional() @IsInt() @Min(0) fluxoSangueMlMin?: number;
  @IsOptional() @IsIn(['fistula', 'cateter', 'protese']) acessoVascular?: string;
  @IsOptional() @IsInt() paSistolicaPre?: number;
  @IsOptional() @IsInt() paSistolicaPos?: number;
  @IsOptional() @IsString() complicacoes?: string;
  @IsOptional() @IsString() notas?: string;
}
