/** Seed de données fictives pour le développement local (aucune donnée réelle). */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const users = [
    { username: "joueur_demo", balance: 10_000 },
    { username: "alice_test", balance: 5_000 },
    { username: "bob_test", balance: 25_000 },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { username: user.username },
      update: {},
      create: user,
    });
  }

  console.log(`Seed terminé : ${users.length} utilisateurs fictifs créés/à jour.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
