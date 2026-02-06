import { cn } from "@/lib/utils";

interface AndroidMessageBubbleProps {
  text: string;
  isMe: boolean;
  details?: {
    link: string;
  };
}

export function AndroidMessageBubble({ text, isMe, details }: AndroidMessageBubbleProps) {
  const renderText = (content: string) => {
    if (!details) return content;

    return content.split("\n").map((line, i) => {
      if (line.includes("http")) {
        return (
          <a
            key={i}
            href={details.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#0B4A78] underline decoration-[#0B4A78]"
          >
            {line}
          </a>
        );
      }
      return <div key={i}>{line}</div>;
    });
  };

  return (
    <div className={cn("flex w-full", isMe ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[82%] px-4 py-2 text-[16px] leading-[22px] break-words shadow-sm",
          isMe
            ? "bg-[#7DC9FF] text-[#0E1218] rounded-2xl rounded-br-md"
            : "bg-[#1E222A] text-[#E6E9EF] rounded-2xl rounded-bl-md"
        )}
      >
        {renderText(text)}
      </div>
    </div>
  );
}
