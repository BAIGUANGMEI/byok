import { PageHeader } from "@/components/admin/page-header";
import { LocalizedText } from "@/components/localized-text";

type Localized = { en: string; zh: string };

type FieldRow = {
  name: string;
  type: string;
  required: Localized;
  description: Localized;
};

type FeatureRow = {
  provider: string;
  upstream: string;
  status: Localized;
  details: Localized;
  limits: Localized;
};

const openAIExample = `curl http://localhost:3000/v1/chat/completions \\
  -H "Authorization: Bearer sk-relay-xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "coding",
    "messages": [
      { "role": "user", "content": "Introduce yourself in one sentence" }
    ],
    "stream": false
  }'`;

const openAIToolsExample = `curl http://localhost:3000/v1/chat/completions \\
  -H "Authorization: Bearer sk-relay-xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "coding",
    "messages": [
      { "role": "user", "content": "What is the weather in Hong Kong?" }
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_weather",
          "description": "Get weather for a city",
          "parameters": {
            "type": "object",
            "properties": {
              "city": { "type": "string" }
            },
            "required": ["city"]
          }
        }
      }
    ],
    "tool_choice": "auto"
  }'`;

const kimiVideoExample = `python3 - <<'PY'
import base64, json

with open("/tmp/kimi-test.mp4", "rb") as f:
    video_b64 = base64.b64encode(f.read()).decode()

payload = {
    "model": "kimi-k2.6",
    "max_completion_tokens": 1024,
    "messages": [
        {
            "role": "user",
            "content": [
                {
                    "type": "video_url",
                    "video_url": {
                        "url": f"data:video/mp4;base64,{video_b64}"
                    }
                },
                { "type": "text", "text": "请描述这个视频的主要内容。" }
            ]
        }
    ]
}

with open("/tmp/kimi-video-request.json", "w") as f:
    json.dump(payload, f)
PY

curl http://localhost:3000/v1/chat/completions \\
  -H "Authorization: Bearer sk-relay-xxx" \\
  -H "Content-Type: application/json" \\
  --data-binary @/tmp/kimi-video-request.json`;

const anthropicExample = `curl http://localhost:3000/v1/messages \\
  -H "x-api-key: sk-relay-xxx" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "coding",
    "max_tokens": 1024,
    "messages": [
      { "role": "user", "content": "Introduce yourself in one sentence" }
    ],
    "stream": false
  }'`;

const anthropicToolsExample = `curl http://localhost:3000/v1/messages \\
  -H "x-api-key: sk-relay-xxx" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "coding",
    "max_tokens": 1024,
    "messages": [
      { "role": "user", "content": "What is the weather in Hong Kong?" }
    ],
    "tools": [
      {
        "name": "get_weather",
        "description": "Get weather for a city",
        "input_schema": {
          "type": "object",
          "properties": {
            "city": { "type": "string" }
          },
          "required": ["city"]
        }
      }
    ],
    "tool_choice": { "type": "auto" }
  }'`;

const streamExample = `curl -N http://localhost:3000/v1/chat/completions \\
  -H "Authorization: Bearer sk-relay-xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "coding",
    "messages": [
      { "role": "user", "content": "Write a TypeScript debounce function" }
    ],
    "stream": true
  }'`;

const anthropicImageExample = `curl http://localhost:3000/v1/messages \\
  -H "x-api-key: sk-relay-xxx" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "vision",
    "max_tokens": 1024,
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "image",
            "source": {
              "type": "base64",
              "media_type": "image/jpeg",
              "data": "BASE64_IMAGE_DATA"
            }
          },
          { "type": "text", "text": "Describe this image." }
        ]
      }
    ]
  }'`;

