import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@popclozet/api-client";
import { useAuth } from "@/hooks/useAuth";
import { locationStorage } from "@/lib/locationStorage";
import { motion } from "framer-motion";
import { MobileShell } from "@/components/layout/MobileShell";
import { ChevronLeft, MapPin, Plus, Check } from "lucide-react";
import { getLocalAddresses, ValidatedAddress } from "@/services/addressService";
import { cn } from "@/lib/utils";

const dmSans = { fontFamily: "'DM Sans', sans-serif" };

const AddressSelectionPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const returnTo = location.state?.returnTo || null;
  const [addresses, setAddresses] = useState<ValidatedAddress[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchAddresses = async () => {
      // 1. Get from localStorage (recent)
      const local = getLocalAddresses();
      
      // 2. Get from Supabase if logged in
      let dbAddresses: ValidatedAddress[] = [];
      if (user) {
        const { data, error } = await supabase
          .from('addresses')
          .select('*')
          .eq('user_id', user.id)
          .order('is_default', { ascending: false });
        
        if (data) {
          dbAddresses = data.map(addr => ({
            lat: addr.latitude,
            lng: addr.longitude,
            formattedAddress: addr.full_address,
            label: addr.label,
            pincode: addr.pincode,
            city: addr.city
          }));
        }
      }

      // Merge and remove duplicates by address string
      const merged = [...dbAddresses];
      local.forEach(l => {
        if (!merged.find(m => m.formattedAddress === l.formattedAddress)) {
          merged.push(l);
        }
      });

      setAddresses(merged);
      if (merged.length > 0) {
        setSelectedIdx(0);
      }
    };

    fetchAddresses();
  }, [user]);

  const handleProceed = async () => {
    if (selectedIdx !== null) {
      setIsSaving(true);
      const addr = addresses[selectedIdx];
      
      let deliveryEstimate: '15min' | 'delayed' = '15min';
      const WAREHOUSE = { lat: 19.1306, lng: 72.9155 };

      // Calculate road distance via backend proxy (same as CheckoutPage)
      try {
        const { getRoadDistance } = await import("@/services/mapServices");
        const res = await getRoadDistance(WAREHOUSE, {
          lat: addr.lat,
          lng: addr.lng,
          eLoc: addr.eLoc
        });
        if (res.status === 'success') {
          deliveryEstimate = res.distanceKm > 6 ? 'delayed' : '15min';
          console.log(`🛣️ Distance: ${res.distanceKm.toFixed(2)}km -> ${deliveryEstimate}`);
        } else {
          console.warn('Distance API returned error:', res.error);
        }
      } catch (err) {
        console.warn('Distance calculation failed:', err);
      }

      // 1. Save to locationStorage for Home page display
      locationStorage.set({
        source: "gps",
        lat: addr.lat,
        lng: addr.lng,
        city: addr.city || addr.formattedAddress.split(',')[0].trim(),
        locality: addr.label || 'Home',
        delivery_estimate: deliveryEstimate
      });

      // 2. If user is logged in, mark as default in DB + update estimate in profile
      if (user) {
        // First reset all defaults
        await supabase
          .from('addresses')
          .update({ is_default: false })
          .eq('user_id', user.id);
        
        // Then set this one as default
        await supabase
          .from('addresses')
          .update({ is_default: true })
          .eq('user_id', user.id)
          .eq('full_address', addr.formattedAddress);

        // Update profile with the new estimate
        const { updateProfile } = await import("@/services/profileService");
        try {
          await updateProfile({ delivery_estimate: deliveryEstimate });
        } catch (err) {
          // Gracefully handle if column missing
          console.warn('Could not save delivery_estimate to profile:', err);
        }
      }

      setIsSaving(false);
      
      // 3. Redirect back to returnTo or checkout
      if (returnTo) {
        navigate(returnTo);
      } else {
        navigate("/checkout", { state: { selectedAddress: addr } });
      }
    }
  };

  return (
    <div className="bg-[#050505] min-h-screen text-white">
      <header className="sticky top-0 z-50 bg-[#111111]/90 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 -ml-1 rounded-full hover:bg-white/5 transition-all active:scale-95">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg md:text-2xl font-black tracking-tighter" style={dmSans}>
          Select Address
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-28 md:px-5 md:pt-6 md:pb-32">
        <div className="space-y-6">
          {/* Saved Addresses Section */}
          <div>
            <h2 className="text-[10px] md:text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 md:mb-4">
              Saved Addresses
            </h2>
            
            <div className="space-y-3">
              {addresses.map((addr, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedIdx(idx)}
                  className={cn(
                    "w-full text-left p-3 md:p-4 rounded-2xl md:rounded-3xl border transition-all duration-300",
                    selectedIdx === idx 
                      ? "bg-[#f2546d]/10 border-[#f2546d] shadow-[0_0_20px_rgba(242,84,109,0.1)]" 
                      : "bg-[#1A1A1A] border-white/5 hover:border-white/10"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0",
                      selectedIdx === idx ? "bg-[#f2546d] text-white" : "bg-zinc-800 text-zinc-500"
                    )}>
                      <MapPin className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                        Home / Other
                      </p>
                      <p className="text-xs md:text-sm font-bold text-white leading-relaxed line-clamp-2" style={dmSans}>
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
            onClick={() => navigate(`/map?returnTo=${returnTo || "/checkout"}`)}
            className="w-full p-3 md:p-5 rounded-2xl md:rounded-3xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-all flex items-center gap-3 group"
          >
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-zinc-800 flex items-center justify-center group-hover:bg-[#f2546d]/20 group-hover:text-[#f2546d] transition-colors">
              <Plus className="w-4 h-4 md:w-5 md:h-5" />
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
          disabled={selectedIdx === null || isSaving}
          className={cn(
            "w-full h-12 md:h-14 flex items-center justify-center rounded-2xl md:rounded-[20px] font-black text-base md:text-lg transition-all shadow-xl",
            (selectedIdx !== null && !isSaving)
              ? "bg-[#f2546d] text-white shadow-[#f2546d]/20 active:scale-[0.98]" 
              : "bg-zinc-800 text-zinc-500 opacity-50 cursor-not-allowed"
          )}
          style={dmSans}
        >
          {isSaving ? "SAVING..." : "CONFIRM ADDRESS"}
        </button>
      </footer>
    </div>
  );
};

export default AddressSelectionPage;
