import { useContext, useEffect, useState } from "react";
import apiUrl from "../../../api/apiClient";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import RegisterProductForm from "../../../blocks/admin/RegisterProductFormBlock";

const RegisterProductPage = () => {
  const { token } = useContext(AuthContext);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await apiUrl.get("categories");
        setCategories(res.data);
      } catch {
        showToast("Error al cargar categorías", "error");
      }
    };
    fetchCategories();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (formData) => {
    try {
      await apiUrl.post("products", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      showToast("Producto creado correctamente", "success");
      navigate("/admin/products");
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error || "Error al crear producto";
      if (status === 409) {
        // Conflicto de estado del recurso: p.ej. SKU duplicado
        // (El backend envía "SKU ya existe")
        showToast(msg, "warning");
      } else {
        showToast(msg, "error");
      }
    }
  };

  return (
    <div className="form-container">
      <h2>Nuevo Producto</h2>
      <RegisterProductForm categories={categories} onSubmit={handleSubmit} />
    </div>
  );
};

export default RegisterProductPage;
