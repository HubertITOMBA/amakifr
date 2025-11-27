"use client";

import { useEffect } from "react";

export default function SessionAutoSignout() {
  useEffect(() => {
    const SIGNOUT_URL = "/api/auth/signout-quick";

    const DEFAULT_DELAY_MS = 1000; // couverture fermetures rapides
    const DEFAULT_INACTIVITY_MS = 15 * 60 * 1000; // 15 minutes

    const envDelay = Number(process.env.NEXT_PUBLIC_SESSION_SIGNOUT_DELAY_MS);
    const envInactivity = Number(process.env.NEXT_PUBLIC_SESSION_INACTIVITY_MS);

    const DELAY_MS = Number.isFinite(envDelay) && envDelay > 0 ? envDelay : DEFAULT_DELAY_MS;
    const INACTIVITY_MS = Number.isFinite(envInactivity) && envInactivity > 0 ? envInactivity : DEFAULT_INACTIVITY_MS;

    let closingTimer: number | undefined;
    let idleTimer: number | undefined;

    const sendSignout = () => {
      try {
        if (navigator.sendBeacon) {
          const blob = new Blob([""], { type: "text/plain" });
          navigator.sendBeacon(SIGNOUT_URL, blob);
        } else {
          fetch(SIGNOUT_URL, { method: "POST", keepalive: true, headers: { "Content-Type": "text/plain" }, body: "" }).catch(() => {});
        }
      } catch {}
    };

    const scheduleCloseSignout = () => {
      if (closingTimer) return;
      // @ts-ignore
      closingTimer = setTimeout(() => {
        sendSignout();
        closingTimer = undefined;
      }, DELAY_MS);
    };

    const cancelCloseSignout = () => {
      if (closingTimer) {
        clearTimeout(closingTimer);
        closingTimer = undefined;
      }
    };

    const resetIdleTimer = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = undefined;
      }
      // @ts-ignore
      idleTimer = setTimeout(() => {
        sendSignout();
        idleTimer = undefined;
      }, INACTIVITY_MS);
    };

    const activityEvents = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ] as const;

    const onActivity = () => {
      resetIdleTimer();
    };

    const onBeforeUnload = () => {
      scheduleCloseSignout();
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        scheduleCloseSignout();
      } else {
        cancelCloseSignout();
        resetIdleTimer();
      }
    };

    const onPageHide = () => {
      scheduleCloseSignout();
    };

    // Init
    resetIdleTimer();

    // Listeners
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    activityEvents.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      activityEvents.forEach((evt) => window.removeEventListener(evt, onActivity));
      cancelCloseSignout();
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, []);

  return null;
}
