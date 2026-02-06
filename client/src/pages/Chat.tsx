import { AndroidChatHeader } from "@/components/AndroidChatHeader";
import { AndroidMessageBubble } from "@/components/AndroidMessageBubble";
import { ChatHeader } from "@/components/ChatHeader";
import { MessageBubble } from "@/components/MessageBubble";
import { useChat, type Message as ChatMessage } from "@/contexts/ChatContext";
import { Plus, Mic, Smile, Image } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { format } from "date-fns";

const API_STORAGE_KEY = "ios_msg_history_api";
const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");
const apiUrl = (path: string) => `${API_BASE}${path}`;

async function fetchWithRetry(path: string, init: RequestInit, attempts = 3, delayMs = 3000) {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const resp = await fetch(apiUrl(path), init);
      if (resp.status >= 500 && i < attempts - 1) {
        await new Promise((res) => setTimeout(res, delayMs));
        continue;
      }
      return resp;
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await new Promise((res) => setTimeout(res, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw lastError ?? new Error("Failed to fetch");
}

export default function Chat() {
  const { settings, messages, sendMessage } = useChat();
  const [inputCode, setInputCode] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [apiMessages, setApiMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem(API_STORAGE_KEY);
    if (!saved) return [];
    try {
      return JSON.parse(saved).map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      }));
    } catch {
      return [];
    }
  });
  const mode =
    new URLSearchParams(window.location.search).get("mode") === "api"
      ? "api"
      : "manual";
  const platform = new URLSearchParams(window.location.search).get("platform");
  const isAndroid = platform === "android";

  const badge = !isAndroid ? (
    <span
      className="text-gray-400 text-[30px] leading-none relative -mt-1 -ml-1 font-bold"
      aria-label={mode === "api" ? "API mode" : "Manual mode"}
    >
      ›
    </span>
  ) : null;

  const generateSuffix = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (mode === "api") {
      scrollToBottom();
    }
  }, [apiMessages, mode]);

  // Auto-focus input on mount
  useEffect(() => {
    // Small delay to ensure transition is done
    setTimeout(() => {
      inputRef.current?.focus();
    }, 300);
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === API_STORAGE_KEY && event.newValue === null) {
        setApiMessages([]);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Persist API history
  useEffect(() => {
    if (mode !== "api") return;
    localStorage.setItem(API_STORAGE_KEY, JSON.stringify(apiMessages));
  }, [apiMessages, mode]);

  const appendApi = (msg: ChatMessage) => {
    setApiMessages((prev) => [...prev, msg]);
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputCode.trim()) return;

    const text = inputCode.trim();
    setInputCode("");

    if (mode === "manual") {
      sendMessage(text);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
      return;
    }

    const now = new Date();
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      text,
      isMe: true,
      timestamp: now,
    };
    appendApi(userMsg);

    try {
      const resp = await fetchWithRetry(
        "/api/onay/qr-start",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ terminal: text }),
        },
        3,
        3000
      );

      let body: any = null;
      const contentType = resp.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try {
          body = await resp.json();
        } catch {
          body = null;
        }
      } else {
        const raw = await resp.text();
        if (raw) {
          try {
            body = JSON.parse(raw);
          } catch {
            body = { message: raw };
          }
        }
      }

      if (!resp.ok || !body?.success) {
        const msg = body?.message || `Код отклонён (${resp.status})`;
        throw new Error(msg);
      }

      const data = body?.data || {};
      const isEmptyPayload = !data.route && !data.plate;

      if (isEmptyPayload) {
        const errMsg: ChatMessage = {
          id: crypto.randomUUID(),
          text: "Ошибка. Услуга временно недоступна, попробуйте позже.",
          isMe: false,
          timestamp: new Date(),
        };
        appendApi(errMsg);
        return;
      }

      const route = data.route || "—";
      const plate = data.plate || "—";
      const price =
        typeof data.cost === "number"
          ? `${Math.round(data.cost / 100)}₸`
          : settings.price || "120₸";

      const suffix = generateSuffix();
      const formattedDate = format(new Date(), "dd/MM HH:mm");
      const responseText = `ONAY! ALA
AT ${formattedDate}
${route},${plate},${price}
http://qr.tha.kz/${suffix}`;

      const systemMsg: ChatMessage = {
        id: crypto.randomUUID(),
        text: responseText,
        isMe: false,
        timestamp: new Date(),
        details: {
          route,
          number: plate,
          price,
          suffix,
          link: `/qr/${suffix}`,
        },
      };
      appendApi(systemMsg);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Код неверный или сервис недоступен";
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        text: `Ошибка. ${message}`,
        isMe: false,
        timestamp: new Date(),
      };
      appendApi(errMsg);
    } finally {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
    }
  };

  const activeMessages = mode === "api" ? apiMessages : messages;
  const headerTime = format(activeMessages[0]?.timestamp ?? new Date(), "HH:mm");

  return (
    <div
      className={
        isAndroid
          ? "flex flex-col h-[100dvh] bg-[#12141A] text-white overflow-hidden"
          : "flex flex-col h-[100dvh] bg-black text-white overflow-hidden"
      }
    >
      {isAndroid ? (
        <AndroidChatHeader title="9909" />
      ) : (
        <ChatHeader title="9909" badge={badge} />
      )}

      {/* Messages Area */}
      <div
        className={
          isAndroid
            ? "flex-1 overflow-y-auto pt-[76px] pb-[120px] px-4 space-y-3 scroll-smooth"
            : "flex-1 overflow-y-auto pt-[120px] pb-[140px] px-4 space-y-2 scroll-smooth"
        }
        style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorY: "contain" }}
      >
        {isAndroid && (
          <div className="space-y-2 pt-2 pb-3">
            <div className="text-center text-[12px] text-[#9AA1AB]">{headerTime}</div>
            <div className="text-center text-[12px] text-[#7F8792]">SMS/MMS абоненту 9909</div>
          </div>
        )}

        {activeMessages.map((msg) => {
          const showTime = msg.isMe;

          return (
            <Fragment key={msg.id}>
              {isAndroid ? (
                <AndroidMessageBubble text={msg.text} isMe={msg.isMe} details={msg.details} />
              ) : (
                <MessageBubble
                  text={msg.text}
                  isMe={msg.isMe}
                  timestamp={msg.timestamp}
                  showTimestamp={showTime}
                  details={msg.details}
                />
              )}
            </Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="fixed bottom-0 left-0 right-0 safe-area-bottom z-50">
        {isAndroid ? (
          <div className="bg-[#12141A]">
            <div className="flex items-center gap-2 px-3 py-3 w-full max-w-md mx-auto">
              <button className="w-11 h-11 rounded-full bg-[#1E222A] border border-[#2A2E35] flex items-center justify-center text-[#D4D7DE]">
                <Plus size={20} strokeWidth={2.2} />
              </button>

              <form onSubmit={handleSend} className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  placeholder="Введите сообщение"
                  className="w-full bg-[#1E222A] border border-[#2A2E35] rounded-full pl-4 pr-20 h-11 text-[15px] text-white placeholder:text-[#7E8691] focus:outline-none"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2 text-[#C9CED6]">
                  <button type="button" className="p-1 hover:text-white transition-colors">
                    <Smile size={18} />
                  </button>
                  <button type="button" className="p-1 hover:text-white transition-colors">
                    <Image size={18} />
                  </button>
                </div>
              </form>

              <button className="w-11 h-11 rounded-full bg-[#1E222A] border border-[#2A2E35] flex items-center justify-center text-[#D4D7DE]">
                <Mic size={20} strokeWidth={2.2} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center px-3 py-7 min-h-[55px]">
            <button className="w-10 h-10 rounded-full bg-[#262628] flex items-center justify-center text-white hover:bg-[#2C2C2E] transition-colors">
              <Plus size={20} strokeWidth={2.5} />
            </button>
            
            <form onSubmit={handleSend} className="flex-1 mx-2 relative">
              <input
                ref={inputRef}
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="Текстовое сообщение • ..."
                className="w-full bg-[#262628]/90 rounded-full px-4 pr-12 py-4 text-[17px] text-white placeholder:text-[#8E8E93] focus:outline-none transition-colors h-12"
              />
              <button 
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white hover:opacity-80 transition-opacity"
              >
                <Mic size={20} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
