"use client";
import React, { useState, useRef, useEffect } from "react";
import MockVideo from "../components/MockVideo";
import DiamondCountBar from "../components/DiamondCountBar";
import ChatInput from "../components/ChatInput";
import FlagButton from "../components/FlagButton";

// Define the message type
interface ChatMessage {
  sender: string;
  text: string;
}

export default function VideoChatPage() {
  // Start with empty chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Video stream state
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Request camera access on mount
  useEffect(() => {
    navigator.mediaDevices?.getUserMedia({ video: true })
      .then((stream) => {
        setVideoStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(() => {
        setVideoStream(null);
      });
  }, []);

  // Attach stream to video element if available
  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream]);

  function handleSend(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!input.trim()) return;
    setMessages((prev) => {
      return [...prev, { sender: "you", text: input.trim() }];
    });
    setInput("");
  }

  return (
    <div className="fixed inset-0 z-0 flex items-center justify-center bg-black/80">
      <div className="w-full h-full flex flex-col md:flex-row items-stretch justify-stretch p-0">
        <div className="gradient-border border md:border-[3px] w-full h-full flex flex-col md:flex-row overflow-hidden relative">
          {/* Left/User 1 */}
          <div className="flex-1 flex flex-col relative overflow-hidden">
            <MockVideo imgSrc="/home/c34.jpg" />
            {/* Project logo (top left, only left panel) */}
            <div className="absolute top-4 left-4 z-10">
              <img src="/logo.png" alt="Logo" className="w-8 h-8" />
            </div>
            {/* Top right diamond count (desktop) */}
            <div className="absolute top-3 right-4 flex items-center">
              <DiamondCountBar count={3900} />
            </div>
          </div>
          {/* Divider with gradient border */}
          <div className="hidden md:flex items-stretch">
            <div className="w-[3px] h-full gradient-border border md:border-[3px] mx-0" />
          </div>
          <div className="flex md:hidden w-full">
            <div className="h-[3px] w-full gradient-border border md:border-[3px] my-0" />
          </div>
          {/* Right/User 2 */}
          <div className="flex-1 flex flex-col relative overflow-hidden">
            {/* Show video stream if available, else fallback image */}
            {videoStream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover bg-black/80"
                style={{ objectFit: 'cover' }}
              />
            ) : (
              <MockVideo flip imgSrc="/no_user.png" />
            )}
            {/* Flag icon (top right, only right panel) */}
            <div className="absolute top-4 right-4 z-10">
              <FlagButton />
            </div>
            {/* Chat overlay/input */}
            <ChatInput
              messages={messages}
              input={input}
              setInput={setInput}
              handleSend={handleSend}
              chatEndRef={chatEndRef}
            />
          </div>
          {/* Swipe icon (desktop only, bottom center) */}
          <div className="hidden md:flex absolute left-1/5 bottom-10 z-20">
            <button>
              <img src="/swipe.png" alt="Swipe" className="w-33 h-33 mx-auto" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
