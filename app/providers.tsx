"use client";

import type { ReactNode } from "react";
import { HMSRoomProvider } from "@100mslive/react-sdk";

export default function Providers({ children }: { children: ReactNode }) {
  return <HMSRoomProvider>{children}</HMSRoomProvider>;
}
