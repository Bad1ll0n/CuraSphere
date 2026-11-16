'use client';

import { useAuth } from '@/lib/auth-context';
import { Spinner } from '@/components/dashboard/partilhado';
import { DashboardMedico } from '@/components/dashboard/paineis/medico';
import { DashboardBloco } from '@/components/dashboard/paineis/bloco';
import { DashboardImagiologia } from '@/components/dashboard/paineis/imagiologia';
import { DashboardEnfermeiro } from '@/components/dashboard/paineis/enfermeiro';
import { DashboardChefeEnfermagem } from '@/components/dashboard/paineis/chefeenfermagem';
import { DashboardReabilitacao } from '@/components/dashboard/paineis/reabilitacao';
import { DashboardFarmacia } from '@/components/dashboard/paineis/farmacia';
import { DashboardRececao } from '@/components/dashboard/paineis/rececao';
import { DashboardTransporte } from '@/components/dashboard/paineis/transporte';
import { DashboardTI } from '@/components/dashboard/paineis/ti';
import { DashboardQualidade } from '@/components/dashboard/paineis/qualidade';
import { DashboardExecutivo } from '@/components/dashboard/paineis/executivo';
import { DashboardGenerico } from '@/components/dashboard/paineis/generico';

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
