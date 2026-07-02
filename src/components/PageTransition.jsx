import React from 'react'
import { motion } from 'framer-motion'

const variants = {
  initial: { opacity: 0, y: 15 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, y: -15, transition: { duration: 0.2, ease: 'easeIn' } },
}

export default function PageTransition({ children }) {
  return (
    <motion.div
      initial="initial"
      animate="enter"
      exit="exit"
      variants={variants}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  )
}
