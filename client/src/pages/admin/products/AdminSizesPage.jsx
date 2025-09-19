import AdminListManager from "../../../blocks/admin/AdminListManagesBlocks";

const AdminSizesPage = () => {
  return (
    <div className="admin-page-container">
      <AdminListManager
        title="Tallas"
        path="/sizes"        
        fieldName="label"    
      />
    </div>
  );
};

export default AdminSizesPage;