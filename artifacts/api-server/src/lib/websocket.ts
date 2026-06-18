import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import { parse as parseCookie } from "cookie";
import { logger } from "./logger";
import { getSession, SESSION_COOKIE } from "./auth";

interface Client {
  ws: WebSocket;
  userId: string;
  matchId: string;
}

interface IgnitionRoom {
  taps: Record<string, number>;
  resolved: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

const clients: Client[] = [];
const ignitionRooms = new Map<string, IgnitionRoom>();

export function broadcastToMatch(matchId: string, payload: unknown) {
  const data = JSON.stringify(payload);
  const room = clients.filter((c) => c.matchId === matchId);
  for (const client of room) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

function resolveIgnition(matchId: string) {
  const room = ignitionRooms.get(matchId);
  if (!room || room.resolved) return;

  room.resolved = true;
  if (room.timer) clearTimeout(room.timer);

  const tapEntries = Object.entries(room.taps);
  let firstSpeakerId: string | null = null;

  if (tapEntries.length === 1) {
    firstSpeakerId = tapEntries[0][0];
  } else if (tapEntries.length >= 2) {
    firstSpeakerId = tapEntries.sort((a, b) => a[1] - b[1])[0][0];
  }

  logger.info({ matchId, firstSpeakerId }, "Ignition resolved");

  broadcastToMatch(matchId, {
    type: "ignition_resolve",
    data: { firstSpeakerId },
  });

  ignitionRooms.delete(matchId);
}

function maybeStartIgnition(matchId: string) {
  if (ignitionRooms.has(matchId)) return;

  const matchClients = clients.filter((c) => c.matchId === matchId);
  if (matchClients.length < 2) return;

  const room: IgnitionRoom = {
    taps: {},
    resolved: false,
    timer: setTimeout(() => resolveIgnition(matchId), 12000),
  };
  ignitionRooms.set(matchId, room);
  logger.info({ matchId }, "Ignition started");
}

/** Section J — resolve verified userId from WS upgrade request */
async function getVerifiedUserId(req: IncomingMessage): Promise<string | null> {
  // Try Authorization: Bearer <sid> header first (API client fallback)
  const authHeader = req.headers["authorization"];
  let sid: string | undefined;

  if (authHeader?.startsWith("Bearer ")) {
    sid = authHeader.slice(7);
  } else {
    // Parse sid from cookie
    const cookies = parseCookie(req.headers.cookie ?? "");
    sid = cookies[SESSION_COOKIE];
  }

  if (!sid) return null;

  try {
    const session = await getSession(sid);
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? "", "http://localhost");
    const matchId = url.searchParams.get("matchId");

    if (!matchId) {
      ws.close(1008, "matchId required");
      return;
    }

    // Section J — verify session before trusting userId
    const verifiedUserId = await getVerifiedUserId(req);
    if (!verifiedUserId) {
      ws.close(1008, "Unauthorized: valid session required");
      return;
    }

    const userId = verifiedUserId;
    const client: Client = { ws, userId, matchId };
    clients.push(client);

    logger.info({ matchId, userId }, "WS client connected (verified)");

    broadcastToMatch(matchId, {
      type: "presence",
      data: { userId, online: true },
    });

    maybeStartIgnition(matchId);

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === "typing") {
          const data = JSON.stringify({
            type: "typing",
            data: { userId, isTyping: msg.isTyping },
          });
          clients
            .filter((c) => c.matchId === matchId && c.userId !== userId)
            .forEach((c) => {
              if (c.ws.readyState === WebSocket.OPEN) c.ws.send(data);
            });
        } else if (msg.type === "ignition_tap") {
          const igRoom = ignitionRooms.get(matchId);
          if (igRoom && !igRoom.resolved && !(userId in igRoom.taps)) {
            igRoom.taps[userId] = Date.now();
            logger.info({ matchId, userId }, "Ignition tap recorded");
            if (Object.keys(igRoom.taps).length >= 2) {
              resolveIgnition(matchId);
            }
          }
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
