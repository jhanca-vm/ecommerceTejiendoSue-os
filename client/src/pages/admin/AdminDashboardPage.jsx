import { useEffect, useState, useContext, useCallback, useMemo } from "react";

import apiUrl from "../../api/apiClient";

import { AuthContext } from "../../contexts/AuthContext";
import DashboardHeaderBlock from "../../blocks/admin/dashboar/DashboardHeaderBlock";
import MonthlySalesChart from "../../blocks/admin/dashboar/MonthlySalesChart";
import TopProductsChart from "../../blocks/admin/dashboar/TopProductsChart";
import OrdersByStatusChart from "../../blocks/admin/dashboar/OrdersByStatusChart";
import SummaryCardsBlock from "../../blocks/admin/dashboar/SummaryCardsBlock";
import DashboardFilters from "../../blocks/admin/dashboar/DashboardFilters";

const API = "http://localhost:5000/api";

const defaultFilters = {
  startDate: "",
  endDate: "",
  category: "",
  groupByMonth: true,
};

const AdminDashboardPage = () => {
  const { token } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [filters, setFilters] = useState(defaultFilters);

  const loadDashboard = useCallback(() => {
    setLoading(true);
    setErr(null);
    apiUrl
      .get(`dashboard/summary`, {
        headers: { Authorization: `Bearer ${token}` },
        params: filters,
      })
      .then((res) => setStats(res.data))
      .catch((e) => {
        console.error("Error cargando dashboard:", e);
        setErr("No se pudo cargar el dashboard");
      })
      .finally(() => setLoading(false));
  }, [token, filters]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const isStatsEmpty = useMemo(() => {
    if (!stats) return true;
    const ms = stats.monthlySales && stats.monthlySales.length > 0;
    const tp = stats.topProducts && stats.topProducts.length > 0;
    const os = stats.ordersByStatus && stats.ordersByStatus.length > 0;
    const totals =
      Number(stats.totalSales || 0) > 0 ||
      Number(stats.totalOrders || 0) > 0 ||
      Number(stats.totalItemsSold || 0) > 0;
    return !(ms || tp || os || totals);
  }, [stats]);

  // ====== Loading inicial con skeletons ======
  if (loading && !stats) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-header">
          <h1>Panel de Control del Administrador</h1>
          <p>Resumen gráfico de ventas, pedidos y productos.</p>
        </div>

        <div className="dashboard-filters">
          <div className="sk sk--input" />
          <div className="sk sk--input" />
          <div className="sk sk--input" />
          <div className="sk sk--toggle" />
          <div className="sk sk--btn" />
          <div className="sk sk--btn" />
          <div className="sk sk--btn" />
          <div className="sk sk--btn" />
          <div className="sk sk--btn" />
        </div>

        <div className="summary-cards skeleton-grid">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>

        <div className="skeleton-chart" />
        <div className="skeleton-chart" />
        <div className="skeleton-chart" />
      </div>
    );
  }

  // ====== Error ======
  if (err) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-error">{err}</div>
      </div>
    );
  }

  // ====== Estado vacío (stats válidas pero sin datos) ======
  if (stats && isStatsEmpty) {
    return (
      <div className="dashboard-page ">
        <DashboardHeaderBlock />
        <DashboardFilters onFilterChange={setFilters} />

        <div className="empty">
          <div className="empty__icon" aria-hidden />
          <h3 className="empty__title">Sin datos en el rango seleccionado</h3>
          <p className="empty__desc">
            Ajusta los filtros de fecha o categoría para ver resultados.
          </p>
          <div className="empty__actions">
            <button
              className="btn"
              onClick={() => setFilters(defaultFilters)}
              title="Limpiar filtros"
            >
              Limpiar filtros
            </button>
            <button
              className="btn btn--primary"
              onClick={loadDashboard}
              title="Recargar"
            >
              Recargar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ====== Vista normal ======
  return (
    <div className="dashboard-page" style={{ padding: "20px" }}>
      <DashboardHeaderBlock />
      <DashboardFilters onFilterChange={setFilters} />

      {/* Si hay nuevo fetch con stats ya cargadas, podemos mostrar un sutil skeleton arriba */}
      {loading && (
        <div className="top-loading" aria-hidden>
          <div className="top-loading__bar" />
        </div>
      )}

      <SummaryCardsBlock summary={stats} />

      <MonthlySalesChart
        current={stats.monthlySales || []}
        previous={(stats.prev && stats.prev.monthlySales) || []}
        currency={stats.currency || "USD"}
        groupByMonth={stats.range?.groupByMonth}
      />

      <TopProductsChart
        data={stats.topProducts || []}
        currency={stats.currency || "USD"}
      />

      <OrdersByStatusChart data={stats.ordersByStatus || []} />
    </div>
  );
};

export default AdminDashboardPage;
