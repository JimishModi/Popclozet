import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, MapPin } from "lucide-react";

import { MobileShell } from "@/components/layout/MobileShell";
import { useAuth } from "@/hooks/useAuth";
import type { ValidatedAddress } from "@/services/addressService";
import {
  buildManualAddressSummary,
  getCheckoutAddressContext,
  isManualAddressComplete,
  normalizeManualAddressDetails,
  saveCheckoutAddressContext,
  type ManualAddressDetails,
} from "@/lib/addressAccuracy";

const dmSans = { fontFamily: "'DM Sans', sans-serif" };

type AddressAccuracyState = {
  selectedAddress?: ValidatedAddress;
  manualAddressDetails?: ManualAddressDetails | null;
  nextRoute?: string;
  forwardState?: Record<string, unknown>;
};

const createInitialForm = (
  profile: { full_name?: string | null; phone?: string | null } | null,
  existing?: ManualAddressDetails | null,
  selectedAddress?: ValidatedAddress | null
): ManualAddressDetails => ({
  contactName: existing?.contactName || profile?.full_name || "",
  phoneNumber: existing?.phoneNumber || profile?.phone || "",
  houseNumber: existing?.houseNumber || "",
  streetAddress: existing?.streetAddress || "",
  landmark: existing?.landmark || "",
  city: existing?.city || selectedAddress?.city || "",
  pincode: existing?.pincode || selectedAddress?.pincode || "",
});

export default function AddressAccuracyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();

  const routeState = (location.state || {}) as AddressAccuracyState;
  const storedContext = getCheckoutAddressContext();

  const selectedAddress =
    routeState.selectedAddress || storedContext?.selectedAddress || null;
  const nextRoute = routeState.nextRoute || "/checkout";
  const forwardState = routeState.forwardState || {};

  const initialDetails = useMemo(
    () =>
      createInitialForm(
        profile,
        routeState.manualAddressDetails || storedContext?.manualAddressDetails,
        selectedAddress
      ),
    [profile, routeState.manualAddressDetails, selectedAddress, storedContext]
  );

  const [form, setForm] = useState<ManualAddressDetails>(initialDetails);

  useEffect(() => {
    setForm(initialDetails);
  }, [initialDetails]);

  useEffect(() => {
    if (!selectedAddress) {
      navigate("/checkout/address", { replace: true });
    }
  }, [navigate, selectedAddress]);

  if (!selectedAddress) {
    return null;
  }

  const handleChange =
    (field: keyof ManualAddressDetails) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const isFormValid = useMemo(() => isManualAddressComplete(form), [form]);

  const handleContinue = () => {
    if (!isFormValid) return;

    const normalizedManualAddressDetails = normalizeManualAddressDetails(form);

    saveCheckoutAddressContext({
      selectedAddress,
      manualAddressDetails: normalizedManualAddressDetails,
    });

    navigate(nextRoute, {
      state: {
        ...forwardState,
        selectedAddress,
        manualAddressDetails: normalizedManualAddressDetails,
      },
    });
  };

  const manualSummary = buildManualAddressSummary(form);

  return (
    <MobileShell className="bg-[#111111] text-white" hideBottomNav>
      <main className="flex-1 overflow-y-auto px-5 pt-14 pb-28">
        <header className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center transition-all active:scale-95"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-white" style={dmSans}>
              Delivery Details
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Thodi extra detail dene se rider ko exact spot dhoondhne me help milegi.
            </p>
          </div>
        </header>

        <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-[#f2546d]" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white">
              Address Fetched
            </h2>
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed">
            {selectedAddress.formattedAddress}
          </p>
        </section>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                Name <span className="text-[#f2546d] ml-1">*</span>
              </span>
              <input
                value={form.contactName}
                onChange={handleChange("contactName")}
                placeholder="Customer name"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-sm text-white outline-none focus:border-[#f2546d]"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                Phone Number <span className="text-[#f2546d] ml-1">*</span>
              </span>
              <input
                value={form.phoneNumber}
                onChange={handleChange("phoneNumber")}
                placeholder="Contact number"
                inputMode="tel"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-sm text-white outline-none focus:border-[#f2546d]"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                House / Flat Number <span className="text-[#f2546d] ml-1">*</span>
              </span>
              <input
                value={form.houseNumber}
                onChange={handleChange("houseNumber")}
                placeholder="Flat no, building name"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-sm text-white outline-none focus:border-[#f2546d]"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                Street / Area <span className="text-[#f2546d] ml-1">*</span>
              </span>
              <textarea
                value={form.streetAddress}
                onChange={handleChange("streetAddress")}
                placeholder="Street, society, area"
                rows={3}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-sm text-white outline-none focus:border-[#f2546d] resize-none"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                Landmark <span className="text-[#f2546d] ml-1">*</span>
              </span>
              <input
                value={form.landmark}
                onChange={handleChange("landmark")}
                placeholder="Nearby landmark"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-sm text-white outline-none focus:border-[#f2546d]"
              />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                  City <span className="text-[#f2546d] ml-1">*</span>
                </span>
                <input
                  value={form.city}
                  onChange={handleChange("city")}
                  placeholder="City"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-sm text-white outline-none focus:border-[#f2546d]"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                  Pincode <span className="text-[#f2546d] ml-1">*</span>
                </span>
                <input
                  value={form.pincode}
                  onChange={handleChange("pincode")}
                  placeholder="Pincode"
                  inputMode="numeric"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-sm text-white outline-none focus:border-[#f2546d]"
                />
              </label>
            </div>
          </div>
        </div>

        {manualSummary && (
          <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 mt-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">
              Manual Address
            </p>
            <p className="text-sm text-zinc-300 leading-relaxed">{manualSummary}</p>
          </section>
        )}
      </main>

      <div className="sticky bottom-0 px-5 py-6 bg-gradient-to-t from-[#111111] via-[#111111] to-transparent">
        <button
          onClick={handleContinue}
          disabled={!isFormValid}
          className={`w-full h-14 rounded-2xl text-white text-lg font-bold shadow-lg transition-all ${
            isFormValid
              ? "bg-[#f2546d] shadow-[#f2546d]/20 active:scale-[0.98]"
              : "bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50"
          }`}
        >
          Continue
        </button>
      </div>
    </MobileShell>
  );
}
