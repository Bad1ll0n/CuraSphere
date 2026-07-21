import type { Meta, StoryObj } from '@storybook/react';
import { Breadcrumb } from './breadcrumb';

const meta: Meta<typeof Breadcrumb> = { title: 'Componentes/Breadcrumb', component: Breadcrumb };
export default meta;
type Story = StoryObj<typeof Breadcrumb>;

export const Padrao: Story = {
  args: { items: [{ label: 'Início', href: '/' }, { label: 'Doentes', href: '/doentes' }, { label: 'João Silva' }] },
};
export const DoisNiveis: Story = {
  args: { items: [{ label: 'Início', href: '/' }, { label: 'Banco de Sangue' }] },
};
