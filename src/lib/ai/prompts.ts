import type { TemplateItem } from "@/types";
import { prepareSlideContentForImage } from "@/lib/slide-content";

export type SlidePromptInput = {
  title: string;
  content: string;
  pageType: string;
  notes?: string | null;
};

export type SlidePromptOptions = {
  template: TemplateItem;
  stylePrompt?: string | null;
  styleToken?: string | null;
  hasReferenceImage: boolean;
  pageIndex: number;
  totalPages: number;
  watermark?: boolean;
  aspectRatio?: string;
  isRedesign?: boolean;
  /** 用户上传的参考图，据此生成新幻灯片 */
  isUploadReference?: boolean;
  /** 重设计/参考图模式：用户写的修改说明（不得原样贴到幻灯片上） */
  editInstructions?: string | null;
  /** PPT 焕新：按原稿截图保留文字、仅换设计 */
  isLayoutRemix?: boolean;
};

function inferLayoutStrategy(pageType: string, content: string): string {
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const bulletCount = lines.filter((l) => l.startsWith("•")).length;
  const hasNumbers = /\d+%|\d+\+|\d+亿|70%|15%/.test(content);
  const isLong = content.length > 280;

  switch (pageType) {
    case "cover":
      return [
        "Layout: COVER — cinematic hero composition.",
        "Large dominant headline zone (top-left or center), secondary line below, optional footer strip for credits/logos.",
        "Use bold visual hierarchy; one focal graphic or abstract shape — not a bullet list.",
        "Do NOT reuse inner-page layouts.",
      ].join(" ");

    case "toc":
      return [
        "Layout: TABLE OF CONTENTS — structured index, not a content slide.",
        "Vertical numbered list OR two-column chapter list with clear numbering.",
        "Optional small process diagram on one side if 配图 notes mention flow.",
        "Keep entries scannable; equal spacing between items.",
      ].join(" ");

    case "section":
      return [
        "Layout: SECTION DIVIDER — minimal text, maximum atmosphere.",
        "Oversized section title centered or left-aligned, optional chapter number.",
        "Strong background motif; almost no body copy.",
      ].join(" ");

    case "data":
      return [
        "Layout: DATA / METRICS — chart-friendly.",
        hasNumbers
          ? "Highlight key figures in large callout boxes or stat cards (2×2 or row of 4)."
          : "Reserve clear area for chart/graph placeholder with supporting bullets.",
        "Left or top: headline; right or bottom: visualization zone.",
      ].join(" ");

    case "ending":
      return [
        "Layout: CLOSING — CTA or thank-you.",
        "Centered message, contact/QR zone, clean exit slide.",
        "Less dense than content pages.",
      ].join(" ");

    case "image":
      return [
        "Layout: VISUAL-FOCUSED — image-dominant with short caption.",
        "60–70% visual area, minimal text overlay.",
      ].join(" ");

    default:
      if (bulletCount >= 4) {
        return [
          "Layout: CONTENT — 2×2 card grid or four-quadrant layout.",
          "Each bullet in its own card with icon; title bar on top.",
          isLong ? "Prioritize readability; shorten visual density if needed." : "",
        ]
          .filter(Boolean)
          .join(" ");
      }
      if (bulletCount === 3) {
        return [
          "Layout: CONTENT — three-column or left-text + right triptych.",
          "Balanced whitespace; one icon per pillar.",
        ].join(" ");
      }
      if (bulletCount <= 2) {
        return [
          "Layout: CONTENT — split layout (50/50).",
          "Text block on one side, conceptual illustration or diagram on the other.",
        ].join(" ");
      }
      return [
        "Layout: CONTENT — single-column editorial with clear headline + paragraph blocks.",
        "Avoid generic bullet-only slides; use visual grouping.",
      ].join(" ");
  }
}

