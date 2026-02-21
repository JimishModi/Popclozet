import { useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Compass, Home, Sparkles } from "lucide-react";

const NotFound = () => {
  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route");
  }, []);

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-background via-secondary/10 to-background text-foreground overflow-hidden">
      <div className="absolute inset-0 opacity-40 blur-3xl pointer-events-none" aria-hidden>
        <div className="absolute -top-10 -left-10 w-72 h-72 rounded-full bg-primary/20" />
        <div className="absolute top-1/3 right-10 w-64 h-64 rounded-full bg-secondary/20" />
        <div className="absolute bottom-0 left-1/2 w-80 h-80 rounded-full bg-accent/15" />
      </div>

      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-primary/10 text-primary font-semibold border border-primary/20"
        >
          <Sparkles className="w-4 h-4" />
          Lost in the wardrobe
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-5xl md:text-6xl font-black mb-4 tracking-tight"
        >
          Page not found
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10"
        >
          The outfit you’re looking for took a different runway. Let’s get you back to styles that fit.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <Link
            to="/home"
            className="btn-primary inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Link>
          <Link
            to="/how-it-works"
            className="glass inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full hover:glass-strong transition"
          >
            <Compass className="w-4 h-4" />
            How It Works
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-12 grid sm:grid-cols-3 gap-4 text-left w-full max-w-3xl"
        >
          {[
            { title: "Trending drops", copy: "Fresh edits and capsule looks updated weekly." },
            { title: "Hyper-fast fitting", copy: "AI-powered recommendations tuned to your vibe." },
            { title: "Zero-hassle rentals", copy: "Pickup, delivery, and returns built in." },
          ].map((item) => (
            <div key={item.title} className="p-4 rounded-2xl border border-border/70 bg-card/70 backdrop-blur">
              <p className="font-semibold mb-1">{item.title}</p>
              <p className="text-sm text-muted-foreground">{item.copy}</p>
            </div>
          ))}
        </motion.div>
      </main>
    </div>
  );
};

export default NotFound;
