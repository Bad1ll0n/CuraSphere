import type { Meta, StoryObj } from '@storybook/react';
import { EmptyState } from './empty-state';

const meta: Meta<typeof EmptyState> = {
  title: 'Componentes/EmptyState',
  component: EmptyState,
  args: { title: 'Sem doentes atribuídos', description: 'Quando te forem atribuídos doentes, aparecem aqui.' },
  argTypes: { icon: { control: 'select', options: ['patients', 'medication', 'tasks', 'notes', 'calendar', 'search', 'generic'] } },
};
export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Doentes: Story = { args: { icon: 'patients' } };
export const ComAcao: Story = { args: { icon: 'tasks', title: 'Sem tarefas', description: 'Cria a primeira tarefa do turno.', action: { label: 'Nova tarefa', onClick: () => { /* vazio */ } } } };
export const Pesquisa: Story = { args: { icon: 'search', title: 'Sem resultados', description: 'Tenta outros termos de pesquisa.' } };