function buildStyleLockWithReference(options: SlidePromptOptions): string {
  const userNotes = options.stylePrompt?.trim();
  const templatePalette = options.template.colors.join(", ");

  return `
=== DECK STYLE SYSTEM (consistent across all ${options.totalPages} slides) ===
Deck ID: ${options.styleToken || "slidecraft-deck"}

*** PRIMARY COLOR & STYLE SOURCE: ATTACHED REFERENCE IMAGE ***
The user uploaded a reference image. You MUST derive the entire color scheme from that image:
- Sample dominant background hue, accent colors, gradient stops, and text contrast colors FROM THE REFERENCE IMAGE ONLY.
- If the reference is green-themed → this slide MUST use green tones (not blue, not navy).
- If the reference is warm/orange → use warm tones. Match what you SEE in the reference.
- IGNORE and DO NOT USE any pre-defined template palette or default "corporate blue/navy" styling.
- Template catalog colors are DISABLED for this job. Forbidden unless they appear in the reference: ${templatePalette}

${userNotes ? `Additional user style notes (secondary to reference image):\n${userNotes}` : "User did not type extra style notes — the reference image alone defines colors and mood."}

REFERENCE IMAGE RULES (critical):
- The attached image is a STYLE MOODBOARD ONLY (colors, lighting, typography mood, decoration).
- DO NOT copy its layout, text positions, element arrangement, logos placement, or page structure.
- This slide needs a NEW layout composed for the content below, but COLORS must match the reference image.

Typography: match the reference's feel (weight, modern/classic); high contrast for readability.
Visual cohesion: all slides in this deck share the SAME colors as extracted from the reference — but each page has a unique layout.`;
}

function buildStyleLockFromTemplate(options: SlidePromptOptions): string {
  const palette = options.template.colors.join(", ");
  const styleDesc =
    options.stylePrompt?.trim() || options.template.stylePrompt;

  return `
=== DECK STYLE SYSTEM (consistent across all ${options.totalPages} slides) ===
Deck ID: ${options.styleToken || "slidecraft-deck"}
Template: ${options.template.name}
Style description: ${styleDesc}
Color palette (must match across deck): ${palette}

No reference image — apply the template style and palette above consistently.
Typography: professional presentation Chinese/English mixed; high contrast; crisp edges.
Visual cohesion: one brand look across slides; each page layout still unique.`;
}

function buildStyleLockForUploadReference(options: SlidePromptOptions): string {
  const userNotes = options.stylePrompt?.trim();
  return `
=== MODIFY SLIDE USING REFERENCE (two images may be attached) ===
Image 1 (if present): the CURRENT generated slide — revise THIS slide, keep brand continuity.
Image 2 (if present): user's UPLOADED reference — shows WHAT to change (layout mockup, marked screenshot, example).
The "Must-include body text" below is the user's EDIT INSTRUCTIONS: what to change, what to keep, what content to add/remove.
- Follow the instruction text precisely; use the uploaded reference only as a visual guide for the requested edits.
- Output one polished presentation slide — not a collage of the two inputs.
${userNotes ? `\nProject style notes:\n${userNotes}` : ""}`;
}

function buildStyleLockForRedesign(options: SlidePromptOptions): string {
  const userNotes = options.stylePrompt?.trim();
  return `
=== REDESIGN: EDIT THIS SLIDE ONLY ===
One attached image: the CURRENT version of this slide. Revise it for the user.
- Keep the same overall brand colors, mood, and production quality as the attached image.
- Follow the user's EDIT INSTRUCTIONS below — do NOT paste those instruction sentences onto the slide.
- Keep existing on-slide copy and layout from the attached image unless instructions ask to change specific text.
- Adjust layout and hierarchy only where needed for the requested edits.
- This is a single-page edit — do not invent a different deck style.
${userNotes ? `\nUser style notes:\n${userNotes}` : ""}`;
}

