/**
 * OpenAI-compatible API adapter.
 *
 * Translates Anthropic SDK requests (POST /v1/messages) into OpenAI
 * chat-completions format (POST /v1/chat/completions), and converts the
 * streamed SSE response back into Anthropic-style events so the rest of
 * the codebase can remain unchanged.
 *
 * Activated when MODEL_PROVIDER=openai is set in .env.
 */

import { randomUUID } from 'crypto'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isOpenAIProviderEnabled(): boolean {
  return (process.env.MODEL_PROVIDER || '').toLowerCase() === 'openai'
}

export function getOpenAIBaseURL(): string {
  return (process.env.OPENAI_BASE_URL || '').replace(/\/+$/, '')
}

export function getOpenAIApiKey(): string {
  return process.env.OPENAI_API_KEY || ''
}

export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL || 'gpt-4o'
}

// ---------------------------------------------------------------------------
// Request translation: Anthropic → OpenAI
// ---------------------------------------------------------------------------

interface AnthropicContentBlock {
  type: string
  text?: string
  id?: string
  name?: string
  input?: unknown
  tool_use_id?: string
  content?: unknown
  source?: unknown
  [key: string]: unknown
}

interface AnthropicMessage {
  role: string
  content: string | AnthropicContentBlock[]
}

interface AnthropicToolDef {
  name: string
  description?: string
  input_schema?: unknown
  [key: string]: unknown
}

interface AnthropicRequestBody {
  model: string
  messages: AnthropicMessage[]
  system?: Array<{ type: string; text: string; [key: string]: unknown }>
  tools?: AnthropicToolDef[]
  max_tokens?: number
  stream?: boolean
  temperature?: number
  thinking?: unknown
  metadata?: unknown
  [key: string]: unknown
}

function extractTextFromContent(
  content: string | AnthropicContentBlock[],
): string {
  if (typeof content === 'string') return content
  return content
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text!)
    .join('\n')
}

function convertMessages(
  anthropicMessages: AnthropicMessage[],
  systemBlocks?: Array<{ type: string; text: string }>,
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = []

  // System prompt
  if (systemBlocks && systemBlocks.length > 0) {
    const systemText = systemBlocks.map((b) => b.text).join('\n\n')
    if (systemText) {
      out.push({ role: 'system', content: systemText })
    }
  }

  for (const msg of anthropicMessages) {
    if (msg.role === 'user') {
      // Check for tool_result blocks
      if (Array.isArray(msg.content)) {
        const toolResults = msg.content.filter(
          (b) => b.type === 'tool_result',
        )
        const textBlocks = msg.content.filter((b) => b.type === 'text')
        // Tool results → role: tool
        for (const tr of toolResults) {
          const resultContent =
            typeof tr.content === 'string'
              ? tr.content
              : Array.isArray(tr.content)
                ? (tr.content as AnthropicContentBlock[])
                    .filter((c) => c.type === 'text')
                    .map((c) => c.text)
                    .join('\n')
                : JSON.stringify(tr.content ?? '')
          out.push({
            role: 'tool',
            tool_call_id: tr.tool_use_id || 'unknown',
            content: resultContent,
          })
        }
        // Text blocks → role: user
        if (textBlocks.length > 0) {
          out.push({
            role: 'user',
            content: textBlocks.map((b) => b.text || '').join('\n'),
          })
        }
        // If only tool results, we already handled them
        if (toolResults.length === 0 && textBlocks.length === 0) {
          out.push({
            role: 'user',
            content: extractTextFromContent(msg.content),
          })
        }
      } else {
        out.push({ role: 'user', content: msg.content })
      }
    } else if (msg.role === 'assistant') {
      if (Array.isArray(msg.content)) {
        const textParts = msg.content
          .filter((b) => b.type === 'text')
          .map((b) => b.text || '')
        const toolUses = msg.content.filter((b) => b.type === 'tool_use')

        const assistantMsg: Record<string, unknown> = {
          role: 'assistant',
          content: textParts.join('\n') || null,
        }

        if (toolUses.length > 0) {
          assistantMsg.tool_calls = toolUses.map((tu) => ({
            id: tu.id || randomUUID(),
            type: 'function',
            function: {
              name: tu.name || '',
              arguments: JSON.stringify(tu.input ?? {}),
            },
          }))
        }
        out.push(assistantMsg)
      } else {
        out.push({ role: 'assistant', content: msg.content })
      }
    }
  }

  return out
}

