import "dotenv/config";
import { buildApp } from "./app";

const PORT = Number(process.env.PORT ?? 3001);

async function main(): Promise<void> {
  const app = buildApp();
  await app.listen({ port: PORT, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
