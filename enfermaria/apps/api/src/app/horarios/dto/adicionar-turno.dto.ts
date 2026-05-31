import { IsString, IsDateString, IsArray, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdicionarTurnoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tipo: string;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  data: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  profissionaisIds: string[];
}
