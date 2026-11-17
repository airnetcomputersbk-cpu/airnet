import { useEffect, useRef, useState } from "react";
import { invalidateClientCache } from "../lib/dataCache";

export type SyncEntity =
  | "enquiries"
  | "tracker"
  | "records"
  | "services"
  | "government_services"
  | "notifications"
  | "settings"
  | "documents"
  | "all";

export interface SyncMessage {
  type: string;
  entity?: SyncEntity;
  action?: "create" | "update" | "delete" | "refresh" | "bulk_delete" | "reorder";
  payload?: any;
  timestamp?: string;
}

type SyncCallback = (msg: SyncMessage) => void;

// Global singleton EventSource manager to minimize socket connections
class LiveSyncManager {
  private static instance: LiveSyncManager;
  private es: EventSource | null = null;
  private listeners = new Map<SyncEntity, Set<SyncCallback>>();
  private reconnectTimer: any = null;
  public isConnected = false;

  private constructor() {
    this.connect();
  }

  public static getInstance(): LiveSyncManager {
    if (!LiveSyncManager.instance) {
      LiveSyncManager.instance = new LiveSyncManager();
    }
    return LiveSyncManager.instance;
  }

  public connect(): void {
    if (typeof window === "undefined") return;
    if (this.es && (this.es.readyState === EventSource.OPEN || this.es.readyState === EventSource.CONNECTING)) {
      return;
    }

    try {
      this.es = new EventSource("/api/events/live");

      this.es.onopen = () => {
        this.isConnected = true;
      };

      this.es.onmessage = (event) => {
        if (!event.data) return;
        try {
          const msg: SyncMessage = JSON.parse(event.data);
          if (msg.type === "sync_event" && msg.entity) {
            // Auto invalidate client cache for this entity
            invalidateClientCache(`admin_${msg.entity}*`);
            invalidateClientCache(`public_${msg.entity}*`);

            // Notify specific listeners
            const specific = this.listeners.get(msg.entity);
            if (specific) {
              specific.forEach((cb) => {
                try {
                  cb(msg);
                } catch (e) {
                  console.error("[LiveSync] Listener error:", e);
                }
              });
            }

            // Notify "all" wildcard listeners
            const allListeners = this.listeners.get("all");
            if (allListeners) {
              allListeners.forEach((cb) => {
                try {
                  cb(msg);
                } catch (e) {
                  console.error("[LiveSync] All-listener error:", e);
                }
              });
            }
          }
        } catch {
          // Ignore heartbeats or non-JSON messages
        }
      };

      this.es.onerror = () => {
        this.isConnected = false;
        if (this.es) {
          this.es.close();
          this.es = null;
        }
        // Auto-reconnect with exponential backoff / jitter
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
          }, 3000);
        }
      };
    } catch (e) {
      console.warn("[LiveSync] Could not initialize EventSource:", e);
    }
  }

  public subscribe(entity: SyncEntity, callback: SyncCallback): () => void {
    if (!this.listeners.has(entity)) {
      this.listeners.set(entity, new Set());
    }
    this.listeners.get(entity)!.add(callback);

    // Ensure connection is active
    this.connect();

    // Return unsubscribe function
    return () => {
      const set = this.listeners.get(entity);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.listeners.delete(entity);
        }
      }
    };
  }
}

/**
 * React hook to listen for real-time live database updates.
 * Automatically invalidates local cache and triggers silent revalidation.
 */
export function useLiveSync(entity: SyncEntity, onSync?: (msg: SyncMessage) => void) {
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const manager = LiveSyncManager.getInstance();
    setConnected(manager.isConnected);

    const unsubscribe = manager.subscribe(entity, (msg) => {
      if (onSyncRef.current) {
        onSyncRef.current(msg);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [entity]);

  return { connected };
}
