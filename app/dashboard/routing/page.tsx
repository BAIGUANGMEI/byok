import { ResourceManager } from "@/components/admin/resource-manager";
import { ProviderTabs } from "@/components/admin/section-tabs";
import { getDb } from "@/lib/db/client";
import { modelMappings, routingRules } from "@/lib/db/schema";
import { serializeRoute } from "@/lib/admin/serializers";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function toClientItems(items: Record<string, unknown>[]) {
  return JSON.parse(JSON.stringify(items)) as (Record<string, unknown> & { id: string })[];
}

export default async function RoutingPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const db = getDb();
  const [rules, models] = await Promise.all([db.select().from(routingRules), db.select().from(modelMappings)]);

  return (
    <div className="space-y-5">
      <ProviderTabs />
    <ResourceManager
      title="Routing Rules"
      endpoint="/api/admin/routing"
      returnPath="/dashboard/routing"
      initialCreate={params.mode === "new"}
      notice={params.status === "created" ? "Created" : null}
      initialItems={toClientItems(rules.map(serializeRoute))}
      fields={[
        { name: "alias", label: "Alias", required: true, placeholder: "chat-default" },
        {
          name: "modelMappingId",
          label: "Model mapping",
          type: "select",
          required: true,
          options: models.map((model) => ({ value: model.id, label: model.publicModelName })),
          optionEndpoint: "/api/admin/models",
          optionValue: "id",
          optionLabel: "publicModelName",
          emptyOptionLabel: "Create a model mapping first",
        },
        { name: "priority", label: "Priority", type: "number", defaultValue: 100 },
        { name: "enabled", label: "Enabled", type: "checkbox", defaultValue: true },
      ]}
    />
    </div>
  );
}
