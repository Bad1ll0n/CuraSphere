import { IsArray, ValidateNested, IsString, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class AtribuicaoTurnoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  doenteId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  enfermeiroId: string;
}

export class AtribuirDoentesTurnoDto {
  @ApiProperty({ type: [AtribuicaoTurnoDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AtribuicaoTurnoDto)
  atribuicoes: AtribuicaoTurnoDto[];
}
