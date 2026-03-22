import { SERVER_URL } from "@/lib/socket";

interface AvatarProps {
  avatar?: string;
  firstName?: string;
  lastName?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeMap = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
  xl: "h-20 w-20 text-2xl",
};

export function Avatar({ avatar, firstName, lastName, size = "md", className = "" }: AvatarProps) {
  const initials = [firstName?.[0], lastName?.[0]].filter(Boolean).join("").toUpperCase() || "U";
  const sizeClass = sizeMap[size];

  if (avatar) {
    return (
      <img
        src={`${SERVER_URL}/avatars/${avatar}`}
        alt={initials}
        className={`${sizeClass} rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div className={`flex items-center justify-center rounded-full bg-accent font-bold text-white ${sizeClass} ${className}`}>
      {initials}
    </div>
  );
}
