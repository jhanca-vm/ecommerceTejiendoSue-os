import { useEffect, useState, useMemo, useRef } from "react";
import { FaTimesCircle, FaPlusCircle } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import { formatCOP } from "../../utils/currency";
import apiURL from "../../api/apiClient";

/** Convierte ISO a valor de <input type="datetime-local"> */
const toDatetimeLocal = (iso) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
};

const getIdVal = (x) => (typeof x === "object" && x?._id ? x._id : x);

/** Normaliza variantes a IDs (lo que el backend espera) */
const normalizeVariantsForSubmit = (vars) =>
  (Array.isArray(vars) ? vars : []).map((v) => ({
    size: getIdVal(v.size),
    color: getIdVal(v.color),
    stock: Number(v.stock) || 0,
  }));

/** Preview del precio con descuento */
const DiscountPreview = ({ price, discount }) => {
  const { enabled, type, value } = discount || {};
  const has = enabled && price > 0 && Number(value) > 0;

  const effective = useMemo(() => {
    if (!has) return price || 0;
    let eff = price;
    if (type === "PERCENT") eff = price - (price * Number(value)) / 100;
    else eff = price - Number(value);
    return Math.max(0, Number(eff.toFixed(2)));
  }, [has, price, type, value]);

  if (!price) return null;

  return (
    <div className="discount-preview">
      {has ? (
        <p>
          Precio actual: <b>{formatCOP(price)}</b> — Precio con promo:{" "}
          <b>{formatCOP(effective)}</b>
        </p>
      ) : (
        <p>
          Precio actual: <b>{formatCOP(price)}</b>
        </p>
      )}
    </div>
  );
};

const SKU_REGEX = /^[A-Za-z0-9\-_.]{3,32}$/; // corto, legible y único

