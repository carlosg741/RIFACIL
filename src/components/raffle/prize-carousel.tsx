"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Prize = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  position: number;
};

export function PrizeCarousel({ prizes }: { prizes: Prize[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  function goTo(index: number) {
    const nextIndex = Math.max(0, Math.min(prizes.length - 1, index));
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({
      left: track.clientWidth * nextIndex,
      behavior: "smooth",
    });
    setActiveIndex(nextIndex);
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <div
          ref={trackRef}
          className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={(event) => {
            const track = event.currentTarget;
            if (!track.clientWidth) return;
            setActiveIndex(
              Math.min(
                prizes.length - 1,
                Math.round(track.scrollLeft / track.clientWidth),
              ),
            );
          }}
        >
          {prizes.map((prize) => (
            <article
              key={prize.id}
              className="min-w-full snap-center overflow-hidden rounded-2xl border border-primary/20 bg-card"
            >
              {prize.imageUrl ? (
                <div className="flex h-[55vh] min-h-64 max-h-[640px] items-center justify-center bg-black/10 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={prize.imageUrl}
                    alt={prize.title}
                    className="max-h-full max-w-full rounded-xl object-contain"
                  />
                </div>
              ) : (
                <div className="flex min-h-64 items-center justify-center bg-secondary/30 p-8 text-center text-muted-foreground">
                  Premio sin imagen
                </div>
              )}
              <div className="p-4 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Premio #{prize.position}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-foreground sm:text-2xl">
                  {prize.title}
                </h2>
                {prize.description ? (
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {prize.description}
                  </p>
                ) : null}
              </div>
            </article>
          ))}
        </div>

        {prizes.length > 1 ? (
          <>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              aria-label="Ver premio anterior"
              className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full shadow-lg md:inline-flex"
              disabled={activeIndex === 0}
              onClick={() => goTo(activeIndex - 1)}
            >
              ‹
            </Button>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              aria-label="Ver premio siguiente"
              className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full shadow-lg md:inline-flex"
              disabled={activeIndex === prizes.length - 1}
              onClick={() => goTo(activeIndex + 1)}
            >
              ›
            </Button>
          </>
        ) : null}
      </div>

      {prizes.length > 1 ? (
        <div className="flex items-center justify-center gap-2">
          {prizes.map((prize, index) => (
            <button
              key={prize.id}
              type="button"
              aria-label={`Ver premio ${index + 1}`}
              aria-current={index === activeIndex ? "true" : undefined}
              className={`h-2.5 rounded-full transition-all ${
                index === activeIndex
                  ? "w-7 bg-primary"
                  : "w-2.5 bg-primary/30"
              }`}
              onClick={() => goTo(index)}
            />
          ))}
          <span className="ml-2 text-xs text-muted-foreground">
            Desliza para ver todos
          </span>
        </div>
      ) : null}
    </div>
  );
}
