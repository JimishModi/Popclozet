"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface EncryptedTextProps {
    text: string;
    className?: string;
    encryptedClassName?: string;
    revealedClassName?: string;
    revealDelayMs?: number;
    charset?: string;
    flipDelayMs?: number;
    scramble?: boolean;
}

const DEFAULT_CHARSET =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-={}[];:,.<>/?";

export function EncryptedText({
    text,
    className = "",
    encryptedClassName = "text-neutral-500",
    revealedClassName = "text-black dark:text-white",
    revealDelayMs = 50,
    charset = DEFAULT_CHARSET,
    flipDelayMs = 50,
    scramble = true,
}: EncryptedTextProps) {
    const [displayText, setDisplayText] = useState(text);
    const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (!scramble) {
            const all = new Set<number>(text.split("").map((_, idx) => idx));
            setDisplayText(text);
            setRevealedIndices(all);
            return;
        }

        let currentIndex = 0;
        const textLength = text.length;
        const revealed = new Set<number>();
        setRevealedIndices(new Set());
        setDisplayText(text);

        // Start revealing characters one by one
        const revealInterval = setInterval(() => {
            if (currentIndex < textLength) {
                revealed.add(currentIndex);
                setRevealedIndices(new Set(revealed));
                currentIndex++;
            } else {
                clearInterval(revealInterval);
            }
        }, revealDelayMs);

        // Scramble non-revealed characters
        const scrambleInterval = setInterval(() => {
            setDisplayText((prev) =>
                prev
                    .split("")
                    .map((char, index) => {
                        if (revealed.has(index) || char === " ") {
                            return text[index];
                        }
                        return charset[Math.floor(Math.random() * charset.length)];
                    })
                    .join("")
            );
        }, flipDelayMs);

        return () => {
            clearInterval(revealInterval);
            clearInterval(scrambleInterval);
        };
    }, [text, revealDelayMs, charset, flipDelayMs, scramble]);

    return (
        <span className={cn("font-mono", className)}>
            {displayText.split("").map((char, index) => (
                <span
                    key={index}
                    className={cn(
                        "transition-colors duration-200",
                        revealedIndices.has(index) ? revealedClassName : encryptedClassName
                    )}
                >
                    {char}
                </span>
            ))}
        </span>
    );
}
