import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { chat as chatApi } from "../lib/api";
import type { Message, Conversation } from "../types";
import { useAuthStore } from "../store/authStore";
import { formatDistanceToNow, differenceInMinutes } from "date-fns";
import { ArrowLeft, Send, Loader, Check, CheckCheck } from "lucide-react";
import Avatar from "../components/Avatar";

export default function ChatRoomPage() {
  const { convId } = useParams<{ convId: string }>();
  const nav = useNavigate();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [wsConnected, setWsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // REST fetch initial messages
  const { data: history, isLoading } = useQuery<{ messages: Message[] }>({
    queryKey: ["messages", convId],
    queryFn: () => chatApi.messages(convId!) as Promise<{ messages: Message[] }>,
    enabled: !!convId,
  });

  // Conv info for header
  const { data: convs } = useQuery<Conversation[]>({
    queryKey: ["conversations"],
    queryFn: () => chatApi.list() as Promise<Conversation[]>,
    staleTime: 0,
  });
  const conv = convs?.find((c) => c.id === convId);

  useEffect(() => {
    if (history?.messages) setMessages(history.messages);
  }, [history]);

  // Mark as read on open
  useEffect(() => {
    if (convId) chatApi.markRead(convId).catch(() => {});
  }, [convId]);

  // WebSocket with auto-reconnect
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isUnmountedRef = useRef(false);

  const connectWs = useCallback(() => {
    if (isUnmountedRef.current || !convId) return;
    const wsUrl = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/api/v1/ws/conversations/${convId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      reconnectAttemptsRef.current = 0;
      ws.send(JSON.stringify({ type: "read" }));
    };
    ws.onclose = () => {
      setWsConnected(false);
      if (!isUnmountedRef.current) {
        const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 30000);
        reconnectAttemptsRef.current += 1;
        reconnectTimerRef.current = setTimeout(connectWs, delay);
      }
    };
    ws.onerror = () => setWsConnected(false);
    ws.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);

        if (payload.type === "message") {
          const msg = payload.data as Message;
          setMessages((prev) => [...prev, msg]);
          qc.invalidateQueries({ queryKey: ["conversations"] });
          // Auto-mark as read since we're in this chat
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "read" }));
          }
        } else if (payload.type === "typing") {
          if (payload.user_id !== user?.id) {
            setIsTyping(true);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
          }
        } else if (payload.type === "presence") {
          if (payload.user_id !== user?.id) {
            setOtherOnline(payload.online);
          }
        } else if (payload.type === "read") {
          // Other person read our messages — update read_at on all our sent messages
          if (payload.reader_id !== user?.id) {
            const now = new Date().toISOString();
            setMessages((prev) =>
              prev.map((m) =>
                m.sender_id === user?.id && !m.read_at ? { ...m, read_at: now } : m
              )
            );
          }
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    };

  }, [convId, qc, user?.id]);

  useEffect(() => {
    if (!convId) return;
    isUnmountedRef.current = false;
    connectWs();
    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (inputTypingTimeoutRef.current) clearTimeout(inputTypingTimeoutRef.current);
    };
  }, [convId, connectWs]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Send typing event while user is typing
  const handleInputChange = useCallback((val: string) => {
    setInput(val);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "typing" }));
    }
    if (inputTypingTimeoutRef.current) clearTimeout(inputTypingTimeoutRef.current);
    inputTypingTimeoutRef.current = setTimeout(() => {}, 2000);
  }, []);

  const send = useCallback(() => {
    const body = input.trim();
    if (!body) return;
    setInput("");
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "message", msg_type: "text", body }));
    } else {
      chatApi.send(convId!, body).then((msg) => {
        setMessages((prev) => [...prev, msg as Message]);
      });
    }
  }, [input, convId]);

  // Online/last seen label
  const getPresenceLabel = () => {
    if (otherOnline) return { text: "Online", color: "text-green-400" };
    if (conv?.other_last_seen_at) {
      const mins = differenceInMinutes(new Date(), new Date(conv.other_last_seen_at));
      if (mins < 1) return { text: "Just now", color: "text-zinc-400" };
      return {
        text: `Last seen ${formatDistanceToNow(new Date(conv.other_last_seen_at), { addSuffix: true })}`,
        color: "text-zinc-500",
      };
    }
    return null;
  };

  const presence = getPresenceLabel();

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border-b border-zinc-800">
        <button onClick={() => nav(-1)} className="text-zinc-400 hover:text-zinc-200">
          <ArrowLeft size={20} />
        </button>
        <Avatar
          src={conv?.other_avatar_url}
          name={conv?.other_display_name}
          username={conv?.other_username}
          size={9}
          linkTo={conv?.other_username ? `/profile/${conv.other_username}` : undefined}
        />
        <div className="flex-1 min-w-0">
          {conv?.other_username ? (
            <Link to={`/profile/${conv.other_username}`} className="font-bold text-sm truncate hover:underline block">
              {conv?.other_display_name ?? conv?.other_username ?? "Chat"}
            </Link>
          ) : (
            <p className="font-bold text-sm truncate">
              {conv?.other_display_name ?? conv?.other_username ?? "Chat"}
            </p>
          )}
          {isTyping ? (
            <p className="text-xs text-orange-400 italic">typing...</p>
          ) : presence ? (
            <p className={`text-xs ${presence.color}`}>{presence.text}</p>
          ) : wsConnected ? (
            <p className="text-xs text-green-400">Live</p>
          ) : null}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader className="animate-spin text-orange-400" size={20} />
          </div>
        )}
        {messages.map((m) => {
          const isMine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                  isMine
                    ? "bg-orange-500 text-white rounded-br-sm"
                    : "bg-zinc-800 text-zinc-100 rounded-bl-sm"
                }`}
              >
                {m.is_deleted ? (
                  <span className="italic opacity-60">Message deleted</span>
                ) : (
                  m.body
                )}
                <div className={`flex items-center gap-1 mt-1 ${isMine ? "justify-end" : "justify-start"}`}>
                  <p className={`text-xs ${isMine ? "text-orange-200" : "text-zinc-500"}`}>
                    {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                  </p>
                  {isMine && (
                    m.read_at
                      ? <CheckCheck size={12} className="text-orange-200" />
                      : <Check size={12} className="text-orange-300 opacity-60" />
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator bubble */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-zinc-800 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border-t border-zinc-800">
        <input
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Type a message…"
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-sm outline-none focus:border-orange-500 transition-colors"
        />
        <button
          onClick={send}
          disabled={!input.trim()}
          className="w-9 h-9 bg-orange-500 hover:bg-orange-600 rounded-xl flex items-center justify-center disabled:opacity-40 transition-colors"
        >
          <Send size={16} className="text-white" />
        </button>
      </div>
    </div>
  );
}
