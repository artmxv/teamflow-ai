import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ProductFrameProps = {
  children: ReactNode;
  className?: string;
  title?: string;
  tone?: "light" | "dark";
};

export function ProductFrame({
  children,
  className,
  tone = "light",
}: ProductFrameProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsActive(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setIsActive(true);
        observer.disconnect();
      },
      { threshold: 0.28 },
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={frameRef}
      className={cn(
        "public-product-frame",
        tone === "dark" && "public-product-frame--dark",
        isActive && "is-scene-active",
        className,
      )}
    >
      <div className="public-product-frame__chrome">
        <span className="public-product-frame__traffic" aria-hidden><i /><i /><i /></span>
      </div>
      <div className="public-product-frame__body">{children}</div>
    </div>
  );
}
