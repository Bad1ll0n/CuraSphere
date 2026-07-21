import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './input';

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  args: { placeholder: 'Número de processo…' },
};
export default meta;
type Story = StoryObj<typeof Input>;

export const Normal: Story = { render: (a) => <div style={{ maxWidth: 320 }}><Input {...a} /></div> };
export const Invalido: Story = { render: (a) => <div style={{ maxWidth: 320 }}><Input {...a} invalid defaultValue="abc" /></div> };
export const Desativado: Story = { render: (a) => <div style={{ maxWidth: 320 }}><Input {...a} disabled /></div> };
