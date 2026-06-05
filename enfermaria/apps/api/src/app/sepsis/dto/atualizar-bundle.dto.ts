import { IsEnum } from 'class-validator';

export class AtualizarBundleDto {
  @IsEnum(['hemoculturasColhidas', 'antibioticosIniciados', 'lactatoMedido', 'fluidoterapiaIniciada'])
  campo: 'hemoculturasColhidas' | 'antibioticosIniciados' | 'lactatoMedido' | 'fluidoterapiaIniciada';
}
