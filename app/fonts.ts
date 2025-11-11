// EFFECT: Centralizes next/font setup so layout can share a single Inter instance.
import { Inter } from "next/font/google";

export const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});
