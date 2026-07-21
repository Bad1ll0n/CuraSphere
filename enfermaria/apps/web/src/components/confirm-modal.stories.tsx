import type { Meta, StoryObj } from '@storybook/react';
import { ConfirmModal } from './confirm-modal';

const meta: Meta<typeof ConfirmModal> = {
  title: 'Componentes/ConfirmModal',
  component: ConfirmModal,
  args: {
    isOpen: true,
    titulo: 'Eliminar registo?',
    mensagem: 'Esta ação não pode ser revertida. O registo será removido permanentemente.',
    onConfirmar: () => {},
    onCancelar: () => {},
  },
  argTypes: { variant: { control: 'select', options: ['danger', 'warning', 'info'] } },
};
export default meta;
type Story = StoryObj<typeof ConfirmModal>;

export const Perigo: Story = { args: { variant: 'danger', labelConfirmar: 'Eliminar' } };
export const Aviso: Story = { args: { variant: 'warning', titulo: 'Descartar alterações?', mensagem: 'Tens alterações por guardar.', labelConfirmar: 'Descartar' } };
export const Info: Story = { args: { variant: 'info', titulo: 'Confirmar alta', mensagem: 'Confirmas a alta clínica deste doente?', labelConfirmar: 'Confirmar' } };
