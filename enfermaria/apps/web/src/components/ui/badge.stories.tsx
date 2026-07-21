import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './badge';

const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
  args: { children: 'Estável', tone: 'success' },
  argTypes: { tone: { control: 'select', options: ['neutral', 'accent', 'success', 'warning', 'danger'] } },
};
export default meta;
type Story = StoryObj<typeof Badge>;

export const Tons: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Badge tone="neutral">Rascunho</Badge>
      <Badge tone="accent" dot>Novo</Badge>
      <Badge tone="success" dot>Estável</Badge>
      <Badge tone="warning" dot>Em risco</Badge>
      <Badge tone="danger" dot>Crítico</Badge>
    </div>
  ),
};
