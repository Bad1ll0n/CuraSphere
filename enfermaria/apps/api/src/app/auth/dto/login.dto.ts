import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  numeroFuncionario: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200) // SEC-25: sem tecto, um corpo enorme ia inteiro até ao bcrypt
  password: string;
}
