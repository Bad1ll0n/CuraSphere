import { PrismaClient } from './generated/prisma';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('admin123', 10);

  const admin = await prisma.utilizador.upsert({
    where: { numeroFuncionario: '00001' },
    update: { role: 'enfermeiro', subRole: 'supervisor_enfermagem', nome: 'Supervisor Enfermagem' },
    create: {
      nome: 'Supervisor Enfermagem',
      numeroFuncionario: '00001',
      passwordHash: hash,
      role: 'enfermeiro',
      subRole: 'supervisor_enfermagem',
      ordemExperiencia: 1,
    },
  });

  const admin2 = await prisma.utilizador.upsert({
    where: { numeroFuncionario: '00002' },
    update: { role: 'administrativo' },
    create: {
      nome: 'Administrativo',
      numeroFuncionario: '00002',
      passwordHash: hash,
      role: 'administrativo',
    },
  });

  const itAdmin = await prisma.utilizador.upsert({
    where: { numeroFuncionario: '00003' },
    update: { role: 'ti', subRole: 'it_admin', nome: 'IT Admin' },
    create: {
      nome: 'IT Admin',
      numeroFuncionario: '00003',
      passwordHash: hash,
      role: 'ti',
      subRole: 'it_admin',
    },
  });

  console.log('Utilizadores criados/actualizados:');
  console.log(' -', admin.nome, '| Nº', admin.numeroFuncionario, '| Role:', admin.role, '/', admin.subRole);
  console.log(' -', admin2.nome, '| Nº', admin2.numeroFuncionario, '| Role:', admin2.role);
  console.log(' -', itAdmin.nome, '| Nº', itAdmin.numeroFuncionario, '| Role:', itAdmin.role, '/', itAdmin.subRole);
  console.log('Password de todos: admin123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
