/** QA-11: o que o papel administrativo vê do doente — identificação e internamento, sem dados clínicos. */
export function visaoAdministrativa(d: any) {
  if (!d) return d;
  const { id, nome, numeroProcesso, dataNascimento, sexo, estadoRegisto, tipoVisita, dataAdmissao, dataAltaPrevista, dataAlta, ativo, cama, identificadorHis } = d;
  return { id, nome, numeroProcesso, dataNascimento, sexo, estadoRegisto, tipoVisita, dataAdmissao, dataAltaPrevista, dataAlta, ativo, identificadorHis,
    cama: cama ? { id: cama.id, numero: cama.numero, quarto: cama.quarto, servico: cama.servico } : null };
}
