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
        title="Model Mappings"
        endpoint="/api/admin/models"
        returnPath="/dashboard/models"
        initialCreate={params.mode === "new"}
        notice={params.status === "created" ? "Created" : null}
        initialItems={toClientItems(models.map(serializeModel))}
        fields={[
          {
            name: "publicModelName",
            label: "Public model",
            required: true,
            placeholder: "gpt-4o-mini",
          },
          {
            name: "sourceId",
            label: "Provider source",
            type: "select",
            required: true,
            options: sources.map((source) => ({ value: source.id, label: source.name })),
            optionEndpoint: "/api/admin/sources",
            optionValue: "id",
            optionLabel: "name",
            emptyOptionLabel: "Create a source first",
          },
          { name: "upstreamModelName", label: "Upstream model", required: true, placeholder: "gpt-4o-mini" },
          { name: "enabled", label: "Enabled", type: "checkbox", defaultValue: true },
          { name: "supportsStreaming", label: "Streaming", type: "checkbox", defaultValue: true },
          { name: "supportsTools", label: "Tools", type: "checkbox", defaultValue: false },
          { name: "supportsVision", label: "Vision", type: "checkbox", defaultValue: false },
          { name: "supportsJsonMode", label: "JSON mode", type: "checkbox", defaultValue: false },
          { name: "contextWindow", label: "Context window", type: "number", placeholder: "128000" },
          { name: "maxOutputTokens", label: "Max output tokens", type: "number", placeholder: "4096" },
          { name: "inputPricePer1M", label: "Input price / 1M", placeholder: "0.15000000" },
          { name: "outputPricePer1M", label: "Output price / 1M", placeholder: "0.60000000" },
          { name: "currency", label: "Currency", defaultValue: "USD" },
        ]}
      />
    </div>
  );
}
