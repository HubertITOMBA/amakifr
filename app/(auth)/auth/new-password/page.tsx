import { NewPasswordForm } from "@/components/auth/new-password-form";
import { Suspense } from "react";

const NewPasswordPage = () => {
    return (
        <div className="min-h-screen flex items-center justify-center">
            <Suspense fallback={
                <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            }>
                <NewPasswordForm /> 
            </Suspense>
        </div>
    );
};

export default NewPasswordPage;