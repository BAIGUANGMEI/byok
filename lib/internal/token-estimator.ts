import type { InternalChatRequest } from "@/lib/internal/types";

export function estimateTokensFromText(text: string): number {
  let ascii = 0;
  let cjk = 0;
  let other = 0;

  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code <= 0x007f) ascii += 1;
    else if (code >= 0x4e00 && code <= 0x9fff) cjk += 1;
    else other += 1;
  }

  return Math.ceil(ascii / 4 + cjk * 1.1 + other / 2);
}

export function estimateInputTokens(request: InternalChatRequest): number {
  const system = request.system ? estimateTokensFromText(request.system) : 0;
  const messages = request.messages.reduce((total, message) => {
    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("\n");
    return total + estimateTokensFromText(text) + 4;
  }, 0);
  return system + messages;
}
