import React, { RefObject, useState, useEffect, useRef } from "react";

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
  const [showMessages, setShowMessages] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Start or reset the 2-minute timer
  const startHideTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setShowMessages(false);
    }, 1 * 15 * 1000); // 15 seconds
  };

  // On mount, start timer
  useEffect(() => {
    startHideTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // On input focus, show messages and reset timer
  const handleFocus = () => {
    setShowMessages(true);
    startHideTimer();
  };

  // Determine form class based on messages and showMessages
  const formClass =
    messages.length > 0 && showMessages
      ? "bg-black/60 rounded-2xl p-4 text-white text-sm md:text-base max-w-full flex flex-col-reverse gap-2 flex-1"
      : "max-w-full flex flex-col-reverse gap-2 flex-1";

  const formStyle = messages.length > 0 && showMessages
    ? { minHeight: "80px", maxHeight: "240px", justifyContent: "flex-end" }
    : {};

  return (
    <div className="absolute bottom-0 left-0 w-full p-4 flex items-end mb-2 md:mb-8 lg:mb-12">
      <form
        className={formClass}
        style={formStyle}
        onSubmit={handleSend}
        autoComplete="off"
      >
        <div className={inputContainerClass}>
          <input
            type="text"
            placeholder="Start typing..."
            className={inputClass}
            value={input}
            onChange={e => setInput(e.target.value)}
            maxLength={200}
            onFocus={handleFocus}
          />
          <button
            type="submit"
            className="ml-2 text-xl disabled:opacity-50"
            disabled={!input.trim()}
          >
            ➤
          </button>
        </div>
        {/* Messages container with fade/slide animation */}
        {messages.length > 0 && (
          <div
            className={`flex flex-col gap-1 overflow-y-auto transition-all duration-500 ease-in-out ${
              showMessages ? 'opacity-100 max-h-40 translate-y-0' : 'opacity-0 max-h-0 -translate-y-4 pointer-events-none'
            }`}
            style={{ maxHeight: showMessages ? '160px' : '0px' }}
          >
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className="text-white text-left"
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
      </form>
    </div>
  );
}
