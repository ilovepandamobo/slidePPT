import PptxGenJS from "pptxgenjs";

type SlideExport = {
  imageUrl: string;
  title: string;
};

export async function buildPptx(
  title: string,
  slides: SlideExport[],
  aspectRatio: string
): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.author = "SlideCraft AI";
  pptx.title = title;

  const layout =
    aspectRatio === "4:3"
      ? "screen4x3"
      : aspectRatio === "9:16"
        ? "LAYOUT_16x9"
        : "LAYOUT_16x9";
  pptx.layout = layout;

  for (const slide of slides) {
    const s = pptx.addSlide();
    s.addImage({
      data: slide.imageUrl,
      x: 0,
      y: 0,
      w: "100%",
      h: "100%",
    });
  }

  const data = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return data;
}
