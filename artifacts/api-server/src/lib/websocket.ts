import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import { logger } from "./logger";

interface Client {
  ws: WebSocket;
  userId: string;
  matchId: string;
}

const clients: Client[] = [];

export function broadcastToMatch(matchId: string, payload: unknown) {
  const data = JSON.stringify(payload);
  const room = clients.filter((c) => c.matchId === matchId);
  for (const client of room) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? "", "http://localhost");
    const matchId = url.searchParams.get("matchId");
    const userId = url.searchParams.get("userId");

    if (!matchId || !userId) {
      ws.close(1008, "matchId and userId required");
      return;
    }

    const client: Client = { ws, userId, matchId };
    clients.push(client);

    logger.info({ matchId, userId }, "WS client connected");

    // Notify partner of presence
    broadcastToMatch(matchId, {
      type: "presence",
      data: { userId, online: true },
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "typing") {
          // Broadcast typing to others in match
          const data = JSON.stringify({
            type: "typing",
            data: { userId, isTyping: msg.isTyping },
          });
          clients
            .filter((c) => c.matchId === matchId && c.userId !== userId)
            .forEach((c) => {
              if (c.ws.readyState === WebSocket.OPEN) c.ws.send(data);
            });
        }
      } catch (err) {
        logger.warn({ err }, "WS message parse error");
      }
    });

    ws.on("close", () => {
      const idx = clients.indexOf(client);
      if (idx !== -1) clients.splice(idx, 1);
      logger.info({ matchId, userId }, "WS client disconnected");
      broadcastToMatch(matchId, {
        type: "presence",
        data: { userId, online: false },
      });
    });

    ws.on("error", (err) => {
      logger.warn({ err }, "WS error");
    });
  });

  logger.info("WebSocket server ready at /ws");
  return wss;
}
