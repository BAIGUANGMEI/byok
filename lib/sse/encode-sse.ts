export function encodeSse(data: string, event?: string): string {
  const lines: string[] = [];
  if (event) lines.push(`event: ${event}`);
  for (const line of data.split("\n")) {
    lines.push(`data: ${line}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}
