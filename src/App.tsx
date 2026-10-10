import { useEffect, useMemo, useRef, useState } from 'react'
import { CELLS, W, RULES, MAX_TICK, MAX_NOTE, MAX_EDITS, initial, decode, encode, validate, frame, stats, seek, plant, receipt, type Scenario, type Rule } from './engine'
import './styles.css'
function boot() {
  if (!location.hash) return { state: initial(), notice: '' }
  try { return { state: decode(location.hash.slice(1)), notice: '共有された時刻と介入を復元しました。' } }
  catch { return { state: initial(), notice: '共有リンクを読めませんでした。新しい庭で始めます。' } }
}
const names: Record<Rule,string> = {wave:'波紋',life:'生命',weave:'織物'}
const descriptions: Record<Rule,string> = {wave:'四方へ伝わる波。一粒の違いが、遠くへ届く。',life:'隣り合う光が生存条件を変える。密度が未来を変える。',weave:'左右だけへ伝わる糸。縦には影響を与えない。'}
type Debug = { getState: () => Scenario; inspect: () => ReturnType<typeof stats>; seek: (t: number) => void; plant: (i: number) => void; load: (s: unknown) => void; share: () => string; pause: () => void }
declare global { interface Window { __GARDEN__: Debug } }
export default function App() {
  const [start] = useState(boot)
  const [state,setState] = useState(start.state)
  const [notice,setNotice] = useState(start.notice)
  const [running,setRunning] = useState(false)
  const [difference,setDifference] = useState(false)
  const [focus,setFocus] = useState(10 * W + 16)
  const [link,setLink] = useState('')
  const stateRef = useRef(state)
  const update = (next: Scenario) => { stateRef.current = validate(next); setState(stateRef.current); setLink('') }
  const act = (fn: () => void) => { try { fn() } catch(e) { setNotice(e instanceof Error ? e.message : '操作できませんでした') } }
  const board = useMemo(() => frame(state), [state])
  const baseline = useMemo(() => frame(state,state.tick,true), [state])
  const metrics = useMemo(() => stats(state), [state])
  useEffect(() => {
    window.__GARDEN__ = {
      getState: () => structuredClone(stateRef.current),
      inspect: () => stats(stateRef.current),
      seek: t => { setRunning(false); update(seek(stateRef.current,t)) },
      plant: i => { setRunning(false); update(plant(stateRef.current,i)) },
      load: s => { setRunning(false); update(validate(s)) },
      share: () => `${location.origin}${location.pathname}#${encode(stateRef.current)}`,
      pause: () => setRunning(false),
    }
  }, [])
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => {
      const s = stateRef.current
      if (s.tick >= MAX_TICK) { setRunning(false); return }
      update(seek(s, s.tick + 1))
    }, 160)
    return () => clearInterval(timer)
  }, [running])
  const travel = (t:number) => { setRunning(false); update(seek(stateRef.current,t)); setNotice(t === 0 ? '最初の光へ戻りました。介入は未来に残っています。' : `T${t}へ移動しました。`) }
  const touch = (i:number) => act(() => {
    setRunning(false); update(plant(stateRef.current,i)); setFocus(i)
    setNotice(`T${stateRef.current.tick} · (${i % W + 1}, ${Math.floor(i / W) + 1}) に一粒。再生すると違いが広がります。`)
  })
  const share = async () => {
    const url = window.__GARDEN__.share(); setLink(url)
    try { await navigator.clipboard.writeText(url); setNotice('共有リンクをコピーしました。介入の時刻まで復元できます。') }
    catch { setNotice('コピーできませんでした。下のリンクを選択してコピーできます。') }
  }
  const download = () => {
    const cells = board.map((v,i) => v || baseline[i] !== v ? `<rect x="${i%W*12+20}" y="${Math.floor(i/W)*12+20}" width="9" height="9" fill="${v ? (baseline[i]!==v?'#eeae76':'#badcb7') : 'none'}" ${!v?'stroke="#eeae76" stroke-width="1"':''}/>` : '').join('')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="424" height="304"><rect width="100%" height="100%" fill="#101b1b"/>${cells}<text x="20" y="280" fill="#badcb7" font-family="monospace" font-size="12">REVERSE GARDEN / T${state.tick} / ${metrics.changed} DIFFERENT</text></svg>`
    const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})); const a=document.createElement('a'); a.href=url;a.download=`reverse-garden-${state.seed}-t${state.tick}.svg`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('この時刻の庭をSVGで保存しました。')
  }
  return <main>
    <header><a className="wordmark" href={location.pathname}>RG<span> / DAILY EXPERIMENT 011</span></a><span className="topnote">ローカル計算・外部送信なし</span></header>
    <section className="intro"><div><p className="eyebrow">A SMALL MACHINE FOR OTHER FUTURES</p><h1>可逆の庭<span>一粒で、世界を分ける。</span></h1></div><p className="introcopy">戻せない一日を始める前に、<br/>戻せる世界に、触れてみる。<br/><small>これは占いではなく、因果を見る小さな計算機。</small></p></section>
    <div className="workspace"><section className="garden-panel" aria-label="庭と時間の操作">
      <div className="panelbar"><span><i className={running?'led active':'led'}/>{running?'GROWING':'TIME HELD'} / {names[state.rule]}</span><strong>T{String(state.tick).padStart(2,'0')}</strong></div>
      <div className="garden" role="group" aria-label="32列20行の庭。セルをクリック、または矢印とEnterで一粒を反転。">
        {Array.from({length:CELLS},(_,i) => <button key={i} id={`cell-${i}`} className={`cell ${board[i]?'alive':''} ${board[i]!==baseline[i]?'changed':''} ${difference&&board[i]===baseline[i]?'dim':''}`} tabIndex={focus===i?0:-1} aria-label={`${i%W+1}列${Math.floor(i/W)+1}行 ${board[i]?'点灯':'消灯'}`} onFocus={()=>setFocus(i)} onClick={()=>touch(i)} onKeyDown={e=>{
          const offset:Record<string,number>={ArrowRight:1,ArrowLeft:-1,ArrowDown:W,ArrowUp:-W}
          if(e.key in offset){e.preventDefault();const f=(i+offset[e.key]+CELLS)%CELLS;setFocus(f);document.getElementById(`cell-${f}`)?.focus()}
        }}/>) }
      </div>
      <div className="legend"><span><i className="green"/>いまの光</span><span><i className="orange"/>点＝増えた光 / 輪＝消えた光</span><button className="textbutton" aria-pressed={difference} onClick={()=>setDifference(!difference)}>{difference?'すべてを見る':'差分だけを見る'}</button></div>
      <div className="timecontrol"><button className="primary" onClick={()=>{if(state.tick===MAX_TICK)update(seek(stateRef.current,0));setRunning(!running);setNotice('')}}>{running?'一時停止':'育てる ▶'}</button><button disabled={state.tick===0} onClick={()=>travel(Math.max(0,stateRef.current.tick-8))}>8刻 巻き戻す</button><button disabled={state.tick===MAX_TICK} onClick={()=>travel(Math.min(MAX_TICK,stateRef.current.tick+8))}>8刻 進める</button><button disabled={state.tick===0} onClick={()=>travel(0)}>最初へ</button></div>
      <label className="timeline">時間をつまむ <span>T{state.tick} / {MAX_TICK}</span><input aria-label="時刻" type="range" min="0" max={MAX_TICK} value={state.tick} onChange={e=>travel(Number(e.target.value))}/></label>
      <div className="eventline" aria-label="介入の時間軸">{state.edits.map((e,i)=><button key={i} style={{left:`${e.t/MAX_TICK*96}%`}} title={`介入${i+1}: T${e.t}`} aria-label={`介入${i+1}の時刻T${e.t}へ`} onClick={()=>travel(e.t)}/>)}</div>
      <p className="status" role="status">{notice || '① 育てる → ② 光を一粒クリック → ③ 進める。オレンジがあなたの影響。'}</p>
    </section>
    <aside>
      <section className="instructions"><p className="eyebrow">FIRST 10 SECONDS</p><h2>一粒は、小さすぎない。</h2><ol><li><b>育てる。</b>光が自律的に進む。</li><li><b>触れる。</b>好きな一粒を反転。</li><li><b>先を見る。</b>オレンジの違いが広がる。</li></ol><p>時間を介入前まで戻すと、違いは消える。先へ進むと、また現れる。</p></section>
      <section className="metric-panel"><div><strong>{metrics.changed}</strong><span>別の未来にいる粒</span></div><div><strong>{state.edits.length}<small> / {MAX_EDITS}</small></strong><span>あなたの介入</span></div></section>
      <section className="worlds" aria-label="同じ種、同じ時刻の二つの世界"><div><span>触れなかった世界 · {metrics.baselineLive}灯</span><svg viewBox="0 0 320 200" role="img" aria-label="介入なしの庭">{baseline.map((v,i)=>v?<rect key={i} x={i%W*10} y={Math.floor(i/W)*10} width="7" height="7" fill="#a8c99a"/>:null)}</svg></div><div><span>あなたが触れた世界 · {metrics.live}灯</span><svg viewBox="0 0 320 200" role="img" aria-label="介入した庭">{board.map((v,i)=>v?<rect key={i} x={i%W*10} y={Math.floor(i/W)*10} width="7" height="7" fill={baseline[i]!==v?'#e9a26e':'#a8c99a'}/>:null)}</svg></div></section>
      <section className="laws"><h2>世界の法則を変える</h2><div className="rulebuttons">{RULES.map(r=><button key={r} aria-pressed={state.rule===r} onClick={()=>{setRunning(false);update({...stateRef.current,rule:r});setNotice(`同じ種と介入を「${names[r]}」の法則で再計算しました。`)}}>{names[r]}</button>)}</div><p>{descriptions[state.rule]}</p><label className="seed">種 / SEED <input aria-label="種" type="number" min="0" max="999999" value={state.seed} onChange={e=>act(()=>{setRunning(false);update(validate({...stateRef.current,seed:Number(e.target.value)}))})}/></label><button className="textbutton" onClick={()=>{setRunning(false);update({...initial(),seed:(stateRef.current.seed+7919)%1000000});setNotice('新しい種の庭。前の庭は共有リンクで保存できます。')}}>別の種を育てる ↗</button></section>
    </aside></div>
    <section className="artifact"><div><p className="eyebrow">YOUR CAUSAL PRINT</p><h2>{receipt(state)}</h2><label>この庭に添える一行 <span>{Array.from(state.note).length}/{MAX_NOTE}</span><input aria-label="庭に添える一行" value={state.note} onChange={e=>update({...stateRef.current,note:Array.from(e.target.value).slice(0,MAX_NOTE).join('')})}/></label><p className="annotation">{state.note || '言葉がなくても、影響は残る。'}</p></div><div className="artifact-actions"><button onClick={share}>この未来を共有</button><button onClick={download}>庭をSVGで持ち帰る</button><button disabled={!state.edits.length} onClick={()=>{setRunning(false);update({...stateRef.current,edits:stateRef.current.edits.slice(0,-1)});setNotice('最後の一手を取り消しました。')}}>最後の一手を取り消す</button></div></section>
    {link&&<label className="sharelink">共有URL<input aria-label="共有URL" readOnly value={link} onFocus={e=>e.target.select()}/></label>}
    <details><summary>なぜ戻せる？ / 介入記録 / Hermesの操作面</summary><div className="technical"><p>次の状態 = 前の状態 XOR 現在の近傍ルール。二つの時刻があれば前の状態も復元できる可逆セルオートマトンです。庭の端はつながっています。画面の巻戻しは種と時系列の介入からその時刻を再構成します。巻戻しても未来の介入は消えません。</p><p>一行メモは注釈のみ。光の成長を変えるのは種・法則・介入の場所と時刻です。最大80刻・32手。ログを外部に送らず、共有先にはURL内の一行メモも渡ります。</p><code>window.__GARDEN__.inspect() / .seek(24) / .plant(336) / .share()</code><code>npm run scenario -- --seed 1106 --tick 24 --edit 8,336</code><ul>{state.edits.map((e,i)=><li key={i}>#{i+1} · T{e.t} · ({e.i%W+1},{Math.floor(e.i/W)+1}) {e.t>state.tick?'未来の介入':'適用済み'}</li>)}</ul></div></details>
    <footer>REVERSE GARDEN<span>小さな選択が、何も変えないとは限らない。</span></footer>
  </main>
}
