import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class AlterarPasswordDto {
  @IsString()
  @IsNotEmpty()
  passwordAtual: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  novaPassword: string;
}
