import { ResourceManager } from "@/components/admin/resource-manager";
import { getDb } from "@/lib/db/client";
import { relayApiKeys } from "@/lib/db/schema";
import { serializeRelayKey } from "@/lib/admin/serializers";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function toClientItems(items: Record<string, unknown>[]) {
  return JSON.parse(JSON.stringify(items)) as (Record<string, unknown> & { id: string })[];
}

export default async function KeysPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const keys = await getDb().select().from(relayApiKeys);

  return (
    <ResourceManager
      title="Relay API Keys"
      endpoint="/api/admin/keys"
      returnPath="/dashboard/keys"
      initialCreate={params.mode === "new"}
      initialItems={toClientItems(keys.map(serializeRelayKey))}
      fields={[
        { name: "name", label: "Name", required: true, placeholder: "Local test key" },
        { name: "keyPrefix", label: "Prefix", tableOnly: true },
        { name: "last4", label: "Last 4", tableOnly: true },
        { name: "enabled", label: "Enabled", type: "checkbox", defaultValue: true },
        { name: "monthlyTokenLimit", label: "Monthly token limit", type: "number" },
        { name: "monthlyRequestLimit", label: "Monthly request limit", type: "number" },
      ]}
    />
  );
}
