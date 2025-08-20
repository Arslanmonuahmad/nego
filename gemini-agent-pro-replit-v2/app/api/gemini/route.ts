export const runtime = 'edge'
const BASE = 'https://generativelanguage.googleapis.com/v1beta'

type InMsg = { role: 'user' | 'assistant' | 'system'; content: string }

function toGeminiContents(messages: InMsg[], system?: string) {
  const contents: any[] = []
  if (system) contents.push({ role: 'user', parts: [{ text: `System instruction: ${system}` }] })
  for (const m of messages) {
    if (!m.content?.trim()) continue
    const role = m.role === 'assistant' ? 'model' : 'user'
    contents.push({ role, parts: [{ text: m.content }] })
  }
  return contents
}

export async function POST(req: Request) {
  try {
    const { messages, model, system } = await req.json()
    const chosen = model || process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite'

    const upstream = await fetch(`${BASE}/models/${chosen}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': String(process.env.GEMINI_API_KEY)
      },
      body: JSON.stringify({ contents: toGeminiContents(messages || [], system) })
    })

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text()
      const payload = `data: ${JSON.stringify({ error: text })}\n\n`
      return new Response(payload, { status: 500, headers: { 'Content-Type': 'text/event-stream' } })
    }

    return new Response(upstream.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (e: any) {
    const payload = `data: ${JSON.stringify({ error: e?.message || 'unknown' })}\n\n`
    return new Response(payload, { status: 500, headers: { 'Content-Type': 'text/event-stream' } })
  }
}
