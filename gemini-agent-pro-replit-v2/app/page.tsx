'use client'
import { useEffect, useMemo, useRef, useState } from 'react'

type Msg = { role: 'user' | 'assistant' | 'system'; content: string }
const DEFAULT_SYSTEM = 'You are a helpful Indian English + Hindi bilingual assistant. Be concise.'

const DAILY_FREE_CREDITS = 100
const CREDITS_PER_MSG = 2.5

const models = [
  { id: 'gemini-2.5-flash-lite', label: '2.5 Flash‑Lite (fast & cheap)' },
  { id: 'gemini-2.0-flash', label: '2.0 Flash' },
  { id: 'gemini-2.5-pro-exp', label: '2.5 Pro (exp)'},
]

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function useDailyCredits() {
  const key = `credits:${todayKey()}`
  const [credits, setCredits] = useState<number>(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null
    return raw ? JSON.parse(raw) : DAILY_FREE_CREDITS
  })
  useEffect(() => { localStorage.setItem(key, JSON.stringify(credits)) }, [credits])
  return { credits, setCredits, reset: () => setCredits(DAILY_FREE_CREDITS) }
}

export default function Page(){
  const [messages, setMessages] = useState<Msg[]>([{ role:'assistant', content:'👋 Namaste! I’m your Gemini agent. Ask me anything.' }])
  const [input, setInput] = useState('')
  const [system, setSystem] = useState(DEFAULT_SYSTEM)
  const [model, setModel] = useState(models[0].id)
  const [plan, setPlan] = useState<'free' | 'paid'>('free')
  const { credits, setCredits } = useDailyCredits()
  const [loading, setLoading] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const canSend = useMemo(() => {
    if (loading) return false
    if (plan === 'paid') return input.trim().length > 0
    return input.trim().length > 0 && credits >= CREDITS_PER_MSG
  }, [loading, input, plan, credits])

  useEffect(() => { if(listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight }, [messages, loading])

  async function send() {
    const text = input.trim(); if(!text || !canSend) return
    setInput('')
    const toSend = [...messages, { role: 'user', content: text }]
    setMessages(m => [...toSend, { role:'assistant', content:'' }])
    setLoading(true)
    if (plan === 'free') setCredits(c => Math.max(0, c - CREDITS_PER_MSG))

    const res = await fetch('/api/gemini', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ messages: toSend, model, system }) })
    const reader = res.body!.getReader(); const decoder = new TextDecoder('utf-8'); let assistant=''
    while(true){
      const { value, done } = await reader.read(); if(done) break
      const chunk = decoder.decode(value, { stream:true })
      for (const line of chunk.split('\n')) {
        const t = line.trim(); if(!t.startsWith('data:')) continue
        const payload = t.replace(/^data:\s*/, '')
        if (payload === '[DONE]') continue
        try { const json = JSON.parse(payload); const part = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (part) { assistant += part; setMessages(m => { const copy=[...m]; copy[copy.length-1] = { role:'assistant', content: assistant }; return copy }) } }
        catch {}
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen grid md:grid-cols-[300px_1fr]">
      <aside className="border-r dark:border-zinc-800 p-4 space-y-4 bg-white/60 backdrop-blur dark:bg-zinc-900/60">
        <div className="text-lg font-bold">Gemini Agent</div>
        <div className="text-xs text-gray-600 dark:text-gray-400">Plan</div>
        <select value={plan} onChange={e=>setPlan(e.target.value as any)} className="w-full border rounded-lg px-2 py-1 bg-white dark:bg-zinc-900">
          <option value="free">Free (100 credits/day)</option>
          <option value="paid">Paid (no local cap)</option>
        </select>
        <div className="text-xs text-gray-600 dark:text-gray-400">Model</div>
        <select value={model} onChange={e=>setModel(e.target.value)} className="w-full border rounded-lg px-2 py-1 bg-white dark:bg-zinc-900">
          {models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <div className="text-xs text-gray-600 dark:text-gray-400">System Prompt</div>
        <textarea value={system} onChange={e=>setSystem(e.target.value)} rows={6} className="w-full border rounded-lg p-2 bg-white dark:bg-zinc-900 text-sm" />
        <div className="text-xs text-gray-600 dark:text-gray-400">Credits</div>
        <div className="text-sm"><div className="px-2 py-1 rounded bg-gray-100 dark:bg-zinc-800 inline-block">Left: {plan==='free' ? Math.floor(credits) : '∞'} / {DAILY_FREE_CREDITS}</div>
          <div className="mt-1 text-xs text-gray-500">≈ {plan==='free' ? Math.floor(credits / 2.5) : '∞'} messages today</div>
        </div>
      </aside>

      <main className="flex flex-col">
        <header className="sticky top-0 z-10 border-b dark:border-zinc-800 p-3 bg-white/60 backdrop-blur dark:bg-zinc-900/60 flex items-center justify-between">
          <div className="font-semibold">Chat</div>
          <div className="text-xs text-gray-500">Streaming via SSE • {model}</div>
        </header>
        <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={m.role==='user' ? 'text-right' : 'text-left'}>
              <div className={`inline-block px-3 py-2 rounded-2xl shadow text-sm md:text-base ${m.role==='user' ? 'bg-black text-white rounded-br-sm' : 'bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-bl-sm'}`}>{m.content}</div>
            </div>
          ))}
          {loading && <div className="text-xs text-gray-500 animate-pulse">Assistant is typing…</div>}
        </div>
        <div className="border-t dark:border-zinc-800 p-3 flex gap-2">
          <textarea value={input} onChange={e=>setInput(e.target.value)} rows={1} onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send() } }} placeholder={plan==='free' && credits < 2.5 ? 'Out of free credits for today.' : 'Type your message…'} className="flex-1 resize-none rounded-xl border dark:border-zinc-800 p-3 bg-white dark:bg-zinc-900" />
          <button onClick={send} disabled={!canSend} className={`px-4 py-2 rounded-xl ${canSend ? 'bg-black text-white' : 'bg-gray-300 text-gray-600 cursor-not-allowed'}`}>Send</button>
        </div>
        <footer className="text-center text-xs text-gray-500 dark:text-gray-400 p-3">© {new Date().getFullYear()} Gemini Agent</footer>
      </main>
    </div>
  )
}
