import { PrismaClient } from './generated/prisma';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('admin123', 10);

  const admin = await prisma.utilizador.upsert({
    where: { numeroFuncionario: '00001' },
    update: {},
    create: {
      nome: 'Chefe de Enfermeiros',
      numeroFuncionario: '00001',
      passwordHash: hash,
      role: 'chefe_enfermeiros',
      ordemExperiencia: 1,
    },
  });

  const admin2 = await prisma.utilizador.upsert({
    where: { numeroFuncionario: '00002' },
    update: {},
    create: {
      nome: 'Administrativo',
      numeroFuncionario: '00002',
      passwordHash: hash,
      role: 'administrativo',
    },
  });

  const itAdmin = await prisma.utilizador.upsert({
    where: { numeroFuncionario: '00003' },
    update: {},
    create: {
      nome: 'IT Admin',
      numeroFuncionario: '00003',
      passwordHash: hash,
      role: 'it_admin',
    },
  });

  console.log('Utilizadores criados:');
  console.log(' -', admin.nome, '| Nº', admin.numeroFuncionario, '| Role:', admin.role);
  console.log(' -', admin2.nome, '| Nº', admin2.numeroFuncionario, '| Role:', admin2.role);
  console.log(' -', itAdmin.nome, '| Nº', itAdmin.numeroFuncionario, '| Role:', itAdmin.role);
  console.log('Password de todos: admin123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
