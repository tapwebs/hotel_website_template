import { type Transition } from 'framer-motion'

export const springPresets = {
  snappy: {
    type: 'spring',
    stiffness: 450,
    damping: 30,
    mass: 0.8,
  } as Transition,

  drawer: {
    type: 'spring',
    stiffness: 340,
    damping: 32,
    mass: 0.9,
  } as Transition,

  statusTransition: {
    type: 'spring',
    stiffness: 220,
    damping: 26,
  } as Transition,

  gentle: {
    type: 'spring',
    stiffness: 280,
    damping: 28,
  } as Transition,
}

