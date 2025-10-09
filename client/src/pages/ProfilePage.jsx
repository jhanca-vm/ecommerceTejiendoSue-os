import { useEffect, useState, useContext } from "react";
import api from "../api/apiClient";
import { AuthContext } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { getBaseUrl } from "../api/apiClient";

export default function ProfilePage() {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    role: "",
    isVerified: false,
    phone: "",
    avatar: { full: "", thumb: "" },
    address: {
      line1: "",
      line2: "",
      city: "",
      state: "",
      zip: "",
      country: "",
    },
  });

  const [pw, setPw] = useState({
    currentPassword: "",
    newPassword: "",
    repeat: "",
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const base = getBaseUrl();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("users/me");
        setProfile((p) => ({
          ...p,
          ...data,
          address: { ...p.address, ...(data.address || {}) },
        }));
      } catch {
        showToast("No se pudo cargar tu perfil", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [showToast]);

  const onSaveInfo = async (e) => {
    e.preventDefault();
    try {
      const { name, phone, address } = profile;
      const { data } = await api.patch("users/me", { name, phone, address });
      setProfile((p) => ({ ...p, ...data }));
      showToast("Perfil actualizado", "success");
    } catch {
      showToast("No se pudo actualizar el perfil", "error");
    }
  };

  const onChangePw = async (e) => {
    e.preventDefault();
    if (!pw.currentPassword || !pw.newPassword || !pw.repeat) {
      return showToast("Completa todos los campos de contraseña", "warning");
    }
    if (pw.newPassword !== pw.repeat) {
      return showToast("Las nuevas contraseñas no coinciden", "warning");
    }
    try {
      await api.patch("users/me/password", {
        currentPassword: pw.currentPassword,
        newPassword: pw.newPassword,
      });
      setPw({ currentPassword: "", newPassword: "", repeat: "" });
      showToast("Contraseña actualizada", "success");
    } catch (err) {
      showToast(
        err?.response?.data?.error || "No se pudo cambiar la contraseña",
        "error"
      );
    }
  };

  const onUploadAvatar = async () => {
    if (!avatarFile) return;
    try {
      const fd = new FormData();
      fd.append("avatar", avatarFile);
      const { data } = await api.patch("users/me/avatar", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setProfile((p) => ({ ...p, avatar: data.avatar || p.avatar }));
      setAvatarFile(null);
      showToast("Foto actualizada", "success");
    } catch {
      showToast("No se pudo subir el avatar", "error");
    }
  };

  if (!user)
    return (
      <section className="profile">
        <h1>Perfil</h1>
        <p>Inicia sesión para ver tu perfil.</p>
      </section>
    );
  if (loading)
    return (
      <section className="profile">
        <h1>Perfil</h1>
        <p>Cargando…</p>
      </section>
    );

  return (
    <div className="profile__grid ao">
      <h1>Mi Perfil</h1>
      <form onSubmit={onSaveInfo} className="card product-form">
        <h2>Información</h2>
        <label>
          Nombre
          <input
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
          />
        </label>
        <label>
          Email
          <input value={profile.email} disabled />
        </label>
        <label>
          Teléfono
          <input
            value={profile.phone || ""}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
          />
        </label>

        <fieldset>
          <legend>Dirección</legend>
          <label>
            Dirección 1
            <input
              value={profile.address.line1 || ""}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  address: { ...profile.address, line1: e.target.value },
                })
              }
            />
          </label>
          <label>
            Dirección 2
            <input
              value={profile.address.line2 || ""}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  address: { ...profile.address, line2: e.target.value },
                })
              }
            />
          </label>
          <div className="row">
            <label>
              Ciudad
              <input
                value={profile.address.city || ""}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    address: { ...profile.address, city: e.target.value },
                  })
                }
              />
            </label>
            <label>
              Provincia/Estado
              <input
                value={profile.address.state || ""}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    address: { ...profile.address, state: e.target.value },
                  })
                }
              />
            </label>
          </div>
          <div className="row">
            <label>
              CP
              <input
                value={profile.address.zip || ""}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    address: { ...profile.address, zip: e.target.value },
                  })
                }
              />
            </label>
            <label>
              País
              <input
                value={profile.address.country || ""}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    address: { ...profile.address, country: e.target.value },
                  })
                }
              />
            </label>
          </div>
        </fieldset>

        <button className="btn btn--primary" type="submit">
          Guardar cambios
        </button>
      </form>

      <div className="card">
        <h2>Avatar</h2>
        <div className="avatarRow">
          <img
            src={
              profile.avatar.thumb
                ? `${base}${profile.avatar.thumb}`
                : "/placeholder.jpg"
            }
            alt="avatar"
          />
          <div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
            />
            <button
              className="btn"
              type="button"
              onClick={onUploadAvatar}
              disabled={!avatarFile}
            >
              Subir
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={onChangePw} className="card">
        <h2>Contraseña</h2>
        <label>
          Actual
          <input
            type="password"
            value={pw.currentPassword}
            onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
          />
        </label>
        <label>
          Nueva
          <input
            type="password"
            value={pw.newPassword}
            onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
          />
        </label>
        <label>
          Repetir nueva
          <input
            type="password"
            value={pw.repeat}
            onChange={(e) => setPw({ ...pw, repeat: e.target.value })}
          />
        </label>
        <button className="btn btn--primary">Cambiar contraseña</button>
      </form>
    </div>
  );
}
