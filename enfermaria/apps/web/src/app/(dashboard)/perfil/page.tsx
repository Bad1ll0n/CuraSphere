'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';

export default function PerfilPage() {
  const { utilizador, logout, registerPasskey } = useAuth();

  // MFA setup
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState('');
  const [codigoAtivacao, setCodigoAtivacao] = useState('');
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [loadingAtivar, setLoadingAtivar] = useState(false);
  const [loadingDesativar, setLoadingDesativar] = useState(false);
  const [codigoDesativacao, setCodigoDesativacao] = useState('');
  const [confirmarDesativar, setConfirmarDesativar] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [mfaAtivo, setMfaAtivo] = useState(utilizador?.mfaAtivo ?? false);

  // Password
  const [passwordAtual, setPasswordAtual] = useState('');
  const [novaPassword, setNovaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [loadingPwd, setLoadingPwd] = useState(false);
  const [msgPwd, setMsgPwd] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const iniciarSetupMfa = async () => {
    setLoadingSetup(true);
    setMensagem(null);
    try {
      const { data } = await api.get('/auth/mfa/setup');
      setQrCode(data.qrCodeDataUrl);
      setSecret(data.secret);
    } catch (e: any) {
      setMensagem({ tipo: 'erro', texto: e.response?.data?.message ?? 'Erro ao iniciar setup MFA' });
    } finally {
      setLoadingSetup(false);
    }
  };

  const ativarMfa = async () => {
    if (codigoAtivacao.length !== 6) return;
    setLoadingAtivar(true);
    setMensagem(null);
    try {
      const { data } = await api.post('/auth/mfa/ativar', { secret, code: codigoAtivacao });
      setMensagem({ tipo: 'ok', texto: data.mensagem });
      setMfaAtivo(true);
      setQrCode(null);
      setSecret('');
      setCodigoAtivacao('');
    } catch (e: any) {
      setMensagem({ tipo: 'erro', texto: e.response?.data?.message ?? 'Código inválido' });
    } finally {
      setLoadingAtivar(false);
    }
  };

  const desativarMfa = async () => {
    if (codigoDesativacao.length !== 6) return;
    setLoadingDesativar(true);
    setMensagem(null);
    try {
      const { data } = await api.post('/auth/mfa/desativar', { code: codigoDesativacao });
      setMensagem({ tipo: 'ok', texto: data.mensagem });
      setMfaAtivo(false);
      setConfirmarDesativar(false);
      setCodigoDesativacao('');
    } catch (e: any) {
      setMensagem({ tipo: 'erro', texto: e.response?.data?.message ?? 'Código inválido' });
    } finally {
      setLoadingDesativar(false);
    }
  };

  // Passkeys
  type Passkey = { id: string; nome: string; deviceType: string; backedUp: boolean; criadoEm: string; ultimoUsoEm: string | null };
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loadingRegPasskey, setLoadingRegPasskey] = useState(false);
  const [nomePasskey, setNomePasskey] = useState('');
  const [msgPasskey, setMsgPasskey] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  useEffect(() => {
    api.get('/auth/webauthn/credentials')
      .then(({ data }) => setPasskeys(data))
      .catch(() => {});
  }, []);

  const adicionarPasskey = async () => {
    setLoadingRegPasskey(true);
    setMsgPasskey(null);
    try {
      await registerPasskey(nomePasskey || 'Passkey');
      const { data } = await api.get('/auth/webauthn/credentials');
      setPasskeys(data);
      setNomePasskey('');
      setMsgPasskey({ tipo: 'ok', texto: 'Passkey registada com sucesso.' });
    } catch {
      setMsgPasskey({ tipo: 'erro', texto: 'Erro ao registar passkey. Verifique se o seu dispositivo suporta passkeys.' });
    } finally {
      setLoadingRegPasskey(false);
    }
  };

  const removerPasskey = async (id: string) => {
    try {
      await api.delete(`/auth/webauthn/credentials/${id}`);
      setPasskeys(p => p.filter(pk => pk.id !== id));
    } catch {
      setMsgPasskey({ tipo: 'erro', texto: 'Erro ao remover passkey.' });
    }
  };

  const alterarPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (novaPassword !== confirmarPassword) {
      setMsgPwd({ tipo: 'erro', texto: 'As passwords não coincidem' });
      return;
    }
    if (novaPassword.length < 8) {
      setMsgPwd({ tipo: 'erro', texto: 'A nova password deve ter pelo menos 8 caracteres' });
      return;
    }
    setLoadingPwd(true);
    setMsgPwd(null);
    try {
      const { data } = await api.patch('/auth/alterar-password', { passwordAtual, novaPassword });
      setMsgPwd({ tipo: 'ok', texto: data.mensagem + ' — por segurança, faça login novamente.' });
      setPasswordAtual(''); setNovaPassword(''); setConfirmarPassword('');
      setTimeout(() => logout(), 2500);
    } catch (e: any) {
      setMsgPwd({ tipo: 'erro', texto: e.response?.data?.message ?? 'Erro ao alterar password' });
    } finally {
      setLoadingPwd(false);
    }
  };

  if (!utilizador) return null;

  return (
    <div style={{ padding: '40px 48px', maxWidth: '680px' }}>
      <h1 className="text-2xl font-bold text-slate-900" style={{ marginBottom: '8px' }}>O meu perfil</h1>
      <p className="text-slate-500 text-sm" style={{ marginBottom: '40px' }}>Gerir as suas credenciais e segurança da conta</p>

      {/* Dados da conta */}
      <section style={{ marginBottom: '40px' }}>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm" style={{ padding: '24px' }}>
          <div className="flex items-center gap-4" style={{ marginBottom: '20px' }}>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-lg font-bold shadow-md">
              {utilizador.nome.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{utilizador.nome}</p>
              <p className="text-sm text-slate-500">Nº {utilizador.numeroFuncionario}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Role', valor: utilizador.role },
              { label: 'Sub-role', valor: utilizador.subRole ?? '—' },
              { label: 'Serviço', valor: utilizador.servico },
            ].map(f => (
              <div key={f.label} className="bg-slate-50 rounded-xl" style={{ padding: '12px 14px' }}>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">{f.label}</p>
                <p className="text-sm font-semibold text-slate-700 mt-1">{f.valor}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Autenticação em 2 passos */}
      <section style={{ marginBottom: '40px' }}>
        <h2 className="text-base font-bold text-slate-800" style={{ marginBottom: '16px' }}>
          Autenticação em 2 Passos (MFA)
        </h2>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm" style={{ padding: '24px' }}>
          <div className="flex items-start justify-between gap-4" style={{ marginBottom: mensagem ? '20px' : '0' }}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${mfaAtivo ? 'bg-emerald-50' : 'bg-slate-100'}`}>
                <svg className={`w-5 h-5 ${mfaAtivo ? 'text-emerald-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {mfaAtivo ? 'Ativo' : 'Inativo'}
                </p>
                <p className="text-xs text-slate-500">
                  {mfaAtivo
                    ? 'O seu login requer um código da aplicação autenticadora.'
                    : 'Adicione uma camada extra de segurança à sua conta.'}
                </p>
              </div>
            </div>

            {mfaAtivo ? (
              <button
                onClick={() => setConfirmarDesativar(true)}
                className="shrink-0 text-xs font-semibold text-red-500 hover:text-red-600 border border-red-200 hover:border-red-300 rounded-lg transition-colors"
                style={{ padding: '8px 14px' }}
              >
                Desativar
              </button>
            ) : (
              !qrCode && (
                <button
                  onClick={iniciarSetupMfa}
                  disabled={loadingSetup}
                  className="shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 rounded-lg transition-colors disabled:opacity-50"
                  style={{ padding: '8px 14px' }}
                >
                  {loadingSetup ? 'A carregar...' : 'Ativar'}
                </button>
              )
            )}
          </div>

          {/* Setup QR Code */}
          {qrCode && !mfaAtivo && (
            <div style={{ marginTop: '24px' }}>
              <div className="border-t border-slate-100" style={{ paddingTop: '24px' }}>
                <p className="text-sm font-semibold text-slate-700" style={{ marginBottom: '8px' }}>1. Digitalize o código QR</p>
                <p className="text-xs text-slate-500" style={{ marginBottom: '16px' }}>
                  Abra o <strong>Google Authenticator</strong> ou <strong>Microsoft Authenticator</strong> e digitalize o código abaixo.
                </p>
                <div className="flex justify-center" style={{ marginBottom: '20px' }}>
                  <Image src={qrCode} alt="QR Code MFA" width={180} height={180} className="rounded-xl border border-slate-200" />
                </div>
                <p className="text-xs font-semibold text-slate-700" style={{ marginBottom: '12px' }}>2. Introduza o código de verificação</p>
                <div className="flex gap-3 items-end">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={codigoAtivacao}
                    onChange={e => setCodigoAtivacao(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xl text-center tracking-[0.5em] font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                    placeholder="000000"
                  />
                  <button
                    onClick={ativarMfa}
                    disabled={loadingAtivar || codigoAtivacao.length !== 6}
                    className="shrink-0 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                    style={{ padding: '12px 20px' }}
                  >
                    {loadingAtivar ? 'A verificar...' : 'Confirmar'}
                  </button>
                </div>
                <button
                  onClick={() => { setQrCode(null); setSecret(''); setCodigoAtivacao(''); }}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                  style={{ marginTop: '12px' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Desativar MFA */}
          {confirmarDesativar && (
            <div style={{ marginTop: '24px' }}>
              <div className="border-t border-slate-100" style={{ paddingTop: '24px' }}>
                <p className="text-sm font-semibold text-slate-700" style={{ marginBottom: '8px' }}>Confirmar desativação</p>
                <p className="text-xs text-slate-500" style={{ marginBottom: '16px' }}>
                  Introduza o código atual da sua aplicação autenticadora para desativar o MFA.
                </p>
                <div className="flex gap-3 items-end">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={codigoDesativacao}
                    onChange={e => setCodigoDesativacao(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xl text-center tracking-[0.5em] font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                    placeholder="000000"
                  />
                  <button
                    onClick={desativarMfa}
                    disabled={loadingDesativar || codigoDesativacao.length !== 6}
                    className="shrink-0 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                    style={{ padding: '12px 20px' }}
                  >
                    {loadingDesativar ? 'A desativar...' : 'Desativar'}
                  </button>
                </div>
                <button
                  onClick={() => { setConfirmarDesativar(false); setCodigoDesativacao(''); }}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                  style={{ marginTop: '12px' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Mensagem de feedback MFA */}
          {mensagem && (
            <div className={`flex items-center gap-2 text-sm rounded-xl ${mensagem.tipo === 'ok' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}
              style={{ padding: '12px 14px', marginTop: '16px' }}>
              {mensagem.tipo === 'ok'
                ? <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                : <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              {mensagem.texto}
            </div>
          )}
        </div>
      </section>

      {/* Passkeys / FIDO2 */}
      <section style={{ marginBottom: '40px' }}>
        <h2 className="text-base font-bold text-slate-800" style={{ marginBottom: '4px' }}>Passkeys</h2>
        <p className="text-xs text-slate-500" style={{ marginBottom: '16px' }}>
          Inicie sessão com Touch ID, Face ID ou chave de segurança — sem password.
        </p>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm" style={{ padding: '24px' }}>
          {/* Lista passkeys existentes */}
          {passkeys.length > 0 ? (
            <ul className="space-y-3" style={{ marginBottom: '20px' }}>
              {passkeys.map(pk => (
                <li key={pk.id} className="flex items-center justify-between gap-3 bg-slate-50 rounded-xl" style={{ padding: '12px 14px' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{pk.nome}</p>
                      <p className="text-xs text-slate-400">
                        {pk.deviceType === 'multiDevice' ? 'Sincronizada' : 'Dispositivo único'}{pk.backedUp ? ' · Cópia de segurança' : ''}
                        {pk.ultimoUsoEm ? ` · Último uso: ${new Date(pk.ultimoUsoEm).toLocaleDateString('pt-PT')}` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removerPasskey(pk.id)}
                    className="text-xs text-red-500 hover:text-red-600 border border-red-100 hover:border-red-200 rounded-lg transition-colors"
                    style={{ padding: '6px 12px' }}
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400" style={{ marginBottom: '16px' }}>Nenhuma passkey registada.</p>
          )}

          {/* Adicionar nova passkey */}
          <div className="border-t border-slate-100" style={{ paddingTop: '16px' }}>
            <p className="text-xs font-semibold text-slate-600" style={{ marginBottom: '10px' }}>Adicionar nova passkey</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={nomePasskey}
                onChange={e => setNomePasskey(e.target.value)}
                placeholder="Ex: MacBook Touch ID"
                maxLength={50}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
              <button
                onClick={adicionarPasskey}
                disabled={loadingRegPasskey}
                className="shrink-0 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors"
                style={{ padding: '10px 16px' }}
              >
                {loadingRegPasskey ? 'A registar...' : 'Registar'}
              </button>
            </div>
          </div>

          {msgPasskey && (
            <div className={`flex items-center gap-2 text-sm rounded-xl ${msgPasskey.tipo === 'ok' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}
              style={{ padding: '12px 14px', marginTop: '12px' }}>
              {msgPasskey.tipo === 'ok'
                ? <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                : <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              {msgPasskey.texto}
            </div>
          )}
        </div>
      </section>

      {/* Alterar Password */}
      <section>
        <h2 className="text-base font-bold text-slate-800" style={{ marginBottom: '16px' }}>Alterar Password</h2>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm" style={{ padding: '24px' }}>
          <form onSubmit={alterarPassword}>
            <div className="space-y-4">
              {[
                { label: 'Password atual', value: passwordAtual, set: setPasswordAtual, autocomplete: 'current-password' },
                { label: 'Nova password', value: novaPassword, set: setNovaPassword, autocomplete: 'new-password' },
                { label: 'Confirmar nova password', value: confirmarPassword, set: setConfirmarPassword, autocomplete: 'new-password' },
              ].map(f => (
                <div key={f.label}>
                  <span className="block text-xs font-semibold text-slate-600" style={{ marginBottom: '6px' }}>{f.label}</span>
                  <input aria-label={f.label}
                    type="password"
                    value={f.value}
                    onChange={e => f.set(e.target.value)}
                    autoComplete={f.autocomplete}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                    placeholder="••••••••"
                  />
                </div>
              ))}
            </div>

            {msgPwd && (
              <div className={`flex items-center gap-2 text-sm rounded-xl ${msgPwd.tipo === 'ok' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}
                style={{ padding: '12px 14px', marginTop: '16px' }}>
                {msgPwd.tipo === 'ok'
                  ? <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  : <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                {msgPwd.texto}
              </div>
            )}

            <button
              type="submit"
              disabled={loadingPwd}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
              style={{ padding: '12px 24px', marginTop: '20px' }}
            >
              {loadingPwd ? 'A guardar...' : 'Alterar password'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
