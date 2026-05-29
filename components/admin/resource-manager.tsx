"use client";

import { useEffect, useMemo, useState } from "react";

type FieldOption = {
  label: string;
  value: string;
};

export type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "checkbox" | "password" | "textarea" | "select";
  placeholder?: string;
  createOnly?: boolean;
  formOnly?: boolean;
  tableOnly?: boolean;
  required?: boolean;
  defaultValue?: string | number | boolean;
  help?: string;
  options?: FieldOption[];
  optionEndpoint?: string;
  optionValue?: string;
  optionLabel?: string;
  emptyOptionLabel?: string;
};

type ApiItem = Record<string, unknown> & { id: string };

export function ResourceManager({
  title,
  endpoint,
  fields,
  returnPath,
  initialCreate = false,
  initialItems = [],
  notice,
  testEndpointTemplate,
}: {
  title: string;
  endpoint: string;
  fields: Field[];
  returnPath: string;
  initialCreate?: boolean;
  initialItems?: ApiItem[];
  notice?: string | null;
  testEndpointTemplate?: string;
}) {
  const [items, setItems] = useState<ApiItem[]>(initialItems);
  const [editing, setEditing] = useState<ApiItem | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(() =>
    initialCreate
      ? Object.fromEntries(
          fields.filter((field) => !field.tableOnly).map((field) => [field.name, defaultFormValue(field)]),
        )
      : {},
  );
  const [message, setMessage] = useState<string | null>(notice ?? null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, FieldOption[]>>({});

  const visibleFields = useMemo(
    () => fields.filter((field) => !field.tableOnly && (!editing || !field.createOnly)),
    [editing, fields],
  );
  const tableFields = useMemo(() => fields.filter((field) => !field.formOnly).slice(0, 6), [fields]);

  function defaultFormValue(field: Field): string | number | boolean {
    if (field.defaultValue !== undefined) return field.defaultValue;
    if (field.type === "checkbox") return false;
    return "";
  }

  function fieldOptions(field: Field): FieldOption[] {
    return [...(field.options ?? []), ...(dynamicOptions[field.name] ?? [])];
  }

  function payloadFromForm(): Record<string, unknown> {
    return Object.fromEntries(
      fields
        .filter((field) => !field.tableOnly && (!editing || !field.createOnly))
        .map((field) => [field.name, form[field.name]]),
    );
  }

  async function load() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(endpoint);
      const body = (await response.json().catch(() => ({ data: [] }))) as {
        data?: ApiItem[];
        error?: { message?: string };
      };
      if (!response.ok) {
        setMessage(body.error?.message ?? "Failed to load records");
        setItems([]);
        return;
      }
      setItems(body.data ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load records");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [endpoint]);

  useEffect(() => {
    const optionFields = fields.filter((field) => field.optionEndpoint);
    if (!optionFields.length) return;

    let ignore = false;

    async function loadFieldOptions() {
      const next: Record<string, FieldOption[]> = {};
      for (const field of optionFields) {
        if (!field.optionEndpoint) continue;
        try {
          const response = await fetch(field.optionEndpoint);
          const body = (await response.json().catch(() => ({ data: [] }))) as { data?: ApiItem[] };
          next[field.name] = (body.data ?? []).map((item) => {
            const valueKey = field.optionValue ?? "id";
            const labelKey = field.optionLabel ?? valueKey;
            const value = String(item[valueKey] ?? "");
            const label = String(item[labelKey] ?? value);
            return { value, label };
          });
        } catch {
          next[field.name] = [];
        }
      }
      if (!ignore) setDynamicOptions(next);
    }

    void loadFieldOptions();
    return () => {
      ignore = true;
    };
  }, [fields]);

  function startCreate() {
    setEditing(null);
    setForm(
      Object.fromEntries(
        fields.filter((field) => !field.tableOnly).map((field) => [field.name, defaultFormValue(field)]),
      ),
    );
    setMessage(null);
  }

  function startEdit(item: ApiItem) {
    setEditing(item);
    setForm(item);
    setMessage(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSubmitting(true);
    const url = editing ? `${endpoint}/${editing.id}` : endpoint;
    let body: { data?: Record<string, unknown>; error?: { message?: string } } = {};
    try {
      const response = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payloadFromForm()),
      });
      body = (await response.json().catch(() => ({}))) as {
        data?: Record<string, unknown>;
        error?: { message?: string };
      };
      if (!response.ok) {
        setMessage(body.error?.message ?? "Request failed");
        return;
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed");
      return;
    } finally {
      setSubmitting(false);
    }

    setMessage(body.data && "key" in body.data ? `Created key: ${String(body.data.key)}` : "Saved");
    setEditing(null);
    setForm({});
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this item?")) return;
    const response = await fetch(`${endpoint}/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage("Delete failed");
      return;
    }
    await load();
  }

  async function runTest(id: string) {
    if (!testEndpointTemplate) return;
    const response = await fetch(testEndpointTemplate.replace(":id", encodeURIComponent(id)), { method: "POST" });
    const body = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      message?: string;
      error?: { message?: string };
    };
    setMessage(body.message ?? body.error?.message ?? (response.ok ? "Done" : "Failed"));
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-sm text-zinc-400">Create, edit, disable, and delete records.</p>
        </div>
        <a
          href={`${returnPath}?mode=new`}
          onClick={(event) => {
            event.preventDefault();
            startCreate();
          }}
          className="rounded-md bg-cyan-500 px-3 py-2 text-sm font-semibold text-zinc-950"
        >
          New
        </a>
      </div>

      {message ? (
        <div className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-200">{message}</div>
      ) : null}

      {(editing || Object.keys(form).length > 0) && (
        <form action={endpoint} method="post" onSubmit={submit} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <input type="hidden" name="_redirect" value={returnPath} />
          <div className="grid gap-4 md:grid-cols-2">
            {visibleFields.map((field) => (
              <label key={field.name} className="block text-sm text-zinc-300">
                {field.label}
                {field.type === "checkbox" ? (
                  <>
                    <input type="hidden" name={field.name} value="false" />
                    <input
                      type="checkbox"
                      name={field.name}
                      value="true"
                      className="ml-3 align-middle"
                      checked={Boolean(form[field.name])}
                      onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.checked }))}
                    />
                  </>
                ) : field.type === "select" ? (
                  <select
                    className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-cyan-500"
                    name={field.name}
                    value={String(form[field.name] ?? "")}
                    required={field.required}
                    onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                  >
                    <option value="">{field.emptyOptionLabel ?? "Select an option"}</option>
                    {fieldOptions(field).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === "textarea" ? (
                  <textarea
                    className="mt-2 min-h-24 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-cyan-500"
                    name={field.name}
                    value={String(form[field.name] ?? "")}
                    placeholder={field.placeholder}
                    required={field.required}
                    onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                  />
                ) : (
                  <input
                    className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-cyan-500"
                    name={field.name}
                    type={field.type ?? "text"}
                    value={String(form[field.name] ?? "")}
                    placeholder={field.placeholder}
                    required={field.required}
                    onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                  />
                )}
                {field.help ? <span className="mt-1 block text-xs text-zinc-500">{field.help}</span> : null}
              </label>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              disabled={submitting}
              className="rounded-md bg-cyan-500 px-3 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60"
            >
              {submitting ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setForm({});
              }}
              className="rounded-md border border-zinc-700 px-3 py-2 text-sm"
            >
              Cancel
            </button>
            <a href={returnPath} className="rounded-md border border-zinc-700 px-3 py-2 text-sm">
              Back
            </a>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900">
        <table className="w-full text-left text-sm">
          <thead className="text-zinc-400">
            <tr>
              <th className="px-4 py-3">ID</th>
              {tableFields.map((field) => (
                <th key={field.name} className="px-4 py-3">
                  {field.label}
                </th>
              ))}
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-zinc-800">
                <td className="max-w-48 truncate px-4 py-3 font-mono text-xs text-zinc-400">{item.id}</td>
                {tableFields.map((field) => (
                  <td key={field.name} className="max-w-56 truncate px-4 py-3">
                    {String(item[field.name] ?? "")}
                  </td>
                ))}
                <td className="whitespace-nowrap px-4 py-3">
                  <button onClick={() => startEdit(item)} className="mr-2 text-cyan-300 hover:text-cyan-100">
                    Edit
                  </button>
                  {testEndpointTemplate ? (
                    <button onClick={() => runTest(item.id)} className="mr-2 text-emerald-300 hover:text-emerald-100">
                      Test
                    </button>
                  ) : null}
                  <button onClick={() => remove(item.id)} className="text-red-300 hover:text-red-100">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!items.length ? (
              <tr>
                <td className="px-4 py-6 text-zinc-400" colSpan={tableFields.length + 2}>
                  {loading ? "Loading..." : "No records yet."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