const openAIRequestFields: FieldRow[] = [
  {
    name: "model",
    type: "string",
    required: { en: "Required", zh: "必填" },
    description: {
      en: "Public BYOK model name or alias. BYOK resolves it to the configured upstream model.",
      zh: "BYOK 公开模型名或别名。BYOK 会解析到已配置的上游模型。",
    },
  },
  {
    name: "messages",
    type: "array",
    required: { en: "Required", zh: "必填" },
    description: {
      en: "OpenAI-style chat messages. Supported roles are system, developer, user, assistant, and tool. System and developer messages are merged into the internal system prompt.",
      zh: "OpenAI 风格消息数组。支持 system、developer、user、assistant、tool。system 和 developer 会合并为内部 system prompt。",
    },
  },
  {
    name: "stream",
    type: "boolean",
    required: { en: "Optional", zh: "可选" },
    description: {
      en: "When true, returns server-sent events and ends with data: [DONE].",
      zh: "为 true 时返回 SSE 流，并以 data: [DONE] 结束。",
    },
  },
  {
    name: "max_tokens",
    type: "integer",
    required: { en: "Optional", zh: "可选" },
    description: {
      en: "Maximum output tokens for standard OpenAI-compatible upstream providers.",
      zh: "标准 OpenAI 兼容上游的最大输出 token。",
    },
  },
  {
    name: "max_completion_tokens",
    type: "integer",
    required: { en: "Optional", zh: "可选" },
    description: {
      en: "Accepted by BYOK clients. For Kimi and MiMo upstream calls, BYOK sends this field instead of max_tokens.",
      zh: "BYOK 客户端可传。调用 Kimi 和 MiMo 上游时，BYOK 会发送该字段而不是 max_tokens。",
    },
  },
  {
    name: "temperature",
    type: "number",
    required: { en: "Optional", zh: "可选" },
    description: {
      en: "Sampling temperature. Passed through when present.",
      zh: "采样温度。传入时会透传给上游。",
    },
  },
  {
    name: "top_p",
    type: "number",
    required: { en: "Optional", zh: "可选" },
    description: {
      en: "Nucleus sampling parameter. Passed through when present.",
      zh: "核采样参数。传入时会透传给上游。",
    },
  },
  {
    name: "stop",
    type: "string | string[]",
    required: { en: "Optional", zh: "可选" },
    description: {
      en: "Stop sequence or list of stop sequences.",
      zh: "停止序列或停止序列数组。",
    },
  },
  {
    name: "tools",
    type: "array",
    required: { en: "Optional", zh: "可选" },
    description: {
      en: "OpenAI function tools. BYOK also converts them to Anthropic tool schemas when the upstream source uses Anthropic Messages.",
      zh: "OpenAI function tools。当上游为 Anthropic Messages 时，BYOK 会转换为 Anthropic 工具 schema。",
    },
  },
  {
    name: "tool_choice",
    type: "string | object",
    required: { en: "Optional", zh: "可选" },
    description: {
      en: "Tool selection policy. Supports auto, none, required, or a specific function object.",
      zh: "工具选择策略。支持 auto、none、required 或指定 function object。",
    },
  },
  {
    name: "response_format",
    type: "object",
    required: { en: "Optional", zh: "可选" },
    description: {
      en: "JSON mode or JSON schema object. Requires the model mapping to enable JSON mode.",
      zh: "JSON mode 或 JSON schema。需要模型映射启用 JSON mode。",
    },
  },
  {
    name: "stream_options",
    type: "object",
    required: { en: "Optional", zh: "可选" },
    description: {
      en: "Forwarded to OpenAI-compatible upstream providers. BYOK adds include_usage=true for streaming calls when requesting upstream usage.",
      zh: "会透传给 OpenAI 兼容上游。流式请求时 BYOK 会在需要上游用量时加入 include_usage=true。",
    },
  },
  {
    name: "provider-specific fields",
    type: "any",
    required: { en: "Optional", zh: "可选" },
    description: {
      en: "Unknown top-level fields are preserved and sent upstream, such as DeepSeek thinking/reasoning fields, Kimi prompt_cache_key and safety_identifier, or MiMo extension fields.",
      zh: "未知顶层字段会保留并发送给上游，例如 DeepSeek thinking/reasoning 字段、Kimi prompt_cache_key 和 safety_identifier、MiMo 扩展字段。",
    },
  },
];

const openAIMessageFields: FieldRow[] = [
  {
    name: "role",
    type: "string",
    required: { en: "Required", zh: "必填" },
    description: {
      en: "system, developer, user, assistant, or tool.",
      zh: "system、developer、user、assistant 或 tool。",
    },
  },
  {
    name: "content",
    type: "string | array",
    required: { en: "Required", zh: "必填" },
    description: {
      en: "Text string or content blocks. BYOK recognizes text and image_url; unknown blocks are preserved for provider-specific multimodal features such as Kimi video_url.",
      zh: "文本字符串或内容块数组。BYOK 识别 text 和 image_url；未知内容块会保留，用于 Kimi video_url 等供应商多模态能力。",
    },
  },
  {
    name: "name",
    type: "string",
    required: { en: "Optional", zh: "可选" },
    description: {
      en: "Optional participant name, forwarded to OpenAI-compatible upstreams.",
      zh: "可选参与者名称，会转发给 OpenAI 兼容上游。",
    },
  },
  {
    name: "tool_call_id",
    type: "string",
    required: { en: "Tool only", zh: "tool 消息必填" },
    description: {
      en: "ID of the tool call that this tool message answers.",
      zh: "该 tool 消息所响应的工具调用 ID。",
    },
  },
  {
    name: "tool_calls",
    type: "array",
    required: { en: "Assistant only", zh: "assistant 消息可用" },
    description: {
      en: "Assistant tool calls. BYOK converts them to Anthropic tool_use blocks when needed.",
      zh: "assistant 工具调用。需要时 BYOK 会转换为 Anthropic tool_use block。",
    },
  },
  {
    name: "reasoning_content",
    type: "string",
    required: { en: "Optional", zh: "可选" },
    description: {
      en: "Reasoning text used by providers such as DeepSeek reasoner. Preserved in requests and responses.",
      zh: "DeepSeek reasoner 等供应商使用的推理文本。请求和响应中都会保留。",
    },
  },
];

