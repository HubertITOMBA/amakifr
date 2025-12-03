import { CardWrapper } from "@/components/auth/card-wrapper";
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { LoginButton } from "@/components/auth/login-button";
import { Button } from "@/components/ui/button";

export const ErrorCard = () => {
    return (
        <CardWrapper  
            labelBox= "Erreur !"
            headerLabel="Oops! Quelque chose s'est mal passée !"  
            backButtonLabel="Retour à la connexion"
            backButtonComponent={
                <LoginButton mode="modal">
                    <Button
                        variant="link"
                        size="sm"
                        type="button"
                        className="w-full text-gray-800 dark:text-gray-200 hover:text-gray-900 dark:hover:text-gray-100 font-normal"
                    >
                        Retour à la connexion
                    </Button>
                </LoginButton>
            }
        >
            <div className="w-full flex justify-center items-center">
                <ExclamationTriangleIcon className="text-destructive" />
            </div>
       </CardWrapper>     
    )
}

