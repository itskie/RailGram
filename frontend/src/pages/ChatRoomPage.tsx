import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { chat as chatApi } from "../lib/api";
import type { Message, Conversation } from "../types";
import { useAuthStore } from "../store/authStore";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Send, Loader } from "lucide-react";

export default function ChatRoomPage() {
  const { convId } = useParams<{ convId: string }>();
  const nav = useNavigate();
  const { user, token } = useAuthStore();
  const qc = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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
  });
  const conv = convs?.find((c) => c.id === convId);

  useEffect(() => {
    if (history?.messages) setMessages(history.messages);
  }, [history]);

  // Mark as read on open
  useEffect(() => {
    if (convId) chatApi.markRead(convId).catch(() => {});
  }, [convId]);

  // WebSocket
  useEffect(() => {
    if (!convId || !token) return;
    const wsUrl = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/api/v1/ws/conversations/${convId}?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => setWsConnected(false);
    ws.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === "message") {
          setMessages((prev) => [...prev, payload.data as Message]);
          qc.invalidateQueries({ queryKey: ["conversations"] });
        }
      } catch { /* ignore */ }
    };

    return () => ws.close();
  }, [convId, token, qc]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border-b border-zinc-800">
        <button onClick={() => nav(-1)} className="text-zinc-400 hover:text-zinc-200">
          <ArrowLeft size={20} />
        </button>
        <div className="w-9 h-9 rounded-full bg-zinc-700 overflow-hidden flex-shrink-0">
          {conv?.other_avatar_url && (
            <img src={conv.other_avatar_url} className="w-full h-full object-cover" alt="" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">
            {conv?.other_display_name ?? conv?.other_username ?? "Chat"}
          </p>
          <p className={`text-xs ${wsConnected ? "text-green-400" : "text-zinc-500"}`}>
            {wsConnected ? "Live" : "Connecting…"}
          </p>
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
                <p className={`text-xs mt-1 ${isMine ? "text-orange-200" : "text-zinc-500"}`}>
                  {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border-t border-zinc-800">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
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
