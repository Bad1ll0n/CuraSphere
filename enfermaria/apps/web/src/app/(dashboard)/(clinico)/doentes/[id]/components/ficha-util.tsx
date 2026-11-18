/** Auxiliares da ficha do doente (ARQ-14: fora do page.tsx, que está na lista dos grandes). */
export function calcIdade(dataNascimento: string) {
  const hoje = new Date();
  const nasc = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

export function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-slate-800">{value}</span>
    </div>
  );
}