function convertTools(
  anthropicTools: AnthropicToolDef[],
): Array<Record<string, unknown>> {
  return anthropicTools
    .filter((t) => t.name && t.input_schema)
    .map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description || '',
        parameters: t.input_schema || { type: 'object', properties: {} },
      },
    }))
}

function buildOpenAIRequest(body: AnthropicRequestBody): Record<string, unknown> {
  const openaiModel = getOpenAIModel()
  const messages = convertMessages(body.messages, body.system)

  const req: Record<string, unknown> = {
    model: openaiModel,
    messages,
    stream: true,
    max_tokens: body.max_tokens || 8192,
  }

  if (body.temperature !== undefined) {
    req.temperature = body.temperature
  }

  // Convert tools if present
  if (body.tools && body.tools.length > 0) {
    const converted = convertTools(body.tools)
    if (converted.length > 0) {
      req.tools = converted
    }
  }

  return req
}

// ---------------------------------------------------------------------------
// Response translation: OpenAI SSE → Anthropic SSE
// ---------------------------------------------------------------------------

function buildAnthropicMessageStart(model: string): string {
  const msgId = `msg_${randomUUID().replace(/-/g, '').slice(0, 20)}`
  const event = {
    type: 'message_start',
    message: {
      id: msgId,
      type: 'message',
      role: 'assistant',
      content: [],
      model,
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    },
  }
  return `event: message_start\ndata: ${JSON.stringify(event)}\n\n`
}

function buildContentBlockStart(index: number): string {
  const event = {
    type: 'content_block_start',
    index,
    content_block: { type: 'text', text: '' },
  }
  return `event: content_block_start\ndata: ${JSON.stringify(event)}\n\n`
}

function buildTextDelta(index: number, text: string): string {
  const event = {
    type: 'content_block_delta',
    index,
    delta: { type: 'text_delta', text },
  }
  return `event: content_block_delta\ndata: ${JSON.stringify(event)}\n\n`
}

function buildToolCallStart(
  index: number,
  id: string,
  name: string,
): string {
  const event = {
    type: 'content_block_start',
    index,
    content_block: { type: 'tool_use', id, name, input: {} },
  }
  return `event: content_block_start\ndata: ${JSON.stringify(event)}\n\n`
}

function buildInputJsonDelta(index: number, partialJson: string): string {
  const event = {
    type: 'content_block_delta',
    index,
    delta: { type: 'input_json_delta', partial_json: partialJson },
  }
  return `event: content_block_delta\ndata: ${JSON.stringify(event)}\n\n`
}

function buildContentBlockStop(index: number): string {
  const event = { type: 'content_block_stop', index }
  return `event: content_block_stop\ndata: ${JSON.stringify(event)}\n\n`
}

function buildMessageDelta(
  stopReason: string,
  outputTokens: number,
): string {
  const event = {
    type: 'message_delta',
    delta: { stop_reason: stopReason, stop_sequence: null },
    usage: { output_tokens: outputTokens },
  }
  return `event: message_delta\ndata: ${JSON.stringify(event)}\n\n`
}

function buildMessageStop(): string {
  const event = { type: 'message_stop' }
  return `event: message_stop\ndata: ${JSON.stringify(event)}\n\n`
}

interface ToolCallState {
  index: number
  id: string
  name: string
  arguments: string
  started: boolean
}

/**
 * Convert an OpenAI SSE stream to an Anthropic SSE stream.
 */
