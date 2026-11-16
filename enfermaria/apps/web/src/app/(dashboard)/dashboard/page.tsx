'use client';

import { useAuth } from '@/lib/auth-context';
import { Spinner } from '@/components/dashboard/partilhado';
import dynamic from 'next/dynamic';

// PERF-10: cada papel descarrega só o seu painel (os gráficos do executivo e do médico
// deixam de pesar no dashboard da enfermagem e vice-versa).
const DashboardMedico = dynamic(() => import('@/components/dashboard/paineis/medico').then((m) => m.DashboardMedico), { loading: () => <Spinner /> });
const DashboardBloco = dynamic(() => import('@/components/dashboard/paineis/bloco').then((m) => m.DashboardBloco), { loading: () => <Spinner /> });
const DashboardImagiologia = dynamic(() => import('@/components/dashboard/paineis/imagiologia').then((m) => m.DashboardImagiologia), { loading: () => <Spinner /> });
const DashboardEnfermeiro = dynamic(() => import('@/components/dashboard/paineis/enfermeiro').then((m) => m.DashboardEnfermeiro), { loading: () => <Spinner /> });
const DashboardChefeEnfermagem = dynamic(() => import('@/components/dashboard/paineis/chefeenfermagem').then((m) => m.DashboardChefeEnfermagem), { loading: () => <Spinner /> });
const DashboardReabilitacao = dynamic(() => import('@/components/dashboard/paineis/reabilitacao').then((m) => m.DashboardReabilitacao), { loading: () => <Spinner /> });
const DashboardFarmacia = dynamic(() => import('@/components/dashboard/paineis/farmacia').then((m) => m.DashboardFarmacia), { loading: () => <Spinner /> });
const DashboardRececao = dynamic(() => import('@/components/dashboard/paineis/rececao').then((m) => m.DashboardRececao), { loading: () => <Spinner /> });
const DashboardTransporte = dynamic(() => import('@/components/dashboard/paineis/transporte').then((m) => m.DashboardTransporte), { loading: () => <Spinner /> });
const DashboardTI = dynamic(() => import('@/components/dashboard/paineis/ti').then((m) => m.DashboardTI), { loading: () => <Spinner /> });
const DashboardQualidade = dynamic(() => import('@/components/dashboard/paineis/qualidade').then((m) => m.DashboardQualidade), { loading: () => <Spinner /> });
const DashboardExecutivo = dynamic(() => import('@/components/dashboard/paineis/executivo').then((m) => m.DashboardExecutivo), { loading: () => <Spinner /> });
const DashboardGenerico = dynamic(() => import('@/components/dashboard/paineis/generico').then((m) => m.DashboardGenerico), { loading: () => <Spinner /> });

const SUBROLES_BLOCO = ['cirurgiao_geral', 'medico_anestesia'];

const SUBROLES_IMAG  = ['medico_imagem', 'anatomia_patologica'];

const SUBROLES_SUPERVISOR = ['supervisor_enfermagem', 'medico_gestor'];

export default function DashboardPage() {
  const { utilizador, loading } = useAuth();

  if (loading || !utilizador) return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner />
    </div>
  );

  const role = utilizador.role;
  const subRole = utilizador.subRole ?? '';
  const props = { utilizador };

  const renderVista = () => {
    if (role === 'medico') {
      if (SUBROLES_BLOCO.includes(subRole))  return <DashboardBloco {...props} />;
      if (SUBROLES_IMAG.includes(subRole))   return <DashboardImagiologia {...props} />;
      return <DashboardMedico {...props} />;
    }
    if (role === 'enfermeiro') {
      if (SUBROLES_SUPERVISOR.includes(subRole)) return <DashboardChefeEnfermagem {...props} />;
      return <DashboardEnfermeiro {...props} />;
    }
    if (role === 'auxiliar')      return <DashboardEnfermeiro {...props} />;
    if (role === 'tecnico_saude') return <DashboardReabilitacao {...props} />;
    if (role === 'farmaceutico')  return <DashboardFarmacia {...props} />;
    if (role === 'administrativo')return <DashboardRececao {...props} />;
    if (role === 'operacional')   return <DashboardTransporte {...props} />;
    if (role === 'ti')            return <DashboardTI {...props} />;
    if (role === 'qualidade')     return <DashboardQualidade {...props} />;
    if (role === 'direcao')       return <DashboardExecutivo {...props} />;
    return <DashboardGenerico {...props} />;
  };

  return (
    <div style={{ padding: '40px 48px', maxWidth: '1280px', margin: '0 auto' }}>
      {renderVista()}
    </div>
  );
}
