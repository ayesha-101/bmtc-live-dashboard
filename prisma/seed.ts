import { PrismaClient } from "@prisma/client";
import { hashPassword, INITIAL_PASSWORD } from "../lib/password";

const prisma = new PrismaClient();

// Creates the very first account — an Admin — only if the database has no
// users yet. The Admin then creates everyone else (the BM manager, the
// employees) from inside the app; there is no public sign-up. It starts on
// the standard first password and is forced to change it at first login.
async function main() {
  const existing = await prisma.user.count();
  if (existing > 0) {
    console.log(`Skipping seed — ${existing} user(s) already exist.`);
    return;
  }

  const email = (process.env.SEED_ADMIN_EMAIL || "admin@bmtc.local").toLowerCase();
  const fullName = process.env.SEED_ADMIN_NAME || "System Admin";
  const passwordHash = await hashPassword(INITIAL_PASSWORD);

  await prisma.user.create({
    data: {
      email,
      fullName,
      passwordHash,
      department: "electrical",
      role: "admin",
      mustChangePassword: true,
    },
  });

  console.log("\n=========================================");
  console.log(" Initial Admin account created");
  console.log("=========================================");
  console.log(` Email:    ${email}`);
  console.log(` Password: ${INITIAL_PASSWORD}`);
  console.log("=========================================");
  console.log(" Sign in, set a real password, then add everyone else");
  console.log(" from Admin → Users. Change this password immediately.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
