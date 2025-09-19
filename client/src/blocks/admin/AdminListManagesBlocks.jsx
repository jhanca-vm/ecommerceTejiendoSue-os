// src/blocks/admin/AdminListManagesBlocks.jsx
import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaTimesCircle, FaPlusCircle } from "react-icons/fa";

import api, { cancelAllActiveRequests } from "../../api/apiClient";
import { useToast } from "../../contexts/ToastContext";

/**
 * AdminListManager
 * Props:
 *  - title: string (visible)
 *  - path: string -> ej: "/sizes", "/colors", "/categories"
 *  - fieldName: string -> ej: "label" | "name"
 *  - idField?: string -> por defecto "_id"
 *  - normalizeIn?: (item) => item
 *  - normalizeOut?: (payload) => payload
 */
const AdminListManager = ({
  title = "Gestión",
  path = "/sizes",
  fieldName = "label",
  idField = "_id",
  normalizeIn,
  normalizeOut,
}) => {
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [newValue, setNewValue] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const mountedRef = useRef(true);

  const singular = useMemo(() => {
    return title?.endsWith("s") ? title.slice(0, -1) : title || "ítem";
  }, [title]);

  const safeNormalizeIn = useMemo(
    () => (typeof normalizeIn === "function" ? normalizeIn : (x) => x),
    [normalizeIn]
  );
  const safeNormalizeOut = useMemo(
    () => (typeof normalizeOut === "function" ? normalizeOut : (x) => x),
    [normalizeOut]
  );

  // Normaliza path para no duplicar /api
  const norm = (p = "") => {
    let u = String(p).trim();
    u = u.replace(/^https?:\/\/[^/]+/i, "");
    u = u.replace(/^\/?api(\/|$)/i, "/");
    if (!u.startsWith("/")) u = `/${u}`;
    return u;
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchItems();
    return () => {
      mountedRef.current = false;
      try {
        cancelAllActiveRequests();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(norm(path));
      const arr = Array.isArray(data) ? data : data?.items || [];
      const cleaned = arr.map(safeNormalizeIn);
      if (mountedRef.current) setItems(cleaned);
    } catch (err) {
      const msg = err?.response?.data?.error || "Error al cargar elementos";
      showToast(msg, "error");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const handleCreate = async () => {
    const value = String(newValue || "").trim();
    if (!value) {
      showToast(`Ingresa un(a) ${singular.toLowerCase()}.`, "warning");
      return;
    }
    const exists = items.some(
      (it) => String(it[fieldName] || "").toLowerCase() === value.toLowerCase()
    );
    if (exists) {
      showToast(`${singular} ya existe.`, "warning");
      return;
    }

    setLoading(true);
    try {
      const payload = safeNormalizeOut({ [fieldName]: value });
      const { data } = await api.post(norm(path), payload);
      const created = safeNormalizeIn(data?.item || data);
      if (mountedRef.current) {
        setItems((prev) => [created, ...prev]);
        setNewValue("");
        showToast(`${singular} creado con éxito`, "success");
      }
    } catch (err) {
      const msg = err?.response?.data?.error || "Error al crear";
      showToast(msg, "error");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item?.[idField]);
    setEditingValue(item?.[fieldName] ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingValue("");
  };

  const handleUpdate = async (id) => {
    const value = String(editingValue || "").trim();
    if (!value) {
      showToast("El valor no puede estar vacío.", "warning");
      return;
    }
    const exists = items.some(
      (it) =>
        String(it[idField]) !== String(id) &&
        String(it[fieldName] || "").toLowerCase() === value.toLowerCase()
    );
    if (exists) {
      showToast(`${singular} ya existe.`, "warning");
      return;
    }

    setLoading(true);
    try {
      const payload = safeNormalizeOut({ [fieldName]: value });
      const { data } = await api.put(`${norm(path)}/${id}`, payload);
      const updated = safeNormalizeIn(data?.item || data);
      if (mountedRef.current) {
        setItems((prev) =>
          prev.map((it) => (String(it[idField]) === String(id) ? updated : it))
        );
        cancelEdit();
        showToast(`${singular} actualizado`, "success");
      }
    } catch (err) {
      const msg = err?.response?.data?.error || "Error al actualizar";
      showToast(msg, "error");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      await api.delete(`${norm(path)}/${id}`);
      if (mountedRef.current) {
        setItems((prev) =>
          prev.filter((it) => String(it[idField]) !== String(id))
        );
        showToast(`${singular} eliminado`, "success");
        setConfirmDeleteId(null);
      }
    } catch (err) {
      const msg = err?.response?.data?.error || "Error al eliminar";
      showToast(msg, "error");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const onKeyDownEdit = (e, id) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleUpdate(id);
    }
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  };

  const handleCancel = () => {
    navigate("/admin/products");
  };

  return (
    <div className="alm-container">
      <div className="alm-header">
        <h2>Administrar {title}</h2>
        {loading && <span className="alm-badge">Cargando…</span>}
      </div>

      <div className="alm-form-row">
        <input
          type="text"
          placeholder={`Nueva ${singular.toLowerCase()}`}
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          disabled={loading}
        />
        <button
          className="btn btn--primary"
          onClick={handleCreate}
          disabled={loading}
          title={`Crear ${singular.toLowerCase()}`}
        >
          <FaPlusCircle style={{ marginRight: 6 }} />
          Agregar
        </button>
        <button
          className="btn btn--muted"
          onClick={handleCancel}
          title="Cancelar y volver"
          disabled={loading}
        >
          <FaTimesCircle style={{ marginRight: 6 }} />
          Cancelar
        </button>
      </div>

      <div className="alm-table-wrap">
        <table className="alm-table">
          <thead>
            <tr>
              <th>{singular}</th>
              <th className="col-actions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={2} className="empty-row">
                  No hay {title.toLowerCase()}.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const id = item?.[idField];
                const isEditing = String(editingId) === String(id);
                return (
                  <tr key={id}>
                    <td>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={(e) => onKeyDownEdit(e, id)}
                          autoFocus
                        />
                      ) : (
                        <span className="alm-item-text">
                          {item?.[fieldName]}
                        </span>
                      )}
                    </td>
                    <td className="actions">
                      {isEditing ? (
                        <>
                          <button
                            className="btn btn--primary btn-sm"
                            onClick={() => handleUpdate(id)}
                            disabled={loading || !editingValue.trim()}
                            title="Guardar cambios"
                          >
                            Guardar
                          </button>
                          <button
                            className="btn btn--muted btn-sm"
                            onClick={cancelEdit}
                            disabled={loading}
                            title="Cancelar edición"
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn btn--ghost btn-sm"
                            onClick={() => startEdit(item)}
                            disabled={loading}
                            title="Editar"
                          >
                            Editar
                          </button>
                          <button
                            className="btn btn--danger btn-sm"
                            onClick={() => setConfirmDeleteId(id)}
                            disabled={loading}
                            title="Eliminar"
                          >
                            Eliminar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {confirmDeleteId && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h3>Eliminar {singular.toLowerCase()}</h3>
            <p>¿Seguro que deseas eliminar este {singular.toLowerCase()}?</p>
            <div className="modal-actions">
              <button
                className="btn btn--muted"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancelar
              </button>
              <button
                className="btn btn--danger"
                onClick={() => handleDelete(confirmDeleteId)}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminListManager;
