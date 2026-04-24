/**
 * AboutUsPage — Full detailed About Us page
 *
 * Shows the complete hygiene process timeline (Pre-Cleaning, Sanitization,
 * Post-Cleaning, Quality Check) plus the Our Brand section.
 * Accessed by tapping the ">" on the About Us slider on the home page.
 */

import { Helmet } from "react-helmet-async";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { MobileShell } from "@/components/layout/MobileShell";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { AboutUsProcess } from "@/components/ui/AboutUsProcess";

export default function AboutUsPage() {
    return (
        <MobileShell className="bg-[#111111] text-white">
            <Helmet>
                <title>About Us | Popclozet</title>
                <meta name="description" content="Learn about Popclozet's mission to make premium fashion rental accessible. Discover our hygiene process and brand story." />
            </Helmet>
            <MobileHeader />

            <main className="flex-1 overflow-y-auto">
                {/* Header */}
                <header className="sticky top-0 z-50 bg-[#111111]/90 backdrop-blur-xl px-4 py-4 border-b border-white/5">
                    <Link
                        to="/home"
                        className="inline-flex items-center gap-2 p-2 -ml-2 rounded-full hover:bg-white/10 transition-all active:scale-95"
                    >
                        <ArrowLeft className="w-5 h-5 text-white" />
                    </Link>
                </header>

                {/* Full AboutUsProcess component */}
                <AboutUsProcess />
            </main>
        </MobileShell>
    );
}