const anthropicRequestFields: FieldRow[] = [
  {
    name: "model",
    type: "string",
    required: { en: "Required", zh: "必填" },
    description: {
      en: "Public BYOK model name or alias.",
      zh: "BYOK 公开模型名或别名。",
    },
  },
  {
    name: "max_tokens",
    type: "integer",
    required: { en: "Optional", zh: "可选" },
    description: {
      en: "Maximum output tokens. BYOK defaults to 1024 when omitted.",
      zh: "最大输出 token。未传时 BYOK 默认使用 1024。",
    },
  },
  {
    name: "messages",
    type: "array",
    required: { en: "Required", zh: "必填" },
    description: {
      en: "Anthropic-style messages. Supported roles are user and assistant.",
      zh: "Anthropic 风格消息数组。支持 user 和 assistant。",
    },
  },
  {
    name: "system",
    type: "string | text block[]",
    required: { en: "Optional", zh: "可选" },
    description: {
      en: "System prompt string or an array of text blocks.",
      zh: "system prompt 字符串或 text block 数组。",
    },
  },
  {
    name: "stream",
    type: "boolean",
    required: { en: "Optional", zh: "可选" },
    description: {
      en: "When true, returns Anthropic-compatible server-sent events.",
      zh: "为 true 时返回 Anthropic 兼容 SSE 流。",
    },
  },
  {
    name: "temperature",
    type: "number",
    required: { en: "Optional", zh: "可选" },
    description: {
      en: "Sampling temperature. Passed through when present.",
      zh: "采样温度。传入时会透传给上游。",
    },
  },
  {
    name: "top_p",
    type: "number",
    required: { en: "Optional", zh: "可选" },
    description: {
      en: "Nucleus sampling parameter. Passed through when present.",
      zh: "核采样参数。传入时会透传给上游。",
    },
  },
  {
    name: "stop_sequences",
    type: "string[]",
    required: { en: "Optional", zh: "可选" },
    description: {
      en: "Stop sequence list. BYOK maps it to stop for OpenAI-compatible upstreams.",
      zh: "停止序列数组。调用 OpenAI 兼容上游时 BYOK 会映射为 stop。",
    },
  },
  {
    name: "tools",
    type: "array",
    required: { en: "Optional", zh: "可选" },
    description: {
      en: "Anthropic tool schemas. BYOK converts them to OpenAI function tools when needed.",
      zh: "Anthropic 工具 schema。需要时 BYOK 会转换为 OpenAI function tools。",
    },
  },
  {
    name: "tool_choice",
    type: "object",
    required: { en: "Optional", zh: "可选" },
    description: {
      en: "Tool selection policy, such as auto, any, none, or a named tool.",
      zh: "工具选择策略，例如 auto、any、none 或指定工具。",
    },
  },
  {
    name: "provider-specific fields",
    type: "any",
    required: { en: "Optional", zh: "可选" },
    description: {
      en: "Unknown top-level fields are preserved and sent upstream, including thinking or provider beta fields.",
      zh: "未知顶层字段会保留并发送给上游，包括 thinking 或供应商 beta 字段。",
    },
  },
];

