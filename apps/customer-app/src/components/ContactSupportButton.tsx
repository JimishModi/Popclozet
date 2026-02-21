// src/components/ContactSupportButton.tsx
import React from "react";
import { useNavigate } from "react-router-dom";

export default function ContactSupportButton() {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate("/signup")}
      className="inline-block rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-sm hover:shadow-md transition"
      type="button"
    >
      Contact Support
    </button>
  );
}
