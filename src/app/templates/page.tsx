import { TEMPLATES } from "@/lib/templates-data";
import { TemplateGrid } from "@/components/templates/template-grid";

export default function TemplatesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-white">模版中心</h1>
      <p className="mt-2 text-slate-500">
        精选 GPT Image 风格模版，覆盖商务、科技、教育等场景
      </p>
      <div className="mt-8">
        <TemplateGrid templates={TEMPLATES} mode="browse" />
      </div>
    </div>
  );
}
