"use client";

import { useEffect, useState } from "react";
import { EncryptedText } from "./ui/encrypted-text";

interface WelcomeScreenProps {
    onComplete: () => void;
}

export function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
    const [fadeOut, setFadeOut] = useState(false);

    useEffect(() => {
        // Wait for the text to fully reveal (approx 1.5s) + 1s extra
        const timer = setTimeout(() => {
            setFadeOut(true);
            // Wait for fade out animation to complete
            setTimeout(onComplete, 1000);
        }, 2500);

        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-1000 ${fadeOut ? "opacity-0" : "opacity-100"
                }`}
        >
            <div className="text-center">
                <h1 className="text-4xl md:text-6xl font-bold">
                    <EncryptedText
                        text="Welcome to Popclozet"
                        encryptedClassName="text-neutral-600"
                        revealedClassName="text-white"
                        revealDelayMs={50}
                        scramble={false}
                    />
                </h1>
                <p className="mt-4 text-neutral-400">
                    <EncryptedText
                        text="Instant fashion rental"
                        encryptedClassName="text-neutral-700"
                        revealedClassName="text-neutral-400"
                        revealDelayMs={60}
                        scramble={false}
                    />
                </p>
            </div>
        </div>
    );
}
