import { campo, construirAck, construirAdt, lerMensagem, lerPid, lerPv1 } from './hl7-mensagem';

/** PROD-14 — mensagens HL7 v2 reais (numeração do MSH, PID-3 com repetições, ACK, ADT de saída). */
describe('HL7 v2 — leitura e escrita', () => {
  const A01 = [
    'MSH|^~\\&|SONHO|HOSP|CURASPHERE|HOSP|20261119083000||ADT^A01^ADT_A01|MSG0001|P|2.5',
    'EVN|A01|20261119083000',
    'PID|1||123456^^^HIS^PI~987654321^^^SNS^NH||Silva^Maria^José||19500505|F',
    'PV1|1|I|MED^12^12A||||||||||||||||EP778',
  ].join('\r');

  it('lê o MSH com a numeração HL7 (MSH-9 é o tipo, MSH-10 o controlo)', () => {
    const msh = lerMensagem(A01).find((s) => s.id === 'MSH')!;
    expect(campo(msh, 3)).toBe('SONHO');
    expect(campo(msh, 9)).toBe('ADT^A01^ADT_A01');
    expect(campo(msh, 10)).toBe('MSG0001');
  });

  it('aceita \\n, \\r\\n e os delimitadores MLLP', () => {
    expect(lerMensagem(`\x0b${A01.replace(/\r/g, '\n')}\x1c\r`).map((s) => s.id)).toEqual(['MSH', 'EVN', 'PID', 'PV1']);
  });

  it('PID: identificador do HIS e número SNS pelas repetições de PID-3; nome, nascimento e sexo', () => {
    const pid = lerPid(lerMensagem(A01).find((s) => s.id === 'PID'));
    expect(pid).toEqual({
      identificadorHis: '123456', numeroSNS: '987654321', nome: 'Maria José Silva',
      dataNascimento: new Date('1950-05-05T00:00:00Z'), sexo: 'feminino',
    });
    expect(lerPid(lerMensagem('MSH|^~\\&|X\rPID|1||555^^^RNU').find((s) => s.id === 'PID'))).toMatchObject({ identificadorHis: null, numeroSNS: '555' });
  });

  it('PV1: localização e episódio no HIS', () => {
    expect(lerPv1(lerMensagem(A01).find((s) => s.id === 'PV1'))).toEqual({ servico: 'MED', quarto: '12', cama: '12A', episodioHis: 'EP778' });
  });

  it('ACK responde ao controlo da mensagem com o código', () => {
    const ack = construirAck(lerMensagem(A01), 'AE', 'Doente não encontrado', new Date('2026-11-19T08:31:00Z')).split('\r');
    expect(ack[0]).toMatch(/^MSH\|\^~\\&\|CURASPHERE\|HOSPITAL\|SONHO\|HOSP\|20261119083100\|\|ACK\^A01\^ACK\|ACKMSG0001\|P\|2\.5$/);
    expect(ack[1]).toBe('MSA|AE|MSG0001|Doente não encontrado');
  });

  it('ADT de saída: identificadores do HIS, do CuraSphere e SNS; PV1-44/45 nos campos certos; volta a ler-se', () => {
    const raw = construirAdt('A03', {
      controlo: 'C1', identificadorHis: '123456', numeroProcesso: '2026-00000001', numeroSNS: '987654321',
      nome: 'Maria José Silva', dataNascimento: new Date('1950-05-05T00:00:00Z'), sexo: 'feminino',
      servico: 'MED', quarto: '12', cama: '12A', quando: new Date('2026-11-19T12:00:00Z'),
    }, new Date('2026-11-19T12:00:05Z'));
    const segs = lerMensagem(raw);
    expect(campo(segs[0], 9)).toBe('ADT^A03^ADT_A01');
    expect(lerPid(segs.find((s) => s.id === 'PID'))).toMatchObject({ identificadorHis: '123456', numeroSNS: '987654321', sexo: 'feminino', nome: 'Maria José Silva' });
    const pv1 = segs.find((s) => s.id === 'PV1')!;
    expect(campo(pv1, 3)).toBe('MED^12^12A');
    expect(campo(pv1, 44)).toBe('');
    expect(campo(pv1, 45)).toBe('20261119120000');
  });

  it('escapa separadores nos dados (um "|" num nome não parte o segmento)', () => {
    const raw = construirAdt('A08', { controlo: 'C', identificadorHis: null, numeroProcesso: 'P|1', nome: 'Ana|Maria', dataNascimento: null, sexo: null });
    expect(lerMensagem(raw).find((s) => s.id === 'PID')!.campos).toHaveLength(9);
  });
});
