import { PROVIDER_PRESETS } from "@/lib/providers/presets";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Settings</h2>
        <p className="text-sm text-zinc-400">Runtime configuration is controlled through environment variables.</p>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="font-medium">Provider presets</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-zinc-400">
              <tr>
                <th className="px-3 py-2">Label</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Protocol</th>
                <th className="px-3 py-2">Base URL</th>
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
