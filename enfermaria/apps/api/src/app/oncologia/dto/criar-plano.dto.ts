import { IsArray, IsInt, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';

export class CriarPlanoDto {
  @IsString() protocoloNome!: string;
  @IsInt() @Min(1) ciclosPrevistos!: number;
  @IsOptional() @IsInt() @Min(1) intervaloDias?: number;
  @IsOptional() @IsNumber() @IsPositive() alturaCm?: number;
  @IsOptional() @IsNumber() @IsPositive() pesoKg?: number;
  // [{ nome, mgPorM2, doseMaximaMg? }] — normalizado/validado no serviço.
  @IsArray() farmacos!: Array<{ nome: string; mgPorM2: number; doseMaximaMg?: number }>;
}
