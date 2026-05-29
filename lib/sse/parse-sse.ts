export type SseEvent = {
  event?: string;
  data: string;
};

export async function* parseSse(stream: ReadableStream<Uint8Array>): AsyncIterable<SseEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName: string | undefined;
  let dataLines: string[] = [];

  const flush = (): SseEvent | null => {
    if (dataLines.length === 0) {
      eventName = undefined;
      return null;
    }
    const event = { event: eventName, data: dataLines.join("\n") };
    eventName = undefined;
    dataLines = [];
    return event;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.search(/\r?\n/);
    while (boundary >= 0) {
      const line = buffer.slice(0, boundary).replace(/\r$/, "");
      buffer = buffer.slice(boundary + (buffer[boundary] === "\r" ? 2 : 1));

      if (line === "") {
        const event = flush();
        if (event) {
          if (event.data === "[DONE]") return;
          yield event;
        }
      } else if (line.startsWith(":")) {
        // Ignore comments.
      } else if (line.startsWith("event:")) {
        eventName = line.slice("event:".length).trimStart();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice("data:".length).trimStart());
      }

      boundary = buffer.search(/\r?\n/);
    }
  }

  const remainder = decoder.decode();
  if (remainder) buffer += remainder;
  if (buffer) {
    for (const line of buffer.split(/\r?\n/)) {
      if (line.startsWith("data:")) dataLines.push(line.slice("data:".length).trimStart());
      if (line.startsWith("event:")) eventName = line.slice("event:".length).trimStart();
    }
  }
  const event = flush();
  if (event && event.data !== "[DONE]") yield event;
}
