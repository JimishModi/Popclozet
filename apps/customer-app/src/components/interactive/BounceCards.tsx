import { useEffect, useMemo, useRef } from "react";
import { gsap } from "gsap";
import "./BounceCards.css";

interface BounceCardsProps {
  className?: string;
  images?: string[];
  containerWidth?: number | string;
  containerHeight?: number | string;
  animationDelay?: number;
  animationStagger?: number;
  easeType?: string;
  transformStyles?: string[];
  enableHover?: boolean;
}

export default function BounceCards({
  className = "",
  images = [],
  containerWidth = "100%",
  containerHeight = 360,
  animationDelay = 0.35,
  animationStagger = 0.06,
  easeType = "elastic.out(1, 0.8)",
  transformStyles = [
    "rotate(8deg) translate(-170px)",
    "rotate(4deg) translate(-85px)",
    "rotate(0deg)",
    "rotate(-6deg) translate(85px)",
    "rotate(2deg) translate(170px)"
  ],
  enableHover = false
}: BounceCardsProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const cardSelector = useMemo(() => {
    const id = Math.random().toString(36).slice(2, 8);
    return `pc-bounce-card-${id}`;
  }, []);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || images.length === 0) return;

    gsap.fromTo(
      node.querySelectorAll(`.${cardSelector}`),
      { scale: 0 },
      {
        scale: 1,
        stagger: animationStagger,
        ease: easeType,
        delay: animationDelay
      }
    );
  }, [animationDelay, animationStagger, easeType, images.length, cardSelector]);

  const getNoRotationTransform = (transformStr: string): string => {
    const hasRotate = /rotate\([\s\S]*?\)/.test(transformStr);
    if (hasRotate) {
      return transformStr.replace(/rotate\([\s\S]*?\)/, "rotate(0deg)");
    }
    if (transformStr === "none") {
      return "rotate(0deg)";
    }
    return `${transformStr} rotate(0deg)`;
  };

  const getPushedTransform = (baseTransform: string, offsetX: number): string => {
    const translateRegex = /translate\(([-0-9.]+)px\)/;
    const match = baseTransform.match(translateRegex);
    if (match) {
      const currentX = parseFloat(match[1]);
      const newX = currentX + offsetX;
      return baseTransform.replace(translateRegex, `translate(${newX}px)`);
    }
    if (baseTransform === "none") {
      return `translate(${offsetX}px)`;
    }
    return `${baseTransform} translate(${offsetX}px)`;
  };

  const pushSiblings = (hoveredIdx: number) => {
    if (!enableHover) return;

    images.forEach((_, i) => {
      gsap.killTweensOf(`.${cardSelector}-${i}`);

      const baseTransform = transformStyles[i] || "none";

      if (i === hoveredIdx) {
        const noRotation = getNoRotationTransform(baseTransform);
        gsap.to(`.${cardSelector}-${i}`, {
          transform: noRotation,
          duration: 0.4,
          ease: "back.out(1.4)",
          overwrite: "auto"
        });
      } else {
        const offsetX = i < hoveredIdx ? -160 : 160;
        const pushedTransform = getPushedTransform(baseTransform, offsetX);

        const distance = Math.abs(hoveredIdx - i);
        const delay = distance * 0.05;

        gsap.to(`.${cardSelector}-${i}`, {
          transform: pushedTransform,
          duration: 0.4,
          ease: "back.out(1.4)",
          delay,
          overwrite: "auto"
        });
      }
    });
  };

  const resetSiblings = () => {
    if (!enableHover) return;
    images.forEach((_, i) => {
      gsap.killTweensOf(`.${cardSelector}-${i}`);
      const baseTransform = transformStyles[i] || "none";
      gsap.to(`.${cardSelector}-${i}`, {
        transform: baseTransform,
        duration: 0.4,
        ease: "back.out(1.4)",
        overwrite: "auto"
      });
    });
  };

  return (
    <div
      ref={rootRef}
      className={`bounceCardsContainer ${className}`}
      style={{
        width: containerWidth,
        height: containerHeight
      }}
    >
      {images.map((src, idx) => (
        <div
          key={idx}
          className={`bounce-card ${cardSelector} ${cardSelector}-${idx}`}
          style={{ transform: transformStyles[idx] ?? "none" }}
          onMouseEnter={() => pushSiblings(idx)}
          onMouseLeave={resetSiblings}
        >
          <img className="bounce-card-image" src={src} alt={`lookbook-${idx}`} loading="lazy" />
        </div>
      ))}
    </div>
  );
}
