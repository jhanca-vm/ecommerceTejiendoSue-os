import { useEffect, useMemo, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/apiClient";
import { AuthContext } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";

// Hook para debounce
const useDebounced = (value, delay = 400) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

export default function AdminUsersPage() {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Seguridad: solo admins
  useEffect(() => {
    if (!user || user.role !== "admin") {
      showToast("Acceso restringido a administradores", "warning");
      navigate("/");
    }
  }, [user, navigate, showToast]);

  // Filtros y estado
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [verified, setVerified] = useState("all");
  const [sort, setSort] = useState("createdAt:desc");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);

  const debouncedQ = useDebounced(q, 400);

  // Construcción de parámetros
  const params = useMemo(() => {
    const p = { page, limit, sort };
    if (debouncedQ.trim()) p.q = debouncedQ.trim();
    if (role !== "all") p.role = role;
    if (verified !== "all") p.verified = verified;
    return p;
  }, [page, limit, sort, debouncedQ, role, verified]);

  // Fetch de usuarios
  useEffect(() => {
    let cancel = false;
    setLoading(true);
    api
      .get("/admin/users", { params })
      .then(({ data }) => {
        if (cancel) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
        setTotal(Number(data?.total || 0));
      })
      .catch(() => {
        if (cancel) return;
        setItems([]);
        setTotal(0);
        showToast("Error al cargar usuarios", "error");
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [params, showToast]);

  // Reiniciar página al cambiar filtros
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, role, verified, limit, sort]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="ao">
      <section className=" ">
        <h1>Usuarios</h1>

        <div className="filters af">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o email…"
          />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="all">Rol: todos</option>
            <option value="user">Usuario</option>
            <option value="admin">Administrador</option>
          </select>
          <select
            value={verified}
            onChange={(e) => setVerified(e.target.value)}
          >
            <option value="all">Verificación: todos</option>
            <option value="1">Verificados</option>
            <option value="0">No verificados</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="createdAt:desc">Recientes primero</option>
            <option value="createdAt:asc">Antiguos primero</option>
            <option value="name:asc">Nombre A→Z</option>
            <option value="name:desc">Nombre Z→A</option>
            <option value="email:asc">Email A→Z</option>
            <option value="email:desc">Email Z→A</option>
          </select>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            <option value={10}>10 / pág</option>
            <option value={20}>20 / pág</option>
            <option value={50}>50 / pág</option>
            <option value={100}>100 / pág</option>
          </select>
        </div>

        <div className="summary">
          {loading ? "Cargando…" : `Total: ${total} usuarios`}
        </div>

        <div className="tableWrap">
          <table className="table table-wrap ">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Verificado</th>
                <th>Creado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5}>Cargando…</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5}>Sin resultados</td>
                </tr>
              ) : (
                items.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      <span
                        className={`badge ${
                          u.role === "admin" ? "badge--admin" : "badge--user"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td>
                      {u.isVerified ? (
                        <span className="badge badge--ok">Sí</span>
                      ) : (
                        <span className="badge badge--warn">No</span>
                      )}
                    </td>
                    <td>
                      {u.createdAt
                        ? new Date(u.createdAt).toLocaleString()
                        : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="pager">
          <button
            className="btn btn--ghost"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Anterior
          </button>
          <span>
            Pág. {page} / {totalPages}
          </span>
          <button
            className="btn btn--ghost"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Siguiente →
          </button>
        </div>
      </section>
    </div>
  );
}
