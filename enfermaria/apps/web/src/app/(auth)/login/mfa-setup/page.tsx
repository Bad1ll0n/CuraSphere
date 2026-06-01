'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function MfaSetupPage() {
  const router = useRouter();
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem('mfaSetupToken');
    if (!token) { router.push('/login'); return; }
    api.get('/auth/mfa/setup', { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => { setQrCode(data.qrCodeDataUrl); setSecret(data.secret); })
      .catch(() => router.push('/login'));
  }, [router]);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setLoading(true);
    const token = sessionStorage.getItem('mfaSetupToken');
    try {
      await api.post('/auth/mfa/ativar', { secret, code }, { headers: { Authorization: `Bearer ${token}` } });
      sessionStorage.removeItem('mfaSetupToken');
      router.push('/login');
    } catch {
      setErro('Código inválido. Verifique a aplicação autenticadora.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 w-full max-w-sm">
        <h1 className="text-white text-xl font-bold mb-2">Configurar Autenticação em 2 Passos</h1>
        <p className="text-slate-400 text-sm mb-6">
          Obrigatório para o seu perfil. Leia o QR code com a aplicação Google Authenticator ou Authy.
        </p>
        {qrCode && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrCode} alt="QR Code MFA" className="w-48 h-48 mx-auto mb-6 rounded" />
        )}
        <form onSubmit={handleActivate} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="Código de 6 dígitos"
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 text-center text-2xl tracking-widest focus:outline-none focus:border-blue-500"
          />
          {erro && <p className="text-red-400 text-sm">{erro}</p>}
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg py-3 font-medium transition-colors"
          >
            {loading ? 'A activar...' : 'Activar e Continuar'}
          </button>
        </form>
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="w-full text-sm text-slate-500 hover:text-slate-400 transition mt-4"
        >
          ← Voltar ao login
        </button>
      </div>
    </div>
  );
}
