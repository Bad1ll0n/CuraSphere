import { Type } from 'class-transformer';
import { IsString, IsInt, IsBoolean, IsArray, ValidateNested, MaxLength, Min, Max, ArrayMaxSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * BE-01 — `PUT /v1/dashboard-config` recebia `@Body() body: { widgets: WidgetLayout[] }`.
 * `WidgetLayout` é uma interface TS, apagada na compilação: a `ValidationPipe` global via
 * apenas `Object` e não validava nada. O corpo é gravado tal e qual numa coluna JSON
 * (`DashboardConfigService.saveConfig`), pelo que qualquer estrutura arbitrária — de
 * qualquer tamanho — era persistida.
 */
export class WidgetLayoutDto {
  @ApiProperty()
  @IsString() @MaxLength(100)
  id: string;

  @ApiProperty()
  @IsInt() @Min(0) @Max(1000)
  x: number;

  @ApiProperty()
  @IsInt() @Min(0) @Max(1000)
  y: number;

  @ApiProperty()
  @IsInt() @Min(1) @Max(1000)
  w: number;

  @ApiProperty()
  @IsInt() @Min(1) @Max(1000)
  h: number;

  @ApiProperty()
  @IsBoolean()
  visible: boolean;
}

export class GuardarConfigDto {
  @ApiProperty({ type: [WidgetLayoutDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => WidgetLayoutDto)
  widgets: WidgetLayoutDto[];
}
