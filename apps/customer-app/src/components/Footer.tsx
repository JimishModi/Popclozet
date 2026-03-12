// src/components/Footer.tsx
import React from "react";
import { Instagram, Linkedin, Mail } from "lucide-react";
import Logo from "@/logo/popclozet-logo.svg";

const links = [
  { title: "Features", href: "#" },
  { title: "Solution", href: "#" },
  { title: "Customers", href: "#" },
  { title: "Pricing", href: "#" },
  { title: "Help", href: "#" },
  { title: "About", href: "#" },
];

// Official X (Twitter) SVG (fill inherits currentColor)
const XIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 1200 1227"
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M714.163 519.284L1160.89 0H1054.09L667.137 450.887L367.371 0H0L468.381 681.29L0 1226.97H106.797L515.466 742.674L832.629 1226.97H1200L714.137 519.284H714.163ZM568.764 663.762L521.708 596.221L145.574 79.694H321.003L619.149 515.284L666.206 582.825L1060.93 1147.85H885.502L568.764 663.789V663.762Z" />
  </svg>
);

function IconCircle({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="w-12 h-12 sm:w-10 sm:h-10 inline-flex items-center justify-center rounded-full bg-white/95 border border-border shadow-sm hover:shadow-md transition-all duration-200 transform hover:-translate-y-0.5 touch-manipulation min-w-[48px] min-h-[48px]"
      title={label}
    >
      <span className="inline-flex items-center justify-center text-muted-foreground">
        {children}
      </span>
    </a>
  );
}

export default function Footer() {
  return (
    <footer className="py-12 sm:py-16 md:py-32 bg-[#F6F0E0] dark:bg-[#1A1A1A] border-t border-black/10 dark:border-[#FAFAFA]/10">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 text-center">
        <a href="/" aria-label="go home" className="mx-auto block w-fit">
          <img src={Logo} alt="PopClozet" className="h-12 sm:h-14 w-auto mx-auto" />
        </a>

        <div className="my-6 sm:my-8 flex flex-wrap justify-center gap-4 sm:gap-6 text-sm sm:text-base font-medium">
          {links.map((link, index) => (
            <a
              key={index}
              href={link.href}
              className="text-muted-foreground hover:text-primary transition-colors duration-200 py-2 px-2 touch-manipulation"
            >
              <span>{link.title}</span>
            </a>
          ))}
        </div>

        <div className="flex flex-col items-center gap-4 sm:gap-6 my-6 sm:my-8">
          <div className="flex flex-col items-center gap-3 text-sm sm:text-base text-muted-foreground">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center px-2">
              <Mail className="w-4 h-4 flex-shrink-0" />
              <a href="mailto:Businessoutreach@popclozet.com" className="hover:text-primary transition-colors break-all sm:break-normal">
                Businessoutreach@popclozet.com
              </a>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center px-2">
              <Mail className="w-4 h-4 flex-shrink-0" />
              <a href="mailto:Businessrep@popclozet.in" className="hover:text-primary transition-colors break-all sm:break-normal">
                Businessrep@popclozet.in
              </a>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-4 mt-4">
            <IconCircle
              href="https://www.instagram.com/popclozet.in?utm_source=qr&igsh=MWhncmMwNW42Nzdsdw=="
              label="PopClozet on Instagram"
            >
              <Instagram className="w-4 h-4" />
            </IconCircle>

            <IconCircle
              href="https://www.linkedin.com/company/popclozet/?viewAsMember=true"
              label="PopClozet on LinkedIn"
            >
              <Linkedin className="w-4 h-4" />
            </IconCircle>

            <IconCircle href="https://x.com/popclozet?s=09" label="PopClozet on X">
              <XIcon className="w-4 h-4" />
            </IconCircle>
          </div>
        </div>

        <span className="text-muted-foreground block text-center text-sm">
          © {new Date().getFullYear()} PopClozet. All rights reserved.
        </span>
      </div>
    </footer>
  );
}
