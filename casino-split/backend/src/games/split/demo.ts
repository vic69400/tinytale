#!/usr/bin/env node
/**
 * Démo CLI de référence du flow complet Split : création de session,
 * mise, rounds successifs, cash-out (ou bust), puis révélation du seed.
 * Sert de spécification exécutable du moteur pour l'équipe API/frontend.
 */
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createSeedSession, incrementNonce, revealSeedSession } from "../../provably-fair/seedSession";
import { startGame, playRound, cashOut, type Side } from "./splitGame";

async function main(): Promise<void> {
  const rl = readline.createInterface({ input: stdin, output: stdout });

  let session = createSeedSession("demo-user");
  console.log(`Session créée. serverSeedHash=${session.serverSeedHash} clientSeed=${session.clientSeed}`);

  const betAmount = Number(await rl.question("Montant de la mise : "));
  let game = startGame(betAmount);

  while (game.status === "active") {
    const answer = (await rl.question("Choix (left/right/cashout) : ")).trim().toLowerCase();

    if (answer === "cashout") {
      if (game.currentRound === 0) {
        console.log("Impossible de cash-out avant d'avoir joué au moins un round.");
        continue;
      }
      const { state, payout } = cashOut(game);
      game = state;
      console.log(`Cash-out ! Payout = ${payout}`);
      break;
    }

    if (answer !== "left" && answer !== "right") {
      console.log("Choix invalide, entrez 'left', 'right' ou 'cashout'.");
      continue;
    }

    session = incrementNonce(session);
    const { state, result } = playRound(game, answer as Side, {
      serverSeed: session.serverSeed,
      clientSeed: session.clientSeed,
      nonce: session.nonce,
    });
    game = state;

    console.log(
      `Round ${result.round}: choisi=${result.chosenSide} survécu=${result.survived} ` +
        `multiplicateur=${result.cumulativeMultiplier.toFixed(4)}`,
    );
    if (!result.survived) {
      console.log(`Bust ! Le côté sûr était: ${result.safeSide}. Partie terminée, mise perdue.`);
    }
  }

  session = revealSeedSession(session);
  console.log(`Seed révélé pour vérification indépendante : serverSeed=${session.serverSeed}`);
  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
