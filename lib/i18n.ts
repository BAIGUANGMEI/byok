export type Language = "en" | "zh";

export type LocalizedText = string | { en: string; zh: string };

export const defaultLanguage: Language = "en";

export const translations = {
  language: { en: "Language", zh: "语言" },
  english: { en: "English", zh: "英文" },
  chinese: { en: "中文", zh: "中文" },
  theme: { en: "Theme", zh: "主题" },
  dark: { en: "Dark", zh: "暗色" },
  light: { en: "Light", zh: "亮色" },
  signOut: { en: "Sign out", zh: "退出登录" },
  createEditDelete: { en: "Create, edit, disable, and delete records.", zh: "创建、编辑、停用和删除记录。" },
  new: { en: "New", zh: "新增" },
  edit: { en: "Edit", zh: "编辑" },
  test: { en: "Test", zh: "测试" },
  delete: { en: "Delete", zh: "删除" },
  actions: { en: "Actions", zh: "操作" },
  close: { en: "Close", zh: "关闭" },
  cancel: { en: "Cancel", zh: "取消" },
  save: { en: "Save", zh: "保存" },
  saving: { en: "Saving...", zh: "保存中..." },
  loading: { en: "Loading...", zh: "加载中..." },
  noRecords: { en: "No records yet.", zh: "暂无记录。" },
  noData: { en: "No data yet.", zh: "暂无数据。" },
  deleteConfirm: { en: "Delete this item?", zh: "确定删除这条记录吗？" },
  failedToLoad: { en: "Failed to load records", zh: "加载记录失败" },
  requestFailed: { en: "Request failed", zh: "请求失败" },
  deleteFailed: { en: "Delete failed", zh: "删除失败" },
  saved: { en: "Saved", zh: "已保存" },
  created: { en: "Created", zh: "已创建" },
  createdKey: { en: "Created key", zh: "已创建密钥" },
  done: { en: "Done", zh: "完成" },
  failed: { en: "Failed", zh: "失败" },
  selectOption: { en: "Select an option", zh: "请选择" },
  id: { en: "ID", zh: "ID" },
} as const;

export type TranslationKey = keyof typeof translations;

export function resolveLocalizedText(value: LocalizedText, language: Language): string {
  if (typeof value === "string") return value;
  return value[language] ?? value.en;
}
