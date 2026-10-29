import { useMemo, useState } from "react";

const API_URL = "http://localhost:8000";

const initialMessages = [{
  role: "assistant",
  content: "Hi! Ask me anything about Python, FastAPI, LLMs, or AI."
}];

function Message({ message }) {
  return (
    <div className={`message-row ${message.role}`}>
      <div className="message">
        <div className="role-label">
          {message.role === "user" ? "You" : "AI"}
        </div>
        <div className="message-content">{message.content}</div>
      </div>
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [usage, setUsage] = useState(null);
  const [error, setError] = useState("");

  const canSend = useMemo(
    () => input.trim().length > 0 && !isStreaming,
    [input, isStreaming]
  );

  async function sendMessage(event) {
    event.preventDefault();

    const text = input.trim();
    if (!text || isStreaming) return;

    setError("");
    setUsage(null);

    const userMessage = { role: "user", content: text };
    const assistantMessage = { role: "assistant", content: "" };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput("");
    setIsStreaming(true);

    try {
      const conversationForApi = [...messages, userMessage].map(
        ({ role, content }) => ({ role, content })
      );

      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: conversationForApi }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Backend request failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const rawEvent of events) {
          if (!rawEvent.startsWith("data: ")) continue;

          const payload = JSON.parse(rawEvent.slice(6));
          console.log('paylod ==> ',payload);
          

          if (payload.type === "delta") {
            setMessages((current) => {
              const next = [...current];
              const last = next.length - 1;
              next[last] = {
                ...next[last],
                content: next[last].content + payload.text,
              };
              return next;
            });
          }

          if (payload.type === "done") setUsage(payload.usage);
          if (payload.type === "error") throw new Error(payload.message);
        }
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setIsStreaming(false);
    }
  }

  function clearChat() {
    if (isStreaming) return;
    setMessages(initialMessages);
    setUsage(null);
    setError("");
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <p className="eyebrow">PROJECT 1</p>
          <h1>LLM Chatbot</h1>
          <p className="subtitle">React → FastAPI → OpenAI → Streaming</p>
        </div>
        <button className="secondary-button" onClick={clearChat}>Clear</button>
      </header>

      <main className="chat-shell">
        <section className="messages">
          {messages.map((message, index) => (
            <Message key={`${message.role}-${index}`} message={message} />
          ))}
          {isStreaming && <div className="typing">AI is generating…</div>}
        </section>

        {usage && (
          <div className="usage">
            Tokens — input: {usage.input_tokens ?? "n/a"}, output:{" "}
            {usage.output_tokens ?? "n/a"}, total: {usage.total_tokens ?? "n/a"}
          </div>
        )}

        {error && <div className="error">{error}</div>}

        <form className="composer" onSubmit={sendMessage}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask something..."
            rows={3}
            disabled={isStreaming}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (canSend) sendMessage(e);
              }
            }}
          />
          <button className="send-button" disabled={!canSend}>
            {isStreaming ? "Generating…" : "Send"}
          </button>
        </form>
      </main>
    </div>
  );
}