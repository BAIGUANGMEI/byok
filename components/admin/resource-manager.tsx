"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { usePreferences } from "@/components/preferences-provider";
import type { LocalizedText } from "@/lib/i18n";

type FieldOption = {
  label: LocalizedText;
  value: string;
};

export type Field = {
  name: string;
  label: LocalizedText;
  type?: "text" | "number" | "checkbox" | "password" | "textarea" | "select";
  placeholder?: LocalizedText;
  createOnly?: boolean;
  formOnly?: boolean;
  tableOnly?: boolean;
  required?: boolean;
  defaultValue?: string | number | boolean;
  help?: LocalizedText;
  options?: FieldOption[];
  optionEndpoint?: string;
  optionValue?: string;
  optionLabel?: string;
  emptyOptionLabel?: LocalizedText;
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
  title: LocalizedText;
  endpoint: string;
  fields: Field[];
  returnPath: string;
  initialCreate?: boolean;
  initialItems?: ApiItem[];
  notice?: LocalizedText | null;
  testEndpointTemplate?: string;
}) {
  const { text, t } = usePreferences();
  const [items, setItems] = useState<ApiItem[]>(initialItems);
  const [editing, setEditing] = useState<ApiItem | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(() =>
    initialCreate
      ? Object.fromEntries(
          fields.filter((field) => !field.tableOnly).map((field) => [field.name, defaultFormValue(field)]),
        )
      : {},
  );
  const [message, setMessage] = useState<string | null>(notice ? text(notice) : null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, FieldOption[]>>({});
  const modalRef = useRef<HTMLDivElement | null>(null);

  const visibleFields = useMemo(
    () => fields.filter((field) => !field.tableOnly && (!editing || !field.createOnly)),
    [editing, fields],
  );
  const tableFields = useMemo(() => fields.filter((field) => !field.formOnly).slice(0, 6), [fields]);
  const modalOpen = editing !== null || Object.keys(form).length > 0;
  const titleText = text(title);
  const closeModal = useCallback(() => {
    setEditing(null);
    setForm({});
    setMessage(null);
  }, []);

  function defaultFormValue(field: Field): string | number | boolean {
    if (field.defaultValue !== undefined) return field.defaultValue;
    if (field.type === "checkbox") return false;
    return "";
  }

  function fieldOptions(field: Field): FieldOption[] {
    const options = [...(field.options ?? []), ...(dynamicOptions[field.name] ?? [])];
    const seen = new Set<string>();
    return options.filter((option) => {
      if (seen.has(option.value)) return false;
      seen.add(option.value);
      return true;
    });
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
        setMessage(body.error?.message ?? t("failedToLoad"));
        setItems([]);
        return;
      }
      setItems(body.data ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("failedToLoad"));
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

  useEffect(() => {
    if (!modalOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) closeModal();
    };

    window.addEventListener("keydown", handleKeyDown);
    const firstInput = modalRef.current?.querySelector<HTMLElement>("input:not([type='hidden']), select, textarea, button");
    firstInput?.focus();

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeModal, modalOpen, submitting]);

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
        setMessage(body.error?.message ?? t("requestFailed"));
        return;
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("requestFailed"));
      return;
    } finally {
      setSubmitting(false);
    }

    const successMessage = body.data && "key" in body.data ? `${t("createdKey")}: ${String(body.data.key)}` : t("saved");
    setEditing(null);
    setForm({});
    await load();
    setMessage(successMessage);
  }

  async function remove(id: string) {
    if (!confirm(t("deleteConfirm"))) return;
    const response = await fetch(`${endpoint}/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage(t("deleteFailed"));
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
    setMessage(body.message ?? body.error?.message ?? (response.ok ? t("done") : t("failed")));
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={titleText}
        description={t("createEditDelete")}
        action={
          <a
            href={`${returnPath}?mode=new`}
            onClick={(event) => {
              event.preventDefault();
              startCreate();
            }}
            className="codex-button inline-flex rounded-md px-3 py-2 text-sm font-semibold"
          >
            {t("new")}
          </a>
        }
      />

      {!modalOpen && message ? (
        <div className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-200">{message}</div>
      ) : null}

      {modalOpen ? (
        <div
          className="resource-modal-backdrop fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm md:items-center"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !submitting) closeModal();
          }}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="resource-modal-title"
            className="resource-modal-enter w-full max-w-3xl rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/40"
          >
            <div className="flex items-center justify-between gap-4 border-b border-zinc-800 px-5 py-4">
              <h3 id="resource-modal-title" className="text-lg font-semibold">
                {editing ? `${t("edit")} ${titleText}` : `${t("new")} ${titleText}`}
              </h3>
              <button
                type="button"
                aria-label={t("close")}
                onClick={closeModal}
                disabled={submitting}
                className="grid h-8 w-8 place-items-center rounded-md border border-zinc-700 text-lg leading-none text-zinc-300 hover:border-zinc-500 hover:text-white disabled:opacity-50"
              >
                x
              </button>
            </div>
            <form action={endpoint} method="post" onSubmit={submit} className="p-5">
              <input type="hidden" name="_redirect" value={returnPath} />
              {message ? (
                <div className="mb-4 rounded-md border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-200">
                  {message}
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                {visibleFields.map((field) => (
                  <label key={field.name} className="block text-sm text-zinc-300">
                    {text(field.label)}
                    {field.type === "checkbox" ? (
                      <span className="mt-2 flex min-h-10 items-center rounded-md border border-zinc-700 bg-zinc-950 px-3">
                        <input type="hidden" name={field.name} value="false" />
                        <input
                          type="checkbox"
                          name={field.name}
                          value="true"
                          className="h-4 w-4"
                          checked={Boolean(form[field.name])}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, [field.name]: event.target.checked }))
                          }
                        />
                      </span>
                    ) : field.type === "select" ? (
                      <select
                        className="codex-focus mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                        name={field.name}
                        value={String(form[field.name] ?? "")}
                        required={field.required}
                        onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                      >
                        <option value="">{field.emptyOptionLabel ? text(field.emptyOptionLabel) : t("selectOption")}</option>
                        {fieldOptions(field).map((option) => (
                          <option key={option.value} value={option.value}>
                            {text(option.label)}
                          </option>
                        ))}
                      </select>
                    ) : field.type === "textarea" ? (
                      <textarea
                        className="codex-focus mt-2 min-h-24 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                        name={field.name}
                        value={String(form[field.name] ?? "")}
                        placeholder={field.placeholder ? text(field.placeholder) : undefined}
                        required={field.required}
                        onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                      />
                    ) : (
                      <input
                        className="codex-focus mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                        name={field.name}
                        type={field.type ?? "text"}
                        value={String(form[field.name] ?? "")}
                        placeholder={field.placeholder ? text(field.placeholder) : undefined}
                        required={field.required}
                        onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                      />
                    )}
                    {field.help ? <span className="mt-1 block text-xs text-zinc-500">{text(field.help)}</span> : null}
                  </label>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="rounded-md border border-zinc-700 px-3 py-2 text-sm hover:border-zinc-500 disabled:opacity-60"
                >
                  {t("cancel")}
                </button>
                <button
                  disabled={submitting}
                  className="codex-button rounded-md px-3 py-2 text-sm font-semibold"
                >
                  {submitting ? t("saving") : t("save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900">
        <table className="w-full text-left text-sm">
          <thead className="text-zinc-400">
            <tr>
              <th className="px-4 py-3">{t("id")}</th>
              {tableFields.map((field) => (
                <th key={field.name} className="px-4 py-3">
                  {text(field.label)}
                </th>
              ))}
              <th className="px-4 py-3">{t("actions")}</th>
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
                  <button onClick={() => startEdit(item)} className="mr-2 text-blue-300 hover:text-blue-100">
                    {t("edit")}
                  </button>
                  {testEndpointTemplate ? (
                    <button onClick={() => runTest(item.id)} className="mr-2 text-emerald-300 hover:text-emerald-100">
                      {t("test")}
                    </button>
                  ) : null}
                  <button onClick={() => remove(item.id)} className="text-red-300 hover:text-red-100">
                    {t("delete")}
                  </button>
                </td>
              </tr>
            ))}
            {!items.length ? (
              <tr>
                <td className="px-4 py-6 text-zinc-400" colSpan={tableFields.length + 2}>
                  {loading ? t("loading") : t("noRecords")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
