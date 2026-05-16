interface PageHeaderProps {
  titulo: string;
  subtitulo?: string;
  acoes?: React.ReactNode;
}

export function PageHeader({ titulo, subtitulo, acoes }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-slate-500">{subtitulo}</p>}
      </div>
      {acoes && <div className="flex items-center gap-2 shrink-0">{acoes}</div>}
    </div>
  );
}
