import React from "react";

export default function FiltersSidebar({ onSale, inStock, onToggleOnSale, onToggleInStock, sizesFacet = [], colorsFacet = [] }) {
  return (
    <div>
      <h4>Filtros</h4>
      <div style={{ display: "grid", gap: 8 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={onSale} onChange={onToggleOnSale} />
          En promociónes
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={inStock} onChange={onToggleInStock} />
          En stock
        </label>
      </div>

      {/* Facetas (solo lectura por ahora) */}
      {sizesFacet?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h5 style={{ margin: "8px 0" }}>Tallas</h5>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {sizesFacet.map((s) => (
              <li key={String(s._id)}>{s.label || s._id} ({s.count})</li>
            ))}
          </ul>
        </div>
      )}

      {colorsFacet?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h5 style={{ margin: "8px 0" }}>Colores</h5>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {colorsFacet.map((c) => (
              <li key={String(c._id)}>{c.name || c._id} ({c.count})</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
