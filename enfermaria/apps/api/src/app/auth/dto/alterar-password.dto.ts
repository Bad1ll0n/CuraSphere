import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class AlterarPasswordDto {
  @IsString()
  @IsNotEmpty()
  passwordAtual: string;

  @IsString()
  // SEC-25: comprimento e não composição (NIST 800-63B); comuns e dados pessoais no serviço.
  @MinLength(12, { message: 'A password deve ter pelo menos 12 caracteres (uma frase curta serve)' })
  @MaxLength(64, { message: 'A password deve ter no máximo 64 caracteres' })
  novaPassword: string;
}
