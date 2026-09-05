import { useQuery } from "@tanstack/react-query";
import { ImageIcon } from "lucide-react";
import { signedImageUrl } from "@/lib/queries";
import { cn } from "@/lib/utils";

export function ScanThumb({ path, className }: { path?: string | null; className?: string }) {
  const { data } = useQuery({
    queryKey: ["signed-image", path],
    queryFn: () => (path ? signedImageUrl(path) : null),
    enabled: Boolean(path),
    staleTime: 30 * 60 * 1000,
  });

  return (
    <div
      className={cn(
        "grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted",
        className,
      )}
    >
      {data ? (
        <img src={data} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <ImageIcon className="size-4 text-muted-foreground" />
      )}
    </div>
  );
}
