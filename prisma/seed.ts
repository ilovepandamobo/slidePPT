import { PrismaClient } from "@prisma/client";
import { TEMPLATES } from "../src/lib/templates-data";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  for (const t of TEMPLATES) {
    await prisma.template.upsert({
      where: { id: t.id },
      update: {
        name: t.name,
        category: t.category,
        description: t.description,
        stylePrompt: t.stylePrompt,
        colors: JSON.stringify(t.colors),
        preview: t.preview,
        isPremium: t.isPremium,
      },
      create: {
        id: t.id,
        name: t.name,
        category: t.category,
        description: t.description,
        stylePrompt: t.stylePrompt,
        colors: JSON.stringify(t.colors),
        preview: t.preview,
        isPremium: t.isPremium,
      },
    });
  }

  const demoEmail = "demo@slidecraft.app";
  const hash = await bcrypt.hash("demo123456", 10);
  await prisma.user.upsert({
    where: { email: demoEmail },
    update: {},
    create: {
      email: demoEmail,
      name: "演示用户",
      passwordHash: hash,
      plan: "pro",
      credits: 500,
    },
  });

  console.log("Seed complete. Demo: demo@slidecraft.app / demo123456");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