function buildStyleLockForLayoutRemix(options: SlidePromptOptions): string {
  const userNotes = options.stylePrompt?.trim();
  return `
=== TWO-IMAGE CONTRACT (READ FIRST — NON-NEGOTIABLE) ===
Exactly TWO images are attached in fixed order:
  • urls[0] = IMAGE 1 = STYLE REFERENCE ONLY
  • urls[1] = IMAGE 2 = CONTENT SOURCE ONLY

These images serve COMPLETELY DIFFERENT roles. Mixing them up is a failure.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMAGE 1 — STYLE REFERENCE (urls[0]) — DESIGN SKIN ONLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Purpose: Extract visual design language ONLY. This is a "style moodboard".

WHAT TO EXTRACT FROM IMAGE 1 (allowed):
✓ Background color, gradient direction, and overall tone (dark/light)
✓ Accent colors, secondary colors, highlight colors
✓ Typography FEEL: weight (bold/light), modern vs classic, sans vs serif mood
✓ Decorative language: rounded corners, shadows, borders, glass/blur, geometric shapes
✓ Icon style, line weight, illustration style (flat/3D/minimal)
✓ Spacing rhythm and whitespace density (airy vs compact)
✓ Professional presentation aesthetic level (corporate / tech / editorial)

STRICTLY FORBIDDEN FROM IMAGE 1 (never use):
✗ ANY readable text: titles, subtitles, bullets, paragraphs, captions, labels
✗ ANY numbers, statistics, chart data, table cells, dates, names, brands, logos text
✗ Layout structure: where elements sit, column splits, grid from this image
✗ The subject matter of photos/diagrams in Image 1 (do not copy its charts/icons/content)
✗ Copying Image 1's slide as a template — you are NOT editing Image 1

Think of Image 1 as a color/font/mood swatch — NOT a slide to reproduce.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMAGE 2 — ORIGINAL SLIDE (urls[1]) — CONTENT SOURCE ONLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Purpose: Extract ALL information content. This is the user's actual slide to redesign.

WHAT TO EXTRACT FROM IMAGE 2 (required):
✓ Every headline, subheadline, bullet point, paragraph — copy text accurately
✓ All numbers, percentages, metrics, table data, chart labels and values
✓ Logical hierarchy: which text is title vs body vs footer (rewrite layout, keep words)
✓ Meaning of diagrams/charts — redraw them professionally with SAME data

STRICTLY FORBIDDEN FROM IMAGE 2 (never reuse):
✗ Its ugly colors, fonts, backgrounds, gradients
✗ Its poor spacing, misalignment, cramped layout, clip-art quality
✗ Its low-quality visual design — you are FIXING the design, not cloning it

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMULA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Final slide = IMAGE 2's FULL TEXT/DATA + IMAGE 1's DESIGN SYSTEM + NEW professional layout

You are a senior presentation designer. Produce ONE publication-ready slide:
- Content 100% from Image 2 (same language, same facts, same wording)
- Visual style 100% from Image 1's design language (colors, mood, decoration style)
- Layout 100% NEW: professional grid, clear hierarchy, balanced margins, McKinsey/Apple-keynote quality
${userNotes ? `\nAdditional user style notes (secondary to Image 1):\n${userNotes}` : ""}`;
}

function buildLayoutRemixSection(): string {
  return `
=== LAYOUT REMIX EXECUTION RULES ===
1. Read Image 2 first — list mentally every text element you must preserve.
2. Read Image 1 second — note only colors, typography mood, and decorative style.
3. Compose a NEW slide from scratch using a professional layout pattern suited to Image 2's content volume:
   - Cover → hero headline zone + subtitle + optional footer strip
   - Bullets → card grid, columns, or icon pillars (NOT a plain bullet list dump)
   - Data → large stat callouts or clean chart area with Image 2's numbers
   - Tables → redesigned clean table with Image 2's cell content only
4. Apply Image 1's color palette to backgrounds, accents, and typography colors.
5. Double-check: zero text from Image 1 appears on output; zero styling from Image 2 remains.

ANTI-PATTERNS (instant fail):
- Showing Image 1's title/company/product name on the slide
- Side-by-side before/after collage
- Watermarking or labeling "Image 1" / "Image 2"
- Mixing brand names from the style reference into the content slide`;
}

function buildLayoutRemixContentSection(
  slide: SlidePromptInput,
  options: SlidePromptOptions
): string {
  const pageLabel = `Slide ${options.pageIndex + 1} of ${options.totalPages}`;
  const layout = inferLayoutStrategy(slide.pageType, "");

  return `
=== THIS PAGE (${pageLabel}) ===
Page role hint: ${slide.pageType}
Internal label (do not print unless it appears in Image 2): ${slide.title}

Design brief:
- ${layout}
- Professional keynote/Business PPT quality: generous margins, clear visual hierarchy, no clutter
- Match content density to Image 2 — if Image 2 has 4 bullets, show 4 bullets (same text), better arranged
- If Image 2 is in Chinese, output Chinese; if English, output English; preserve mixed language exactly
- Icons and illustrations should support Image 2's meaning, styled with Image 1's color palette

Final verification checklist before output:
☑ Every visible word on the output exists in Image 2 (not Image 1)
☑ Color scheme matches Image 1 (not Image 2)
☑ Layout is newly designed and professional (not copied from either input image)
☑ No meta labels like「标题：」「内容：」「配图指引」on the slide`;
}

