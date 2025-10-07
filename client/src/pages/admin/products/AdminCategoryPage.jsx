import AdminListManager from "../../../blocks/admin/AdminListManagesBlocks";

const AdminCategoryPage = () => {
  return (
    <div className="admin-page-container">
      <AdminListManager
        title="Categorias"
        path="/categories"        
        fieldName="name"    
      />
    </div>
  );
};

export default AdminCategoryPage;
