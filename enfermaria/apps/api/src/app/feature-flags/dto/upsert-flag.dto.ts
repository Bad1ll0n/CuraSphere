import { IsBoolean, IsInt, IsOptional, IsString, Max, Min, MaxLength, IsArray } from 'class-validator';

export class UpsertFlagDto {
  @IsOptional() @IsString() @MaxLength(300) descricao?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(100) rolloutPercent?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) roles?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) servicos?: string[];
}