const anthropicContentFields: FieldRow[] = [
  {
    name: "text",
    type: '{ "type": "text", "text": string }',
    required: { en: "Supported", zh: "支持" },
    description: {
      en: "Plain text block.",
      zh: "普通文本块。",
    },
  },
  {
    name: "image",
    type: "base64 | url | file",
    required: { en: "Supported", zh: "支持" },
    description: {
      en: "Anthropic image block. BYOK preserves base64, url, and file sources for Anthropic upstreams and converts supported sources to OpenAI image_url for OpenAI upstreams.",
      zh: "Anthropic 图片块。Anthropic 上游会保留 base64、url、file；OpenAI 上游会转换可支持的 source 为 image_url。",
    },
  },
  {
    name: "tool_use",
    type: "object",
    required: { en: "Supported", zh: "支持" },
    description: {
      en: "Assistant tool call block. Converted to OpenAI tool_calls when needed.",
      zh: "assistant 工具调用块。需要时会转换为 OpenAI tool_calls。",
    },
  },
  {
    name: "tool_result",
    type: "object",
    required: { en: "Supported", zh: "支持" },
    description: {
      en: "User tool result block. Converted to OpenAI tool messages when needed.",
      zh: "user 工具结果块。需要时会转换为 OpenAI tool 消息。",
    },
  },
  {
    name: "thinking",
    type: "object",
    required: { en: "Supported", zh: "支持" },
    description: {
      en: "Reasoning/thinking block. BYOK preserves it and maps it to OpenAI reasoning_content when needed.",
      zh: "推理/thinking 块。BYOK 会保留，并在需要时映射为 OpenAI reasoning_content。",
    },
  },
  {
    name: "unknown blocks",
    type: "object",
    required: { en: "Passthrough", zh: "透传" },
    description: {
      en: "Unknown block objects are preserved for provider-specific extensions.",
      zh: "未知内容块对象会保留，用于供应商特有扩展。",
    },
  },
];

const openAIResponseFields: FieldRow[] = [
  {
    name: "id",
    type: "string",
    required: { en: "Always", zh: "总是返回" },
    description: {
      en: "Upstream response ID or generated fallback ID.",
      zh: "上游响应 ID 或 BYOK 生成的兜底 ID。",
    },
  },
  {
    name: "choices[].message.content",
    type: "string | null",
    required: { en: "Always", zh: "总是返回" },
    description: {
      en: "Assistant text. Null when the response only contains tool calls.",
      zh: "assistant 文本。当响应只有工具调用时为 null。",
    },
  },
  {
    name: "choices[].message.reasoning_content",
    type: "string",
    required: { en: "When available", zh: "有则返回" },
    description: {
      en: "Reasoning text from DeepSeek, Kimi, MiMo, or compatible upstreams.",
      zh: "来自 DeepSeek、Kimi、MiMo 或兼容上游的推理文本。",
    },
  },
  {
    name: "choices[].message.tool_calls",
    type: "array",
    required: { en: "When available", zh: "有则返回" },
    description: {
      en: "Function tool calls.",
      zh: "function 工具调用。",
    },
  },
  {
    name: "choices[].finish_reason",
    type: "string",
    required: { en: "Always", zh: "总是返回" },
    description: {
      en: "stop, length, tool_calls, content_filter, or error.",
      zh: "stop、length、tool_calls、content_filter 或 error。",
    },
  },
  {
    name: "usage",
    type: "object",
    required: { en: "When available", zh: "有则返回" },
    description: {
      en: "prompt_tokens, completion_tokens, total_tokens, and prompt_tokens_details.cached_tokens.",
      zh: "prompt_tokens、completion_tokens、total_tokens 和 prompt_tokens_details.cached_tokens。",
    },
  },
];

const anthropicResponseFields: FieldRow[] = [
  {
    name: "id",
    type: "string",
    required: { en: "Always", zh: "总是返回" },
    description: {
      en: "Upstream response ID or generated fallback ID.",
      zh: "上游响应 ID 或 BYOK 生成的兜底 ID。",
    },
  },
  {
    name: "content[]",
    type: "text | thinking | tool_use",
    required: { en: "Always", zh: "总是返回" },
    description: {
      en: "Assistant content blocks. BYOK maps OpenAI text, reasoning_content, and tool_calls into Anthropic blocks.",
      zh: "assistant 内容块。BYOK 会把 OpenAI text、reasoning_content 和 tool_calls 映射为 Anthropic block。",
    },
  },
  {
    name: "stop_reason",
    type: "string",
    required: { en: "Always", zh: "总是返回" },
    description: {
      en: "end_turn, max_tokens, or tool_use.",
      zh: "end_turn、max_tokens 或 tool_use。",
    },
  },
  {
    name: "usage",
    type: "object",
    required: { en: "Always", zh: "总是返回" },
    description: {
      en: "input_tokens, cache_read_input_tokens, cache_creation_input_tokens, and output_tokens.",
      zh: "input_tokens、cache_read_input_tokens、cache_creation_input_tokens 和 output_tokens。",
    },
  },
];

