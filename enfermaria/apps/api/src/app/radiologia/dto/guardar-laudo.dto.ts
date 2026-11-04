import { IsOptional, IsString, MinLength } from 'class-validator';

export class GuardarLaudoDto {
  @IsOptional() @IsString() tecnica?: string;
  @IsString() @MinLength(1) achados!: string;
  @IsString() @MinLength(1) conclusao!: string;
}
