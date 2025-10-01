// src/pages/AdminInboxPage
import { useEffect, useState, useContext } from "react";

import apiUrl from "../api/apiClient";

import { AuthContext } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { socket } from "../socket";

const AdminInboxPage = () => {
  const { token } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();

  const ITEMS_PER_PAGE = 5;

  const fetchInbox = async () => {
    setLoading(true);
    try {
      const res = await apiUrl.get(
        "messages/inbox/admin",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setUsers(res.data);
    } catch (err) {
      console.error("Error al cargar el inbox", err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (userId, status) => {
    try {
      await apiUrl.post(
        "messages/status",
        { userId, status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchInbox();
    } catch (err) {
      console.error("Error al actualizar estado", err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchInbox();
      socket.on("adminInboxUpdate", fetchInbox);
      return () => socket.off("adminInboxUpdate");
    }
  }, [token]);

  const filteredUsers = users.filter((u) => {
    const searchMatch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const filterMatch =
      filter === "all" ||
      (filter === "unread" && u.unread) ||
      (filter === "read" && !u.unread);
    return searchMatch && filterMatch;
  });

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePageChange = (direction) => {
    if (direction === "prev" && currentPage > 1) {
      setCurrentPage(currentPage - 1);
    } else if (direction === "next" && currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filter]);

  return (
    <div className="admin-inbox-container">
      <h2>📨 Conversaciones de Soporte</h2>

      <div className="inbox-controls" style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <input
          type="text"
          placeholder="Buscar por nombre o correo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
          style={{ flex: 2, padding: "0.4rem", border: "1px solid #ccc", borderRadius: "4px" }}
        />

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="filter-select"
          style={{ flex: 1, padding: "0.4rem", border: "1px solid #ccc", borderRadius: "4px" }}
        >
          <option value="all">Todos</option>
          <option value="unread">No leídos</option>
          <option value="read">Leídos</option>
        </select>
      </div>

      {loading ? (
        <p className="empty-inbox">Cargando...</p>
      ) : paginatedUsers.length === 0 ? (
        <p className="empty-inbox">No hay resultados.</p>
      ) : (
        <>
          <ul className="inbox-list">
            {paginatedUsers.map((u) => (
              <li key={u._id} className="inbox-item">
                <button
                  className="inbox-button"
                  onClick={() => navigate(`/support/${u._id}`)}
                >
                  <div className="user-info">
                    <div className="user-header">
                      <span className="user-name">{u.name}</span>
                      {u.unread && (
                        <span className="unread-dot" style={{ marginLeft: "0.5rem", color: "#ff9800" }}>
                          ● Nuevo
                        </span>
                      )}
                      {u.lastMessageTime && (
                        <span className="timestamp" style={{ marginLeft: "auto" }}>
                          🕓 {new Date(u.lastMessageTime).toLocaleString("es-CO", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                    <span className="user-email">&lt;{u.email}&gt;</span>
                    <p className="last-message">
                      {u.lastMessage || "Sin mensajes aún."}
                    </p>
                    <div style={{ marginTop: "0.5rem" }}>
                      <label htmlFor={`status-${u._id}`}>Estado:</label>
                      <select
                        id={`status-${u._id}`}
                        value={u.status || "abierto"}
                        onChange={(e) => updateStatus(u._id, e.target.value)}
                        className={`status-select ${u.status}`}
                      >
                        <option value="abierto">Abierto</option>
                        <option value="en_espera">En espera</option>
                        <option value="cerrado">Cerrado</option>
                      </select>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          <div style={{ display: "flex", justifyContent: "center", marginTop: "1rem", gap: "1rem" }}>
            <button
              onClick={() => handlePageChange("prev")}
              disabled={currentPage === 1}
              style={{ padding: "0.5rem 1rem" }}
            >
              ← Anterior
            </button>
            <span>
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => handlePageChange("next")}
              disabled={currentPage === totalPages}
              style={{ padding: "0.5rem 1rem" }}
            >
              Siguiente →
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminInboxPage;
