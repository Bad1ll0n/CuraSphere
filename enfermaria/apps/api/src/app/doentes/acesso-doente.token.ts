/**
 * Token para resolver a verificação de acesso ao doente sem importar o `DoenteService`.
 *
 * O gateway de websockets precisa da mesma regra que protege a API por HTTP, mas importar o
 * serviço fecha um ciclo no carregamento dos ficheiros: doentes.service → ai-clinico →
 * alertas → events.gateway. Quando os alertas referem o `EventsGateway`, ele ainda não está
 * definido, e todos os ficheiros que passam por esse caminho falham ao carregar.
 *
 * Este ficheiro não importa nada, por isso não pode entrar em ciclo nenhum. O token é um
 * alias da mesma instância do `DoenteService` — a regra continua num único sítio.
 */
export const VERIFICADOR_ACESSO_DOENTE = Symbol('VERIFICADOR_ACESSO_DOENTE');

export interface VerificadorAcessoDoente {
  assertAcessoDoente(utilizadorId: string, role: string, doenteId: string): Promise<void>;
}
