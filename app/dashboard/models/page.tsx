import { ResourceManager } from "@/components/admin/resource-manager";
import { ProviderTabs } from "@/components/admin/section-tabs";
import { getDb } from "@/lib/db/client";
import { modelMappings, providerSources } from "@/lib/db/schema";
import { serializeModel } from "@/lib/admin/serializers";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function toClientItems(items: Record<string, unknown>[]) {
  return JSON.parse(JSON.stringify(items)) as (Record<string, unknown> & { id: string })[];
}

export default async function ModelsPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const db = getDb();
  const [models, sources] = await Promise.all([db.select().from(modelMappings), db.select().from(providerSources)]);

  return (
    <div className="space-y-5">
      <ProviderTabs />
      <ResourceManager
        title={{ en: "Model Mappings", zh: "模型映射" }}
        endpoint="/api/admin/models"
        returnPath="/dashboard/models"
        initialCreate={params.mode === "new"}
        notice={params.status === "created" ? { en: "Created", zh: "已创建" } : null}
        initialItems={toClientItems(models.map(serializeModel))}
        fields={[
          {
            name: "publicModelName",
            label: { en: "Public model", zh: "公开模型名" },
            required: true,
            placeholder: "gpt-4o-mini",
          },
          {
            name: "sourceId",
            label: { en: "Provider source", zh: "供应商来源" },
            type: "select",
            required: true,
            options: sources.map((source) => ({ value: source.id, label: source.name })),
            optionEndpoint: "/api/admin/sources",
            optionValue: "id",
            optionLabel: "name",
            emptyOptionLabel: { en: "Create a source first", zh: "请先创建来源" },
          },
          { name: "upstreamModelName", label: { en: "Upstream model", zh: "上游模型名" }, required: true, placeholder: "gpt-4o-mini" },
          { name: "enabled", label: { en: "Enabled", zh: "启用" }, type: "checkbox", defaultValue: true },
          { name: "supportsStreaming", label: { en: "Streaming", zh: "流式" }, type: "checkbox", defaultValue: true },
          { name: "supportsTools", label: { en: "Tools", zh: "工具" }, type: "checkbox", defaultValue: false },
          { name: "supportsVision", label: { en: "Vision", zh: "视觉" }, type: "checkbox", defaultValue: false },
          { name: "supportsJsonMode", label: { en: "JSON mode", zh: "JSON 模式" }, type: "checkbox", defaultValue: false },
          { name: "contextWindow", label: { en: "Context window", zh: "上下文窗口" }, type: "number", placeholder: "128000" },
          { name: "maxOutputTokens", label: { en: "Max output tokens", zh: "最大输出 Token" }, type: "number", placeholder: "4096" },
          { name: "inputPricePer1M", label: { en: "Input price / 1M", zh: "输入价格 / 百万" }, placeholder: "0.15000000" },
          { name: "outputPricePer1M", label: { en: "Output price / 1M", zh: "输出价格 / 百万" }, placeholder: "0.60000000" },
          { name: "currency", label: { en: "Currency", zh: "货币" }, defaultValue: "USD" },
        ]}
      />
    </div>
  );
}
