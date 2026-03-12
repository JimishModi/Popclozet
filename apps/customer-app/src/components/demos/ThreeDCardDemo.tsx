"use client";

import React from "react";
import { CardBody, CardContainer, CardItem } from "../ui/3d-card";
import { ShimmerButton } from "../ui/tailwindcss-buttons";

export function ThreeDCardDemo() {
    return (
        <CardContainer className="inter-var">
            <CardBody className="bg-gray-50 relative group/card  dark:hover:shadow-2xl dark:hover:shadow-emerald-500/[0.1] dark:bg-black dark:border-white/[0.2] border-black/[0.1] w-auto sm:w-[30rem] h-auto rounded-xl p-6 border  ">
                <CardItem
                    translateZ="50"
                    className="text-xl font-bold text-neutral-600 dark:text-white"
                >
                    Rent the Runway Look
                </CardItem>
                <CardItem
                    as="p"
                    translateZ="60"
                    className="text-neutral-500 text-sm max-w-sm mt-2 dark:text-neutral-300"
                >
                    Get premium fashion delivered in minutes. Why buy when you can rent?
                </CardItem>
                <CardItem
                    translateZ="100"
                    rotateX={20}
                    rotateZ={-10}
                    className="w-full mt-4"
                >
                    <img
                        src="https://images.unsplash.com/photo-1539008835657-9e8e9680c956?q=80&w=2560&auto=format&fit=crop"
                        height="1000"
                        width="1000"
                        className="h-60 w-full object-cover rounded-xl group-hover/card:shadow-xl"
                        alt="Fashion Rental"
                        loading="lazy"
                    />
                </CardItem>
                <div className="flex justify-between items-center mt-20">
                    <CardItem
                        translateZ={20}
                        translateX={-40}
                        as="div"
                    >
                        <ShimmerButton className="h-auto px-4 py-2 text-xs">
                            View Details →
                        </ShimmerButton>
                    </CardItem>
                    <CardItem
                        translateZ={20}
                        translateX={40}
                        as="div"
                    >
                        <button className="px-8 py-2 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold hover:shadow-lg transition duration-200">
                            Rent Now
                        </button>
                    </CardItem>
                </div>
            </CardBody>
        </CardContainer>
    );
}

