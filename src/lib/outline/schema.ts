import { z } from "zod";
import type { OutlinePage, PageType } from "@/types";

const pageTypeSchema = z.enum([
  "cover",
  "toc",
  "section",
  "content",
  "data",
  "image",
  "ending",
  "qa",
]);

export const LlmOutlinePageSchema = z.object({
  pageIndex: z.number().int().min(1).optional(),
  pageType: pageTypeSchema,
  title: z.string().min(1).max(200),
  content: z.string(),
  notes: z.string().optional(),
});

export const LlmOutlineResponseSchema = z.object({
  pageCount: z.number().int().min(1).max(50),
  presentationTitle: z.string().optional(),
  pages: z.array(LlmOutlinePageSchema).min(1).max(50),
  warnings: z.array(z.string()).optional(),
});

export type LlmOutlineResponse = z.infer<typeof LlmOutlineResponseSchema>;

export function llmPagesToOutlinePages(
  response: LlmOutlineResponse
): OutlinePage[] {
  return response.pages.map((p) => ({
    pageType: p.pageType as PageType,
    title: p.title.trim(),
    content: p.content.trim(),
    notes: p.notes?.trim() || undefined,
  }));
}