const providerRows: FeatureRow[] = [
  {
    provider: "DeepSeek",
    upstream: "openai_chat",
    status: { en: "First-class chat adapter", zh: "重点聊天适配" },
    details: {
      en: "Chat, streaming, tools, JSON mode, reasoning_content, reasoning/thinking passthrough, logprobs passthrough, stream usage, and prompt cache hit/miss usage.",
      zh: "聊天、流式、工具调用、JSON mode、reasoning_content、reasoning/thinking 透传、logprobs 透传、流式用量、prompt 缓存命中/未命中统计。",
    },
    limits: {
      en: "FIM and non-chat endpoints are not exposed by BYOK.",
      zh: "BYOK 暂不暴露 FIM 和非聊天 endpoint。",
    },
  },
  {
    provider: "Kimi / Moonshot",
    upstream: "openai_chat",
    status: { en: "First-class chat adapter", zh: "重点聊天适配" },
    details: {
      en: "Chat, streaming, max_completion_tokens, tools, JSON mode, thinking passthrough, prompt_cache_key, cached_tokens usage, image_url, and raw video_url blocks.",
      zh: "聊天、流式、max_completion_tokens、工具调用、JSON mode、thinking 透传、prompt_cache_key、cached_tokens 用量、image_url 和原始 video_url 内容块。",
    },
    limits: {
      en: "Public video URLs are not accepted by Kimi; use data:video/...;base64 or ms:// file IDs. Files API is not exposed by BYOK.",
      zh: "Kimi 不接受普通公网视频 URL；请使用 data:video/...;base64 或 ms:// 文件 ID。BYOK 暂不暴露 Files API。",
    },
  },
  {
    provider: "Xiaomi MiMo",
    upstream: "openai_chat / anthropic_messages",
    status: { en: "First-class chat adapter", zh: "重点聊天适配" },
    details: {
      en: "OpenAI and Anthropic upstream formats, api-key auth, max_completion_tokens/max_tokens mapping, tools, thinking/reasoning passthrough, image URL first with base64 fallback, and extra provider fields.",
      zh: "OpenAI 和 Anthropic 上游格式、api-key 认证、max_completion_tokens/max_tokens 映射、工具调用、thinking/reasoning 透传、图片 URL 优先并可回退 base64，以及额外供应商字段。",
    },
    limits: {
      en: "Speech, audio, video generation, and web-search product endpoints are not exposed as BYOK endpoints yet.",
      zh: "语音、音频、视频生成和联网搜索产品 endpoint 暂未作为 BYOK 独立接口暴露。",
    },
  },
  {
    provider: "Custom OpenAI-compatible",
    upstream: "openai_chat",
    status: { en: "Generic adapter", zh: "通用适配" },
    details: {
      en: "Any upstream with /chat/completions and /models can be used. Unknown request fields and content blocks are preserved.",
      zh: "任何提供 /chat/completions 和 /models 的上游都可接入。未知请求字段和内容块会保留。",
    },
    limits: {
      en: "Advanced features depend on the upstream provider's real support.",
      zh: "高级能力取决于上游实际支持情况。",
    },
  },
  {
    provider: "Custom Anthropic-compatible",
    upstream: "anthropic_messages",
    status: { en: "Generic adapter", zh: "通用适配" },
    details: {
      en: "Any upstream with /messages and /models can be used. BYOK maps Anthropic tools/images/thinking to the internal format.",
      zh: "任何提供 /messages 和 /models 的上游都可接入。BYOK 会把 Anthropic tools/images/thinking 映射到内部格式。",
    },
    limits: {
      en: "Advanced features depend on the upstream provider's real support.",
      zh: "高级能力取决于上游实际支持情况。",
    },
  },
];

