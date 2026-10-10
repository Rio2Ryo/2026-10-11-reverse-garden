import { initial, validate, stats, receipt, encode, decode, frame, next, RULES } from '../src/engine'
try {
  const s = initial(), seen = new Set<string>()
  const args = process.argv.slice(2)
  for (let j = 0; j < args.length; j++) {
    const m = /^(--[a-z]+)(?:=(.*))?$/.exec(args[j])
    if (!m || !['--seed','--rule','--tick','--edit','--note'].includes(m[1])) throw new Error(`不明な引数: ${args[j]}`)
    const key = m[1], value = m[2] ?? args[++j]
    if (value === undefined || value.startsWith('--') || value === '') throw new Error(`${key} に値が必要です`)
    if (seen.has(key) && key !== '--edit') throw new Error(`重複した引数: ${key}`)
    seen.add(key)
    if (key === '--note') s.note = value
    else if (key === '--rule') { if (!RULES.includes(value as typeof s.rule)) throw new Error('ruleはwave/life/weave'); s.rule = value as typeof s.rule }
    else if (key === '--edit') { const parts = value.split(','); if (parts.length !== 2 || parts.some(p=>!/^\d+$/.test(p))) throw new Error('editは時刻,セル番号'); s.edits.push({t:Number(parts[0]),i:Number(parts[1])}) }
    else { if (!/^\d+$/.test(value)) throw new Error(`${key} は非負整数`); if (key === '--seed') s.seed = Number(value); else s.tick = Number(value) }
  }
  const state = validate(s), token = encode(state)
  const previous = frame({...state,edits:[]},0), current = frame({...state,edits:[]},1)
  const reverseExact = JSON.stringify(next(next(previous,current,state.rule),current,state.rule)) === JSON.stringify(previous)
  console.log(JSON.stringify({state,metrics:stats(state),receipt:receipt(state),token,tokenLength:token.length,replayExact:JSON.stringify(decode(token))===JSON.stringify(state),reverseExact},null,2))
} catch(e) { console.error(e instanceof Error?e.message:'不正な引数'); process.exitCode=1 }
