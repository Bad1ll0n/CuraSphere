import { IsUUID, IsInt, IsOptional, Min } from 'class-validator';

export class AdicionarAtoDto {
  @IsUUID()
  atoId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantidade?: number;
}