function buildHardConstraintsForLayoutRemix(options: SlidePromptOptions): string {
  const ratio =
    options.aspectRatio === "4:3"
      ? "4:3"
      : options.aspectRatio === "9:16"
        ? "9:16 vertical"
        : "16:9 widescreen";

  const wm = options.watermark
    ? ""
    : "\n- No watermarks unless present in Image 2 content.";

  return `
=== HARD CONSTRAINTS (LAYOUT REMIX) ===
- Output: ONE single professional presentation slide, ${ratio}.
- TEXT SOURCE: Image 2 ONLY. If a word is not in Image 2, it must NOT appear on the output.
- STYLE SOURCE: Image 1 ONLY (colors, mood, decoration). Image 1 text is POISON — never render it.
- Typography: crisp, readable, real rendered text (not placeholder blocks).
- Quality bar: top-tier corporate presentation — not a screenshot edit, not a filter overlay.
- No lorem ipsum; no invented marketing copy; no text from the style reference image.${wm}`;
}

function buildStyleLockSection(options: SlidePromptOptions): string {
  if (options.isLayoutRemix) {
    return buildStyleLockForLayoutRemix(options);
  }
  if (options.isUploadReference) {
    return buildStyleLockForUploadReference(options);
  }
  if (options.isRedesign) {
    return buildStyleLockForRedesign(options);
  }
  if (options.hasReferenceImage) {
    return buildStyleLockWithReference(options);
  }
  return buildStyleLockFromTemplate(options);
}

function buildRedesignSection(): string {
  return `
=== REDESIGN MODE ===
Only the current slide image is attached (no separate deck style board).
Apply the user's edit instructions to that slide while preserving its visual identity.`;
}

function buildEditInstructionsSection(
  slide: SlidePromptInput,
  options: SlidePromptOptions
): string {
  const instructions = options.editInstructions?.trim() || "";
  const pageLabel = `Slide ${options.pageIndex + 1} of ${options.totalPages}`;

  return `
=== USER EDIT INSTRUCTIONS (apply to attached slide — NOT slide body copy) ===
${pageLabel} | Page role: ${slide.pageType}
${options.isUploadReference ? "Two images may be attached: current slide + user reference." : "One image attached: current slide."}

Instructions from user (Chinese/English). These describe HOW to change the slide:
${instructions || "(no specific instructions — polish layout and visuals only, keep all existing on-slide text)"}

Optional headline update (only if user changed title in editor): ${slide.title}

CRITICAL RULES:
- NEVER print the instruction paragraph verbatim on the slide (e.g. do not show "优化后要高级专业一点" as visible text).
- Preserve all existing headlines, bullets, diagrams, and data from the attached slide unless instructions explicitly ask to replace specific text.
- When instructions ask to change tone/style/detail (e.g. "more professional vocabulary"), update the EXISTING on-slide elements accordingly — do not add the instruction wording itself.
- If instructions quote new replacement copy (e.g. "把标题改为：XXX"), render only that quoted copy, not the meta sentence.
${slide.notes ? `\nAuthor art notes (layout hints, not necessarily on-slide text):\n${slide.notes}` : ""}`;
}

function buildUploadReferenceSection(): string {
  return `
=== UPLOAD REFERENCE MODE ===
User will describe edits in the body text. Apply those edits to the current slide, guided by the uploaded reference image.`;
}

