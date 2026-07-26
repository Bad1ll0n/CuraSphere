import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CriarGravidezDto {
  @IsOptional() @IsDateString() dataUltimaMenstruacao?: string; // DUM
  @IsOptional() @IsDateString() dataPrevistaParto?: string; // DPP — calculada da DUM se omitida
  @IsOptional() @IsInt() @Min(0) gravida?: number; // G
  @IsOptional() @IsInt() @Min(0) para?: number; // P
  @IsOptional() @IsString() grupoSanguineo?: string;
  @IsOptional() @IsString() fatoresRisco?: string;
}
