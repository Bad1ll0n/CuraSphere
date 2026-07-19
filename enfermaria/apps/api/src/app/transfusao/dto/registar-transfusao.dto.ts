import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

/**
 * Administração de uma bolsa a um doente — dupla-verificação à cabeceira
 * (análoga aos "5 certos" do MAR). As três verificações têm de estar todas
 * confirmadas; a compatibilidade ABO/Rh é (re)calculada no servidor, nunca
 * confiando apenas no cliente.
 */
export class RegistarTransfusaoDto {
  @IsString()
  bolsaId: string;

  @IsBoolean()
  verificacaoABO: boolean; // doente certo + grupo ABO/Rh compatível conferido

  @IsBoolean()
  verificacaoUnidade: boolean; // nº da unidade confere com a etiqueta

  @IsBoolean()
  verificacaoValidade: boolean; // dentro da validade

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacoes?: string;
}
