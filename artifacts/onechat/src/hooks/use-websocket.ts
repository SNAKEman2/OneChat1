import { useEffect, useState, useRef, useCallback } from "react";
import { Message } from "@workspace/api-client-react";

export interface IgnitionResult {
  firstSpeakerId: string | null;
}

export interface Reaction {
  emoji: string;
  count: number;
  byMe: boolean;
}

export type ReactionsMap = Record<string, Reaction[]>;

// E2 — exponential backoff constants
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const RECONNECT_FACTOR = 1.5;

export function useWebsocket(matchId: string | null, initialMessages: Message[], userId?: string) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState<Record<string, boolean>>({});
  const [ignitionResult, setIgnitionResult] = useState<IgnitionResult | null>(null);
  const [reactions, setReactions] = useState<ReactionsMap>({});
  const [roomExpired, setRoomExpired] = useState(false);
  const [partnerLastRead, setPartnerLastRead] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const reconnectDelayRef = useRef(RECONNECT_BASE_MS);
  const reconnectTimerRef = useRef<number | null>(null);
  // E2 — disposed flag prevents reconnect after intentional unmount
  const disposedRef = useRef(false);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  const connect = useCallback(() => {
    if (disposedRef.current || !matchId) return;

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wssUrl = `${proto}//${window.location.host}/ws?matchId=${matchId}`;
    const ws = new WebSocket(wssUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectDelayRef.current = RECONNECT_BASE_MS; // reset backoff on success
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "message":
            setMessages((prev) => {
              if (prev.find((m) => m.id === data.data.id)) return prev;
              return [...prev, data.data];
            });
            setPartnerTyping(false);
            break;

          case "typing":
            if (data.data.userId !== userId) {
              setPartnerTyping(data.data.isTyping);
              if (data.data.isTyping) {
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = window.setTimeout(
                  () => setPartnerTyping(false),
                  3000
                );
              }
            }
            break;

          case "presence":
            setOnlineStatus((prev) => ({
              ...prev,
              [data.data.userId]: data.data.online,
            }));
            break;

          case "ignition_resolve":
            setIgnitionResult(data.data as IgnitionResult);
            break;

          // A2 — reaction events
          case "reaction_add":
            setReactions((prev) => {
              const msgId = data.data.messageId as string;
              const emoji = data.data.emoji as string;
              const reactorId = data.data.userId as string;
              const existing = [...(prev[msgId] ?? [])];
              const idx = existing.findIndex((r) => r.emoji === emoji);
              if (idx >= 0) {
                existing[idx] = {
                  ...existing[idx],
                  count: existing[idx].count + 1,
                  byMe: existing[idx].byMe || reactorId === userId,
                };
              } else {
                existing.push({ emoji, count: 1, byMe: reactorId === userId });
              }
              return { ...prev, [msgId]: existing };
            });
            break;

          case "reaction_remove":
            setReactions((prev) => {
              const msgId = data.data.messageId as string;
              const emoji = data.data.emoji as string;
              const reactorId = data.data.userId as string;
              const existing = (prev[msgId] ?? [])
                .map((r) =>
                  r.emoji === emoji
                    ? { ...r, count: r.count - 1, byMe: r.byMe && reactorId !== userId }
                    : r
                )
                .filter((r) => r.count > 0);
              return { ...prev, [msgId]: existing };
            });
            break;

          // E3 — room expired event
          case "room_expired":
            setRoomExpired(true);
            break;

          // E3 — partner ended match
          case "match_ended":
            setRoomExpired(true);
            break;

          // A3 — read receipts
          case "read":
            if (data.data.userId !== userId) {
              setPartnerLastRead(data.data.lastReadAt as string);
            }
            break;
        }
      } catch (e) {
        console.error("WS parse error", e);
      }
    };

    ws.onclose = () => {
      if (disposedRef.current) return; // intentional close — don't reconnect

      // E2 — exponential backoff reconnect
      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(delay * RECONNECT_FACTOR, RECONNECT_MAX_MS);
      reconnectTimerRef.current = window.setTimeout(connect, delay);
    };

    ws.onerror = () => {
      // onclose will fire next and handle reconnect
    };
  }, [matchId, userId]);

  useEffect(() => {
    if (!matchId) return;
    disposedRef.current = false;
    connect();

    return () => {
      disposedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [matchId, connect]);

  const sendTyping = (isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "typing", isTyping }));
    }
  };

  const tapIgnition = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "ignition_tap" }));
    }
  };

  // A3 — notify partner we've read messages
  const sendRead = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "read" }));
    }
  };

  return {
    messages,
    partnerTyping,
    onlineStatus,
    sendTyping,
    ignitionResult,
    tapIgnition,
    reactions,
    setReactions,
    roomExpired,
    partnerLastRead,
    sendRead,
  };
}
