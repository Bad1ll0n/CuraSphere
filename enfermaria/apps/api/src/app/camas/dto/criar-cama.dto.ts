import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CriarCamaDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  numero: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  quarto: string;
}
