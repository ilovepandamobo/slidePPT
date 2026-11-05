import { prisma } from "@/lib/db";

/** 根据各页 status 同步项目 status（draft / generating / ready） */
export async function syncProjectStatus(projectId: string) {
  const slideStates = await prisma.slide.findMany({
    where: { projectId },
    select: { status: true },
  });
  const anyGenerating = slideStates.some((s) => s.status === "generating");
  const anyDone = slideStates.some((s) => s.status === "done");
  const status = anyGenerating ? "generating" : anyDone ? "ready" : "draft";
  await prisma.project.update({
    where: { id: projectId },
    data: { status },
  });
}
