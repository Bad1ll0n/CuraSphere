import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejeitarMedicacaoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  motivoRejeicao: string;
}
