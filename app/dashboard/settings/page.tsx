import { PageHeader } from "@/components/admin/page-header";
import { LocalizedText } from "@/components/localized-text";
import { PreferenceControls } from "@/components/preference-controls";
import { PROVIDER_PRESETS } from "@/lib/providers/presets";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title={<LocalizedText value={{ en: "Settings", zh: "设置" }} />}
        description={<LocalizedText value={{ en: "Runtime configuration is controlled through environment variables.", zh: "运行时配置由环境变量控制。" }} />}
      />
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="font-medium">
          <LocalizedText value={{ en: "Interface preferences", zh: "界面偏好" }} />
        </h3>
        <div className="mt-4">
          <PreferenceControls />
        </div>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="font-medium">
          <LocalizedText value={{ en: "Provider presets", zh: "供应商预设" }} />
        </h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-zinc-400">
              <tr>
                <th className="px-3 py-2"><LocalizedText value={{ en: "Label", zh: "标签" }} /></th>
                <th className="px-3 py-2"><LocalizedText value={{ en: "Type", zh: "类型" }} /></th>
                <th className="px-3 py-2"><LocalizedText value={{ en: "Protocol", zh: "协议" }} /></th>
                <th className="px-3 py-2"><LocalizedText value={{ en: "Base URL", zh: "基础 URL" }} /></th>
              </tr>
            </thead>
            <tbody>
              {PROVIDER_PRESETS.map((preset) => (
                <tr key={preset.providerType} className="border-t border-zinc-800">
                  <td className="px-3 py-2">{preset.label}</td>
                  <td className="px-3 py-2">{preset.providerType}</td>
                  <td className="px-3 py-2">{preset.protocol}</td>
                  <td className="px-3 py-2 font-mono text-xs">{preset.baseUrl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
