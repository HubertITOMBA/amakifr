import { RegisterForm } from '@/components/auth/register-form'
import React, { Suspense } from 'react'

const page = () => {
  return (
    <main>
       <Suspense fallback={<div>Chargement...</div>}>
           <RegisterForm />
        </Suspense>
    </main>
)
} 
export default page