import { ChevronRight, Leaf } from 'lucide-react'

const blobStyle = (top, left, width, height, color, borderRadius) => ({
  position: 'absolute',
  top: `${top}%`,
  left: `${left}%`,
  width: `${width}%`,
  height: `${height}%`,
  background: color,
  borderRadius: borderRadius || '60% 40% 30% 70% / 60% 30% 70% 40%',
  filter: 'blur(1px)',
  opacity: 0.85,
  pointerEvents: 'none',
})

export default function LandingPage({ onStart }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #7cb342 0%, #558b2f 45%, #33691e 100%)',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Organic wavy blob shapes */}
      <div style={{ ...blobStyle( -8, -5, 50, 45, 'rgba(129, 199, 132, 0.6)', '70% 30% 60% 40% / 50% 60% 40% 50%' ) }} />
      <div style={{ ...blobStyle( 15, 55, 55, 50, 'rgba(102, 187, 106, 0.5)', '40% 60% 50% 50% / 60% 40% 60% 40%' ) }} />
      <div style={{ ...blobStyle( 50, -10, 45, 40, 'rgba(76, 175, 80, 0.45)', '50% 50% 70% 30% / 40% 70% 30% 60%' ) }} />
      <div style={{ ...blobStyle( 70, 40, 50, 45, 'rgba(56, 142, 60, 0.5)', '30% 70% 50% 50% / 60% 50% 40% 50%' ) }} />
      <div style={{ ...blobStyle( 5, 70, 35, 35, 'rgba(205, 220, 57, 0.35)', '60% 40% 50% 50% / 50% 60% 50% 40%' ) }} />

      {/* Header */}
      <header style={{
        position: 'relative',
        zIndex: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 48px',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'rgba(255,255,255,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Leaf size={20} style={{ color: '#fff' }} />
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '0.02em' }}>
            EarthPulse AI
          </span>
        </div>
      </header>

      {/* Main content — title left, image right */}
      <main style={{
        position: 'relative',
        zIndex: 2,
        flex: 1,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 48,
        padding: '32px 48px 64px',
        flexWrap: 'wrap',
      }}>
        <div style={{ flex: '1 1 340px', maxWidth: 560 }}>
          <h1 style={{
            fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
            fontWeight: 800,
            color: '#fff',
            marginBottom: 12,
            lineHeight: 1.2,
            letterSpacing: '0.02em',
            textShadow: '0 2px 20px rgba(0,0,0,0.12)',
          }}>
            EarthPulse AI — Climate Risk & Multimodal Document Intelligence RAG Platform
          </h1>
          <p style={{
            fontSize: 18,
            color: 'rgba(255,255,255,0.95)',
            marginBottom: 20,
            fontWeight: 500,
            letterSpacing: '0.03em',
          }}>
            AI-powered sustainability analysis
          </p>
          <p style={{
            fontSize: 15,
            color: 'rgba(255,255,255,0.9)',
            lineHeight: 1.75,
            marginBottom: 28,
          }}>
            Analyze climate and sustainability reports with document intelligence. Upload PDFs or fetch from URLs,

            extract metrics, detect greenwashing, and explore climate risk, supply chain, and financing insights
            aligned with global standards and the UN Sustainable Development Goals.
          </p>
          <button
            onClick={onStart}
            style={{
              padding: '14px 28px',
              fontSize: 15,
              fontWeight: 600,
              color: '#1b5e20',
              background: 'rgba(255,255,255,0.95)',
              border: 'none',
              borderRadius: 12,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
          >
            Start now <ChevronRight size={18} />
          </button>
        </div>
        <div style={{
          flex: '1 1 340px',
          maxWidth: 520,
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          border: '1px solid rgba(255,255,255,0.2)',
          opacity: 0.72,
        }}>
          <img
            src="/sdg-goals.png"
            alt="UN Sustainable Development Goals — Economic, Environmental, and Social Pillars"
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </div>
      </main>
    </div>
  )
}
