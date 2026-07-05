import { useEffect, useState, useRef, useCallback } from "react";
import { Message } from "@workspace/api-client-react";

export interface IgnitionResult {
  firstSpeakerId: string | null;
}

// E2 — exponential backoff constants
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const RECONNECT_FACTOR = 1.5;

export function useWebsocket(matchId: string | null, initialMessages: Message[], userId?: string) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState<Record<string, boolean>>({});
  const [ignitionResult, setIgnitionResult] = useState<IgnitionResult | null>(null);
  const [roomExpired, setRoomExpired] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const reconnectDelayRef = useRef(RECONNECT_BASE_MS);
  const reconnectTimerRef = useRef<number | null>(null);
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
      reconnectDelayRef.current = RECONNECT_BASE_MS;
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

          // Edit: replace message content in-place
          case "message_edited":
            setMessages((prev) =>
              prev.map((m) => (m.id === data.data.id ? { ...m, ...data.data } : m))
            );
            break;

          // Delete (unsend): mark as deleted
          case "message_deleted":
            setMessages((prev) =>
              prev.map((m) =>
                m.id === data.data.id
                  ? { ...m, isDeleted: true, content: "", imageUrl: null }
                  : m
              )
            );
            break;

          // View-once media viewed by partner
          case "media_viewed":
            setMessages((prev) =>
              prev.map((m) =>
                m.id === data.data.id ? { ...m, viewedAt: data.data.viewedAt } : m
              )
            );
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

          case "room_expired":
          case "match_ended":
            setRoomExpired(true);
            break;
        }
      } catch (e) {
        console.error("WS parse error", e);
      }
    };

    ws.onclose = () => {
      if (disposedRef.current) return;
      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(delay * RECONNECT_FACTOR, RECONNECT_MAX_MS);
      reconnectTimerRef.current = window.setTimeout(connect, delay);
    };

    ws.onerror = () => {
      // onclose fires next
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

  return {
    messages,
    partnerTyping,
    onlineStatus,
    sendTyping,
    ignitionResult,
    tapIgnition,
    roomExpired,
  };
}
