"use client";

import { useEffect } from "react";

type SessionEmailBridgeProps = {
  email: string | null;
};

export default function SessionEmailBridge({ email }: SessionEmailBridgeProps) {
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__session_email = email ?? null;
  }, [email]);

  return null;
}
