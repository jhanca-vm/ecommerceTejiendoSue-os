import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { FaTimesCircle, FaPlusCircle } from "react-icons/fa";
import { useToast } from "../../contexts/ToastContext";
import apiUrl from "../../api/apiClient";

const MAX_IMAGE_MB = 10;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Debe coincidir con la validación backend (6–64, alfanumérico, guion o guion_bajo, sin espacios)
const SKU_REGEX = /^[A-Z0-9][A-Z0-9-_]{5,63}$/i;

const RegisterProductForm = ({ categories, onSubmit }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Campos base
  const [sku, setSku] = useState(""); // opcional: si se deja vacío, el backend lo autogenera
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(""); // string en UI; se limpia al enviar
  const [selectedCategory, setSelectedCategory] = useState("");

  // Imágenes (File[]) + previews (blob URLs)
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);

  // Catálogos de variantes
  const [sizes, setSizes] = useState([]);
  const [colors, setColors] = useState([]);

  // Variante en edición
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [variantStock, setVariantStock] = useState("");

  // Variantes añadidas
  const [variants, setVariants] = useState([]);

  // Errores UI
  const [errors, setErrors] = useState({
    sku: "",
    name: "",
    price: "",
    category: "",
    images: "",
    variants: "",
    variantStock: "",
  });

  useEffect(() => {
    fetchOptions();
    return () => previews.forEach((u) => URL.revokeObjectURL(u));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchOptions = async () => {
    try {
      const [resSizes, resColors] = await Promise.all([
        apiUrl.get("sizes"),
        apiUrl.get("colors"),
      ]);
      setSizes(resSizes.data || []);
      setColors(resColors.data || []);
    } catch {
      showToast("No se pudieron cargar tallas/colores.", "error");
    }
  };

  /* ===================== Helpers ===================== */
  const num = (v) => Number(String(v).replace(/[^\d.]/g, "")) || 0;

  const setFieldError = (field, message) =>
    setErrors((e) => ({ ...e, [field]: message || "" }));

  const clearAllErrors = () =>
    setErrors({
      sku: "",
      name: "",
      price: "",
      category: "",
      images: "",
      variants: "",
      variantStock: "",
    });

  const toastInfo = (msg) => showToast(msg, "info");
  const toastWarn = (msg) => showToast(msg, "warning");
  const toastOk = (msg) => showToast(msg, "success");

  /* ============ Imágenes: validación tipo/tamaño y previews ============ */
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const ok = [];
    const urls = [];
    const rejected = [];

    for (const f of files) {
      const tooBig = f.size > MAX_IMAGE_MB * 1024 * 1024;
      const badType = !ALLOWED_TYPES.includes(f.type);
      if (tooBig || badType) {
        rejected.push(
          `${f.name} ${
            tooBig
              ? `(${(f.size / (1024 * 1024)).toFixed(1)}MB > ${MAX_IMAGE_MB}MB)`
              : ""
          } ${badType ? "(tipo no permitido)" : ""}`.trim()
        );
        continue;
      }
      ok.push(f);
      urls.push(URL.createObjectURL(f));
    }

    if (rejected.length) {
      setFieldError(
        "images",
        `Algunos archivos fueron rechazados: ${rejected.join(", ")}`
      );
      toastWarn("Se rechazaron algunas imágenes por tamaño o tipo.");
    } else {
      setFieldError("images", "");
    }

    setImages((prev) => [...prev, ...ok]);
    setPreviews((prev) => [...prev, ...urls]);

    // permitir volver a elegir mismos archivos
    e.target.value = "";
  };

  const handleRemoveNewImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  /* ================= Variantes: agregar/quitar con validación ================= */
  const handleAddVariant = () => {
    setFieldError("variants", "");
    setFieldError("variantStock", "");

    if (!selectedSize || !selectedColor || num(variantStock) <= 0) {
      if (num(variantStock) <= 0)
        setFieldError("variantStock", "Stock debe ser mayor a 0.");
      toastWarn("Selecciona talla, color y un stock válido.");
      return;
    }

    const duplicate = variants.find(
      (v) => v.size === selectedSize && v.color === selectedColor
    );
    if (duplicate) {
      setFieldError(
        "variants",
        "Ya existe una variante con esa talla y color."
      );
      toastWarn("Variante duplicada.");
      return;
    }

    setVariants((prev) => [
      ...prev,
      { size: selectedSize, color: selectedColor, stock: num(variantStock) },
    ]);
    setSelectedSize("");
    setSelectedColor("");
    setVariantStock("");
    toastOk("Variante agregada.");
  };

  const handleRemoveVariant = (index) => {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  /* ===================== Validación general (submit) ===================== */
  const validateForm = () => {
    clearAllErrors();
    let ok = true;

    // SKU opcional pero, si se ingresa, debe cumplir el patrón
    if (sku.trim()) {
      if (!SKU_REGEX.test(sku.trim())) {
        setFieldError(
          "sku",
          "SKU inválido (6–64 caracteres, alfanumérico/ - / _ , sin espacios)."
        );
        ok = false;
      }
    }

    if (!name.trim()) {
      setFieldError("name", "El nombre es obligatorio.");
      ok = false;
    }
    if (!selectedCategory) {
      setFieldError("category", "Selecciona una categoría.");
      ok = false;
    }
    if (num(price) <= 0) {
      setFieldError("price", "Ingresa un precio válido mayor que 0.");
      ok = false;
    }
    if (!images.length) {
      setFieldError("images", "Agrega al menos una imagen del producto.");
      ok = false;
    }
    if (!variants.length) {
      setFieldError(
        "variants",
        "Agrega al menos una variante (talla + color + stock)."
      );
      ok = false;
    }

    return ok;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toastWarn("Revisa los campos marcados.");
      return;
    }

    const formData = new FormData();
    if (sku.trim()) formData.append("sku", sku.trim()); // opcional; si no va, el backend lo crea
    formData.append("name", name.trim());
    formData.append("description", description);
    formData.append("price", String(num(price)));
    formData.append("categories", selectedCategory);
    formData.append("variants", JSON.stringify(variants));

    images.forEach((file) => formData.append("images", file));

    toastInfo("Enviando producto…");
    onSubmit(formData);
  };

  const handleCancel = () => {
    navigate("/admin/products");
  };

  /* ===================== UI ===================== */
  const priceHelp =
    "Ingresa el precio en COP sin separadores de miles (p. ej. 259900).";
  const skuHelp =
    "Opcional. Déjalo vacío para autogenerar. Formato sugerido: simple, corto y único (p. ej. CAM-NEG-L).";

  return (
    <form
      onSubmit={handleSubmit}
      className="product-form"
      encType="multipart/form-data"
    >
      {/* SKU */}
      <div>
        <label htmlFor="prod-sku">SKU (opcional)</label>
        <input
          id="prod-sku"
          type="text"
          placeholder="SKU del producto (p. ej. CAM-NEG-01)"
          value={sku}
          onChange={(e) => {
            setSku(e.target.value.toUpperCase());
            if (!e.target.value || SKU_REGEX.test(e.target.value))
              setFieldError("sku", "");
          }}
          className={errors.sku ? "is-invalid" : ""}
          inputMode="latin-prose"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
        />
        <p className="muted" style={{ marginTop: 4 }}>
          {skuHelp}
        </p>
        {errors.sku && <p className="error-text">{errors.sku}</p>}
      </div>

      {/* Nombre */}
      <div>
        <label htmlFor="prod-name">Nombre de producto</label>
        <input
          id="prod-name"
          type="text"
          placeholder="Nombre de Producto"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (e.target.value.trim()) setFieldError("name", "");
          }}
          className={errors.name ? "is-invalid" : ""}
          required
        />
        {errors.name && <p className="error-text">{errors.name}</p>}
      </div>

      {/* Descripción */}
      <div>
        <label htmlFor="prod-desc">Descripción</label>
        <textarea
          id="prod-desc"
          placeholder="Describe tu producto (materiales, cuidados, medidas...)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {/* Precio */}
      <div>
        <label htmlFor="prod-price">Precio</label>
        <input
          id="prod-price"
          type="number"
          placeholder="Precio (COP)"
          value={price}
          onChange={(e) => {
            setPrice(e.target.value);
            if (num(e.target.value) > 0) setFieldError("price", "");
          }}
          min="1"
          className={errors.price ? "is-invalid" : ""}
          required
        />
        <p className="muted" style={{ marginTop: 4 }}>
          {priceHelp}
        </p>
        {errors.price && <p className="error-text">{errors.price}</p>}
      </div>

      {/* Categoría */}
      <div>
        <label htmlFor="prod-cat">Categoría</label>
        <select
          id="prod-cat"
          value={selectedCategory}
          onChange={(e) => {
            setSelectedCategory(e.target.value);
            if (e.target.value) setFieldError("category", "");
          }}
          className={errors.category ? "is-invalid" : ""}
          required
        >
          <option value="">Selecciona una categoría</option>
          {categories.map((cat) => (
            <option key={cat._id} value={cat._id}>
              {cat.name}
            </option>
          ))}
        </select>
        {errors.category && <p className="error-text">{errors.category}</p>}
      </div>

      {/* Variantes */}
      <div>
        <label>Variantes (talla / color / stock)</label>
        <div className="variant-selector">
          <select
            aria-label="Seleccionar talla"
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
            aria-label="Seleccionar color"
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
            onChange={(e) => {
              setVariantStock(e.target.value);
              if (num(e.target.value) > 0) setFieldError("variantStock", "");
            }}
            min="1"
            className={errors.variantStock ? "is-invalid" : ""}
          />

          <button
            type="button"
            className="btn-variant"
            onClick={handleAddVariant}
            title="Añadir variante"
          >
            + Añadir Variante
          </button>
        </div>
        {errors.variantStock && (
          <p className="error-text">{errors.variantStock}</p>
        )}

        {variants.length > 0 && (
          <ul className="variant-list" aria-live="polite">
            {variants.map((v, i) => (
              <li key={`${v.size}-${v.color}`}>
                Talla: {sizes.find((s) => s._id === v.size)?.label || "?"} |
                Color: {colors.find((c) => c._id === v.color)?.name || "?"} |
                Stock: {v.stock}
                <button
                  type="button"
                  onClick={() => handleRemoveVariant(i)}
                  aria-label={`Eliminar variante ${i + 1}`}
                  title="Eliminar variante"
                >
                  ✖
                </button>
              </li>
            ))}
          </ul>
        )}
        {errors.variants && <p className="error-text">{errors.variants}</p>}
      </div>

      {/* Imágenes */}
      <div>
        <label htmlFor="prod-images">Imágenes del producto</label>
        <input
          id="prod-images"
          type="file"
          multiple
          accept={ALLOWED_TYPES.join(",")}
          onChange={handleImageChange}
          className={errors.images ? "is-invalid" : ""}
          aria-describedby="img-help"
        />
        <p id="img-help" className="muted" style={{ marginTop: 4 }}>
          Formatos permitidos: JPG/PNG/WEBP. Máximo {MAX_IMAGE_MB}MB por imagen.
          Sugerencia: 1200×1200 px.
        </p>
        {errors.images && <p className="error-text">{errors.images}</p>}

        <div className="image-preview">
          {previews.map((src, i) => (
            <div key={`new-${i}`} className="preview-box">
              <img src={src} alt={`Vista previa ${i + 1}`} />
              <button
                type="button"
                onClick={() => handleRemoveNewImage(i)}
                aria-label={`Eliminar imagen ${i + 1}`}
                title="Eliminar imagen"
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Acciones */}
      <div className="button__option">
        <button type="submit" className="btn-save">
          <FaPlusCircle style={{ marginRight: 6 }} />
          Crear producto
        </button>

        <button
          type="button"
          className="btn-cancel"
          onClick={handleCancel}
          title="Cancelar y volver"
        >
          <FaTimesCircle style={{ marginRight: 6 }} />
          Cancelar
        </button>
      </div>
    </form>
  );
};

export default RegisterProductForm;
