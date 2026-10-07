import { NewPasswordForm } from "@/components/auth/new-password-form";

/**
 * Page publique nouveau mot de passe — email + code 8 chiffres (pas de query secret).
 */
const NewPasswordPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <NewPasswordForm />
    </div>
  );
};

export default NewPasswordPage;
