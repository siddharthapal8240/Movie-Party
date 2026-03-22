interface StatusScreenProps {
  icon?: "spinner" | "rejected";
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function StatusScreen({ icon = "spinner", title, subtitle, action }: StatusScreenProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 h-screen bg-bg-primary">
      {icon === "rejected" ? (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger-subtle">
          <svg className="h-8 w-8 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
      ) : (
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-border-primary border-t-accent" />
      )}
      <p className="text-lg font-semibold text-text-primary">{title}</p>
      {subtitle && <p className="text-sm text-text-secondary">{subtitle}</p>}
      {action}
    </div>
  );
}
