import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import apiUrl from "../api/apiClient";

const url = "https://checkout.wompi.co/widget.js";
const reference = crypto.randomUUID();

export default function useWompi() {
  const ref = useRef(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const amountInCents = useMemo(
    () => (location.state?.total || 0) * 100,
    [location.state.total],
  );

  useEffect(() => {
    const script = document.createElement("script");

    script.src = url;
    script.onload = async () => {
      const { data } = await apiUrl.post("wompi/integrity-signature", {
        reference,
        amount: amountInCents,
      });

      ref.current = new window.WidgetCheckout({
        currency: "COP",
        amountInCents,
        reference,
        publicKey: import.meta.env.VITE_PUBLIC_KEY,
        signature: { integrity: data },
      });

      setLoading(false);
    };

    document.head.appendChild(script);

    return () => document.head.querySelector(`script[src="${url}"]`).remove();
  }, [amountInCents]);

  return { ref, loading };
}