const AdminEditProductForm = ({ productId, token, onSuccess, showToast }) => {
  const [categories, setCategories] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [colors, setColors] = useState([]);

  const navigate = useNavigate();

  const [form, setForm] = useState({
    sku: "", // ⬅️ NUEVO
    name: "",
    description: "",
    price: "",
    discountEnabled: false,
    discountType: "PERCENT",
    discountValue: "",
    discountStartAt: "",
    discountEndAt: "",
  });
  const [selectedCategory, setSelectedCategory] = useState("");

  // nuevas imágenes (File[]) + previews
  const [images, setImages] = useState([]);
  const [preview, setPreview] = useState([]);

  // imágenes existentes (paths)
  const [existingImages, setExistingImages] = useState([]);

  // variantes
  const [variants, setVariants] = useState([]);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [variantStock, setVariantStock] = useState("");

  // para detectar cambios reales
  const originalVariantsRef = useRef("[]");
  const originalDiscountRef = useRef("{}");
  const originalSkuRef = useRef(""); // ⬅️ NUEVO

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchInitialData();
    return () => {
      preview.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchInitialData = async () => {
    try {
      const [productRes, categoriesRes, sizesRes, colorsRes] =
        await Promise.all([
          apiURL.get(`products/${productId}`),
          apiURL.get(`categories`),
          apiURL.get(`sizes`),
          apiURL.get(`colors`),
        ]);

      const p = productRes.data;
      const {
        sku, // ⬅️ NUEVO (del backend)
        name,
        description,
        price,
        images,
        variants,
        categories: catField,
        discount,
      } = p;

      const catId =
        typeof catField === "string" ? catField : catField?._id || "";

      setForm({
        sku: sku || "", // ⬅️ NUEVO
        name: name || "",
        description: description || "",
        price: price || "",
        discountEnabled: !!discount?.enabled,
        discountType: discount?.type || "PERCENT",
        discountValue: discount?.value ?? "",
        discountStartAt: discount?.startAt
          ? toDatetimeLocal(discount.startAt)
          : "",
        discountEndAt: discount?.endAt ? toDatetimeLocal(discount.endAt) : "",
      });
      originalSkuRef.current = sku || ""; // ⬅️ NUEVO

      setSelectedCategory(catId);
      setExistingImages(images || []);
      setVariants(variants || []);

      // originales para comparar
      originalVariantsRef.current = JSON.stringify(
        normalizeVariantsForSubmit(variants || [])
      );
      originalDiscountRef.current = JSON.stringify({
        enabled: !!discount?.enabled,
        type: discount?.type || "PERCENT",
        value: Number(discount?.value || 0),
        startAt: discount?.startAt ? toDatetimeLocal(discount.startAt) : "",
        endAt: discount?.endAt ? toDatetimeLocal(discount.endAt) : "",
      });

      setCategories(categoriesRes.data || []);
      setSizes(sizesRes.data || []);
      setColors(colorsRes.data || []);
    } catch (e) {
      console.error(e);
      showToast("Error al cargar datos", "error");
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  // nuevas imágenes
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const safe = files.filter((f) => /^image\//.test(f.type));
    if (safe.length !== files.length) {
      showToast("Se rechazaron archivos por tipo no permitido", "warning");
    }
    const urls = safe.map((file) => URL.createObjectURL(file));
    setImages((prev) => [...prev, ...safe]);
    setPreview((prev) => [...prev, ...urls]);
    e.target.value = "";
  };

  const handleRemoveExistingImage = (index) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveNewImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreview((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  // Añadir variante NUEVA (size+color) con stock inicial
  const handleAddVariant = () => {
    if (!selectedSize || !selectedColor || Number(variantStock) <= 0) return;

    const exists = (variants || []).some(
      (v) =>
        getIdVal(v.size) === selectedSize && getIdVal(v.color) === selectedColor
    );
    if (exists) return;

    setVariants((prev) => [
      ...prev,
      { size: selectedSize, color: selectedColor, stock: Number(variantStock) },
    ]);
    setSelectedSize("");
    setSelectedColor("");
    setVariantStock("");
  };

  // Eliminar variante completa
  const handleRemoveVariant = (index) => {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  // ⬇️ NUEVO: editar stock inline sin tocar talla/color
  const handleVariantStockEdit = (index, value) => {
    const v = Math.max(0, Number(value) || 0);
    setVariants((prev) =>
      prev.map((item, i) => (i === index ? { ...item, stock: v } : item))
    );
  };

  // Validación de descuento (cliente)
  const validateDiscount = () => {
    if (!form.discountEnabled) return true;
    const v = Number(form.discountValue);
    const priceNum = Number(form.price);

    if (form.discountType === "PERCENT") {
      if (!(v > 0 && v <= 90)) {
        showToast("Porcentaje inválido (1–90%)", "error");
        return false;
      }
    } else {
      if (!(v > 0 && v < priceNum)) {
        showToast("Descuento fijo debe ser > 0 y < precio", "error");
        return false;
      }
    }
    if (form.discountStartAt && form.discountEndAt) {
      const s = new Date(form.discountStartAt).getTime();
      const e = new Date(form.discountEndAt).getTime();
      if (e <= s) {
        showToast("La fecha fin debe ser posterior a la de inicio", "error");
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedCategory || Number(form.price) <= 0) {
      return showToast("Completa los campos requeridos", "error");
    }
    if (form.sku && !SKU_REGEX.test(form.sku)) {
      return showToast(
        "SKU inválido. Usa 3–32 caracteres A-Z, 0-9, - _ .",
        "error"
      );
    }
    if (!validateDiscount()) return;
    if (!token) {
      showToast("Sesión inválida. Vuelve a iniciar sesión.", "error");
      return;
    }

    try {
      setSaving(true);

      const formData = new FormData();
      formData.append("name", String(form.name || "").trim());
      formData.append("description", String(form.description || "").trim());
      formData.append("price", String(form.price));
      formData.append("categories", String(selectedCategory));

      // ⬇️ SKU solo si cambió (evita sobre-escribir innecesario)
      if ((form.sku || "") !== (originalSkuRef.current || "")) {
        formData.append("sku", String(form.sku || "").trim());
      }

      // Variantes: enviamos solo si cambió cualquiera (incluye cambios de stock)
      const normalized = normalizeVariantsForSubmit(variants);
      const nowStr = JSON.stringify(normalized);
      const originalStr = originalVariantsRef.current;
      if (nowStr !== originalStr) {
        formData.append("variants", nowStr);
      }

      // Mantener imágenes existentes
      (existingImages || []).forEach((img) =>
        formData.append("existingImages", img)
      );
      // Nuevas
      (images || []).forEach((file) => formData.append("images", file));

      // Descuento: solo si cambió
      const discountPayload = {
        enabled: !!form.discountEnabled,
        type: form.discountType === "FIXED" ? "FIXED" : "PERCENT",
        value: Number(form.discountValue) || 0,
        startAt: form.discountStartAt || null,
        endAt: form.discountEndAt || null,
      };
      const originalDiscount = JSON.parse(originalDiscountRef.current);
      const changedDiscount =
        originalDiscount.enabled !== discountPayload.enabled ||
        originalDiscount.type !== discountPayload.type ||
        Number(originalDiscount.value || 0) !==
          Number(discountPayload.value || 0) ||
        (originalDiscount.startAt || "") !== (form.discountStartAt || "") ||
        (originalDiscount.endAt || "") !== (form.discountEndAt || "");
      if (changedDiscount) {
        formData.append("discount", JSON.stringify(discountPayload));
      }

      const { data } = await apiURL.put(`products/${productId}`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      const openId =
        data?.historyEvents?.variants || data?.historyEvents?.price || null;

      showToast("Producto actualizado correctamente", "success");
      if (typeof onSuccess === "function") onSuccess(openId);
    } catch (err) {
      console.error("API error:", err?.response?.data || err);
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.error ||
        (status === 409
          ? "Conflicto con el SKU (ya existe). Cambia el SKU e intenta de nuevo."
          : "Error al actualizar producto");
      showToast(msg, status === 409 ? "warning" : "error");
    } finally {
      setSaving(false);
    }
  };

  const getSizeLabel = (v) => {
    if (!v) return "—";
    if (typeof v.size === "object" && v.size?.label) return v.size.label;
    const id = getIdVal(v.size);
    return sizes.find((s) => s._id === id)?.label || "—";
  };
  const getColorName = (v) => {
    if (!v) return "—";
    if (typeof v.color === "object" && v.color?.name) return v.color.name;
    const id = getIdVal(v.color);
    return colors.find((c) => c._id === id)?.name || "—";
  };

  return (
    <div className="form-container">
      <h2>Editar Producto</h2>
      <form
        onSubmit={handleSubmit}
        className="product-form"
        encType="multipart/form-data"
      >
        {/* SKU (producto) */}
        <input
          type="text"
          name="sku"
          placeholder="SKU (único, p. ej. TS-PLN-001)"
          value={form.sku}
          onChange={handleInputChange}
          maxLength={32}
        />

        <input
          type="text"
          name="name"
          placeholder="Nombre"
          value={form.name}
          onChange={handleInputChange}
          required
        />

        <textarea
          name="description"
          placeholder="Descripción"
          value={form.description}
          onChange={handleInputChange}
        />

        <input
          type="number"
          name="price"
          placeholder="Precio"
          value={form.price}
          onChange={handleInputChange}
          min="1"
          required
        />

        {/* Bloque de promoción / descuento */}
        <div className="discount-block">
          <label className="discount-toggle">
            <input
              type="checkbox"
              name="discountEnabled"
              checked={form.discountEnabled}
              onChange={handleInputChange}
            />
            Activar promoción/descuento
          </label>

          {form.discountEnabled && (
            <>
              <div className="discount-row">
                <select
                  name="discountType"
                  value={form.discountType}
                  onChange={handleInputChange}
                >
                  <option value="PERCENT">Porcentaje (%)</option>
                  <option value="FIXED">Monto fijo</option>
                </select>

                <input
                  type="number"
                  name="discountValue"
                  placeholder={
                    form.discountType === "PERCENT"
                      ? "% descuento"
                      : "Valor descontado"
                  }
                  value={form.discountValue}
                  min="1"
                  step="0.01"
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="discount-row">
                <label>
                  Inicio
                  <input
                    type="datetime-local"
                    name="discountStartAt"
                    value={form.discountStartAt}
                    onChange={handleInputChange}
                  />
                </label>
                <label>
                  Fin
                  <input
                    type="datetime-local"
                    name="discountEndAt"
                    value={form.discountEndAt}
                    onChange={handleInputChange}
                  />
                </label>
              </div>

              <DiscountPreview
                price={Number(form.price)}
                discount={{
                  enabled: form.discountEnabled,
                  type: form.discountType,
                  value: form.discountValue,
                }}
              />
            </>
          )}
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          required
        >
          <option value="">Selecciona una categoría</option>
          {categories.map((cat) => (
            <option key={cat._id} value={cat._id}>
              {cat.name}
            </option>
          ))}
        </select>

        {/* Variantes */}
        <div className="variant-selector">
          <select
            value={selectedSize}
            onChange={(e) => setSelectedSize(e.target.value)}
          >
            <option value="">Talla</option>
            {sizes.map((s) => (
              <option key={s._id} value={s._id}>
                {s.label}
              </option>
            ))}
          </select>

          <select
            value={selectedColor}
            onChange={(e) => setSelectedColor(e.target.value)}
          >
            <option value="">Color</option>
            {colors.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>

          <input
            type="number"
            placeholder="Stock"
            value={variantStock}
            onChange={(e) => setVariantStock(e.target.value)}
            min="1"
          />

          <button
            type="button"
            className="btn-variant"
            onClick={handleAddVariant}
          >
            + Añadir Variante
          </button>
        </div>

        {/* Lista de variantes con edición de stock inline */}
        {Array.isArray(variants) && variants.length > 0 && (
          <ul className="variant-list">
            {variants.map((v, i) => (
              <li key={`${getIdVal(v.size)}-${getIdVal(v.color)}`}>
                Talla: <b>{getSizeLabel(v)}</b> | Color:{" "}
                <b>{getColorName(v)}</b> | Stock:{" "}
                <input
                  type="number"
                  value={v.stock}
                  min="0"
                  onChange={(e) => handleVariantStockEdit(i, e.target.value)}
                  style={{ width: 100 }}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveVariant(i)}
                  title="Eliminar variante"
                >
                  ✖
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Imágenes actuales */}
        <label>Imágenes actuales:</label>
        <div className="image-preview">
          {existingImages.map((img, index) => (
            <div key={`ex-${index}`} className="preview-box">
              {/* usa tu base URL de backend en prod */}
              <img src={`http://localhost:5000${img}`} alt="" />
              <button
                type="button"
                onClick={() => handleRemoveExistingImage(index)}
              >
                🗑
              </button>
            </div>
          ))}
        </div>

        {/* Agregar nuevas imágenes */}
        <label>Agregar nuevas imágenes:</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
        />
        <div className="image-preview">
          {preview.map((src, i) => (
            <div key={`new-${i}`} className="preview-box">
              <img src={src} alt="preview" />
              <button type="button" onClick={() => handleRemoveNewImage(i)}>
                🗑
              </button>
            </div>
          ))}
        </div>

        <div className="button__option">
          <button type="submit" className="btn-save" disabled={saving}>
            <FaPlusCircle style={{ marginRight: 6 }} />
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
          <button
            onClick={() => navigate("/admin/products")}
            type="button"
            title="Cancelar cambios y volver"
            className="btn-cancel"
            disabled={saving}
          >
            <FaTimesCircle style={{ marginRight: 6 }} />
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminEditProductForm;
