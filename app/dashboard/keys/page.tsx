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
      title={{ en: "Relay API Keys", zh: "中继 API 密钥" }}
      endpoint="/api/admin/keys"
      returnPath="/dashboard/keys"
      initialCreate={params.mode === "new"}
      initialItems={toClientItems(keys.map(serializeRelayKey))}
      fields={[
        { name: "name", label: { en: "Name", zh: "名称" }, required: true, placeholder: { en: "Local test key", zh: "本地测试密钥" } },
        { name: "keyPrefix", label: { en: "Prefix", zh: "前缀" }, tableOnly: true },
        { name: "last4", label: { en: "Last 4", zh: "后 4 位" }, tableOnly: true },
        { name: "enabled", label: { en: "Enabled", zh: "启用" }, type: "checkbox", defaultValue: true },
        { name: "monthlyTokenLimit", label: { en: "Monthly token limit", zh: "每月 Token 限额" }, type: "number" },
        { name: "monthlyRequestLimit", label: { en: "Monthly request limit", zh: "每月请求限额" }, type: "number" },
      ]}
    />
  );
}
