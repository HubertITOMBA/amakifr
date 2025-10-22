import  LoginForm  from '@/components/auth/login-form'
import React, { Suspense } from 'react'

const page = () => {
  return (
    <main >
      <Suspense fallback={<div>Chargement...</div>}>
         <LoginForm />
      </Suspense>
       
    </main>
  )
}

export default page