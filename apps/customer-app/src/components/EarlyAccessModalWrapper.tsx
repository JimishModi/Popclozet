import { useEffect } from "react";

function EarlyAccessModalWrapper({ children, onClose }: { children: React.ReactNode; onClose: () => void; }) {
  useEffect(() => {
    document.body.classList.add("overflow-hidden");
    return () => document.body.classList.remove("overflow-hidden");
  }, []);

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      {/* overlay */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* center container - no width constraint, let children control their own width */}
      <div className="relative flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

export default EarlyAccessModalWrapper;
