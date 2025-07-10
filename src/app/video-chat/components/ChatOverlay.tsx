import React from 'react';

type ChatMessage = { user: 'You' | 'Stranger'; message: string };

type ChatOverlayProps = {
  chatMessages: ChatMessage[];
  inputValue: string;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onInputFocus: () => void;
  onInputBlur: () => void;
  onInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSend: () => void;
  dataChannelOpen: boolean;
  coins: number;
};

export default function ChatOverlay({
  chatMessages,
  inputValue,
  onInputChange,
  onInputFocus,
  onInputBlur,
  onInputKeyDown,
  onSend,
  dataChannelOpen,
  coins,
}: ChatOverlayProps) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[92%] max-w-xl">
      <div className="w-full rounded-2xl bg-black bg-opacity-60 backdrop-blur-md border border-purple-200 px-4 py-3 flex flex-col space-y-2 shadow-md">
        <div className="flex flex-col space-y-1 min-h-[40px]">
          {chatMessages.length === 0 ? (
            <div className="text-sm text-gray-200 font-normal">&nbsp;</div>
          ) : chatMessages.map((msg, i) => (
            <div key={i} className={`text-sm font-normal ${msg.user === 'You' ? 'text-white text-right' : 'text-gray-100 text-left'}`}>{msg.user === 'You' ? `You: ${msg.message}` : `Stranger: ${msg.message}`}</div>
          ))}
        </div>
        <div className="flex items-center mt-1 bg-white bg-opacity-80 rounded-full px-3 py-1 shadow-sm">
          <input
            type="text"
            placeholder={dataChannelOpen ? 'Start typing...' : 'Connecting chat...'}
            className="flex-1 bg-transparent text-gray-800 outline-none border-none placeholder-gray-400 px-2 py-1 text-base font-normal"
            value={inputValue}
            onChange={onInputChange}
            onFocus={onInputFocus}
            onBlur={onInputBlur}
            onKeyDown={onInputKeyDown}
            disabled={!dataChannelOpen || coins <= 0}
          />
          <button className="ml-2 bg-gradient-to-r from-purple-500 to-purple-400 rounded-full p-2 shadow-md flex items-center justify-center" onClick={onSend} disabled={!inputValue.trim() || !dataChannelOpen || coins <= 0}>
            <svg className="w-5 h-5" fill="none" stroke="white" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M22 2L11 13" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
