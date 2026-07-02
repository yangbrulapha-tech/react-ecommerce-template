import React, { useState, useEffect } from 'react'
import { Lock, ShieldCheck, Truck } from 'lucide-react'

export default function DoorAnimation() {
  const [doorState, setDoorState] = useState('locked') // 'locked', 'closing', 'opening', 'idle'
  const [doorTheme, setDoorTheme] = useState('default') // 'default', 'admin', 'rider'

  useEffect(() => {
    const handleClose = (e) => {
      if (e?.detail?.theme) setDoorTheme(e.detail.theme)
      else setDoorTheme('default')
      setDoorState('closing')
    }
    const handleOpen = () => setDoorState('opening')
    const handleReset = () => setDoorState('idle')
    const handleLock = () => setDoorState('locked')

    window.addEventListener('door-anim:close', handleClose)
    window.addEventListener('door-anim:open', handleOpen)
    window.addEventListener('door-anim:idle', handleReset)
    window.addEventListener('door-anim:lock', handleLock)

    return () => {
      window.removeEventListener('door-anim:close', handleClose)
      window.removeEventListener('door-anim:open', handleOpen)
      window.removeEventListener('door-anim:idle', handleReset)
      window.removeEventListener('door-anim:lock', handleLock)
    }
  }, [])

  useEffect(() => {
    if (doorState === 'opening') {
      const t = setTimeout(() => {
        setDoorState('idle')
      }, 1200)
      return () => clearTimeout(t)
    }
  }, [doorState])

  // Determine positions based on state
  const isClosed = doorState === 'locked' || doorState === 'closing'
  
  const getThemeConfig = () => {
    switch (doorTheme) {
      case 'admin':
        return {
          bg: 'bg-[#1a0505]',
          border: 'border-red-600/50',
          shadow: 'shadow-[10px_0_50px_rgba(220,38,38,0.25)]',
          shadowNeg: 'shadow-[-10px_0_50px_rgba(220,38,38,0.25)]',
          innerBox: 'border-red-600/30 bg-red-900/10',
          centerBg: 'bg-[#2a0808]',
          centerBorder: 'border-red-600',
          centerShadow: 'shadow-[0_0_40px_rgba(220,38,38,0.5)]',
          pulse: 'bg-red-600/20',
          Icon: ShieldCheck,
          iconColor: 'text-red-500',
          title: 'ADMINISTRATOR SYSTEM',
          subtitle: 'ACCESS GRANTED'
        }
      case 'rider':
        return {
          bg: 'bg-[#021810]',
          border: 'border-emerald-500/50',
          shadow: 'shadow-[10px_0_50px_rgba(16,185,129,0.2)]',
          shadowNeg: 'shadow-[-10px_0_50px_rgba(16,185,129,0.2)]',
          innerBox: 'border-emerald-500/30 bg-emerald-900/10',
          centerBg: 'bg-[#04281a]',
          centerBorder: 'border-emerald-500',
          centerShadow: 'shadow-[0_0_40px_rgba(16,185,129,0.5)]',
          pulse: 'bg-emerald-500/20',
          Icon: Truck,
          iconColor: 'text-emerald-400',
          title: 'RIDER MODE',
          subtitle: 'PREPARING DELIVERY'
        }
      default:
        return {
          bg: 'bg-[#0a0f1c]',
          border: 'border-sky-500/50',
          shadow: 'shadow-[10px_0_50px_rgba(14,165,233,0.15)]',
          shadowNeg: 'shadow-[-10px_0_50px_rgba(14,165,233,0.15)]',
          innerBox: 'border-sky-500/30 bg-sky-900/10',
          centerBg: 'bg-[#0f172a]',
          centerBorder: 'border-sky-500',
          centerShadow: 'shadow-[0_0_40px_rgba(14,165,233,0.4)]',
          pulse: 'bg-sky-500/20',
          Icon: Lock,
          iconColor: 'text-sky-400'
        }
    }
  }

  const theme = getThemeConfig()
  const IconComponent = theme.Icon

  return (
    <div className={`fixed inset-0 z-[999999] pointer-events-none flex overflow-hidden transition-opacity duration-300 ${doorState === 'idle' ? 'opacity-0' : 'opacity-100'}`}>
      {/* Left Door */}
      <div className={`w-1/2 h-full ${theme.bg} border-r ${theme.border} ${theme.shadow} transform transition-colors duration-500 transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] flex flex-col items-end justify-center pr-2 sm:pr-8 ${isClosed ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className={`w-16 sm:w-32 h-64 border ${theme.innerBox} rounded-l-md transition-colors duration-500`}></div>
      </div>
      
      {/* Right Door */}
      <div className={`w-1/2 h-full ${theme.bg} border-l ${theme.border} ${theme.shadowNeg} transform transition-colors duration-500 transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] flex flex-col items-start justify-center pl-2 sm:pl-8 ${isClosed ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className={`w-16 sm:w-32 h-64 border ${theme.innerBox} rounded-r-md transition-colors duration-500`}></div>
      </div>

      {/* Center Lock / Logo */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-[800ms] flex flex-col items-center ${isClosed ? 'opacity-100 scale-100 delay-[800ms]' : 'opacity-0 scale-50 delay-0'}`}>
         
         {/* Welcome text for initial load */}
         {doorState === 'locked' && (
           <div className="mb-8 animate-fade-in text-center">
             <div className="flex items-center justify-center space-x-3 mb-2">
               <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-sky-400 bg-navy-950 flex items-center justify-center">
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="text-sky-400 w-6 h-6 sm:w-8 sm:h-8"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/></svg>
               </div>
             </div>
             <h1 className="text-2xl sm:text-4xl font-black text-white tracking-widest font-outfit">WELCOME</h1>
             <p className="text-sky-400 text-xs sm:text-sm tracking-widest mt-1">REACT MARKET</p>
           </div>
         )}
         
         {/* Theme Title (Admin/Rider) */}
         {theme.title && doorState !== 'locked' && (
           <div className="mb-8 animate-fade-in text-center">
             <h1 className={`text-xl sm:text-3xl font-black ${theme.iconColor} tracking-widest font-outfit`}>{theme.title}</h1>
             <p className="text-slate-400 text-[10px] sm:text-xs tracking-[0.2em] mt-2">{theme.subtitle}</p>
           </div>
         )}

         <div className={`w-24 h-24 sm:w-32 sm:h-32 ${theme.centerBg} border-2 ${theme.centerBorder} rounded-full flex items-center justify-center ${theme.centerShadow} relative overflow-hidden transition-colors duration-500`}>
           <div className={`absolute inset-0 ${theme.pulse} animate-pulse`}></div>
           <IconComponent className={`w-10 h-10 sm:w-14 sm:h-14 ${theme.iconColor} relative z-10 transition-colors duration-500`} />
         </div>
      </div>
    </div>
  )
}
