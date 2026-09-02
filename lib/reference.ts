import type { Prisma } from "@prisma/client";

const PREFIX = "BMTC-JIH";
const COUNTER_ID = "lpo";

function currentYYYYMM(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Mints the next reference (e.g. BMTC-JIH-202608-1397) inside the caller's
// transaction. The atomic upsert-increment means two concurrent creates
// get two different values — and the UNIQUE constraint on Lpo.reference is
// the final backstop if anything ever slips past.
export async function nextReference(tx: Prisma.TransactionClient): Promise<string> {
  const counter = await tx.counter.upsert({
    where: { id: COUNTER_ID },
    create: { id: COUNTER_ID, value: 1397 },
    update: { value: { increment: 1 } },
  });
  return `${PREFIX}-${currentYYYYMM()}-${counter.value}`;
}
