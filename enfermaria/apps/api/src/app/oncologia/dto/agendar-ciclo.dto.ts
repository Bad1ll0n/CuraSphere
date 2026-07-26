import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

export class AgendarCicloDto {
  @IsOptional() @IsInt() @Min(1) numero?: number;
  @IsOptional() @IsDateString() dataPrevista?: string;
}