function buildContentSection(
  slide: SlidePromptInput,
  options: SlidePromptOptions
): string {
  const prepared = prepareSlideContentForImage(
    slide.title,
    slide.content,
    slide.notes
  );
  const layout = inferLayoutStrategy(slide.pageType, prepared.body);
  const pageLabel = `Slide ${options.pageIndex + 1} of ${options.totalPages}`;

  const sectionLabel =
    prepared.headline !== slide.title.trim()
      ? `\nOptional small section label (secondary, not dominant): ${slide.title}`
      : "";

  const visualBlock = prepared.visualDirection
    ? `\nVisual composition hints (for layout/imagery ONLY — do NOT print these words on the slide):\n${prepared.visualDirection}`
    : "";

  return `
=== THIS SLIDE: CUSTOM CONTENT & LAYOUT (unique to this page) ===
${pageLabel} | Page role: ${slide.pageType}
Main headline to render on slide: ${prepared.headline}${sectionLabel}

Body copy to render (bullets/paragraphs only — no field labels):
${prepared.body || "(no body)"}${visualBlock}

${layout}

Content-driven design rule:
- Let the amount and type of content above dictate grid, columns, cards, and hierarchy.
- This page's composition MUST differ from other slides in the deck (cover vs TOC vs body vs data).
- Do not repeat the same template layout on every page.
- NEVER render outline metadata labels such as 「标题：」「内容：」「画面：」「核心内容」「配图指引」 on the slide — only the actual headline and body text.`;
}

function buildHardConstraints(options: SlidePromptOptions): string {
  const ratio =
    options.aspectRatio === "4:3"
      ? "4:3"
      : options.aspectRatio === "9:16"
        ? "9:16 vertical"
        : "16:9 widescreen";

  const wm = options.watermark
    ? ""
    : "\n- No watermarks, no stock photo credits, no extra branding not in content.";

  const colorRule = options.isLayoutRemix
    ? "\n- Style/colors from Image 1; ALL text/data from Image 2 — never swap or mix them up."
    : options.isUploadReference
    ? "\n- Align colors and visual style with the uploaded reference where appropriate."
    : options.isRedesign
    ? "\n- Stay consistent with colors and branding in the attached current slide."
    : options.hasReferenceImage
      ? "\n- Colors MUST match the attached reference image (not template defaults)."
      : "";

  return `
=== HARD CONSTRAINTS ===
- Output: single professional presentation slide, ${ratio}.
- Render user-provided Chinese/English text accurately and readably (real typography in image).
- Do NOT show structural field names (标题/内容/画面/核心内容/配图指引) as visible text on the slide.
- No lorem ipsum; no placeholder English unless specified in content.
- No copying reference slide structure — style/colors only.${colorRule}
- Publication-ready, clean margins, no cluttered collage.${wm}`;
}

export function buildSlideGenerationPrompt(
  slide: SlidePromptInput,
  options: SlidePromptOptions
): string {
  const isEditMode =
    options.isRedesign || options.isUploadReference;
  const isRemix = options.isLayoutRemix;

  const parts = [
    isRemix
      ? "You are a senior presentation designer performing LAYOUT REMIX: restyle a user's slide using a separate style moodboard. Follow the TWO-IMAGE CONTRACT exactly."
      : "You are an expert presentation designer creating ONE slide for a multi-slide deck.",
    buildStyleLockSection(options),
    isRemix
      ? buildLayoutRemixSection()
      : options.isUploadReference
        ? buildUploadReferenceSection()
        : options.isRedesign
          ? buildRedesignSection()
          : "",
    isRemix
      ? buildLayoutRemixContentSection(slide, options)
      : isEditMode
        ? buildEditInstructionsSection(slide, options)
        : buildContentSection(slide, options),
    isRemix
      ? buildHardConstraintsForLayoutRemix(options)
      : buildHardConstraints(options),
  ];

  return isRemix ? parts.join("\n").slice(0, 6000) : parts.join("\n").slice(0, 4000);
}

export function describePromptStrategy(
  hasReferenceImage: boolean,
  isRedesign?: boolean,
  isLayoutRemix?: boolean
): string {
  if (isLayoutRemix) {
    return "PPT 焕新：图1仅风格（禁文字），图2仅内容（禁排版），专业重设计。";
  }
  if (isRedesign) {
    return "重设计：仅当前页图片 + 用户文案。";
  }
  if (hasReferenceImage) {
    return "参考图仅提取色系与设计风格；每页根据大纲内容独立排版。";
  }
  return "按模版色系统一视觉；每页根据大纲内容与页类型自动选择不同版式。";
}

export function resolveProjectStylePrompt(
  styleReference: string | null | undefined,
  userStylePrompt: string | null | undefined,
  templateStylePrompt: string | null | undefined
): string | null {
  if (styleReference) {
    return userStylePrompt?.trim() || null;
  }
  return userStylePrompt?.trim() || templateStylePrompt || null;
}
