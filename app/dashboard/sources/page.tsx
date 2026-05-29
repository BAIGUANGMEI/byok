import { ResourceManager } from "@/components/admin/resource-manager";
import { ProviderTabs } from "@/components/admin/section-tabs";
import { getDb } from "@/lib/db/client";
import { providerSources } from "@/lib/db/schema";
import { serializeSource } from "@/lib/admin/serializers";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function toClientItems(items: Record<string, unknown>[]) {
  return JSON.parse(JSON.stringify(items)) as (Record<string, unknown> & { id: string })[];
}

export default async function SourcesPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const rows = await getDb().select().from(providerSources);

  return (
    <div className="space-y-5">
      <ProviderTabs />
    <ResourceManager
      title="Provider Sources"
      endpoint="/api/admin/sources"
      returnPath="/dashboard/sources"
      initialCreate={params.mode === "new"}
      notice={params.status === "created" ? "Created" : null}
      initialItems={toClientItems(rows.map(serializeSource))}
      testEndpointTemplate="/api/admin/sources/:id/test"
      fields={[
        { name: "name", label: "Name", required: true, placeholder: "Kimi" },
        {
          name: "providerType",
          label: "Provider type",
          type: "select",
          required: true,
          defaultValue: "openai_compatible",
          options: [
            { label: "OpenAI compatible", value: "openai_compatible" },
            { label: "Anthropic compatible", value: "anthropic_compatible" },
            { label: "Kimi / Moonshot", value: "kimi" },
            { label: "DeepSeek", value: "deepseek" },
            { label: "MiMo", value: "mimo" },
            { label: "Custom", value: "custom" },
          ],
        },
        {
          name: "protocol",
          label: "Protocol",
          type: "select",
          required: true,
          defaultValue: "openai_chat",
          options: [
            { label: "OpenAI chat", value: "openai_chat" },
            { label: "Anthropic messages", value: "anthropic_messages" },
          ],
        },
        { name: "baseUrl", label: "Base URL", required: true, placeholder: "https://api.openai.com/v1" },
        {
          name: "authType",
          label: "Auth type",
          type: "select",
          required: true,
          defaultValue: "bearer",
          options: [
            { label: "Authorization: Bearer", value: "bearer" },
            { label: "x-api-key", value: "x-api-key" },
            { label: "api-key", value: "api-key" },
          ],
        },
        { name: "apiKey", label: "API key", type: "password", createOnly: true, formOnly: true, required: true },
        { name: "extraHeaders", label: "Extra headers JSON", type: "textarea", formOnly: true, placeholder: "{\"x-foo\":\"bar\"}" },
        { name: "timeoutMs", label: "Timeout ms", type: "number", defaultValue: 60000 },
        { name: "priority", label: "Priority", type: "number", defaultValue: 100 },
        { name: "enabled", label: "Enabled", type: "checkbox", defaultValue: true },
      ]}
    />
    </div>
  );
}
