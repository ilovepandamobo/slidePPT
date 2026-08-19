/**
 * 清理未被数据库引用的 slide-images / style-refs 文件
 * 本地: npx tsx scripts/cleanup-storage.ts
 * 生产: curl -X POST https://slideppt-production.up.railway.app/api/admin/cleanup-storage -H "Authorization: Bearer $CLEANUP_SECRET"
 */
import "dotenv/config";
import { runStorageCleanup } from "../src/lib/storage/cleanup";
import { prisma } from "../src/lib/db";

async function main() {
  const result = await runStorageCleanup();
  console.log(JSON.stringify(result, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
