// Resets the shared demo database to fresh synthetic data. Run: npm run db:reset-demo
import { db } from "../lib/db";
import { buildSeed, writeSeed } from "../lib/demo/buildSeed";
writeSeed(db, buildSeed(new Date())).then(() => db.$disconnect()).then(() => console.log("Demo data reset."));
