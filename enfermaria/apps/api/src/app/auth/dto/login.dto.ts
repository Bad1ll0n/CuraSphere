import { IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  numeroFuncionario: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
