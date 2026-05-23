export type EventMap = {
  "agent:thinking": { message: string };
  "agent:token": { token: string };
  "agent:done": { result: string };
  "tool:start": { tool: string; args: unknown };
  "tool:end": { tool: string; result: unknown };
  error: { error: Error };
};

export type EventName = keyof EventMap;

type Handler<E extends EventName> = (payload: EventMap[E]) => void;

export interface EventBus {
  subscribe<E extends EventName>(event: E, handler: Handler<E>): () => void;
  emit<E extends EventName>(event: E, payload: EventMap[E]): void;
}

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

const EventBusContext = createContext<EventBus | null>(null);

export function EventBusProvider({ bus, children }: { bus: EventBus; children: ReactNode }) {
  return (
    <EventBusContext.Provider value={bus}>
      {children}
    </EventBusContext.Provider>
  );
}

export function useEventBus(): EventBus {
  const bus = useContext(EventBusContext);
  if (!bus) {
    throw new Error("useEventBus must be used within an EventBusProvider");
  }
  return bus;
}

export function createEventBus(): EventBus {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  return {
    subscribe(event, handler) {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(handler as (...args: unknown[]) => void);
      return () => {
        listeners.get(event)?.delete(handler as (...args: unknown[]) => void);
      };
    },

    emit(event, payload) {
      listeners.get(event)?.forEach((handler) => handler(payload));
    },
  };
}
