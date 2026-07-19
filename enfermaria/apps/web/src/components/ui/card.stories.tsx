import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardHeader } from './card';
import { Badge } from './badge';
import { Button } from './button';

const meta: Meta<typeof Card> = { title: 'UI/Card', component: Card };
export default meta;
type Story = StoryObj<typeof Card>;

export const Simples: Story = {
  render: () => (
    <Card style={{ maxWidth: 380 }}>
      <CardHeader title="Sinais vitais" subtitle="Últimas 24h" action={<Badge tone="success" dot>Normal</Badge>} />
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        FC 72 bpm · TA 120/80 · SpO₂ 98% · Temp 36.5 ºC
      </p>
      <div style={{ marginTop: 16 }}>
        <Button size="sm" variant="secondary">Ver histórico</Button>
      </div>
    </Card>
  ),
};
