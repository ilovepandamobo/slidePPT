export type PageType =
  | "cover"
  | "toc"
  | "section"
  | "content"
  | "data"
  | "image"
  | "ending"
  | "qa";

export type OutlinePage = {
  pageType: PageType;
  title: string;
  content: string;
  notes?: string;
};

export type TemplateItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  stylePrompt: string;
  colors: string[];
  preview: string;
  isPremium: boolean;
};

export type BrandKit = {
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
};

export type SlideLayout =
  | "auto"
  | "title"
  | "bullets"
  | "split"
  | "full-image"
  | "data";

export type AspectRatio = "16:9" | "4:3" | "9:16";

export type GenerationMode = "outline" | "remix";

export type RemixPageUpload = {
  id: string;
  url: string;
  name: string;
};
