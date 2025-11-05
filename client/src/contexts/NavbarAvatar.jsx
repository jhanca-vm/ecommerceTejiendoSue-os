// src/components/UserAvatar.jsx
import { useEffect, useState } from "react";
import api, { getBaseUrl } from "../api/apiClient";

export default function UserAvatar({ user, fallbackName = "U" }) {
  const [name, setName] = useState(user?.name || fallbackName);
  const [thumb, setThumb] = useState(user?.avatar?.thumb || "");
  const base = getBaseUrl();

  useEffect(() => {
    let cancel = false;

    const hydrate = async () => {
      try {
        if (thumb) return;
        const { data } = await api.get("users/me");
        if (cancel) return;

        setName(data?.name || name);
        if (data?.avatar?.thumb) {
          setThumb(data.avatar.thumb);
        }
      } catch {
        // Silencioso
      }
    };

    hydrate();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const safeURL = (p) => {
    if (!p) return "";
    return /^https?:\/\//i.test(p) ? p : `${base}${p}`;
  };

  const cacheBust = (u) =>
    u ? `${u}${u.includes("?") ? "&" : "?"}v=${Date.now()}` : "";
  const url = thumb ? cacheBust(safeURL(thumb)) : "";
  const initial = (name || fallbackName).trim().charAt(0).toUpperCase();

  return url ? (
    <img
      className="user-avatar__img"
      src={url}
      alt={name}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  ) : (
    <span className="user-avatar__initial" aria-label={name} title={name}>
      {initial || "U"}
    </span>
  );
}
