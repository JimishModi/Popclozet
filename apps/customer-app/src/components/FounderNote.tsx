import { motion } from "framer-motion";
import { MessageCircle, Calendar, Leaf } from "lucide-react";

const FounderNote = () => {
  return (
    <section className="py-20 md:py-28 bg-gradient-to-b from-background via-primary/5 to-background relative overflow-hidden">
      <div className="container-custom">
        <div className="grid lg:grid-cols-[1.2fr,1fr] gap-12 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Founder Story</p>
            <h2 className="text-3xl md:text-4xl font-playfair font-bold leading-tight">
              Why we built <span className="text-gradient-brand">an endless closet</span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              "I started Popclozet from a simple, recurring panic: 'I have a closet full of clothes, but nothing to wear.' I was tired of spending money on trendy outfits I'd wear once... Popclozet is the solution I always wanted an endless, sustainable closet that gives you the freedom to wear a new outfit for every new plan. Why limit your style?".
            </p>
            <div className="flex items-center gap-4">
              <div className="h-px w-16 bg-primary" />
              <div>
                <p className="font-semibold text-foreground">Viraj Pondkule & Vraj Shah</p>
                <p className="text-sm text-muted-foreground">Co-founders, Popclozet</p>
              </div>
            </div>

            {/* Stats */}
            
            
          </motion.div>

          {/* Right Side - Simple Clean Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex justify-center"
          >
            <div className="relative max-w-sm w-full">
              {/* Clean Card */}
              <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-2xl">
                {/* Image */}
                <div className="relative h-80">
                  <img
                    src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=800&auto=format&fit=crop"
                    alt="Popclozet Team"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
                </div>

                {/* Content */}
                <div className="p-6 -mt-16 relative">
                  <h3 className="text-xl font-bold text-white mb-1">Popclozet Collective</h3>
                  <p className="text-slate-400 text-sm mb-4">Team of stylists & ops</p>

                  {/* Info Bar */}
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/10 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                        <span className="text-white text-xs font-bold">PC</span>
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">@popclozet</p>
                        <p className="text-slate-400 text-xs">Available for styling chats</p>
                      </div>
                    </div>
                    <a
  href="mailto:Vraj.s@popclozet.com"
  className="px-4 py-2 bg-white text-slate-900 rounded-full text-sm font-semibold hover:bg-slate-100 transition-colors"
>
  Book Call!!
</a>

                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default FounderNote;
