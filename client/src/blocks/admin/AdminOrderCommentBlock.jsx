const AdminOrderCommentBlock = ({
  comment,
  trackingNumber,
  shippingCompany,
  onFieldChange,
}) => {
  return (
    <div className="section-shipping">
      <label title="Comentario visible solo para administración">
        Comentario del administrador:
        <textarea
          value={comment}
          onChange={(e) => onFieldChange("adminComment", e.target.value)}
        />
      </label>

      <label title="Número de seguimiento del envío">
        Número de guía:
        <input
          type="text"
          value={trackingNumber}
          onChange={(e) => onFieldChange("trackingNumber", e.target.value)}
        />
      </label>

      <label title="Empresa encargada del envío">
        Transportadora:
        <input
          type="text"
          value={shippingCompany}
          onChange={(e) => onFieldChange("shippingCompany", e.target.value)}
        />
      </label>
    </div>
  );
};

export default AdminOrderCommentBlock;
