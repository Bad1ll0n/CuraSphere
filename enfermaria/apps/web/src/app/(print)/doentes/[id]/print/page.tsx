'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '../../../../../lib/api';

interface Doente {
  id: string;
  nome: string;
  dataNascimento: string;
  numeroProcesso: string;
  estado: string;
  diagnosticoPrincipal: string;
  dataAdmissao: string;
  dataAltaPrevista?: string;
  cama: { numero: string; quarto: string };
}

interface Alergia {
  id: string;
  alergenio: string;
  tipo: string;
  severidade: string;
  notas?: string;
}

interface Medicacao {
  id: string;
  nome: string;
  dose: string;
  via: string;
  frequencia: string;
  ativo: boolean;
  prescritoPor: { nome: string };
}

interface SinalVital {
  id: string;
  data: string;
  pressaoSistolica?: number;
  pressaoDiastolica?: number;
  pulso?: number;
  temperatura?: number;
  saturacaoO2?: number;
  frequenciaRespiratoria?: number;
  registadoPor: { nome: string };
}

interface Contacto {
  id: string;
  nome: string;
  relacao: string;
  telefone: string;
  principal: boolean;
}

interface SumarioAlta {
  motivoAlta: string;
  destino?: string;
  resumoClinical: string;
  prescricaoSaida?: string;
  medicoFamilia?: string;
  criadoPor: { nome: string };
}

const estadoLabel: Record<string, string> = {
  estavel: 'Estável', grave: 'Grave', critico: 'Crítico', alta_prevista: 'Alta Prevista',
};

const motivoLabel: Record<string, string> = {
  melhoria: 'Melhoria Clínica',
  transferencia: 'Transferência',
  pedido_proprio: 'Pedido Próprio',
  obito: 'Óbito',
};

