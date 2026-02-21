// RentalReviews.tsx
import { motion } from "framer-motion";
import { Star } from "lucide-react";

const earlyTesterReviews = [
  {
    name: "Priya S.",
    review: "Loved the designer selection! The quality exceeded my expectations.",
    location: "Andheri",
    rating: 5,
    avatar: "https://i.pinimg.com/1200x/ae/76/c5/ae76c50a34873469b502bf00262888a0.jpg",
  },
  {
    name: "Rahul K.",
    review: "Perfect fit, great quality. Finally found a rental service that works.",
    location: "Bandra",
    rating: 4.8,
    avatar: "https://i.pinimg.com/736x/65/77/c2/6577c2a5ce3bff261006d5b42c8ebc17.jpg",
  },
  {
    name: "Ananya M.",
    review: "Super easy experience. From browsing to return, everything was seamless!",
    location: "Powai",
    rating: 5,
    avatar: "https://i.pinimg.com/736x/ad/fe/fd/adfefdbd991d0d1523144d72a6905a0e.jpg",
  },
  {
    name: "Vikram J.",
    review: "Stylish outfits delivered on time. Made my event memorable.",
    location: "Juhu",
    rating: 4.9,
    avatar: "https://i.pinimg.com/736x/88/78/ae/8878ae192e05a1a799c71332ceed5fac.jpg",
  },
  {
    name: "Sneha R.",
    review: "Highly recommend PopClozet! Amazing collection and service.",
    location: "Worli",
    rating: 5,
    avatar: "https://i.pinimg.com/736x/48/6a/b5/486ab5b518f0f1829388b120c4106ece.jpg",
  },
  {
    name: "Arjun D.",
    review: "Great for formal events. The suits are well-maintained and fit perfectly.",
    location: "Colaba",
    rating: 4.7,
    avatar: "https://i.pinimg.com/736x/d1/0a/a2/d10aa296e6aee00958a669f9848344ab.jpg",
  },
];

const FALLBACK = "/reviewers/placeholder.svg"; // make sure this file exists in public/reviewers

const Avatar = ({ src, alt, size = 40 }: { src: string; alt: string; size?: number }) => {
  // inline component to keep main JSX clean
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      width={size}
      height={size}
      className={`w-${Math.floor(size / 4)} h-${Math.floor(size / 4)} rounded-full object-cover object-center flex-shrink-0`}
      // Note: Tailwind w-X classes don't support dynamic numbers   we use fixed classes below instead.
      // To ensure consistency, we'll override the class attributes below explicitly.
      onError={(e) => {
        const img = e.currentTarget as HTMLImageElement;
        img.onerror = null;
        img.src = FALLBACK;
      }}
    />
  );
};

// Because dynamically building tailwind classes like `w-${n}` doesn't work reliably,
// we'll use direct style attributes for precise sizing for avatars
const RentalReviews = () => {
  return (
    <section className="py-16 md:py-24 bg-muted/30">
      <div className="container-custom">
        {/* Header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="inline-flex items-center gap-2 bg-yellow-500/10 text-yellow-600 px-4 py-2 rounded-full mb-4 border border-yellow-500/20">
            <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
            <span className="font-semibold text-sm">4.9 Average Rating</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-playfair font-bold mb-3">
            What Our <span className="text-gradient-brand">Early Testers</span> Say
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Real experiences from real people who tried PopClozet
          </p>
        </motion.div>

        {/* Reviews Grid - 2 rows of 3 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {earlyTesterReviews.map((review, i) => (
            <motion.div
              key={i}
              className="p-5 rounded-2xl bg-card border border-border/50 hover:border-primary/20 transition-all"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-3" aria-hidden>
                {[...Array(5)].map((_, idx) => (
                  <Star
                    key={idx}
                    className={`w-4 h-4 ${idx < Math.floor(review.rating) ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`}
                  />
                ))}
              </div>

              {/* Review Text */}
              <p className="text-foreground mb-4 leading-relaxed">"{review.review}"</p>

              {/* User Info */}
              <div className="flex items-center gap-3 pt-3 border-t border-border/50">
                <img
                  src={review.avatar}
                  alt={`${review.name}   ${review.location}`}
                  loading="lazy"
                  width={40}
                  height={40}
                  style={{ width: 40, height: 40 }}
                  className="rounded-full object-cover object-center flex-shrink-0 border-2 border-background"
                  onError={(e) => {
                    const img = e.currentTarget as HTMLImageElement;
                    img.onerror = null;
                    img.src = FALLBACK;
                  }}
                />
                <div>
                  <p className="font-semibold text-sm">{review.name}</p>
                  <p className="text-xs text-muted-foreground">{review.location}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Trust Badge */}
        <motion.div
          className="flex justify-center mt-10"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <div
            className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-card border border-border/50 shadow-sm"
            role="group"
            aria-label="Sample reviewer avatars"
          >
            <div className="flex -space-x-2" aria-hidden>
              {earlyTesterReviews.slice(0, 4).map((review, i) => (
                <img
                  key={i}
                  src={review.avatar}
                  alt={review.name}
                  loading="lazy"
                  width={28}
                  height={28}
                  style={{ width: 28, height: 28 }}
                  className="rounded-full border-2 border-background object-cover object-center"
                  onError={(e) => {
                    const img = e.currentTarget as HTMLImageElement;
                    img.onerror = null;
                    img.src = FALLBACK;
                  }}
                />
              ))}
            </div>
            <span className="text-sm text-foreground/80 font-medium">
              Join our <span className="font-bold text-foreground">growing community</span>
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default RentalReviews;
