const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { spawn } = require("node:child_process");
const readline = require("node:readline");
const fs = require("node:fs");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const CLI_ENTRY = path.join(PROJECT_ROOT, "bin", "claude-code-tudou");
const ENV_PATH = path.join(PROJECT_ROOT, ".env");

const MODEL_KEYS = [
  "ANTHROPIC_MODEL",
  "ANTHROPIC_DEFAULT_SONNET_MODEL",
  "ANTHROPIC_DEFAULT_HAIKU_MODEL",
  "ANTHROPIC_DEFAULT_OPUS_MODEL",
  "OLLAMA_MODEL",
  "OPENAI_MODEL",
];

const SETTINGS_KEYS = [
  "MODEL_PROVIDER",
  "ANTHROPIC_BASE_URL",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_MODEL",
  "ANTHROPIC_DEFAULT_SONNET_MODEL",
  "ANTHROPIC_DEFAULT_HAIKU_MODEL",
  "ANTHROPIC_DEFAULT_OPUS_MODEL",
  "OLLAMA_BASE_URL",
  "OLLAMA_MODEL",
  "OPENAI_BASE_URL",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "API_TIMEOUT_MS",
  "DISABLE_TELEMETRY",
  "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
];

const OLLAMA_AGENT_MAX_STEPS = 10;
const TOOL_TEXT_LIMIT = 12000;
const COMMAND_OUTPUT_LIMIT = 8000;

let mainWindow = null;
let activeSessionId = randomUUID();
const startedSessions = new Set();
let isBusy = false;
let currentWorkspace = PROJECT_ROOT;
let activeRequest = null;
const stoppedRequestIds = new Set();

function isSessionInUseError(errorText) {
  return /Session ID .* is already in use/i.test(`${errorText || ""}`);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1260,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: "#140f12",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    return;
  }
  mainWindow.loadFile(path.join(__dirname, "dist", "index.html"));
}

function sendEvent(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel, payload);
}

function parseEnvLines(raw) {
  const lines = raw.split(/\r?\n/);
  const map = new Map();
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    map.set(line.slice(0, idx).trim(), line.slice(idx + 1));
  }
  return { lines, map };
}

function readEnvSettings() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const raw = fs.readFileSync(ENV_PATH, "utf8");
  const { map } = parseEnvLines(raw);
  const settings = {};
  for (const key of SETTINGS_KEYS) {
    settings[key] = map.get(key) ?? "";
  }
  return settings;
}

function writeEnvSettings(partial) {
  const safePartial = partial || {};
  const existing = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  const { lines, map } = parseEnvLines(existing);

  for (const key of SETTINGS_KEYS) {
    if (Object.prototype.hasOwnProperty.call(safePartial, key)) {
      map.set(key, `${safePartial[key] ?? ""}`);
    }
  }

  const used = new Set();
  const next = lines.map((line) => {
    const idx = line.indexOf("=");
    if (idx <= 0) return line;
    const key = line.slice(0, idx).trim();
    if (!SETTINGS_KEYS.includes(key)) return line;
    used.add(key);
    return `${key}=${map.get(key) ?? ""}`;
  });

  for (const key of SETTINGS_KEYS) {
    if (!used.has(key) && map.has(key)) {
      next.push(`${key}=${map.get(key)}`);
    }
  }

  fs.writeFileSync(ENV_PATH, `${next.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`, "utf8");
  return readEnvSettings();
}

function clearModelSettings() {
  const reset = {};
  for (const key of MODEL_KEYS) {
    reset[key] = "";
  }
  return writeEnvSettings(reset);
}

function setWorkspacePath(nextPath) {
  if (!nextPath || typeof nextPath !== "string") return false;
  try {
    const stat = fs.statSync(nextPath);
    if (!stat.isDirectory()) return false;
    currentWorkspace = nextPath;
    return true;
  } catch {
    return false;
  }
}

function buildCliArgs(sessionId, model, isResuming) {
  const args = [
    CLI_ENTRY,
    "-p",
    "--output-format",
    "stream-json",
    "--include-partial-messages",
    "--verbose",
  ];
  if (isResuming) {
    args.push("--resume", sessionId);
  } else {
    args.push("--session-id", sessionId);
  }
  if (model && model.trim()) {
    args.push("--model", model.trim());
  }
  return args;
}

