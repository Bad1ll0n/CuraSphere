import type { Meta, StoryObj } from '@storybook/react';

/**
 * Página "Foundations": documenta os tokens do design system (definidos em global.css,
 * :root + html.dark + html.contrast). Alterna o tema no toolbar do Storybook para ver
 * cada token adaptar-se. Fonte única de verdade para cor — evita hex inline.
 */
const meta: Meta = { title: 'Foundations/Tokens' };
export default meta;
type Story = StoryObj;

const SURFACES = ['--bg-page', '--bg-card', '--bg-surface', '--bg-surface-2', '--bg-input'];
const TEXT = ['--text-hi', '--text-muted', '--text-soft', '--text-dim'];
const SEMANTIC = ['--accent', '--success', '--warning', '--danger'];

function Swatch({ token }: { token: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
      <div style={{ width: 40, height: 40, borderRadius: 8, background: `var(${token})`, border: '1px solid var(--border)' }} />
      <code style={{ fontSize: 13, color: 'var(--text-muted)' }}>{token}</code>
    </div>
  );
}

export const Tokens: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32, color: 'var(--text-hi)' }}>
      <section><h3 style={{ marginBottom: 8 }}>Superfícies</h3>{SURFACES.map((t) => <Swatch key={t} token={t} />)}</section>
      <section><h3 style={{ marginBottom: 8 }}>Texto</h3>{TEXT.map((t) => <Swatch key={t} token={t} />)}</section>
      <section><h3 style={{ marginBottom: 8 }}>Semânticas</h3>{SEMANTIC.map((t) => <Swatch key={t} token={t} />)}</section>
    </div>
  ),
};
