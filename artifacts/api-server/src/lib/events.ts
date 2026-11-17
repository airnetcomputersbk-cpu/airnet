import type { Request, Response } from "express";

interface SSEClient {
  id: string;
  res: Response;
  connectedAt: Date;
}

const sseClients = new Set<SSEClient>();

// Send periodic heartbeat every 20s to keep connections alive across NAT/proxies
setInterval(() => {
  for (const client of sseClients) {
    try {
      client.res.write(":heartbeat\n\n");
    } catch (err) {
      sseClients.delete(client);
    }
  }
}, 20000);

export function sseHandler(req: Request, res: Response): void {
  // Disable compression and buffering for real-time streaming
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const client: SSEClient = {
    id: clientId,
    res,
    connectedAt: new Date(),
  };

  sseClients.add(client);

  // Send initial welcome/ready handshake
  res.write(
    `data: ${JSON.stringify({
      type: "connected",
      clientId,
      activeClients: sseClients.size,
      timestamp: new Date().toISOString(),
    })}\n\n`,
  );

  req.on("close", () => {
    sseClients.delete(client);
  });
}

export function broadcastEvent(
  entity: "enquiries" | "tracker" | "records" | "services" | "government_services" | "notifications" | "settings" | "system" | "documents",
  action: "create" | "update" | "delete" | "refresh" | "bulk_delete" | "reorder",
  payload?: any,
): void {
  if (sseClients.size === 0) return;

  const eventData = JSON.stringify({
    type: "sync_event",
    entity,
    action,
    payload,
    timestamp: new Date().toISOString(),
  });

  const message = `data: ${eventData}\n\n`;

  for (const client of sseClients) {
    try {
      client.res.write(message);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}

export function getActiveSSEClientCount(): number {
  return sseClients.size;
}
