import { ArrowLeft, Phone, MoreVertical, User } from "lucide-react";
import { Link } from "wouter";

interface AndroidChatHeaderProps {
  title: string;
}

export function AndroidChatHeader({ title }: AndroidChatHeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 safe-area-top bg-[#1B1E24]">
      <div className="h-[56px] flex items-center px-3 gap-3 w-full max-w-md mx-auto">
        <Link
          href="/"
          className="p-2 -ml-2 text-[#D4D7DE] active:opacity-70 transition-opacity"
          aria-label="Назад"
        >
          <ArrowLeft size={22} strokeWidth={2.2} />
        </Link>

        <div className="w-10 h-10 rounded-full bg-[#2A2E35] flex items-center justify-center text-[#D4D7DE]">
          <User size={20} />
        </div>

        <div className="flex-1 text-[#E6E9EF] font-semibold text-[18px]">{title}</div>

        <button
          type="button"
          className="p-2 text-[#D4D7DE] hover:text-white transition-colors"
          aria-label="Звонок"
        >
          <Phone size={20} strokeWidth={2.2} />
        </button>

        <button
          type="button"
          className="p-2 -mr-1 text-[#D4D7DE] hover:text-white transition-colors"
          aria-label="Меню"
        >
          <MoreVertical size={20} strokeWidth={2.2} />
        </button>
      </div>
    </header>
  );
}
