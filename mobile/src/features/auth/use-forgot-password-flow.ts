import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { router } from "expo-router";
import {
  confirmPasswordReset,
  requestPasswordReset,
} from "@/api/password-reset";
import {
  createForgotPasswordFlow,
  type ForgotPasswordFlow,
  type ForgotPasswordFlowState,
} from "@/features/auth/password-reset-flow";

/**
 * Hook React branché sur le contrôleur testable (lock synchrone inclus).
 */
export function useForgotPasswordFlow(): {
  state: ForgotPasswordFlowState;
  flow: ForgotPasswordFlow;
} {
  const flowRef = useRef<ForgotPasswordFlow | null>(null);
  if (!flowRef.current) {
    flowRef.current = createForgotPasswordFlow({
      api: {
        request: requestPasswordReset,
        confirm: confirmPasswordReset,
      },
      nav: {
        replaceSignIn: () => {
          router.replace("/sign-in");
        },
      },
    });
  }
  const flow = flowRef.current;

  const subscribe = useCallback(
    (onStoreChange: () => void) => flow.subscribe(onStoreChange),
    [flow]
  );
  const getSnapshot = useCallback(() => flow.getState(), [flow]);
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return useMemo(() => ({ state, flow }), [state, flow]);
}
