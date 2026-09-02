import { PrismaClient } from "@prisma/client";
import { hashPassword, generateTempPassword } from "../lib/password";

const prisma = new PrismaClient();

// Creates the very first account — an Admin — only if the database has no
// users yet. The Admin then creates everyone else (the BM manager, the
// employees) from inside the app; there is no public sign-up. The one-time
// password is printed once and stored nowhere; the account is forced to
// change it on first login.
async function main() {
  const existing = await prisma.user.count();
  if (existing > 0) {
    console.log(`Skipping seed — ${existing} user(s) already exist.`);
    return;
  }

  const username = process.env.SEED_ADMIN_USERNAME || "admin";
  const fullName = process.env.SEED_ADMIN_NAME || "System Admin";
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  await prisma.user.create({
    data: {
      username,
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
  console.log(` Username: ${username}`);
  console.log(` Password: ${tempPassword}`);
  console.log("=========================================");
  console.log(" Sign in, set a real password, then add everyone else");
  console.log(" from Admin → Users. This password is shown only once.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
