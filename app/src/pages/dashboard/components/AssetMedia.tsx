import { useRef, useState } from 'react'
import { Play, Music, BookOpen, Code, FileText } from 'lucide-react'

interface AssetMediaProps {
  imageUrl?: string | null
  animationUrl?: string | null
  category?: string
  fallbackIcon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  tokenId?: bigint | number | string
}

function VideoThumb({ src, poster }: { src: string; poster?: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const v = ref.current
    if (!v) return
    if (v.paused) { void v.play() } else { v.pause() }
  }

  return (
    <div className="relative w-full h-full">
      <video
        ref={ref}
        src={src}
        poster={poster}
        preload="metadata"
        muted
        playsInline
        controls={playing}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
      />
      {!playing && (
        <button
          type="button"
          onClick={toggle}
          aria-label="Play video"
          className="absolute inset-0 flex items-center justify-center transition-opacity"
          style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.45) 100%)' }}
        >
          <span className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
            <Play className="w-5 h-5 text-white" style={{ marginLeft: 2 }} fill="currentColor" />
          </span>
        </button>
      )}
    </div>
  )
}

// Shared plate for literary, software, and dramatic works without artwork.
function MediaPlate({
  children, caption, cornerIcon: CornerIcon, background,
}: {
  children: React.ReactNode
  caption?: string
  cornerIcon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  background?: string
}) {
  return (
    <div
      className="relative w-full h-full flex items-center justify-center"
      style={{
        background: background ?? 'linear-gradient(135deg, color-mix(in srgb, var(--gold) 6%, transparent), var(--bg-elev-2))',
        border: '1px solid color-mix(in srgb, var(--gold) 12%, transparent)',
      }}
    >
      {CornerIcon && (
        <span className="absolute top-2 right-2 opacity-60">
          <CornerIcon className="w-3.5 h-3.5" style={{ color: 'var(--gold-text)' }} />
        </span>
      )}
      {children}
      {caption && (
        <span
          className="absolute bottom-2 left-2 allcaps mono"
          style={{ fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.1em' }}
        >
          {caption}
        </span>
      )}
    </div>
  )
}

function categoryKind(cat: string): 'audiovisual' | 'musical' | 'literary' | 'software' | 'dramatic' | 'visual' | 'unknown' {
  if ((cat.includes('audio') && cat.includes('visual')) || cat.includes('video') || cat.includes('film')) return 'audiovisual'
  if (cat === 'musical' || cat.includes('music')) return 'musical'
  if (cat.includes('literary') || cat.includes('book') || cat.includes('text')) return 'literary'
  if (cat.includes('software') || cat.includes('code')) return 'software'
  if (cat.includes('dramatic') || cat.includes('script') || cat.includes('drama')) return 'dramatic'
  if (cat.includes('visual') || cat.includes('artistic') || cat.includes('image') || cat.includes('photo')) return 'visual'
  return 'unknown'
}

export function AssetMedia({ imageUrl, animationUrl, category, fallbackIcon: FallbackIcon, tokenId }: AssetMediaProps) {
  const cat = (category || '').toLowerCase()
  const kind = categoryKind(cat)

  if (kind === 'audiovisual' && animationUrl) {
    return <VideoThumb src={animationUrl} poster={imageUrl || undefined} />
  }
  // Backwards compat: if an unknown-kind asset has animationUrl, prefer video
  if (kind === 'unknown' && animationUrl) {
    return <VideoThumb src={animationUrl} poster={imageUrl || undefined} />
  }

  if (kind === 'musical' && animationUrl) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-2" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--gold) 10%, transparent), var(--bg-elev-2))' }}>
        <Music className="w-8 h-8" style={{ color: 'var(--gold-text)' }} />
        <audio src={animationUrl} controls className="w-full" style={{ maxHeight: 26 }} onClick={(e) => e.stopPropagation()} />
      </div>
    )
  }

  // Do not N+1 IPFS-fetch a non-visual work's body; render a content-shaped
  // placeholder so the card communicates the work's medium.
  if (!imageUrl) {
    if (kind === 'literary') {
      return (
        <MediaPlate caption="MS · TEXT" cornerIcon={BookOpen}>
          <span className="mono opacity-60" style={{ fontSize: 12, color: 'var(--ink-3)' }}>¶ Manuscript</span>
        </MediaPlate>
      )
    }
    if (kind === 'software') {
      return (
        <MediaPlate
          caption="SRC"
          cornerIcon={Code}
          background="repeating-linear-gradient(45deg, var(--bg-elev) 0 6px, var(--bg-elev-2) 6px 12px)"
        >
          <Code className="w-7 h-7" style={{ color: 'var(--gold-text)' }} />
        </MediaPlate>
      )
    }
    if (kind === 'dramatic') {
      return (
        <MediaPlate caption="ACT I" cornerIcon={FileText}>
          <FileText className="w-7 h-7" style={{ color: 'var(--gold-text)' }} />
        </MediaPlate>
      )
    }
  }

  if (imageUrl) {
    return <img src={imageUrl} alt="" className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110" />
  }

  // Seed the radial-gradient placeholder from tokenId so each no-art card
  // has a distinct background. cx/cy are derived modulo small primes to
  // spread values across the 20%–80% range without clustering.
  const tid = tokenId !== undefined ? Number(BigInt(String(tokenId))) : 0
  const thumbCx = `${20 + (tid % 17) * 3.75}%`
  const thumbCy = `${20 + ((tid * 7) % 19) * 3.16}%`
  const placeholderStyle = { '--thumb-cx': thumbCx, '--thumb-cy': thumbCy } as React.CSSProperties

  if (FallbackIcon) {
    return (
      <div
        className="thumb-placeholder w-full h-full flex items-center justify-center"
        style={placeholderStyle}
      >
        <FallbackIcon className="w-9 h-9 transition-transform duration-300 group-hover:scale-125" style={{ color: 'var(--ink-4)' }} />
      </div>
    )
  }

  return (
    <div className="thumb-placeholder w-full h-full" style={placeholderStyle} />
  )
}
