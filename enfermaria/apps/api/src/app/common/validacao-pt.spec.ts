import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsIn, IsInt,
  IsNotEmpty, IsNumber, IsObject, IsOptional, IsPositive, IsString, IsUrl, IsUUID, Length,
  Matches, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';
import { excecaoValidacao, traduzirMensagemValidacao } from './validacao-pt';

enum Cor { Verde = 'verde', Azul = 'azul' }

class Filho {
  @IsInt() @Min(1) quantidade!: number;
}

class Todos {
  @Min(0) pressaoSistolica!: number;
  @Max(100) saturacaoO2!: number;
  @IsString() @MaxLength(3) curto!: string;
  @MinLength(12) password!: string;
  @IsNotEmpty() obrigatorio!: string;
  @IsNumber() numero!: number;
  @IsInt() inteiro!: number;
  @IsPositive() positivo!: number;
  @IsBoolean() booleano!: boolean;
  @IsDateString() data!: string;
  @IsIn(['a', 'b']) opcao!: string;
  @IsEnum(Cor) cor!: string;
  @IsObject() objeto!: unknown;
  @IsArray() lista!: unknown;
  @IsUUID() id!: string;
  @IsEmail() email!: string;
  @IsUrl() url!: string;
  @Matches(/^\d{9}$/) nif!: string;
  @ArrayMaxSize(1) poucos!: string[];
  @ArrayMinSize(2) muitos!: string[];
  @Length(2, 4) codigo!: string;
  @IsString({ each: true }) etiquetas!: unknown[];
  @IsOptional() @IsString({ message: 'Motivo obrigatório para descontinuar' }) motivo?: unknown;
  @ValidateNested({ each: true }) @Type(() => Filho) linhas!: Filho[];
}

const pipe = new ValidationPipe({
  whitelist: true, forbidNonWhitelisted: true, transform: true, exceptionFactory: excecaoValidacao,
});

async function mensagens(corpo: Record<string, unknown>): Promise<string[]> {
  try {
    await pipe.transform(corpo, { type: 'body', metatype: Todos });
  } catch (e) {
    expect(e).toBeInstanceOf(BadRequestException);
    return ((e as BadRequestException).getResponse() as { message: string[] }).message;
  }
  throw new Error('esperava uma falha de validação');
}

describe('validacao-pt (QA-17)', () => {
  it('nenhuma mensagem por omissão do class-validator chega em inglês', async () => {
    const msgs = await mensagens({
      pressaoSistolica: -5, saturacaoO2: 120, curto: 'abcdef', password: 'x', obrigatorio: '',
      numero: 'x', inteiro: 1.5, positivo: -1, booleano: 'sim', data: 'ontem', opcao: 'z', cor: 'roxo',
      objeto: 3, lista: 3, id: '123', email: 'nao', url: 'nao', nif: '12', poucos: ['a', 'b'],
      muitos: ['a'], codigo: 'x', etiquetas: [1], motivo: 3, linhas: [{ quantidade: 0 }],
      intruso: 'x',
    });
    for (const m of msgs) expect(m).not.toMatch(/\b(must|should|property|each value)\b/);
    expect(msgs).toEqual(expect.arrayContaining([
      'pressaoSistolica não pode ser inferior a 0',
      'saturacaoO2 não pode ser superior a 100',
      'curto não pode ter mais de 3 caracteres',
      'password tem de ter pelo menos 12 caracteres',
      'obrigatorio é obrigatório',
      'opcao tem de ser um dos valores: a, b',
      'Cada valor de etiquetas tem de ser texto',
      'linhas.0.quantidade não pode ser inferior a 1',
      'O campo intruso não é permitido',
      'Motivo obrigatório para descontinuar',
    ]));
  });

  it('mensagens personalizadas passam intactas', () => {
    expect(traduzirMensagemValidacao('Dose fora do intervalo', 'dose')).toBe('Dose fora do intervalo');
    expect(traduzirMensagemValidacao('dose algo desconhecido', 'dose')).toBe('dose algo desconhecido');
  });
});