async function* transformOpenAIStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  model: string,
): AsyncGenerator<string> {
  const decoder = new TextDecoder()
  let buffer = ''
  let textBlockStarted = false
  let textBlockIndex = 0
  let outputTokens = 0
  let stopReason = 'end_turn'
  const toolCalls = new Map<number, ToolCallState>()
  let nextBlockIndex = 0

  // Emit message_start
  yield buildAnthropicMessageStart(model)

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') continue

      let parsed: any
      try {
        parsed = JSON.parse(data)
      } catch {
        continue
      }

      const choice = parsed?.choices?.[0]
      if (!choice) continue

      const delta = choice.delta
      const finishReason = choice.finish_reason

      // Handle text content
      if (delta?.content) {
        if (!textBlockStarted) {
          textBlockIndex = nextBlockIndex++
          yield buildContentBlockStart(textBlockIndex)
          textBlockStarted = true
        }
        yield buildTextDelta(textBlockIndex, delta.content)
        outputTokens++
      }

      // Handle tool calls
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const tcIndex = tc.index ?? 0
          let state = toolCalls.get(tcIndex)

          if (!state && tc.id) {
            // Close text block if open
            if (textBlockStarted) {
              yield buildContentBlockStop(textBlockIndex)
              textBlockStarted = false
            }

            state = {
              index: nextBlockIndex++,
              id: tc.id,
              name: tc.function?.name || '',
              arguments: '',
              started: false,
            }
            toolCalls.set(tcIndex, state)
          }

          if (state) {
            if (tc.function?.name && !state.started) {
              state.name = tc.function.name
            }
            if (tc.function?.arguments) {
              state.arguments += tc.function.arguments
            }

            if (!state.started && state.name) {
              yield buildToolCallStart(state.index, state.id, state.name)
              state.started = true
            }

            if (state.started && tc.function?.arguments) {
              yield buildInputJsonDelta(state.index, tc.function.arguments)
            }
          }
        }
      }

      // Handle finish
      if (finishReason) {
        if (finishReason === 'tool_calls' || finishReason === 'function_call') {
          stopReason = 'tool_use'
        } else if (finishReason === 'length') {
          stopReason = 'max_tokens'
        } else {
          stopReason = 'end_turn'
        }
      }
    }
  }

  // Close any open text block
  if (textBlockStarted) {
    yield buildContentBlockStop(textBlockIndex)
  }

  // Close any open tool call blocks
  for (const [, state] of toolCalls) {
    if (state.started) {
      yield buildContentBlockStop(state.index)
    }
  }

  // Emit message_delta and message_stop
  yield buildMessageDelta(stopReason, outputTokens)
  yield buildMessageStop()
}

// ---------------------------------------------------------------------------
// Fetch adapter
// ---------------------------------------------------------------------------

/**
 * Creates a custom fetch function that intercepts Anthropic API calls
 * and translates them to OpenAI-compatible format.
 */
export function createOpenAIFetchAdapter(): (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response> {
  return async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input)

    // Only intercept messages endpoint (the main API call)
    if (!url.includes('/v1/messages')) {
      // Pass through non-messages requests (e.g. /v1/models)
      return globalThis.fetch(input, init)
    }

    // Parse the Anthropic request body
    let anthropicBody: AnthropicRequestBody
    try {
      const bodyStr =
        init?.body instanceof ReadableStream
          ? await new Response(init.body).text()
          : typeof init?.body === 'string'
            ? init.body
            : JSON.stringify(init?.body ?? {})
      anthropicBody = JSON.parse(bodyStr)
    } catch {
      return new Response('Failed to parse request body', { status: 400 })
    }

    // Build OpenAI request
    const openaiBody = buildOpenAIRequest(anthropicBody)
    const baseUrl = getOpenAIBaseURL()
    const apiKey = getOpenAIApiKey()
    const openaiUrl = `${baseUrl}/chat/completions`

    // Make the actual request to the OpenAI-compatible endpoint
    // Only use clean headers - do NOT pass through Anthropic SDK headers
    // (x-api-key, anthropic-version, etc. would cause auth failures)
    const openaiResponse = await globalThis.fetch(openaiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(openaiBody),
      signal: init?.signal,
    })

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text().catch(() => '')
      return new Response(errText || 'OpenAI API error', {
        status: openaiResponse.status,
        statusText: openaiResponse.statusText,
        headers: openaiResponse.headers,
      })
    }

    // Transform the streaming response
    const reader = openaiResponse.body!.getReader()
    const model = (openaiBody.model as string) || 'gpt-4o'
    const generator = transformOpenAIStream(reader, model)

    const stream = new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await generator.next()
          if (done) {
            controller.close()
            return
          }
          controller.enqueue(new TextEncoder().encode(value))
        } catch (err) {
          controller.error(err)
        }
      },
    })

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        // Add a fake request-id header for the SDK
        'request-id': `req_openai_${randomUUID().replace(/-/g, '').slice(0, 20)}`,
      },
    })
  }
}

export { isOpenAIProviderEnabled }
