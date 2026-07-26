import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CalcularDoseDto {
  // Se fornecido e sem pesoKg, usa-se o último peso registado do doente.
  @IsOptional() @IsString() doenteId?: string;

  @IsNumber() @IsPositive() mgPorKg!: number;

  @IsOptional() @IsNumber() @IsPositive() pesoKg?: number;

  @IsOptional() @IsNumber() @IsPositive() doseMaximaMg?: number;

  @IsOptional() @IsNumber() @IsPositive() frequenciaDia?: number;
}
