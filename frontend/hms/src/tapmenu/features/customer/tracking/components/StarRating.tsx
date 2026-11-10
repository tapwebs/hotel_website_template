import { Star } from 'lucide-react'
import React, { useState } from 'react'
import { motion } from 'framer-motion'

import { soundEffects } from '../../../../services/audio/soundEffects'

const STAR_REACTIONS = [
  '',
  'Terrible 😢',
  'Not Great 😕',
  'It Was Okay 🙂',
  'Really Good! 😊',
  'Absolutely Amazing! 🤩',
]

interface StarRatingProps {
  value: number
  onChange: (v: number) => void
}

export function StarRating({ value, onChange }: StarRatingProps) {
  const [hover, setHover] = useState(0)
  const currentStar = hover || value

  return (
    <div className="flex flex-col items-center gap-1.5 py-1">
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <motion.button
            key={star}
            type="button"
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.85 }}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            onClick={() => {
              onChange(star)
              soundEffects.click()
            }}
            className="p-1 cursor-pointer transition-transform"
            aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
          >
            <Star
              className="w-8 h-8 sm:w-9 sm:h-9 transition-colors"
              fill={star <= currentStar ? '#F59E0B' : 'transparent'}
              color={star <= currentStar ? '#F59E0B' : '#D1D5DB'}
            />
          </motion.button>
        ))}
      </div>

      {currentStar > 0 && (
        <motion.span
          key={currentStar}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs font-bold text-amber-600 dark:text-amber-400"
        >
          {STAR_REACTIONS[currentStar]}
        </motion.span>
      )}
    </div>
  )
}
