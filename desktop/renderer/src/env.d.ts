/// <reference types="vite/client" />

type ChatState = {
  sessionId: string;
  model: string;
  busy: boolean;
  settings: Record<string, string>;
  workspacePath: string;
};

type ChatSendResult = {
  ok: boolean;
  requestId?: string;
  text?: string;
  error?: string;
  sessionId?: string;
  stopped?: boolean;
};

type DeltaPayload = { requestId: string; text: string };
type StatusPayload = { busy: boolean; requestId: string };
type ModelEntry = { id: string; name: string; provider: string };

declare global {
  interface Window {
    desktopApi: {
      getState: () => Promise<ChatState>;
      newSession: () => Promise<{ sessionId: string }>;
      sendMessage: (payload: { prompt: string; model?: string; provider?: string }) => Promise<ChatSendResult>;
      stopMessage: () => Promise<{ ok: boolean; error?: string }>;
      getWorkspace: () => Promise<{ path: string }>;
      chooseWorkspace: () => Promise<{ ok: boolean; path?: string; error?: string; canceled?: boolean }>;
      getSettings: () => Promise<Record<string, string>>;
      saveSettings: (payload: Record<string, string>) => Promise<Record<string, string>>;
      clearModelSettings: () => Promise<Record<string, string>>;
      listModels: (payload: { source: "openrouter" | "anthropic"; apiKey?: string }) => Promise<{
        ok: boolean;
        models?: ModelEntry[];
        error?: string;
      }>;
      onDelta: (handler: (payload: DeltaPayload) => void) => () => void;
      onStatus: (handler: (payload: StatusPayload) => void) => () => void;
    };
  }
}

export {};
