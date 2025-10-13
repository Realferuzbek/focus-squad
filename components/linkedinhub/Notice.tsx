'use client';

import GlowPanel from "@/components/GlowPanel";
import { motion } from "framer-motion";

type NoticeProps = {
  title?: string;
  message: string;
  action?: React.ReactNode;
};

export default function Notice({ title, message, action }: NoticeProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <GlowPanel subtle className="border border-amber-300/20 bg-amber-500/10 p-5 text-amber-100">
        {title && <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-200">{title}</h3>}
        <p className="mt-2 text-sm text-amber-100/80">{message}</p>
        {action && <div className="mt-4">{action}</div>}
      </GlowPanel>
    </motion.div>
  );
}
