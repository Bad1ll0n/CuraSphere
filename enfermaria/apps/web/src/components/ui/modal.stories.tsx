import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Modal } from './modal';
import { Button } from './button';

const meta: Meta<typeof Modal> = { title: 'UI/Modal', component: Modal };
export default meta;
type Story = StoryObj<typeof Modal>;

export const Base: Story = {
  render: () => {
    const [aberto, setAberto] = useState(false);
    return (
      <div>
        <Button onClick={() => setAberto(true)}>Abrir modal</Button>
        <Modal isOpen={aberto} onClose={() => setAberto(false)} titulo="Registar resultado" maxWidth="480px">
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 16 }}>
            Acessível por defeito: <kbd>Esc</kbd> fecha, o foco fica preso no diálogo (Tab/Shift-Tab)
            e regressa ao gatilho ao fechar.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button variant="secondary" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button onClick={() => setAberto(false)}>Guardar</Button>
          </div>
        </Modal>
      </div>
    );
  },
};
