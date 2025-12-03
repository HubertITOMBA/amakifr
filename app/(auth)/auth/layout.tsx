import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

const layout = ( { children } : {children: React.ReactNode}) => {
  return (
    <main className='w-full h-full min-h-screen bg-transparent relative'>
      {/* Contenu */}
      <div className="relative z-10">
        <Link 
          href={'/'} 
          className='px-4 sm:px-10 py-4 flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors relative z-20'
        >
          <ChevronLeft className='w-5 h-5' />
          <span className="text-sm font-medium">Accueil</span>
        </Link>
        <div className='h-full w-full flex justify-center items-center max-sm:px-4 py-8'>
          {children}
        </div>
      </div>
    </main>
  )
}

export default layout