function Section({
  title,
  description,
  children,
}: {
  title: Localized;
  description?: Localized;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div>
        <h3 className="font-medium">
          <LocalizedText value={title} />
        </h3>
        {description ? (
          <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-400">
            <LocalizedText value={description} />
          </p>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function FieldTable({ rows }: { rows: FieldRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-zinc-400">
          <tr>
            <th className="px-3 py-2">
              <LocalizedText value={{ en: "Field", zh: "字段" }} />
            </th>
            <th className="px-3 py-2">
              <LocalizedText value={{ en: "Type", zh: "类型" }} />
            </th>
            <th className="px-3 py-2">
              <LocalizedText value={{ en: "Required", zh: "是否必填" }} />
            </th>
            <th className="px-3 py-2">
              <LocalizedText value={{ en: "Description", zh: "说明" }} />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-t border-zinc-800 align-top">
              <td className="px-3 py-3 font-mono text-xs text-zinc-100">{row.name}</td>
              <td className="px-3 py-3 font-mono text-xs text-zinc-300">{row.type}</td>
              <td className="px-3 py-3 text-zinc-300">
                <LocalizedText value={row.required} />
              </td>
              <td className="px-3 py-3 leading-6 text-zinc-300">
                <LocalizedText value={row.description} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return <pre className="overflow-x-auto rounded-md bg-zinc-950 p-4 text-xs leading-5 text-zinc-200">{children}</pre>;
}

function EndpointSummary({
  method,
  path,
  auth,
  purpose,
}: {
  method: string;
  path: string;
  auth: string;
  purpose: Localized;
}) {
  return (
    <div className="grid gap-3 border-t border-zinc-800 py-3 text-sm md:grid-cols-[96px_1fr_180px_2fr]">
      <div className="font-mono text-xs text-zinc-300">{method}</div>
      <div className="font-mono text-xs text-zinc-100">{path}</div>
      <div className="text-zinc-300">{auth}</div>
      <div className="text-zinc-300">
        <LocalizedText value={purpose} />
      </div>
    </div>
  );
}

function ProviderMatrix() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-zinc-400">
          <tr>
            <th className="px-3 py-2">
              <LocalizedText value={{ en: "Provider", zh: "供应商" }} />
            </th>
            <th className="px-3 py-2">
              <LocalizedText value={{ en: "Upstream format", zh: "上游格式" }} />
            </th>
            <th className="px-3 py-2">
              <LocalizedText value={{ en: "Status", zh: "状态" }} />
            </th>
            <th className="px-3 py-2">
              <LocalizedText value={{ en: "Supported features", zh: "支持能力" }} />
            </th>
            <th className="px-3 py-2">
              <LocalizedText value={{ en: "Limits", zh: "限制" }} />
            </th>
          </tr>
        </thead>
        <tbody>
          {providerRows.map((row) => (
            <tr key={row.provider} className="border-t border-zinc-800 align-top">
              <td className="px-3 py-3 font-medium text-zinc-100">{row.provider}</td>
              <td className="px-3 py-3 font-mono text-xs text-zinc-300">{row.upstream}</td>
              <td className="px-3 py-3 text-zinc-300">
                <LocalizedText value={row.status} />
              </td>
              <td className="px-3 py-3 leading-6 text-zinc-300">
                <LocalizedText value={row.details} />
              </td>
              <td className="px-3 py-3 leading-6 text-zinc-400">
                <LocalizedText value={row.limits} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReferenceLinks() {
  const links = [
    { label: "DeepSeek Chat API", href: "https://api-docs.deepseek.com/api/create-chat-completion" },
    { label: "Kimi Chat API", href: "https://platform.kimi.ai/docs/api/chat" },
    { label: "Kimi Vision", href: "https://platform.kimi.ai/docs/guide/use-kimi-vision-model" },
    { label: "MiMo OpenAI API", href: "https://platform.xiaomimimo.com/docs/en-US/api/chat/openai-api?target=request-body" },
    { label: "MiMo Anthropic API", href: "https://platform.xiaomimimo.com/docs/en-US/api/chat/anthropic-api" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          className="codex-hover rounded-md border border-zinc-800 px-3 py-2 text-sm text-zinc-300"
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}

export default function DocsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title={<LocalizedText value={{ en: "API Reference", zh: "API 参考" }} />}
        description={
          <LocalizedText
            value={{
              en: "BYOK-compatible endpoints, parameters, response shapes, streaming events, provider adapters, and passthrough behavior.",
              zh: "BYOK 兼容接口、参数、响应结构、流式事件、供应商适配和透传规则。",
            }}
          />
        }
      />

      <Section
        title={{ en: "Authentication", zh: "认证" }}
        description={{
          en: "Relay keys can be sent with either Authorization: Bearer or x-api-key. Upstream provider keys stay encrypted in BYOK and are never exposed to clients.",
          zh: "中继密钥可以通过 Authorization: Bearer 或 x-api-key 发送。上游供应商密钥由 BYOK 加密保存，不暴露给客户端。",
        }}
      >
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
            <div className="font-mono text-xs text-zinc-300">Authorization: Bearer sk-relay-...</div>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
            <div className="font-mono text-xs text-zinc-300">x-api-key: sk-relay-...</div>
          </div>
        </div>
      </Section>

      <Section
        title={{ en: "Exposed Endpoints", zh: "暴露接口" }}
        description={{
          en: "Each public BYOK model can be called through both OpenAI-compatible and Anthropic-compatible client APIs.",
          zh: "每个 BYOK 公开模型都可以通过 OpenAI 兼容和 Anthropic 兼容两种客户端 API 调用。",
        }}
      >
        <EndpointSummary
          method="GET"
          path="/v1/models"
          auth="Bearer / x-api-key"
          purpose={{ en: "List enabled public model names and aliases.", zh: "列出已启用的公开模型名和别名。" }}
        />
        <EndpointSummary
          method="POST"
          path="/v1/chat/completions"
          auth="Bearer / x-api-key"
          purpose={{
            en: "OpenAI-compatible chat completions with streaming, images, raw multimodal blocks, tools, reasoning, JSON mode, and usage tracking.",
            zh: "OpenAI 兼容聊天接口，支持流式、图片、原始多模态块、工具调用、推理、JSON mode 和用量统计。",
          }}
        />
        <EndpointSummary
          method="POST"
          path="/v1/messages"
          auth="Bearer / x-api-key"
          purpose={{
            en: "Anthropic-compatible messages with streaming, images, tools, thinking blocks, and usage tracking.",
            zh: "Anthropic 兼容 messages 接口，支持流式、图片、工具调用、thinking block 和用量统计。",
          }}
        />
      </Section>

      <Section
        title={{ en: "Provider Support Matrix", zh: "供应商支持矩阵" }}
        description={{
          en: "DeepSeek, Kimi, and MiMo have first-class chat adapters. Generic OpenAI-compatible and Anthropic-compatible sources are also supported.",
          zh: "DeepSeek、Kimi 和 MiMo 有重点聊天适配。也支持通用 OpenAI-compatible 和 Anthropic-compatible 来源。",
        }}
      >
        <ProviderMatrix />
      </Section>

      <Section
        title={{ en: "OpenAI-Compatible Request Parameters", zh: "OpenAI 兼容请求参数" }}
        description={{
          en: "These parameters are accepted by POST /v1/chat/completions. BYOK forwards supported fields and preserves unknown top-level provider fields.",
          zh: "这些参数适用于 POST /v1/chat/completions。BYOK 会转发已支持字段，并保留未知顶层供应商字段。",
        }}
      >
        <FieldTable rows={openAIRequestFields} />
      </Section>

      <Section
        title={{ en: "OpenAI Message Fields", zh: "OpenAI 消息字段" }}
        description={{
          en: "Content can be a string or an array. Known blocks are normalized; unknown blocks are sent upstream unchanged for provider extensions.",
          zh: "content 可以是字符串或数组。已知 block 会标准化；未知 block 会原样发送给上游以支持供应商扩展。",
        }}
      >
        <FieldTable rows={openAIMessageFields} />
      </Section>

      <Section
        title={{ en: "OpenAI-Compatible Response", zh: "OpenAI 兼容响应" }}
        description={{
          en: "BYOK maps upstream text, reasoning, tool calls, finish reasons, logprobs, and usage into OpenAI-compatible response fields.",
          zh: "BYOK 会把上游文本、推理、工具调用、finish reason、logprobs 和用量映射为 OpenAI 兼容响应字段。",
        }}
      >
        <FieldTable rows={openAIResponseFields} />
      </Section>

      <Section
        title={{ en: "Anthropic-Compatible Request Parameters", zh: "Anthropic 兼容请求参数" }}
        description={{
          en: "These parameters are accepted by POST /v1/messages. BYOK maps them into the configured upstream format.",
          zh: "这些参数适用于 POST /v1/messages。BYOK 会把它们映射到已配置的上游格式。",
        }}
      >
        <FieldTable rows={anthropicRequestFields} />
      </Section>

      <Section
        title={{ en: "Anthropic Content Blocks", zh: "Anthropic 内容块" }}
        description={{
          en: "BYOK supports Anthropic text, image, tool_use, tool_result, and thinking blocks, and preserves unknown provider blocks.",
          zh: "BYOK 支持 Anthropic text、image、tool_use、tool_result 和 thinking block，并保留未知供应商 block。",
        }}
      >
        <FieldTable rows={anthropicContentFields} />
      </Section>

      <Section
        title={{ en: "Anthropic-Compatible Response", zh: "Anthropic 兼容响应" }}
        description={{
          en: "BYOK maps upstream text, reasoning, tool calls, stop reasons, and usage into Anthropic-compatible response fields.",
          zh: "BYOK 会把上游文本、推理、工具调用、stop reason 和用量映射为 Anthropic 兼容响应字段。",
        }}
      >
        <FieldTable rows={anthropicResponseFields} />
      </Section>

      <Section
        title={{ en: "Streaming Events", zh: "流式事件" }}
        description={{
          en: "OpenAI streams emit chat.completion.chunk objects and [DONE]. Anthropic streams emit message_start, content_block_start, content_block_delta, message_delta, and message_stop.",
          zh: "OpenAI 流返回 chat.completion.chunk 和 [DONE]。Anthropic 流返回 message_start、content_block_start、content_block_delta、message_delta 和 message_stop。",
        }}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h4 className="mb-2 text-sm font-medium text-zinc-200">OpenAI stream</h4>
            <ul className="space-y-2 text-sm leading-6 text-zinc-300">
              <li><code>delta.content</code>: <LocalizedText value={{ en: "text delta", zh: "文本增量" }} /></li>
              <li><code>delta.reasoning_content</code>: <LocalizedText value={{ en: "reasoning delta", zh: "推理增量" }} /></li>
              <li><code>delta.tool_calls</code>: <LocalizedText value={{ en: "tool call start and argument deltas", zh: "工具调用开始和参数增量" }} /></li>
              <li><code>finish_reason</code>: <LocalizedText value={{ en: "stop, length, tool_calls, content_filter, error", zh: "stop、length、tool_calls、content_filter、error" }} /></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-medium text-zinc-200">Anthropic stream</h4>
            <ul className="space-y-2 text-sm leading-6 text-zinc-300">
              <li><code>content_block_delta.text_delta</code>: <LocalizedText value={{ en: "text delta", zh: "文本增量" }} /></li>
              <li><code>content_block_delta.thinking_delta</code>: <LocalizedText value={{ en: "thinking delta", zh: "thinking 增量" }} /></li>
              <li><code>content_block_delta.input_json_delta</code>: <LocalizedText value={{ en: "tool input JSON delta", zh: "工具 input JSON 增量" }} /></li>
              <li><code>message_delta.usage</code>: <LocalizedText value={{ en: "usage updates when upstream provides them", zh: "上游提供时返回用量更新" }} /></li>
            </ul>
          </div>
        </div>
      </Section>

      <Section
        title={{ en: "Usage and Cache Accounting", zh: "用量和缓存统计" }}
        description={{
          en: "BYOK stores request-level and daily usage, including input, output, cache hit, cache miss, total tokens, estimated cost, success rate, and latency.",
          zh: "BYOK 会记录请求级和每日用量，包括输入、输出、缓存命中、缓存未命中、总 token、估算成本、成功率和延迟。",
        }}
      >
        <div className="grid gap-3 text-sm md:grid-cols-3">
          <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
            <div className="font-medium text-zinc-100">OpenAI-compatible</div>
            <p className="mt-2 leading-6 text-zinc-400">
              <code>prompt_tokens</code>, <code>completion_tokens</code>, <code>total_tokens</code>,{" "}
              <code>prompt_tokens_details.cached_tokens</code>, <code>prompt_cache_hit_tokens</code>,{" "}
              <code>prompt_cache_miss_tokens</code>
            </p>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
            <div className="font-medium text-zinc-100">Kimi</div>
            <p className="mt-2 leading-6 text-zinc-400">
              <code>cached_tokens</code>{" "}
              <LocalizedText value={{ en: "is treated as input cache hit; miss is prompt_tokens - cached_tokens.", zh: "作为输入缓存命中；未命中按 prompt_tokens - cached_tokens 计算。" }} />
            </p>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
            <div className="font-medium text-zinc-100">Anthropic-compatible</div>
            <p className="mt-2 leading-6 text-zinc-400">
              <code>input_tokens</code>, <code>output_tokens</code>, <code>cache_read_input_tokens</code>,{" "}
              <code>cache_creation_input_tokens</code>
            </p>
          </div>
        </div>
      </Section>

      <Section
        title={{ en: "Examples", zh: "请求示例" }}
        description={{
          en: "Use the examples as request templates. Replace model names and relay keys with values configured in your dashboard.",
          zh: "可以把这些示例当作请求模板。请替换为你在后台配置的模型名和中继密钥。",
        }}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h4 className="mb-2 text-sm font-medium text-zinc-200">OpenAI basic</h4>
            <CodeBlock>{openAIExample}</CodeBlock>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-medium text-zinc-200">Anthropic basic</h4>
            <CodeBlock>{anthropicExample}</CodeBlock>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-medium text-zinc-200">OpenAI tools</h4>
            <CodeBlock>{openAIToolsExample}</CodeBlock>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-medium text-zinc-200">Anthropic tools</h4>
            <CodeBlock>{anthropicToolsExample}</CodeBlock>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-medium text-zinc-200">Streaming</h4>
            <CodeBlock>{streamExample}</CodeBlock>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-medium text-zinc-200">Anthropic image</h4>
            <CodeBlock>{anthropicImageExample}</CodeBlock>
          </div>
          <div className="lg:col-span-2">
            <h4 className="mb-2 text-sm font-medium text-zinc-200">Kimi video</h4>
            <CodeBlock>{kimiVideoExample}</CodeBlock>
          </div>
        </div>
      </Section>

      <Section
        title={{ en: "Official Compatibility References", zh: "官方兼容参考" }}
        description={{
          en: "BYOK follows these provider API shapes for chat requests and documents where provider-specific behavior differs.",
          zh: "BYOK 按这些供应商聊天 API 形态适配，并在供应商行为不同处做说明。",
        }}
      >
        <ReferenceLinks />
      </Section>
    </div>
  );
}
