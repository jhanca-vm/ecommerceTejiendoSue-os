import { useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AuthContext } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import AdminEditProductForm from "../../../blocks/admin/AdminEditProductForm";

// 👇 Tu ruta actual
const HISTORY_PAGE_PATH = "/admin/products";

const AdminEditProductPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useContext(AuthContext);
  const { showToast } = useToast();

  const handleSuccess = (openId) => {
    const url = openId ? `${HISTORY_PAGE_PATH}?open=${openId}` : HISTORY_PAGE_PATH;
    navigate(url);
  };

  return (
    <AdminEditProductForm
      productId={id}
      token={token}
      onSuccess={handleSuccess}
      showToast={showToast}
    />
  );
};

export default AdminEditProductPage;
