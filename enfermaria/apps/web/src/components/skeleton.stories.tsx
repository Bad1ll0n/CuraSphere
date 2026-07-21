import type { Meta, StoryObj } from '@storybook/react';
import { Skeleton, SkeletonText, SkeletonCard, SkeletonTable } from './skeleton';

const meta: Meta = { title: 'Componentes/Skeleton' };
export default meta;
type Story = StoryObj;

export const Linha: Story = { render: () => <Skeleton className="h-4 w-48" /> };
export const Texto: Story = { render: () => <div style={{ maxWidth: 360 }}><SkeletonText lines={4} /></div> };
export const Cartao: Story = { render: () => <div style={{ maxWidth: 360 }}><SkeletonCard /></div> };
export const Tabela: Story = { render: () => <SkeletonTable rows={4} /> };
