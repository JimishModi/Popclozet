import { useState, useEffect } from "react";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface iTestimonial {
  description: string;
  profileImage: string;
  name: string;
  designation: string;
  rating?: number;
  headline?: string;
}

interface TestimonialCardProps {
  testimonial: iTestimonial;
  index: number;
  backgroundImage?: string;
}

export const TestimonialCard = ({
  testimonial,
  backgroundImage,
}: TestimonialCardProps) => {
  const rating = testimonial.rating || 5;

  return (
    <div className="w-full px-4">
      <div className="relative bg-card rounded-2xl p-8 shadow-card hover:shadow-soft transition-all duration-300">
        {backgroundImage && (
          <div
            className="absolute inset-0 opacity-5 rounded-2xl bg-cover bg-center"
            style={{ backgroundImage: `url(${backgroundImage})` }}
          />
        )}
        
        <div className="relative z-10 space-y-6">
          {/* Rating */}
          <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "w-5 h-5",
                  i < rating
                    ? "fill-primary text-primary"
                    : "fill-muted text-muted"
                )}
              />
            ))}
          </div>

          {/* Headline */}
          {testimonial.headline && (
            <h3 className="text-xl font-bold text-headline">
              {testimonial.headline}
            </h3>
          )}

          {/* Description */}
          <p className="text-muted-foreground leading-relaxed text-base">
            "{testimonial.description}"
          </p>

          {/* Profile */}
          <div className="pt-4 border-t border-border">
            <p className="font-semibold text-foreground">{testimonial.name}</p>
            <p className="text-sm text-muted-foreground">
              {testimonial.designation}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

interface CarouselProps {
  items: React.ReactNode[];
  autoPlayInterval?: number;
}

export const Carousel = ({ items, autoPlayInterval = 5000 }: CarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [currentIndex, items.length, autoPlayInterval, isAutoPlaying]);

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
    setIsAutoPlaying(false);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
    setIsAutoPlaying(false);
  };

  return (
    <div className="relative w-full">
      {/* Carousel Container */}
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {items.map((item, index) => (
            <div key={index} className="w-full flex-shrink-0">
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-center gap-4 mt-8">
        <Button
          variant="outline"
          size="icon"
          onClick={goToPrevious}
          className="rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        {/* Dots */}
        <div className="flex gap-2">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setCurrentIndex(index);
                setIsAutoPlaying(false);
              }}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300",
                index === currentIndex
                  ? "bg-primary w-8"
                  : "bg-border hover:bg-primary/50"
              )}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={goToNext}
          className="rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
};
