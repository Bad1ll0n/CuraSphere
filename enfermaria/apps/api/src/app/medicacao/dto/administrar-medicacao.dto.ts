import { IsString, IsOptional, IsUUID, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AdministrarMedicacaoDto {
  @ApiPropertyOptional({ description: 'ID do doente — usado para validar "doente certo" nas 5 certas' })
  @IsUUID()
  @IsOptional()
  doenteId?: string;

  @ApiPropertyOptional({
    description:
      'Dose LIDA NA ETIQUETA pelo enfermeiro. Comparada com a prescrição para confirmar o ' +
      '3.º certo. Sem ela a administração é gravada como NÃO verificada — o serviço já ' +
      'avaliava este campo, mas ele nunca era declarado aqui nem reencaminhado pelo ' +
      'controlador, pelo que `verificacao5Certas` era false em 100% dos registos.',
  })
  @IsString()
  @IsOptional()
  dose?: string;

  @ApiPropertyOptional({
    description: 'Via lida na etiqueta. Confirma o 4.º certo, nas mesmas condições da dose.',
  })
  @IsString()
  @IsOptional()
  via?: string;

  @ApiPropertyOptional({
    description:
      'Etiqueta QR assinada, tal como foi lida. O servidor extrai dela a dose e a via e compara-as com a prescrição — é a ÚNICA forma de os certos 3 e 4 serem verificados de facto, porque a etiqueta é uma fonte independente e assinada. Enviar aqui a dose que o servidor mostrou seria compará-la consigo própria.',
  })
  @IsString()
  @IsOptional()
  qrPayload?: string;

  @ApiPropertyOptional({
    description:
      'O enfermeiro percorreu a lista dos 5 certos à cabeceira e confirmou-os manualmente. ' +
      'É uma ATESTAÇÃO, não uma verificação: o sistema não comparou nada. Distinguir as ' +
      'duas coisas é o ponto — devolver ao servidor a dose que ele próprio enviou seria ' +
      'compará-la consigo mesma e gravar uma verificação que nunca aconteceu.',
  })
  @IsBoolean()
  @IsOptional()
  atestadoPeloEnfermeiro?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  observacoes?: string;
}