function extractTextFromAssistant(message) {
  if (!message || !Array.isArray(message.content)) return "";
  return message.content
    .filter((block) => block && block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("");
}

function truncateText(input, maxLength) {
  if (typeof input !== "string") return "";
  if (input.length <= maxLength) return input;
  return `${input.slice(0, maxLength)}\n...[truncated]`;
}

async function fetchJsonWithTimeout(url, { headers = {}, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    const text = await response.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {}
    return {
      ok: response.ok,
      status: response.status,
      data,
      text,
    };
  } finally {
    clearTimeout(timer);
  }
}

function normalizeModelEntries(list, provider) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      const id = `${item?.id || ""}`.trim();
      if (!id) return null;
      const name = `${item?.name || item?.display_name || id}`.trim();
      return { id, name, provider };
    })
    .filter(Boolean)
    .slice(0, 120);
}

async function listOpenRouterModels(timeoutMs) {
  const result = await fetchJsonWithTimeout("https://openrouter.ai/api/v1/models", { timeoutMs });
  if (!result.ok) {
    return {
      ok: false,
      error: `OpenRouter models API failed (${result.status})`,
    };
  }
  const models = normalizeModelEntries(result?.data?.data, "openrouter");
  return { ok: true, models };
}

async function listAnthropicModels(apiKey, timeoutMs) {
  if (!apiKey || !apiKey.trim()) {
    return { ok: false, error: "Anthropic API key is required." };
  }
  const result = await fetchJsonWithTimeout("https://api.anthropic.com/v1/models", {
    timeoutMs,
    headers: {
      "x-api-key": apiKey.trim(),
      "anthropic-version": "2023-06-01",
    },
  });
  if (!result.ok) {
    const errorText = (result?.data?.error?.message || result.text || "").slice(0, 200);
    return {
      ok: false,
      error: `Anthropic models API failed (${result.status}) ${errorText}`.trim(),
    };
  }
  const models = normalizeModelEntries(result?.data?.data, "anthropic");
  return { ok: true, models };
}



/**
 * Send a message via OpenAI-compatible API endpoint (streaming).
 * This handles /v1/chat/completions format used by OpenAI-compatible providers.
 */
async function sendViaOpenAI({ prompt, model, requestId, baseUrl, apiKey, timeoutMs, conversationHistory }) {
  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const messages = [];
  // Add system message
  messages.push({ role: "system", content: "You are a helpful coding assistant. Please answer in the user's language." });
  // Add conversation history if available
  if (Array.isArray(conversationHistory)) {
    for (const msg of conversationHistory) {
      if (msg.role === "user" || msg.role === "assistant") {
        messages.push({ role: msg.role, content: msg.text || "" });
      }
    }
  }
  // Add current user prompt
  messages.push({ role: "user", content: prompt });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 3000000);

  activeRequest = {
    provider: "openai",
    requestId,
    stop: () => {
      try { controller.abort(); } catch {}
    },
  };

  let fullText = "";
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "gpt-4o",
        messages,
        stream: true,
        max_tokens: 8192,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      clearTimeout(timer);
      if (activeRequest?.requestId === requestId) activeRequest = null;
      return {
        ok: false,
        requestId,
        error: `OpenAI API error (${response.status}): ${(errBody || "").slice(0, 500)}`,
        sessionId: activeSessionId,
      };
    }

    // Handle SSE streaming response
    const reader = response.body;
    const textDecoder = new (require("util").TextDecoder)();
    let buffer = "";

    for await (const chunk of reader) {
      if (stoppedRequestIds.has(requestId)) break;
      buffer += textDecoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed?.choices?.[0]?.delta;
          if (delta?.content) {
            fullText += delta.content;
            sendEvent("chat:delta", { requestId, text: delta.content });
          }
        } catch {
          // Skip invalid JSON chunks
        }
      }
    }

    clearTimeout(timer);
    if (activeRequest?.requestId === requestId) activeRequest = null;

    if (stoppedRequestIds.has(requestId)) {
      stoppedRequestIds.delete(requestId);
      return { ok: false, requestId, error: "Task stopped.", sessionId: activeSessionId, stopped: true };
    }

    return {
      ok: true,
      requestId,
      text: fullText.trim() || "[模型未返回文本]",
      sessionId: activeSessionId,
    };
  } catch (err) {
    clearTimeout(timer);
    if (activeRequest?.requestId === requestId) activeRequest = null;

    if (stoppedRequestIds.has(requestId)) {
      stoppedRequestIds.delete(requestId);
      return { ok: false, requestId, error: "Task stopped.", sessionId: activeSessionId, stopped: true };
    }

    const errMsg = err?.name === "AbortError" ? "请求超时" : (err?.message || "Unknown error");
    return {
      ok: false,
      requestId,
      error: `OpenAI API 请求失败: ${errMsg}`,
      sessionId: activeSessionId,
    };
  }
}

