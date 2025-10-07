import AdminListManager from "../../../blocks/admin/AdminListManagesBlocks";

const AdminColorsPage = () => {
  return (
    <div className="admin-page-container">
      <AdminListManager
        title="Colores"
        path="/colors"        
        fieldName="name"    
      />
    </div>
  );
};

export default AdminColorsPage;
