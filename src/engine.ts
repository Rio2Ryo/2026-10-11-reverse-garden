export const W = 32, H = 20, CELLS = W * H, MAX_TICK = 80, MAX_EDITS = 32, MAX_NOTE = 80
export const RULES = ['wave', 'life', 'weave'] as const
export type Rule = typeof RULES[number]
export type Board = number[]
export type Edit = { t: number; i: number }
export type Scenario = { v: 1; seed: number; rule: Rule; tick: number; edits: Edit[]; note: string }
export const initial = (): Scenario => ({ v: 1, seed: 1106, rule: 'wave', tick: 0, edits: [], note: '小さな一手にも、未来を変える力がある。' })
const integer = (n: unknown, max: number): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= max
export function validate(value: unknown): Scenario {
  if (!value || typeof value !== 'object') throw new Error('庭のデータがありません')
  const s = value as Scenario
  if (s.v !== 1 || !integer(s.seed, 999999) || !integer(s.tick, MAX_TICK) || !RULES.includes(s.rule) || typeof s.note !== 'string' || Array.from(s.note).length > MAX_NOTE || !Array.isArray(s.edits) || s.edits.length > MAX_EDITS || s.edits.some(e => !e || !integer(e.t, MAX_TICK) || !integer(e.i, CELLS - 1))) throw new Error('庭のデータが範囲外です')
  return { v: 1, seed: s.seed, rule: s.rule, tick: s.tick, note: s.note, edits: s.edits.map(e => ({ t: e.t, i: e.i })) }
}
export function seedBoard(seed: number): Board {
  let x = seed + 1
  const b = Array<number>(CELLS).fill(0)
  for (let k = 0; k < 24; k++) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0
    const px = 6 + x % 20
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0
    const py = 4 + x % 12
    b[py * W + px] = 1
  }
  return b
}
export function localRule(board: Board, rule: Rule): Board {
  const at = (x: number, y: number) => board[((y + H) % H) * W + (x + W) % W]
  return board.map((value, i) => {
    const x = i % W, y = Math.floor(i / W)
    if (rule === 'weave') return at(x - 1, y) ^ at(x + 1, y)
    if (rule === 'wave') return at(x - 1, y) ^ at(x + 1, y) ^ at(x, y - 1) ^ at(x, y + 1)
    let n = 0
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) n += at(x + dx, y + dy)
    return Number(n === 3 || (value === 1 && n === 2))
  })
}
// 二時刻を保持すると、同じXOR演算で前にも後ろにも進める。
export function next(previous: Board, current: Board, rule: Rule): Board {
  const signal = localRule(current, rule)
  return previous.map((v, i) => v ^ signal[i])
}
export function frame(raw: Scenario, tick = raw.tick, baseline = false): Board {
  const s = validate({ ...raw, tick })
  let previous = Array<number>(CELLS).fill(0), current = seedBoard(s.seed)
  for (let t = 0; t <= tick; t++) {
    if (!baseline) for (const e of s.edits) if (e.t === t) current[e.i] ^= 1
    if (t === tick) return current
    const future = next(previous, current, s.rule)
    previous = current; current = future
  }
  return current
}
export function stats(s: Scenario) {
  const a = frame(s), b = frame(s, s.tick, true)
  const changed = a.flatMap((v, i) => v !== b[i] ? [i] : [])
  return { tick: s.tick, live: a.reduce((n, v) => n + v, 0), baselineLive: b.reduce((n, v) => n + v, 0), changed: changed.length, changedIndices: changed, edits: s.edits.length }
}
export function seek(s: Scenario, tick: number): Scenario { return validate({ ...s, tick }) }
export function plant(s: Scenario, i: number): Scenario {
  if (s.edits.length >= MAX_EDITS) throw new Error('一つの庭は32手まで。時間を戻すか、新しい庭へ。')
  return validate({ ...s, edits: [...s.edits, { t: s.tick, i }] })
}
export function encode(s: Scenario): string {
  const v = validate(s)
  const text = JSON.stringify([1, v.seed, RULES.indexOf(v.rule), v.tick, v.edits.map(e => [e.t, e.i]), v.note])
  const bytes = new TextEncoder().encode(text)
  return btoa(Array.from(bytes, c => String.fromCharCode(c)).join('')).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}
export function decode(token: string): Scenario {
  if (!token || token.length > 2200 || !/^[A-Za-z0-9_-]+$/.test(token)) throw new Error('共有リンクが壊れています')
  try {
    const bytes = Uint8Array.from(atob(token.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0))
    const p: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    if (!Array.isArray(p) || p.length !== 6 || !integer(p[2], 2) || !Array.isArray(p[4]) || p[4].some(e => !Array.isArray(e) || e.length !== 2)) throw new Error('schema')
    return validate({ v: p[0], seed: p[1], rule: RULES[p[2]], tick: p[3], edits: p[4].map(e => ({ t: e[0], i: e[1] })), note: p[5] })
  } catch { throw new Error('共有リンクが壊れています。新しい庭を開いてください。') }
}
export function receipt(s: Scenario): string {
  const m = stats(s)
  if (!s.edits.length) return 'まだ、あなたの手は入っていない。ここから、世界を分けられる。'
  const visible = s.edits.filter(e => e.t <= s.tick).sort((a,b) => a.t-b.t)
  if (!visible.length) return 'あなたが触れる前の時間。二つの世界は、まだ同じ。'
  if (m.changed === 0) return '違いが消えた時刻。それでも介入の記録は残り、先の時間でまた別れうる。'
  return `T${visible[0].t}の一手から、いま${m.changed}粒が別の未来にいる。${m.live > m.baselineLive ? '触れなかった世界より、光が増えた。' : m.live < m.baselineLive ? '触れなかった世界より、静かな場所が増えた。' : '光の数は同じ。でも、いる場所が違う。'}`
}