async function sendViaClaudeCli({ prompt, model, requestId, sessionId, isResuming, workspacePath, envOverrides }) {
  let lastAssistantText = "";
  let stderrLog = "";
  let lastResultText = "";
  let stdoutLog = "";

  const child = spawn("node", buildCliArgs(sessionId, model, isResuming), {
    cwd: workspacePath || PROJECT_ROOT,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      ...(envOverrides || {}),
    },
  });

  child.stdin.write(prompt);
  child.stdin.end();

  activeRequest = {
    provider: "cli",
    requestId,
    stop: () => {
      try {
        child.kill();
      } catch {}
    },
  };

  const rl = readline.createInterface({ input: child.stdout });
  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    stdoutLog += `${trimmed}\n`;
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return;
    }

    if (
      parsed?.type === "stream_event" &&
      parsed?.event?.type === "content_block_delta" &&
      parsed?.event?.delta?.type === "text_delta" &&
      typeof parsed?.event?.delta?.text === "string"
    ) {
      sendEvent("chat:delta", { requestId, text: parsed.event.delta.text });
    }

    if (parsed?.type === "assistant") {
      const fullText = extractTextFromAssistant(parsed.message);
      if (fullText) lastAssistantText = fullText;
    }

    if (parsed?.type === "result" && typeof parsed?.result === "string") {
      lastResultText = parsed.result;
    }
  });

  child.stderr.on("data", (chunk) => {
    stderrLog += chunk.toString();
  });

  return await new Promise((resolve) => {
    child.on("close", (code) => {
      if (activeRequest?.requestId === requestId) activeRequest = null;

      if (stoppedRequestIds.has(requestId)) {
        stoppedRequestIds.delete(requestId);
        resolve({ ok: false, requestId, error: "Task stopped.", sessionId, stopped: true });
        return;
      }

      if (code === 0) {
        resolve({ ok: true, requestId, text: lastAssistantText.trim(), sessionId });
        return;
      }

      const errorText = stderrLog.trim() || "Unknown CLI error.";
      const fallbackText =
        errorText === "Unknown CLI error."
          ? (lastResultText || lastAssistantText || truncateText(stdoutLog, 1200))
          : "";
      resolve({
        ok: false,
        requestId,
        error: fallbackText || errorText,
        sessionId,
      });
    });
  });
}

ipcMain.handle("chat:getState", async () => {
  const envSettings = readEnvSettings();
  return {
    sessionId: activeSessionId,
    model: envSettings.ANTHROPIC_MODEL || envSettings.OLLAMA_MODEL || envSettings.OPENAI_MODEL || "",
    busy: isBusy,
    settings: envSettings,
    workspacePath: currentWorkspace,
  };
});

ipcMain.handle("workspace:get", async () => ({ path: currentWorkspace }));

ipcMain.handle("workspace:choose", async () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { ok: false, error: "Window not ready." };
  }
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "选择项目目录",
    defaultPath: currentWorkspace,
  });
  if (result.canceled || !result.filePaths?.length) {
    return { ok: false, canceled: true };
  }
  const picked = result.filePaths[0];
  if (!setWorkspacePath(picked)) {
    return { ok: false, error: "所选目录无效。" };
  }
  return { ok: true, path: currentWorkspace };
});

ipcMain.handle("settings:get", async () => readEnvSettings());
ipcMain.handle("settings:save", async (_event, payload) => writeEnvSettings(payload));
ipcMain.handle("settings:clearModel", async () => clearModelSettings());
ipcMain.handle("models:list", async (_event, payload) => {
  const source = `${payload?.source || ""}`.toLowerCase();
  const envSettings = readEnvSettings();
  const timeoutMs = Number.parseInt(envSettings.API_TIMEOUT_MS || "15000", 10) || 15000;

  if (source === "openrouter") {
    return listOpenRouterModels(timeoutMs);
  }

  if (source === "anthropic") {
    const apiKey = `${payload?.apiKey || envSettings.ANTHROPIC_API_KEY || ""}`;
    return listAnthropicModels(apiKey, timeoutMs);
  }

  return { ok: false, error: "Unsupported model source." };
});

