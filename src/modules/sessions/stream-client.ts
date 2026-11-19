import type { SearchMode } from "@/shared/types/conversation";
export async function streamTurn(
  path: string,
  question: string,
  search: SearchMode,
  id: string,
  ref: string | undefined,
  onText: (chunk: string) => void,
  onSearch: () => void,
) {
  const res = await fetch("/api/" + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      text: question,
      client_message_id: id,
      search_mode: search,
      ...(ref?.startsWith("node:")
        ? { explicit_node: ref.slice(5) }
        : ref
          ? { explicit_ref: ref }
          : {}),
    }),
  });
  if (!res.ok) throw Error((await res.json()).error.message);
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "",
    doneEvent = false;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let end: number;
    while ((end = buffer.indexOf("\n\n")) >= 0) {
      const [name, data] = buffer.slice(0, end).split("\n");
      buffer = buffer.slice(end + 2);
      const event = JSON.parse(data.slice(6));
      if (name === "event: text.delta") onText(event.text);
      if (name === "event: search.status") onSearch();
      if (name === "event: error") throw Error(event.message);
      if (name === "event: message.completed") doneEvent = true;
    }
  }
  if (!doneEvent)
    throw Error("연결이 중단되었습니다. 기록을 확인하고 다시 시도하세요.");
}
