import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RealizarSessaoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  evolucao: string;
}
