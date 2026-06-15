import { useEffect, useState, useRef } from "react";
import { Message } from "@workspace/api-client-react";

export function useWebsocket(matchId: string | null, initialMessages: Message[], userId?: string) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState<Record<string, boolean>>({});
  
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    if (!matchId) return;

    const connect = () => {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const userParam = userId ? `&userId=${encodeURIComponent(userId)}` : "";
      const wssUrl = `${proto}//${window.location.host}/ws?matchId=${matchId}${userParam}`;
      
      const ws = new WebSocket(wssUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === "message") {
            setMessages(prev => {
              // Deduplicate
              if (prev.find(m => m.id === data.data.id)) return prev;
              return [...prev, data.data];
            });
            setPartnerTyping(false);
          } 
          else if (data.type === "typing") {
            setPartnerTyping(data.data.isTyping);
            if (data.data.isTyping) {
              if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
              typingTimeoutRef.current = window.setTimeout(() => setPartnerTyping(false), 3000);
            }
          }
          else if (data.type === "presence") {
            setOnlineStatus(prev => ({
              ...prev,
              [data.data.userId]: data.data.online
            }));
          }
        } catch (e) {
          console.error("WS parse error", e);
        }
      };

      ws.onclose = () => {
        setTimeout(connect, 2000); // Reconnect
      };
    };

    connect();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [matchId, userId]);

  const sendTyping = (isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'typing', isTyping }));
    }
  };

  return {
    messages,
    partnerTyping,
    onlineStatus,
    sendTyping
  };
}
