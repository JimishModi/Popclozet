import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MobileShell } from "@/components/layout/MobileShell";
import { ChevronLeft, MapPin, Plus, Check } from "lucide-react";
import { getLocalAddresses, ValidatedAddress } from "@/services/addressService";
import { cn } from "@/lib/utils";

const dmSans = { fontFamily: "'DM Sans', sans-serif" };

const AddressSelectionPage = () => {
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<ValidatedAddress[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  useEffect(() => {
    const saved = getLocalAddresses();
    setAddresses(saved);
    if (saved.length > 0) {
      setSelectedIdx(0);
    }
  }, []);

  const handleProceed = () => {
    if (selectedIdx !== null) {
      // Pass the address to checkout. We can use index or stringify.
      // Stringifying the address object and passing it via state is cleaner.
      const addr = addresses[selectedIdx];
      navigate("/checkout", { state: { selectedAddress: addr } });
    }
  };

  return (
    <MobileShell className="bg-[#111111] text-white">
      <header className="sticky top-0 z-50 bg-[#111111]/90 backdrop-blur-md border-b border-white/5 px-5 py-4 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-white/5 transition-all active:scale-95">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-black tracking-tighter" style={dmSans}>
          Select Address
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto px-5 pt-6 pb-32">
        <div className="space-y-6">
          {/* Saved Addresses Section */}
          <div>
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">
              Saved Addresses
            </h2>
            
            <div className="space-y-3">
              {addresses.map((addr, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedIdx(idx)}
                  className={cn(
                    "w-full text-left p-4 rounded-3xl border transition-all duration-300",
                    selectedIdx === idx 
                      ? "bg-[#f2546d]/10 border-[#f2546d] shadow-[0_0_20px_rgba(242,84,109,0.1)]" 
                      : "bg-[#1A1A1A] border-white/5 hover:border-white/10"
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0",
                      selectedIdx === idx ? "bg-[#f2546d] text-white" : "bg-zinc-800 text-zinc-500"
                    )}>
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                        Home / Other
                      </p>
                      <p className="text-sm font-bold text-white leading-relaxed line-clamp-2" style={dmSans}>
                        {addr.formattedAddress}
                      </p>
                    </div>
                    {selectedIdx === idx && (
                      <div className="w-6 h-6 rounded-full bg-[#f2546d] flex items-center justify-center shrink-0">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </button>
              ))}

              {addresses.length === 0 && (
                <div className="py-8 text-center bg-[#1A1A1A] rounded-3xl border border-dashed border-white/10">
                  <p className="text-zinc-500 text-sm font-medium">No saved addresses found</p>
                </div>
              )}
            </div>
          </div>

          {/* New Address Option */}
          <button 
            onClick={() => navigate("/map?returnTo=/checkout")}
            className="w-full p-5 rounded-3xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-all flex items-center gap-4 group"
          >
            <div className="w-10 h-10 rounded-2xl bg-zinc-800 flex items-center justify-center group-hover:bg-[#f2546d]/20 group-hover:text-[#f2546d] transition-colors">
              <Plus className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-white" style={dmSans}>Use a Different Address</p>
              <p className="text-xs text-zinc-500 mt-0.5">Pick from map or search location</p>
            </div>
          </button>
        </div>
      </main>

      <footer className="px-6 pb-10 pt-2 bg-gradient-to-t from-black via-black/90 to-transparent">
        <button
          onClick={handleProceed}
          disabled={selectedIdx === null}
          className={cn(
            "w-full h-14 flex items-center justify-center rounded-[20px] font-black text-lg transition-all shadow-xl",
            selectedIdx !== null 
              ? "bg-[#f2546d] text-white shadow-[#f2546d]/20 active:scale-[0.98]" 
              : "bg-zinc-800 text-zinc-500 opacity-50 cursor-not-allowed"
          )}
          style={dmSans}
        >
          CONFIRM ADDRESS
        </button>
      </footer>
    </MobileShell>
  );
};

export default AddressSelectionPage;