ipcMain.handle("chat:newSession", async () => {
  activeSessionId = randomUUID();
  return { sessionId: activeSessionId };
});

ipcMain.handle("chat:stop", async () => {
  if (!isBusy || !activeRequest?.stop) {
    return { ok: false, error: "当前没有运行中的任务。" };
  }
  try {
    stoppedRequestIds.add(activeRequest.requestId);
    activeRequest.stop();
    sendEvent("chat:status", { busy: false, requestId: activeRequest.requestId, state: "stopped" });
    isBusy = false;
    activeRequest = null;
    // Avoid immediate session-id reuse after forced stop.
    activeSessionId = randomUUID();
    return { ok: true, sessionId: activeSessionId };
  } catch (error) {
    return { ok: false, error: `停止失败: ${error?.message || "unknown"}` };
  }
});

ipcMain.handle("chat:send", async (_event, payload) => {
  if (isBusy) {
    return { ok: false, error: "A request is already running. Please wait for it to complete." };
  }

  const prompt = typeof payload?.prompt === "string" ? payload.prompt.trim() : "";
  const envSettings = readEnvSettings();
  const provider = (payload?.provider || envSettings.MODEL_PROVIDER || "anthropic").toLowerCase();
  const model =
    typeof payload?.model === "string" && payload.model.trim()
      ? payload.model.trim()
      : provider === "ollama"
        ? envSettings.OLLAMA_MODEL || ""
        : envSettings.ANTHROPIC_MODEL || "";

  const timeoutMs = Number.parseInt(envSettings.API_TIMEOUT_MS || "3000000", 10) || 3000000;

  // OpenAI-compatible provider: use direct API call instead of CLI
  if (provider === "openai") {
    const openaiKey = `${envSettings.OPENAI_API_KEY || ""}`.trim();
    if (!openaiKey) {
      return { ok: false, error: "请先在 OpenAI 兼容模式配置有效的 API Key。" };
    }
    const openaiBase = `${envSettings.OPENAI_BASE_URL || ""}`.trim();
    if (!openaiBase) {
      return { ok: false, error: "请先在 OpenAI 兼容模式配置 Base URL。" };
    }
    if (!prompt) {
      return { ok: false, error: "Prompt cannot be empty." };
    }

    isBusy = true;
    const requestId = randomUUID();
    sendEvent("chat:status", { busy: true, requestId });

    const result = await sendViaOpenAI({
      prompt,
      model: model || envSettings.OPENAI_MODEL || "gpt-4o",
      requestId,
      baseUrl: openaiBase,
      apiKey: openaiKey,
      timeoutMs,
    });

    isBusy = false;
    sendEvent("chat:status", { busy: false, requestId });
    return result;
  }

  if (provider !== "ollama") {
    const cloudKey = `${envSettings.ANTHROPIC_API_KEY || envSettings.ANTHROPIC_AUTH_TOKEN || ""}`.trim();
    if (!cloudKey || cloudKey === "ollama-local") {
      return { ok: false, error: "请先在云端模式配置有效的 API Key。当前 key 为空或为本地占位值。" };
    }
  }
  const envOverrides =
    provider === "ollama"
      ? {
          ANTHROPIC_BASE_URL: (envSettings.OLLAMA_BASE_URL || "http://127.0.0.1:11434").trim(),
          ANTHROPIC_API_KEY: "ollama-local",
          ANTHROPIC_AUTH_TOKEN: "ollama-local",
        }
      : undefined;
  if (!prompt) {
    return { ok: false, error: "Prompt cannot be empty." };
  }

  isBusy = true;
  const requestId = randomUUID();
  sendEvent("chat:status", { busy: true, requestId });

  const isResuming = startedSessions.has(activeSessionId);

  let result = await sendViaClaudeCli({
    prompt,
    model,
    requestId,
    sessionId: activeSessionId,
    isResuming,
    workspacePath: currentWorkspace,
    envOverrides,
  });

  if (!result?.ok && isSessionInUseError(result?.error)) {
    // Auto-recover once by rotating session id and retrying.
    activeSessionId = randomUUID();
    result = await sendViaClaudeCli({
      prompt,
      model,
      requestId,
      sessionId: activeSessionId,
      isResuming: false,
      workspacePath: currentWorkspace,
      envOverrides,
    });
  }

  if (result?.ok) {
    startedSessions.add(activeSessionId);
  }

  isBusy = false;
  sendEvent("chat:status", { busy: false, requestId });
  return result;
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
