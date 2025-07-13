import React, { RefObject } from "react";

interface ChatMessage {
  sender: string;
  text: string;
}

interface ChatInputProps {
  messages: ChatMessage[];
  input: string;
  setInput: (val: string) => void;
  handleSend: (e?: React.FormEvent) => void;
  chatEndRef: RefObject<HTMLDivElement | null>;
}

const inputContainerClass =
  "flex items-center mt-2 bg-black/40 border border-[#dcd9e0] rounded-2xl px-3 py-2";
const inputClass =
  "flex-1 bg-transparent border-none outline-none text-white placeholder-gray-400 px-2";

export default function ChatInput({ messages, input, setInput, handleSend, chatEndRef }: ChatInputProps) {
  return (
    <div className="absolute bottom-0 left-0 w-full p-4 flex items-end mb-2 md:mb-14 lg:mb-16">
      <form
        className={
          messages.length > 0
            ? "bg-black/60 rounded-2xl p-4 text-white text-sm md:text-base max-w-full flex flex-col gap-2 flex-1"
            : "max-w-full flex flex-col gap-2 flex-1"
        }
        style={messages.length > 0 ? { minHeight: "80px", maxHeight: "240px", justifyContent: "flex-end" } : {}}
        onSubmit={handleSend}
        autoComplete="off"
      >
        {messages.length > 0 && (
          <div className="flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: "160px" }}>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={
                  msg.sender === "you"
                    ? "text-right text-[#ffe0ff]"
                    : "text-left text-gray-200"
                }
              >
                <span className="font-semibold">
                  {msg.sender === "you" ? "You:" : "Stranger:"}
                </span>{" "}
                <span>{msg.text}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        )}
        <div className={inputContainerClass}>
          <input
            type="text"
            placeholder="Start typing..."
            className={inputClass}
            value={input}
            onChange={e => setInput(e.target.value)}
            maxLength={200}
          />
          <button
            type="submit"
            className="ml-2 text-xl disabled:opacity-50"
            disabled={!input.trim()}
          >
            ➤
          </button>
        </div>
      </form>
    </div>
  );
}
