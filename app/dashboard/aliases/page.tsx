import { ResourceManager } from "@/components/admin/resource-manager";
import { ProviderTabs } from "@/components/admin/section-tabs";
import { getDb } from "@/lib/db/client";
import { modelAliases, modelMappings } from "@/lib/db/schema";
import { serializeAlias } from "@/lib/admin/serializers";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function toClientItems(items: Record<string, unknown>[]) {
  return JSON.parse(JSON.stringify(items)) as (Record<string, unknown> & { id: string })[];
}

export default async function AliasesPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const db = getDb();
  const [aliases, models] = await Promise.all([db.select().from(modelAliases), db.select().from(modelMappings)]);

  return (
    <div className="space-y-5">
      <ProviderTabs />
    <ResourceManager
      title="Model Aliases"
      endpoint="/api/admin/aliases"
      returnPath="/dashboard/aliases"
      initialCreate={params.mode === "new"}
      notice={params.status === "created" ? "Created" : null}
      initialItems={toClientItems(aliases.map(serializeAlias))}
      fields={[
        { name: "alias", label: "Alias", required: true, placeholder: "chat-default" },
        {
          name: "targetModel",
          label: "Target model",
          type: "select",
          required: true,
          options: models.map((model) => ({ value: model.publicModelName, label: model.publicModelName })),
          optionEndpoint: "/api/admin/models",
          optionValue: "publicModelName",
          optionLabel: "publicModelName",
          emptyOptionLabel: "Create a model mapping first",
        },
        { name: "enabled", label: "Enabled", type: "checkbox", defaultValue: true },
      ]}
    />
    </div>
  );
}
