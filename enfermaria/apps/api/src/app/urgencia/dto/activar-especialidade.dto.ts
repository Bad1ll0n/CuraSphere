import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ActivarEspecialidadeDto {
  @ApiProperty({ enum: ['stemi', 'avc', 'trauma'] })
  @IsIn(['stemi', 'avc', 'trauma'])
  tipo: string;
}
