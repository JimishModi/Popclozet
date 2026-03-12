import React from 'react';

interface CardData {
    title: string;
    desc: string;
    gradientFrom: string;
    gradientTo: string;
    image?: string;
    emoji?: string;
}

interface SkewCardsProps {
    cards: CardData[];
}

export default function SkewCards({ cards }: SkewCardsProps) {
    return (
        <>
            <div className="flex justify-center items-center flex-wrap py-10 min-h-screen">
                {cards.map(({ title, desc, gradientFrom, gradientTo, image, emoji }, idx) => (
                    <div
                        key={idx}
                        className="group relative w-[320px] h-[450px] m-[40px_30px] transition-all duration-500"
                    >
                        {/* Skewed gradient panels */}
                        <span
                            className="absolute top-0 left-[50px] w-1/2 h-full rounded-lg transform skew-x-[15deg] transition-all duration-500 group-hover:skew-x-0 group-hover:left-[20px] group-hover:w-[calc(100%-90px)]"
                            style={{
                                background: `linear-gradient(315deg, ${gradientFrom}, ${gradientTo})`,
                            }}
                        />
                        <span
                            className="absolute top-0 left-[50px] w-1/2 h-full rounded-lg transform skew-x-[15deg] blur-[30px] transition-all duration-500 group-hover:skew-x-0 group-hover:left-[20px] group-hover:w-[calc(100%-90px)]"
                            style={{
                                background: `linear-gradient(315deg, ${gradientFrom}, ${gradientTo})`,
                            }}
                        />

                        {/* Animated blurs */}
                        <span className="pointer-events-none absolute inset-0 z-10">
                            <span className="absolute top-0 left-0 w-0 h-0 rounded-lg opacity-0 bg-[rgba(255,255,255,0.1)] backdrop-blur-[10px] shadow-[0_5px_15px_rgba(0,0,0,0.08)] transition-all duration-100 animate-blob group-hover:top-[-50px] group-hover:left-[50px] group-hover:w-[100px] group-hover:h-[100px] group-hover:opacity-100" />
                            <span className="absolute bottom-0 right-0 w-0 h-0 rounded-lg opacity-0 bg-[rgba(255,255,255,0.1)] backdrop-blur-[10px] shadow-[0_5px_15px_rgba(0,0,0,0.08)] transition-all duration-500 animate-blob animation-delay-1000 group-hover:bottom-[-50px] group-hover:right-[50px] group-hover:w-[100px] group-hover:h-[100px] group-hover:opacity-100" />
                        </span>

                        {/* Content */}
                        <div className="relative z-20 left-0 p-[20px] bg-[rgba(255,255,255,0.05)] dark:bg-[rgba(0,0,0,0.3)] backdrop-blur-[10px] shadow-lg rounded-lg text-white transition-all duration-500 group-hover:left-[-25px] group-hover:p-[30px_20px] h-full overflow-hidden">
                            {/* Image at top if provided */}
                            {image && (
                                <div className="relative w-full h-[180px] mb-4 rounded-lg overflow-hidden">
                                    <img
                                        src={image}
                                        alt={title}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    />
                                    {emoji && (
                                        <div className="absolute top-2 left-2 text-4xl bg-white/20 backdrop-blur-sm rounded-full w-14 h-14 flex items-center justify-center">
                                            {emoji}
                                        </div>
                                    )}
                                </div>
                            )}

                            <h2 className="text-2xl font-bold mb-2">{title}</h2>
                            <p className="text-base leading-relaxed mb-4 opacity-90">{desc}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Tailwind custom utilities for animation and shadows */}
            <style>{`
        @keyframes blob {
          0%, 100% { transform: translateY(10px); }
          50% { transform: translate(-10px); }
        }
        .animate-blob { animation: blob 2s ease-in-out infinite; }
        .animation-delay-1000 { animation-delay: -1s; }
      `}</style>
        </>
    );
}
