/**
 * F-08: o par do `EmptyState` para quando a lista NÃO chegou a ser lida.
 *
 * Em dezenas de páginas, uma falha de rede terminava no estado vazio — "Sem medicações para
 * este turno", "Sem doentes activos". Num contexto clínico é essa ambiguidade que faz o dano:
 * conclui-se que não há nada a fazer. Este componente diz o contrário, com a mesma forma do
 * estado vazio para ocupar o mesmo lugar na página.
 */
interface ErroCarregamentoProps {
  titulo?: string;
  descricao?: string;
  onTentarNovamente?: () => void;
}

const DESCRICAO_OMISSAO =
  'Isto não quer dizer que não haja registos — a lista não chegou a ser lida. Verifique a ligação e tente de novo.';

export function ErroCarregamento({
  titulo = 'Não foi possível carregar os dados',
  descricao = DESCRICAO_OMISSAO,
  onTentarNovamente,
}: ErroCarregamentoProps) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center text-center" style={{ padding: '48px 24px' }}>
      <div
        className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center"
        style={{ marginBottom: '16px' }}
      >
        <svg className="w-10 h-10 text-red-400" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v3.75m0 3.75h.008M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
          />
        </svg>
      </div>
      <p className="text-slate-800 font-semibold text-sm" style={{ marginBottom: '6px' }}>
        {titulo}
      </p>
      <p
        className="text-slate-500 text-xs leading-relaxed"
        style={{ maxWidth: '340px', marginBottom: onTentarNovamente ? '20px' : '0' }}
      >
        {descricao}
      </p>
      {onTentarNovamente && (
        <button
          type="button"
          onClick={onTentarNovamente}
          className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
          style={{ padding: '8px 20px' }}
        >
          Tentar de novo
        </button>
      )}
    </div>
  );
}
