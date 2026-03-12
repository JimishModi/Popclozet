import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BackgroundGradientAnimation } from "@/components/ui/background-gradient-animation";
import { useState } from "react";
import { supabase } from "@popclozet/api-client";
import { toast } from "sonner";

interface CTAButton {
  text: string;
  href: string;
  primary?: boolean;
}

interface SyntheticHeroProps {
  title: string;
  description: string;
  badgeText?: string;
  badgeLabel?: string;
  ctaButtons?: CTAButton[];
  showEmailCapture?: boolean;
  emailPlaceholder?: string;
  emailButtonText?: string;
  heroImage?: string;
  onEmailSubmit?: (email: string) => void;
}

const SyntheticHero = ({
  title,
  description,
  badgeText,
  badgeLabel,
  ctaButtons,
  showEmailCapture = false,
  emailPlaceholder = "Enter your email",
  emailButtonText = "Get Started",
  heroImage,
  onEmailSubmit,
}: SyntheticHeroProps) => {
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      try {
        const { error } = await supabase
          .from('email_signups')
          .insert({ email, source: 'hero' });

        if (error) throw error;

        if (onEmailSubmit) {
          onEmailSubmit(email);
        }
        toast.success("You're on the list! We'll be in touch soon.", {
          description: "Get ready for your endless closet experience.",
        });
        setEmail("");
      } catch (error) {
        toast.error("Oops! Something went wrong.", {
          description: "Please try again later.",
        });
      }
    }
  };

  return (
    <BackgroundGradientAnimation
      gradientBackgroundStart="rgb(255, 255, 255)"
      gradientBackgroundEnd="rgb(250, 245, 235)"
      firstColor="206, 164, 66"
      secondColor="255, 255, 255"
      thirdColor="230, 200, 130"
      fourthColor="206, 164, 66"
      fifthColor="117, 92, 33"
      pointerColor="206, 164, 66"
      size="80%"
      blendingValue="soft-light"
      containerClassName="!h-auto min-h-screen"
      className="!h-auto"
    >
      <section className="relative min-h-screen w-full">
        <div className="container mx-auto px-4 py-20 md:py-24 pt-24 md:pt-32">
          <div className="flex flex-col lg:flex-row gap-8 md:gap-16 items-center max-w-7xl mx-auto">
            {/* Content Column */}
            <div className="w-full lg:w-1/2 space-y-6 md:space-y-8 text-center lg:text-left">
              {badgeText && (
                <Badge variant="secondary" className="inline-flex gap-2 px-4 py-2 text-sm">
                  {badgeLabel && <span className="font-medium">{badgeLabel}:</span>}
                  {badgeText}
                </Badge>
              )}

              <div className="space-y-4 md:space-y-6">
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-[#1a1a1a] leading-[1.1] tracking-tight drop-shadow-[0_2px_10px_rgba(255,255,255,0.3)]">
                  {title}
                </h1>
                <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-[#2d2d2d] max-w-2xl mx-auto lg:mx-0 leading-relaxed drop-shadow-[0_1px_5px_rgba(255,255,255,0.2)]">
                  {description}
                </p>
              </div>

              {/* Email Capture or CTA Buttons */}
              {showEmailCapture ? (
                <form onSubmit={handleSubmit} className="space-y-4 w-full">
                  <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto lg:mx-0">
                    <Input
                      type="email"
                      placeholder={emailPlaceholder}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="flex-1 min-h-[48px] h-12 md:h-14 text-base md:text-lg bg-white/95 backdrop-blur-sm border-white/20 focus:border-white text-headline placeholder:text-muted-foreground px-4"
                    />
                    <Button
                      type="submit"
                      size="lg"
                      className="min-h-[48px] h-12 md:h-14 px-6 md:px-8 bg-[#1a1a1a] text-white hover:bg-[#2d2d2d] font-medium shadow-lg transition-all hover:shadow-xl hover:scale-105 w-full sm:w-auto"
                    >
                      {emailButtonText}
                    </Button>
                  </div>
                </form>
              ) : (
                ctaButtons && (
                  <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                    {ctaButtons.map((button, index) => (
                      <Button
                        key={index}
                        size="lg"
                        variant={button.primary ? "default" : "outline"}
                        asChild
                        className={
                          button.primary
                            ? "bg-primary hover:bg-primary-hover text-primary-foreground shadow-button transition-all hover:shadow-lg hover:scale-105"
                            : ""
                        }
                      >
                        <a href={button.href}>{button.text}</a>
                      </Button>
                    ))}
                  </div>
                )
              )}
            </div>

            {/* Image Column */}
            {heroImage && (
              <div className="w-full lg:w-1/2 relative h-[400px] sm:h-[500px] lg:h-[600px] xl:h-[700px] rounded-2xl md:rounded-3xl overflow-hidden shadow-soft">
                <div className="absolute inset-0 bg-gradient-to-t from-headline/20 to-transparent z-10" />
                <img
                  src={heroImage}
                  alt="Hero visual showcasing trendy fashion outfits"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                  loading="eager"
                />
              </div>
            )}
          </div>
        </div>
      </section>
    </BackgroundGradientAnimation>
  );
};

export default SyntheticHero;
