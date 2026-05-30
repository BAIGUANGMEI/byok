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
        title={{ en: "Provider Sources", zh: "供应商来源" }}
        endpoint="/api/admin/sources"
        returnPath="/dashboard/sources"
        initialCreate={params.mode === "new"}
        notice={params.status === "created" ? { en: "Created", zh: "已创建" } : null}
        initialItems={toClientItems(rows.map(serializeSource))}
        testEndpointTemplate="/api/admin/sources/:id/test"
        fields={[
          { name: "name", label: { en: "Name", zh: "名称" }, required: true, placeholder: "Kimi" },
          {
            name: "providerType",
            label: { en: "Provider type", zh: "供应商类型" },
            type: "select",
            required: true,
            defaultValue: "openai_compatible",
            options: [
              { label: { en: "OpenAI compatible", zh: "OpenAI 兼容" }, value: "openai_compatible" },
              { label: { en: "Anthropic compatible", zh: "Anthropic 兼容" }, value: "anthropic_compatible" },
              { label: "Kimi / Moonshot", value: "kimi" },
              { label: "DeepSeek", value: "deepseek" },
              { label: "MiMo", value: "mimo" },
              { label: { en: "Custom", zh: "自定义" }, value: "custom" },
            ],
          },
          {
            name: "protocol",
            label: { en: "Upstream API format", zh: "上游 API 格式" },
            type: "select",
            required: true,
            defaultValue: "openai_chat",
            options: [
              { label: { en: "OpenAI-compatible upstream", zh: "OpenAI 兼容上游" }, value: "openai_chat" },
              { label: { en: "Anthropic-compatible upstream", zh: "Anthropic 兼容上游" }, value: "anthropic_messages" },
            ],
          },
          { name: "baseUrl", label: { en: "Base URL", zh: "基础 URL" }, required: true, placeholder: "https://api.openai.com/v1" },
          {
            name: "authType",
            label: { en: "Auth type", zh: "认证类型" },
            type: "select",
            required: true,
            defaultValue: "bearer",
            options: [
              { label: "Authorization: Bearer", value: "bearer" },
              { label: "x-api-key", value: "x-api-key" },
              { label: "api-key", value: "api-key" },
            ],
          },
          { name: "apiKey", label: { en: "API key", zh: "API 密钥" }, type: "password", createOnly: true, formOnly: true, required: true },
          { name: "extraHeaders", label: { en: "Extra headers JSON", zh: "额外请求头 JSON" }, type: "textarea", formOnly: true, placeholder: "{\"x-foo\":\"bar\"}" },
          { name: "timeoutMs", label: { en: "Timeout ms", zh: "超时毫秒" }, type: "number", defaultValue: 60000 },
          { name: "priority", label: { en: "Priority", zh: "优先级" }, type: "number", defaultValue: 100 },
          { name: "enabled", label: { en: "Enabled", zh: "启用" }, type: "checkbox", defaultValue: true },
        ]}
      />
    </div>
  );
}
