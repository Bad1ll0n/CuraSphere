import { PrismaClient } from './generated/prisma';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const seedPassword = process.env.SEED_PASSWORD;
  if (!seedPassword) {
    throw new Error(
      'SEED_PASSWORD não definido. Define antes de correr o seed:\n' +
      '  SEED_PASSWORD=<password_forte> npx ts-node src/seed.ts',
    );
  }
  const hash = await bcrypt.hash(seedPassword, 12);

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
      passwordExpiresAt: new Date(),
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
      passwordExpiresAt: new Date(),
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
      passwordExpiresAt: new Date(),
    },
  });

  console.log('Utilizadores criados/actualizados:');
  console.log(' -', admin.nome, '| Nº', admin.numeroFuncionario, '| Role:', admin.role, '/', admin.subRole);
  console.log(' -', admin2.nome, '| Nº', admin2.numeroFuncionario, '| Role:', admin2.role);
  console.log(' -', itAdmin.nome, '| Nº', itAdmin.numeroFuncionario, '| Role:', itAdmin.role, '/', itAdmin.subRole);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
