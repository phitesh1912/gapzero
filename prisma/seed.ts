import { PrismaClient } from "@prisma/client";
import { buildSeed, writeSeed } from "../lib/demo/buildSeed";

// `npm run db:seed`: idempotent reset + seed with synthetic demo data.
async function main() {
  const db = new PrismaClient();
  try {
    const rows = buildSeed(new Date());
    await writeSeed(db, rows);
    console.log(
      `Seeded ${rows.patients.length} patients, ${rows.prescriptions.length} prescriptions, ` +
        `${rows.refills.length} refill requests, ${rows.events.length} events.`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
