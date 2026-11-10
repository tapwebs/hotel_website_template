import React from 'react'

export function Confetti() {
  const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E063', '#845EC2', '#FF9671', '#00C9A7']
  const pieces = Array.from({ length: 48 }, (_, i) => i)

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {pieces.map((i) => {
        const color = colors[i % colors.length]
        const left = `${Math.random() * 100}%`
        const delay = `${Math.random() * 0.6}s`
        const duration = `${1.6 + Math.random() * 1.4}s`
        const size = `${6 + Math.floor(Math.random() * 8)}px`
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: '-10px',
              left,
              width: size,
              height: size,
              backgroundColor: color,
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              animation: `confetti-fall ${duration} ${delay} ease-in forwards`,
            }}
          />
        )
      })}
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