export default function PrintPage() {
  const { id } = useParams<{ id: string }>();
  const [doente, setDoente] = useState<Doente | null>(null);
  const [alergias, setAlergias] = useState<Alergia[]>([]);
  const [medicacoes, setMedicacoes] = useState<Medicacao[]>([]);
  const [sinaisVitais, setSinaisVitais] = useState<SinalVital[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [sumarioAlta, setSumarioAlta] = useState<SumarioAlta | null>(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get(`/doentes/${id}`),
      api.get(`/alergias/${id}`),
      api.get(`/medicacao/doente/${id}`),
      api.get(`/sinais-vitais/${id}`),
      api.get(`/contactos/${id}`),
      api.get(`/doentes/${id}/sumario-alta`).catch(() => ({ data: null })),
    ]).then(([d, a, m, sv, c, sa]) => {
      setDoente(d.data);
      setAlergias(a.data);
      setMedicacoes((m.data as Medicacao[]).filter((med) => med.ativo));
      setSinaisVitais((sv.data as SinalVital[]).slice(0, 5));
      setContactos(c.data);
      setSumarioAlta(sa.data);
      setPronto(true);
    }).catch(() => setPronto(true));
  }, [id]);

  useEffect(() => {
    if (pronto && doente) {
      setTimeout(() => window.print(), 600);
    }
  }, [pronto, doente]);

  if (!pronto || !doente) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', color: 'var(--text-soft)' }}>
        A preparar documento...
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          .page { padding: 24px; }
        }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; margin: 0; }
        .page { max-width: 820px; margin: 0 auto; padding: 40px; }
        h2 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin: 24px 0 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { text-align: left; font-weight: 600; color: #64748b; padding: 6px 10px; background: #f8fafc; }
        td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; }
        .badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; }
        .badge-red { background: #fee2e2; color: #b91c1c; }
        .badge-orange { background: #ffedd5; color: #c2410c; }
        .badge-blue { background: #dbeafe; color: #1d4ed8; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 12px; }
        .info-label { font-size: 10px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .info-value { font-size: 13px; color: #1e293b; font-weight: 500; margin-top: 2px; }
      `}</style>

      <div className="page">
        {/* Botões (só no ecrã) */}
        <div className="no-print" style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
          <button onClick={() => window.print()} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 18px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
            Imprimir / Guardar PDF
          </button>
          <button onClick={() => window.close()} style={{ border: '1px solid #e2e8f0', background: 'var(--bg-card)', borderRadius: '8px', padding: '8px 18px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-soft)' }}>
            Fechar
          </button>
        </div>

        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', paddingBottom: '20px', borderBottom: '2px solid #2563eb' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#2563eb' }} />
              <span style={{ fontWeight: 700, color: '#2563eb', fontSize: '12px', letterSpacing: '0.08em' }}>CURASPHERE — FICHA CLÍNICA</span>
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>{doente.nome}</div>
            <div style={{ marginTop: '4px', color: 'var(--text-soft)', fontSize: '13px' }}>
              Processo Nº {doente.numeroProcesso} · Cama {doente.cama.quarto}/{doente.cama.numero}
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '12px', color: 'var(--text-dim)' }}>
            <div>{new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            <div style={{ marginTop: '4px', fontWeight: 600, color: '#1e293b' }}>{estadoLabel[doente.estado] ?? doente.estado}</div>
          </div>
        </div>

        {/* Dados clínicos */}
        <h2>Dados Clínicos</h2>
        <div className="grid2">
          <div><div className="info-label">Data de Nascimento</div><div className="info-value">{new Date(doente.dataNascimento).toLocaleDateString('pt-PT')}</div></div>
          <div><div className="info-label">Data de Admissão</div><div className="info-value">{new Date(doente.dataAdmissao).toLocaleDateString('pt-PT')}</div></div>
          <div><div className="info-label">Diagnóstico Principal</div><div className="info-value">{doente.diagnosticoPrincipal}</div></div>
          <div><div className="info-label">Alta Prevista</div><div className="info-value">{doente.dataAltaPrevista ? new Date(doente.dataAltaPrevista).toLocaleDateString('pt-PT') : '—'}</div></div>
        </div>

        {/* Alergias */}
        {alergias.length > 0 && (
          <>
            <h2>Alergias ({alergias.length})</h2>
            <table>
              <thead><tr><th>Alergénio</th><th>Tipo</th><th>Severidade</th><th>Notas</th></tr></thead>
              <tbody>
                {alergias.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{a.alergenio}</strong></td>
                    <td>{a.tipo}</td>
                    <td><span className={`badge ${a.severidade === 'anafilaxia' || a.severidade === 'grave' ? 'badge-red' : 'badge-orange'}`}>{a.severidade}</span></td>
                    <td>{a.notas ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Medicação ativa */}
        {medicacoes.length > 0 && (
          <>
            <h2>Medicação Ativa ({medicacoes.length})</h2>
            <table>
              <thead><tr><th>Medicamento</th><th>Dose</th><th>Via</th><th>Frequência</th><th>Prescrito por</th></tr></thead>
              <tbody>
                {medicacoes.map((m) => (
                  <tr key={m.id}>
                    <td><strong>{m.nome}</strong></td>
                    <td>{m.dose}</td>
                    <td>{m.via}</td>
                    <td>{m.frequencia}</td>
                    <td>{m.prescritoPor.nome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Sinais vitais */}
        {sinaisVitais.length > 0 && (
          <>
            <h2>Sinais Vitais Recentes</h2>
            <table>
              <thead><tr><th>Data</th><th>TA (mmHg)</th><th>Pulso</th><th>Temp.</th><th>SpO₂</th><th>FR</th><th>Registado por</th></tr></thead>
              <tbody>
                {sinaisVitais.map((sv) => (
                  <tr key={sv.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(sv.data).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{sv.pressaoSistolica && sv.pressaoDiastolica ? `${sv.pressaoSistolica}/${sv.pressaoDiastolica}` : '—'}</td>
                    <td>{sv.pulso ?? '—'}</td>
                    <td>{sv.temperatura != null ? `${sv.temperatura}°C` : '—'}</td>
                    <td>{sv.saturacaoO2 != null ? `${sv.saturacaoO2}%` : '—'}</td>
                    <td>{sv.frequenciaRespiratoria ?? '—'}</td>
                    <td>{sv.registadoPor.nome.split(' ')[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Contactos */}
        {contactos.length > 0 && (
          <>
            <h2>Contactos de Emergência</h2>
            <table>
              <thead><tr><th>Nome</th><th>Relação</th><th>Telefone</th></tr></thead>
              <tbody>
                {contactos.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.nome}</strong>{c.principal && <span className="badge badge-blue" style={{ marginLeft: '8px' }}>Principal</span>}</td>
                    <td>{c.relacao}</td>
                    <td>{c.telefone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Sumário de alta */}
        {sumarioAlta && (
          <>
            <h2>Sumário de Alta</h2>
            <div className="grid2">
              <div><div className="info-label">Motivo de Alta</div><div className="info-value">{motivoLabel[sumarioAlta.motivoAlta] ?? sumarioAlta.motivoAlta}</div></div>
              {sumarioAlta.destino && <div><div className="info-label">Destino</div><div className="info-value">{sumarioAlta.destino}</div></div>}
              {sumarioAlta.medicoFamilia && <div><div className="info-label">Médico de Família</div><div className="info-value">{sumarioAlta.medicoFamilia}</div></div>}
              <div><div className="info-label">Registado por</div><div className="info-value">{sumarioAlta.criadoPor.nome}</div></div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <div className="info-label">Resumo Clínico</div>
              <div style={{ marginTop: '6px', padding: '12px', background: 'var(--bg-page)', borderRadius: '6px', fontSize: '13px', lineHeight: 1.6 }}>{sumarioAlta.resumoClinical}</div>
            </div>
            {sumarioAlta.prescricaoSaida && (
              <div>
                <div className="info-label">Prescrição de Saída</div>
                <div style={{ marginTop: '6px', padding: '12px', background: 'var(--bg-page)', borderRadius: '6px', fontSize: '13px', lineHeight: 1.6 }}>{sumarioAlta.prescricaoSaida}</div>
              </div>
            )}
          </>
        )}

        {/* Rodapé */}
        <div style={{ marginTop: '40px', paddingTop: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)' }}>
          <span>CuraSphere — Gestão Hospitalar</span>
          <span>Documento gerado automaticamente · Confidencial</span>
        </div>
      </div>
    </>
  );
}
