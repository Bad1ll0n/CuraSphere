import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChamarTicketDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  balcao: string;
}
