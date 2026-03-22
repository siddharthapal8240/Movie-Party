interface ControlButtonProps {
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  label: string;
  badge?: number;
  children: React.ReactNode;
}

export function ControlButton({ onClick, active, danger, label, badge, children }: ControlButtonProps) {
  return (
    <button onClick={onClick} title={label} className="group relative flex flex-col items-center gap-1">
      <div className={`relative flex h-11 w-11 items-center justify-center rounded-full transition-all duration-150 hover:scale-105
        ${danger ? "bg-danger text-white hover:bg-danger-hover"
          : active ? "bg-accent text-white"
          : "bg-bg-tertiary text-text-secondary hover:bg-surface-hover hover:text-text-primary"}`}>
        {children}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{badge}</span>
        )}
      </div>
      <span className="text-[10px] text-text-tertiary group-hover:text-text-secondary transition hidden md:block">{label}</span>
    </button>
  );
}
