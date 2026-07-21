import { IsString, IsOptional, IsInt, Min, Max, MinLength, MaxLength } from 'class-validator';

export class OrientarDto {
  @IsString()
  @MinLength(4)
  @MaxLength(1000)
  sintomas: string;

  @IsOptional() @IsInt() @Min(0) @Max(120) idade?: number;
  @IsOptional() @IsInt() @Min(0) @Max(365) duracaoDias?: number;
}
