import type {
  BroadcastListener,
  IBroadcastAPI,
  IBroadcastLocalAPI,
  IBroadcastUnifiedAPI,
} from 'bridge/BroadcastAPI';
import { consumeAPI, provideAPI } from './main-ipc';

export const BroadcastAPI: IBroadcastUnifiedAPI = consumeAPI<
  IBroadcastAPI,
  IBroadcastLocalAPI
>('BroadcastAPI', {
  addEventListener: (eventID, listener) => {
    let eventListeners = LISTENERS.get(eventID);
    if (eventListeners == null) {
      eventListeners = new Set();
      LISTENERS.set(eventID, eventListeners);
    }
    eventListeners.add(listener);
  },
  removeEventListener: (eventID, listener) => {
    const eventListeners = LISTENERS.get(eventID);
    eventListeners?.delete(listener);
  },
});

const LISTENERS: Map<string, Set<BroadcastListener<unknown[]>>> = new Map();

export async function initBroadcastAPI(): Promise<void> {
  provideAPI('BroadcastAPI', {
    send: async (eventID: string, ...args: unknown[]) => {
      const eventListeners = LISTENERS.get(eventID);
      if (eventListeners != null) {
        for (const listener of eventListeners) {
          await listener(...args);
        }
      }
    },
  } as IBroadcastAPI);
}
