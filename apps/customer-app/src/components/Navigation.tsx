// src/components/Navigation.tsx
import { useEffect, useRef, useState } from "react";
import {
  Menu,
  X,
  ShoppingBag,
  ArrowRight,
  Search,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useCart } from "@/context/CartContext";
import ThemeToggle from "./ThemeToggle";
import SignupModal from "./SignupModal";
import SmartSearchOverlay from "./SmartSearchOverlay";
// new   use this
import logoSrc from "../logo/popclozet-logo.svg";

import { useNavigate, useLocation } from "react-router-dom";

const Navigation = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const [isSignupOpen, setIsSignupOpen] = useState(false);
  const { totalItems } = useCart();

  const navigate = useNavigate();
  const location = useLocation();

  // inline search state
  const [isInlineSearchOpen, setIsInlineSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Smart search overlay (replaces inline search)
  const [isSmartSearchOpen, setIsSmartSearchOpen] = useState(false);

  // Handle search query from SmartSearchOverlay
  const handleSearchQuery = (query: string) => {
    console.log("Search query:", query);
    // Map common search terms to mood IDs
    const moodMap: Record<string, string> = {
      'party': 'party',
      'casual': 'casual',
      'cocktail': 'cocktail',
      'formal': 'formal',
      'office': 'formal',
      'work': 'formal',
      'street': 'street',
      'streetwear': 'street',
      'vacation': 'vacation',
      'beach': 'vacation',
      'wedding': 'cocktail',
      'date': 'party',
    };
    const lowerQuery = query.toLowerCase();
    const matchedMood = Object.entries(moodMap).find(([key]) => lowerQuery.includes(key));

    if (matchedMood) {
      navigate(`/collections/${matchedMood[1]}`);
    } else {
      navigate('/collections');
    }
  };

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow =
      isMobileMenuOpen || isSmartSearchOpen ? "hidden" : "unset";
  }, [isMobileMenuOpen, isSmartSearchOpen]);

  useEffect(() => {
    if (isInlineSearchOpen) {
      const t = setTimeout(() => searchRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [isInlineSearchOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsInlineSearchOpen(false);
        setIsSmartSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Generic smart scroll handler factory (keeps behavior across pages)
  const makeSectionHandler = (id: string, hashPath: string) => {
    return (e?: React.MouseEvent) => {
      e?.preventDefault();

      const scrollToSection = () => {
        const el = document.getElementById(id);
        if (el) {
          // Use smooth scroll to element
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          return true;
        }
        return false;
      };

      if (location.pathname === "/") {
        // Already on homepage: try in-page scroll first
        if (!scrollToSection()) {
          // If element not present yet, navigate with hash so index page can handle it
          navigate(hashPath);
        }
        return;
      }

      // Not on home: navigate to home with hash
      navigate(hashPath);
    };
  };

  // Collections handler: navigate to /collections page
  const handleCollectionsClick = (e?: React.MouseEvent) => {
    e?.preventDefault();
    navigate("/collections");
  };

  const handleHowItWorksClick = makeSectionHandler(
    "how-it-works-section",
    "/#how-it-works-section"
  );

  // Home handler: if already on /, scroll to top, else navigate to /
  const handleHomeClick = (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (location.pathname === "/") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate("/home");
    }
  };

  // nav link definitions (we render them with custom handlers below)
  const navLinks = [
    { name: "Home", href: "/", onClick: handleHomeClick },
    { name: "Collections", href: "/collections", onClick: handleCollectionsClick },
    { name: "How It Works", href: "/#how-it-works-section", onClick: handleHowItWorksClick },
  ];

  const itemHover = {
    scale: 1.02,
    y: -1.5,
    transition: { type: "spring", stiffness: 260, damping: 20 },
  };

  const underlineTransition = {
    duration: 0.22,
    ease: [0.3, 0.7, 0.2, 1],
  };

  return (
    <>
      {/* DESKTOP NAV */}
      <motion.nav
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={cn(
          "hidden md:block fixed inset-x-0 top-[40px] z-50 transition-all",
          isScrolled ? "top-[32px]" : "top-[40px]"
        )}
        aria-label="Primary navigation"
      >
        <div className="container-custom relative flex items-center justify-center">
          {/* subtle aurora */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -inset-8 rounded-3xl filter blur-3xl opacity-40"
            initial={{ x: -60 }}
            animate={{ x: [-60, 0, 60, -60] }}
            transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
            style={{
              background:
                "radial-gradient(600px 200px at 10% 30%, rgba(168,85,247,0.12), transparent 12%), radial-gradient(500px 160px at 90% 70%, rgba(56,189,248,0.06), transparent 14%)",
            }}
          />

          <div
            className={cn(
              "relative w-full max-w-[1200px] rounded-3xl backdrop-blur-xl border border-black/10 dark:border-[#FAFAFA]/10",
              "bg-[#F6F0E0]/90 dark:bg-[#1A1A1A]/95 shadow-[0_10px_30px_rgba(2,6,23,0.22)]",
              // changed: align left and reduce gap so center links sit closer to logo
              "px-6 py-3 flex items-center justify-start gap-4"
            )}
          >
            {/* LOGO */}
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                handleHomeClick();
              }}
              className="flex items-center gap-3 select-none mr-2"
              aria-label="Popclozet home"
            >
              <div className="h-10 w-auto flex items-center">
                <img
                  src={logoSrc}
                  alt="Popclozet logo"
                  className="h-12 w-auto object-contain"
                  loading="lazy"
                />
              </div>
            </a>

            {/* CENTER LINKS */}
            <div className="hidden md:flex items-center gap-4 ml-4">
              {navLinks.map((link) => {
                const isHovered = hoveredLink === link.name;

                // Determine click handler (some links have custom onClick)
                const onClick = (e: React.MouseEvent) => {
                  e.preventDefault();
                  if (link.onClick) {
                    link.onClick(e);
                  } else {
                    // fallback navigate
                    navigate(link.href);
                  }
                };

                return (
                  <motion.button
                    key={link.name}
                    onMouseEnter={() => setHoveredLink(link.name)}
                    onMouseLeave={() => setHoveredLink(null)}
                    whileHover={itemHover}
                    onClick={onClick}
                    className="relative text-sm font-medium text-foreground hover:text-primary transition-colors py-2 px-1 bg-transparent border-none"
                    aria-label={link.name}
                  >
                    {link.name}
                    {isHovered && (
                      <motion.span
                        layoutId="nav-underline"
                        className="absolute left-0 right-0 bottom-0 h-0.5 rounded-full bg-[#EB76C2]"
                        initial={{ opacity: 0, scaleX: 0 }}
                        animate={{ opacity: 1, scaleX: 1 }}
                        exit={{ opacity: 0, scaleX: 0 }}
                        transition={underlineTransition}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* RIGHT GROUP */}
            <motion.div layout="position" className="hidden md:flex items-center gap-3 ml-auto">
              <motion.div
                layout
                initial={false}
                animate={{
                  flexBasis: isInlineSearchOpen ? "292px" : "56px",
                }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
                className={cn(
                  "flex items-center rounded-full px-2 py-1 shadow-sm cursor-pointer",
                  isInlineSearchOpen ? "bg-background border border-border" : "bg-muted/30"
                )}
                style={{ minWidth: 50, maxWidth: "min(45%, 420px)" }}
                onClick={() => {
                  // Open smart search overlay instead of inline search
                  setIsSmartSearchOpen(true);
                }}
                role="search"
                aria-label="Open inline search"
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0",
                    isInlineSearchOpen ? "bg-muted" : "bg-muted/50"
                  )}
                >
                  <Search className="w-4 h-4 text-foreground" />
                </div>

                <AnimatePresence initial={false}>
                  {!isInlineSearchOpen ? (
                    <motion.div
                      key="compact"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="ml-3 hidden lg:flex items-center select-none"
                    >
                      <span className="text-sm text-white/80"> </span>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="expanded"
                      initial={{ opacity: 0, x: 6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 6 }}
                      className="flex items-center gap-2 w-full"
                    >
                      <input
                        ref={searchRef}
                        type="search"
                        placeholder="Search styles, designers, or occasions..."
                        className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground px-2"
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setIsInlineSearchOpen(false);
                          if (e.key === "Enter") {
                            const q = (e.target as HTMLInputElement).value.trim();
                            if (q) {
                              console.log("Search:", q);
                              setIsInlineSearchOpen(false);
                            }
                          }
                        }}
                        aria-label="Search styles, designers, or occasions"
                      />

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsInlineSearchOpen(false);
                        }}
                        className="rounded-full p-1 hover:bg-muted transition flex-shrink-0"
                        aria-label="Close search"
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              <motion.div layout className="p-2 rounded-md">
                <ThemeToggle />
              </motion.div>

              <motion.button
                layout
                type="button"
                onClick={() => navigate("/cart")}
                className="relative p-2 rounded-md hover:bg-muted/30 transition"
                aria-label="Cart"
              >
                <ShoppingBag className="w-5 h-5" />
                {totalItems > 0 && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </motion.button>

              <motion.button
                layout
                onClick={() => setIsSignupOpen(true)}
                whileHover={{ scale: 1.02 }}
                className="rounded-full px-4 py-2 text-sm font-semibold"
              >
                <span
                  className="inline-block rounded-full px-4 py-2 text-black font-bold bg-[#C0E2AD] dark:bg-[#99C08D] shadow-md hover:shadow-lg transition-shadow"
                >
                  Join Early Access →
                </span>
              </motion.button>
            </motion.div>
          </div>
        </div>
      </motion.nav>

      {/* MOBILE NAV - Compact top bar with hamburger */}
      <div className="md:hidden">
        <motion.nav
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed top-0 inset-x-0 z-50"
        >
          <div className="mx-3 mt-3 rounded-2xl bg-[#F6F0E0]/90 dark:bg-[#1A1A1A]/95 backdrop-blur-xl border border-black/10 dark:border-[#FAFAFA]/10 shadow-[0_12px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_30px_rgba(0,0,0,0.35)] px-4 py-3 flex items-center justify-between">
            <button
              onClick={(e) => { e.preventDefault(); handleHomeClick(); }}
              className="flex items-center"
              aria-label="Popclozet home"
              type="button"
            >
              <img src={logoSrc} alt="Popclozet logo" className="h-10 w-auto object-contain" loading="lazy" />
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/cart")}
                className="relative h-11 w-11 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
                aria-label="Cart"
                type="button"
              >
                <ShoppingBag className="w-5 h-5" />
                {totalItems > 0 && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </button>

              <button
                onClick={() => setIsMobileMenuOpen((s) => !s)}
                className="h-11 w-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md active:scale-95 transition"
                aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
                type="button"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </motion.nav>

        {/* Slide-out Menu - Enhanced with Theme toggle */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div className="fixed inset-0 z-40 flex">
              <div className="absolute inset-0 bg-black/50" onClick={() => setIsMobileMenuOpen(false)} />

              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 22, stiffness: 260 }}
                className="absolute right-0 w-[82%] max-w-xs h-full bg-[#F6F0E0]/98 dark:bg-[#1A1A1A]/98 backdrop-blur-xl shadow-2xl overflow-hidden pt-20"
              >
                <div className="p-6 flex flex-col gap-5 h-full">
                  {/* Navigation Links */}
                  <div className="flex flex-col gap-2 mt-2">
                    {navLinks.map((link) => (
                      <button
                        key={link.name}
                        onClick={(e) => {
                          (link.onClick ?? (() => navigate(link.href)))(e as any);
                          setIsMobileMenuOpen(false);
                        }}
                        className="flex items-center justify-between text-xl font-semibold text-foreground py-4 px-5 rounded-xl hover:bg-muted/50 transition-colors active:scale-[0.98] touch-manipulation min-h-[56px]"
                      >
                        <span>{link.name}</span>
                        <ArrowRight className="w-5 h-5 text-muted-foreground" />
                      </button>
                    ))}
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-border/50" />

                  {/* Theme Toggle Section */}
                  <div className="flex items-center justify-between py-4 px-5 rounded-xl bg-muted/30 min-h-[56px]">
                    <span className="text-lg font-semibold text-foreground">Theme</span>
                    <ThemeToggle />
                  </div>

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* CTA Button */}
                  <motion.button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsSignupOpen(true);
                    }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-5 text-center rounded-full bg-[#EB76C2] text-white font-bold text-lg shadow-lg touch-manipulation min-h-[56px]"
                  >
                    Get Started
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>


      {/* Smart Search Overlay */}
      <SmartSearchOverlay
        isOpen={isSmartSearchOpen}
        onClose={() => setIsSmartSearchOpen(false)}
        onSearch={handleSearchQuery}
      />

      <SignupModal isOpen={isSignupOpen} onClose={() => setIsSignupOpen(false)} />
    </>
  );
};

export default Navigation;
