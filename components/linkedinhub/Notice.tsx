type NoticeProps = {
  title?: string;
  message: string;
  action?: React.ReactNode;
};

export default function Notice({ title, message, action }: NoticeProps) {
  return (
    <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-amber-100">
      {title && <h3 className="text-sm font-semibold uppercase tracking-[0.18em]">{title}</h3>}
      <p className="mt-1 text-sm text-amber-50/90">{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
