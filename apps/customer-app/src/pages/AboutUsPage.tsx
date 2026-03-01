/**
 * AboutUsPage — Full detailed About Us page
 *
 * Shows the complete hygiene process timeline (Pre-Cleaning, Sanitization,
 * Post-Cleaning, Quality Check) plus the Our Brand section.
 * Accessed by tapping the ">" on the About Us slider on the home page.
 */

import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { MobileShell } from "@/components/layout/MobileShell";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { BottomNavBar } from "@/components/layout/BottomNavBar";
import { AboutUsProcess } from "@/components/ui/AboutUsProcess";

export default function AboutUsPage() {
    return (
        <MobileShell className="bg-[#111111] text-white">
            <MobileHeader />

            <main className="flex-1 overflow-y-auto">
                {/* Back arrow */}
                <div className="px-4 py-4">
                    <Link
                        to="/home"
                        className="inline-flex items-center gap-2 p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-white" />
                    </Link>
                </div>

                {/* Full AboutUsProcess component */}
                <AboutUsProcess />
            </main>

            <BottomNavBar />
        </MobileShell>
    );
}
