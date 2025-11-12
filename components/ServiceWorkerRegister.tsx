"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator))
      return;

    let unregisterLoadListener: (() => void) | undefined;

    const register = async () => {
      try {
        const existing =
          await navigator.serviceWorker.getRegistration("/sw.js");
        if (existing) return existing;
        return await navigator.serviceWorker.register("/sw.js");
      } catch (error) {
        console.error("Failed to register service worker", error);
        return null;
      }
    };

    if (document.readyState === "complete") {
      register();
    } else {
      const listener = () => {
        register();
        window.removeEventListener("load", listener);
      };
      window.addEventListener("load", listener);
      unregisterLoadListener = () =>
        window.removeEventListener("load", listener);
    }

    return unregisterLoadListener;
  }, []);

  return null;
}
