import { useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const NotFound = () => {
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route");
  }, []);

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center px-6 overflow-hidden relative">

      {/* Ambient glow blobs */}
      <div className="absolute top-[-80px] left-1/2 -translate-x-1/2 w-[420px] h-[420px] rounded-full bg-[#f2546d]/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-60px] right-[-60px] w-[300px] h-[300px] rounded-full bg-[#f2546d]/6 blur-[100px] pointer-events-none" />

      {/* 404 large text */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative select-none"
      >
        <span
          className="text-[140px] sm:text-[180px] font-black leading-none tracking-tighter text-white/[0.04]"
          style={{ WebkitTextStroke: "1.5px rgba(242,84,109,0.15)" }}
        >
          404
        </span>
        {/* Floating hanger icon over the 404 */}
        <motion.div
          initial={{ y: 0 }}
          animate={{ y: [-6, 6, -6] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
            {/* Hanger hook */}
            <path
              d="M36 8V4M32 8C32 5.79 33.79 4 36 4C38.21 4 40 5.79 40 8"
              stroke="#f2546d"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Hanger body */}
            <path
              d="M36 8C36 8 12 28 8 34C4 40 8 46 16 46H56C64 46 68 40 64 34C60 28 36 8 36 8Z"
              stroke="#f2546d"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </motion.div>
      </motion.div>

      {/* Label badge */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="mt-2 px-4 py-1.5 rounded-full border border-[#f2546d]/25 bg-[#f2546d]/10 text-[#f2546d] text-xs font-bold uppercase tracking-widest"
      >
        Outfit Not Found
      </motion.div>

      {/* Heading */}
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="mt-6 text-3xl sm:text-4xl font-black text-white tracking-tight text-center leading-tight"
      >
        This look took
        <br />
        a different runway
      </motion.h1>

      {/* Subtext */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="mt-4 text-sm text-zinc-500 text-center max-w-[280px] leading-relaxed"
      >
        The page you're looking for doesn't exist or has been moved. Let's get you back to the closet.
      </motion.p>

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="mt-10 flex flex-col sm:flex-row items-center gap-3 w-full max-w-[320px]"
      >
        <button
          onClick={() => navigate("/home")}
          className="w-full h-12 rounded-2xl bg-[#f2546d] text-white text-sm font-bold tracking-tight hover:bg-[#e0404c] transition-colors active:scale-95"
        >
          Back to Home
        </button>
        <button
          onClick={() => navigate(-1)}
          className="w-full h-12 rounded-2xl border border-[#303030] bg-[#1a1a1a] text-zinc-300 text-sm font-semibold tracking-tight hover:bg-[#222] transition-all active:scale-95"
        >
          Go Back
        </button>
      </motion.div>

      {/* Divider */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="mt-14 flex items-center gap-3 w-full max-w-[320px]"
      >
        <div className="flex-1 h-px bg-[#232323]" />
        <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">or explore</span>
        <div className="flex-1 h-px bg-[#232323]" />
      </motion.div>

      {/* Quick links */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.75 }}
        className="mt-6 flex gap-3 flex-wrap justify-center max-w-[340px]"
      >
        {[
          { label: "Shop Women", path: "/shop/womens" },
          { label: "Shop Men", path: "/shop/mens" },
          { label: "Brands", path: "/brands" },
          { label: "Search", path: "/search" },
        ].map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="px-4 py-2 rounded-full bg-[#1c1c1c] border border-[#2a2a2a] text-xs font-bold text-zinc-400 hover:text-white hover:border-[#f2546d]/30 transition-all"
          >
            {item.label}
          </button>
        ))}
      </motion.div>

    </div>
  );
};

export default NotFound;
