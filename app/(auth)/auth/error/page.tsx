import { ErrorCard } from "@/components/auth/error-card"
import { Suspense } from "react";

const AuthErrorPage = () => {
    return ( 
        <Suspense fallback={<div>Chargement...</div>}>
            <ErrorCard />
        </Suspense>
     );
}
 
export default AuthErrorPage;