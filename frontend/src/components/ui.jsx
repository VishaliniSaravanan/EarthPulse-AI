import { useRef, useEffect } from 'react'
import { Loader2 } from 'lucide-react'

export function Spinner({ size = 16 }) {
  return <Loader2 size={size} className="spin" style={{ color: 'var(--accent)' }} />
}

export function SectionIcon({ color = 'var(--accent)', children }) {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: 7, background: color + '18',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
    }}>
      {children}
    </div>
  )
}

export function MetricBlock({ label, value, unit, color, small }) {
  const isNA = value === null || value === undefined
  return (
    <div className="metric-block">
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={{ fontSize: small ? 15 : 20, color: isNA ? 'var(--text3)' : (color || 'var(--text)') }}>
        {isNA ? '—' : value}
        {!isNA && unit && <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text3)', marginLeft: 3 }}>{unit}</span>}
      </div>
    </div>
  )
}

export function ProgressBar({ value, max = 100, color = 'var(--accent)' }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="progress-bar">
      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

export function ScoreGauge({ score, size = 100 }) {
  const r = size * 0.4
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 70 ? 'var(--green)' : score >= 45 ? 'var(--orange)' : 'var(--red)'
  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size, transform: 'rotate(-90deg)', position: 'absolute' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={size*0.07} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={size*0.07}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div style={{ textAlign: 'center', position: 'relative' }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: size * 0.22, fontWeight: 700, color, lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: size * 0.1, color: 'var(--text3)', marginTop: 2 }}>/ 100</div>
      </div>
    </div>
  )
}

export function RatingBadge({ rating }) {
  const colors = {
    'AAA': '#065f46', 'AA+': '#065f46', 'AA': '#065f46',
    'A+': '#0c4a6e', 'A': '#0c4a6e', 'BBB+': '#92400e', 'BBB': '#92400e',
    'BB+': '#991b1b', 'BB': '#991b1b', 'B': '#991b1b',
  }
  const bgs = {
    'AAA': '#d1fae5', 'AA+': '#d1fae5', 'AA': '#d1fae5',
    'A+': '#e0f2fe', 'A': '#e0f2fe', 'BBB+': '#fef3c7', 'BBB': '#fef3c7',
    'BB+': '#fee2e2', 'BB': '#fee2e2', 'B': '#fee2e2',
  }
  return (
    <span className="badge" style={{ background: bgs[rating] || '#f1f5f9', color: colors[rating] || '#475569', fontSize: 13, padding: '3px 10px' }}>
      {rating}
    </span>
  )
}

export function EmptyState({ icon, title, desc }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text3)' }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>{title}</div>
      {desc && <div style={{ fontSize: 13 }}>{desc}</div>}
    </div>
  )
}

// Canvas-based force directed graph
export function ForceGraph({ nodes, edges, colorFn, height = 380, onNodeClick }) {
  const canvasRef = useRef()
  const simRef = useRef({ nodes: [], edges: [], running: true })

  useEffect(() => {
    if (!nodes?.length) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.offsetWidth || 700
    const H = height
    canvas.width = W
    canvas.height = H

    const simNodes = nodes.map((n, i) => ({
      ...n,
      x: W / 2 + (Math.random() - 0.5) * W * 0.6,
      y: H / 2 + (Math.random() - 0.5) * H * 0.6,
      vx: 0, vy: 0,
    }))
    const nodeMap = Object.fromEntries(simNodes.map(n => [n.id, n]))
    simRef.current = { nodes: simNodes, edges, running: true }

    let frame = 0
    let raf

    const tick = () => {
      const ns = simRef.current.nodes
      const es = simRef.current.edges

      if (frame < 300) {
        // Repulsion
        for (let i = 0; i < ns.length; i++) {
          for (let j = i + 1; j < ns.length; j++) {
            const dx = ns[j].x - ns[i].x, dy = ns[j].y - ns[i].y
            const d = Math.sqrt(dx * dx + dy * dy) + 1
            const f = Math.min(600, 900 / (d * d))
            ns[i].vx -= f * dx / d; ns[i].vy -= f * dy / d
            ns[j].vx += f * dx / d; ns[j].vy += f * dy / d
          }
        }
        // Springs
        for (const e of es) {
          const a = nodeMap[e.source], b = nodeMap[e.target]
          if (!a || !b) continue
          const dx = b.x - a.x, dy = b.y - a.y
          const d = Math.sqrt(dx * dx + dy * dy) + 1
          const f = (d - 90) * 0.018
          a.vx += f * dx / d; a.vy += f * dy / d
          b.vx -= f * dx / d; b.vy -= f * dy / d
        }
        // Gravity
        for (const n of ns) {
          n.vx += (W / 2 - n.x) * 0.004
          n.vy += (H / 2 - n.y) * 0.004
          n.vx *= 0.84; n.vy *= 0.84
          n.x = Math.max(16, Math.min(W - 16, n.x + n.vx))
          n.y = Math.max(16, Math.min(H - 16, n.y + n.vy))
        }
        frame++
      }

      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = '#f8f9fb'
      ctx.fillRect(0, 0, W, H)

      // Edges
      for (const e of es) {
        const a = nodeMap[e.source], b = nodeMap[e.target]
        if (!a || !b) continue
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y)
        ctx.strokeStyle = e.relation === 'contradicts' ? '#fca5a5' : e.relation === 'supports' ? '#86efac' : '#e2e8f0'
        ctx.lineWidth = 1.2; ctx.stroke()
      }

      // Nodes
      for (const n of ns) {
        const color = colorFn ? colorFn(n) : '#0ea5e9'
        ctx.beginPath(); ctx.arc(n.x, n.y, 5, 0, Math.PI * 2)
        ctx.fillStyle = color; ctx.fill()
        ctx.strokeStyle = 'white'; ctx.lineWidth = 1.5; ctx.stroke()
        if (ns.length < 35) {
          ctx.fillStyle = '#64748b'; ctx.font = '10px Sora'
          ctx.fillText((n.label || '').slice(0, 18), n.x + 8, n.y + 4)
        }
      }

      if (simRef.current.running) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    const handleClick = (evt) => {
      if (!onNodeClick) return
      const rect = canvas.getBoundingClientRect()
      const x = evt.clientX - rect.left
      const y = evt.clientY - rect.top
      const ns = simRef.current.nodes || []
      let closest = null
      let bestDist = Infinity
      for (const n of ns) {
        const dx = n.x - x
        const dy = n.y - y
        const d2 = dx * dx + dy * dy
        if (d2 < bestDist) {
          bestDist = d2
          closest = n
        }
      }
      if (closest && bestDist <= 18 * 18) {
        onNodeClick(closest)
      }
    }
    canvas.addEventListener('click', handleClick)

    return () => {
      simRef.current.running = false
      cancelAnimationFrame(raf)
      canvas.removeEventListener('click', handleClick)
    }
  }, [nodes, edges])

  return (
    <canvas ref={canvasRef} className="graph-canvas" style={{ height, display: 'block' }} />
  )
}
