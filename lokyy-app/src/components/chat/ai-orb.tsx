import Lottie from 'lottie-react'
import sphereData from '@/assets/ai-sphere.json'

export function AIOrb({ size = 200, className = '' }: { size?: number; className?: string }) {
  return (
    <div
      className={className}
      style={{ width: size, height: size }}
      data-testid="ai-orb"
      aria-hidden
    >
      <Lottie animationData={sphereData as object} loop autoplay style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
