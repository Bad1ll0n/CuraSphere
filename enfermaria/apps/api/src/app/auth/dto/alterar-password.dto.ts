import { IsString, IsNotEmpty, MinLength, Matches } from 'class-validator';

export class AlterarPasswordDto {
  @IsString()
  @IsNotEmpty()
  passwordAtual: string;

  @IsString()
  @MinLength(10, { message: 'A password deve ter pelo menos 10 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'A password deve conter pelo menos uma letra maiúscula, uma minúscula e um número',
  })
  novaPassword: string;
}
