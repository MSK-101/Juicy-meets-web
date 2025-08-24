import React, { RefObject, useState, useEffect, useRef } from "react";

interface ChatMessage {
  sender: string;
  text: string;
  timestamp?: number;
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
  const lastMessageTimeRef = useRef<number>(0);

  // Update last message time ref when messages change
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.timestamp) {
        lastMessageTimeRef.current = lastMessage.timestamp;
      }
    }
  }, [messages]);

  // Hide timer logic: hide messages container after 20s of inactivity
  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (input.trim() !== "") {
      // If user is typing, show messages
      setShowMessages(true);
      return;
    }

    // If no messages, don't show container
    if (messages.length === 0) {
      setShowMessages(false);
      return;
    }

    const now = Date.now();
    const timeSinceLastMessage = now - lastMessageTimeRef.current;

    if (timeSinceLastMessage >= 20000) {
      // If last message was more than 20s ago, hide immediately
      setShowMessages(false);
    } else {
      // Show messages and set timer to hide after remaining time
      setShowMessages(true);
      const remainingTime = 20000 - timeSinceLastMessage;

      timerRef.current = setTimeout(() => {
        setShowMessages(false);
      }, remainingTime);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [input, messages.length]); // Only depend on input and messages length, not timestamp

  // On input focus, show messages and reset timer
  const handleFocus = () => {
    setShowMessages(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // On input blur, start the hide timer if no input
  const handleBlur = () => {
    if (input.trim() === "" && messages.length > 0) {
      const now = Date.now();
      const timeSinceLastMessage = now - lastMessageTimeRef.current;

      if (timeSinceLastMessage < 20000) {
        const remainingTime = 20000 - timeSinceLastMessage;
        timerRef.current = setTimeout(() => {
          setShowMessages(false);
        }, remainingTime);
      } else {
        setShowMessages(false);
      }
    }
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
            onBlur={handleBlur}
          />
          <button
            type="submit"
            className="ml-2 text-xl disabled:opacity-50"
            disabled={!input.trim()}
          >
            ➤
          </button>
        </div>
        {/* Messages container with fixed height, scroll, and fade/slide animation */}
        {messages.length > 0 && (
          <div
            className={`flex flex-col gap-1 transition-all duration-500 ease-in-out ${
              showMessages
                ? 'opacity-100 max-h-[180px] overflow-y-auto translate-y-0'
                : 'opacity-0 max-h-0 overflow-hidden -translate-y-4 pointer-events-none'
            }`}
            style={{
              height: showMessages ? '180px' : '0px',
              overflowY: showMessages ? 'auto' : 'hidden'
            }}
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
