import React from 'react'

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-scale-up">
      <div className="w-24 h-24 bg-slate-100 dark:bg-navy-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
        <Icon className="h-12 w-12 text-slate-400 dark:text-slate-500" strokeWidth={1.5} />
      </div>
      <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6 leading-relaxed">
        {description}
      </p>
      {action && (
        <div>
          {action}
        </div>
      )}
    </div>
  )
}
