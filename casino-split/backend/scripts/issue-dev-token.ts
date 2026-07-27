#!/usr/bin/env node
/** Génère un token JWT de dev pour un utilisateur existant (par username). */
import "dotenv/config";
import { prisma } from "../src/db/prisma";
import { issueDevToken } from "../src/auth/authPlugin";

async function main(): Promise<void> {
  const username = process.argv[2];
  if (!username) {
    console.error("Usage: npm run token -- <username>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    console.error(`Utilisateur "${username}" introuvable. Lancez d'abord 'npm run seed'.`);
    process.exit(1);
  }

  console.log(`userId: ${user.id}`);
  console.log(`token:  ${issueDevToken(user.id)}`);
  await prisma.$disconnect();
}

main();
