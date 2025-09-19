# 🧵 ecommerceTejiendoSueños - Tienda Online de Tejidos Artesanales

[![Licencia MIT](https://img.shields.io/badge/Licencia-MIT-green.svg)](LICENSE)
![Estado del Proyecto](https://img.shields.io/badge/Estado-Desarrollo%20Activo-yellow)

Plataforma de e-commerce para venta de productos tejidos artesanales. Desarrollada con React en el frontend y Node.js/Express en el backend.

![Captura de la tienda](public/images/logo.png)

## 🌟 Características Principales

- Catálogo de productos organizado por categorías
- Carrito de compras interactivo
- Sistema de autenticación de usuarios
- Pasarela de pagos integrada
- Panel de administración para gestión de productos
- Búsqueda y filtrado de productos
- Reseñas y valoraciones de productos

## 🛠️ Tecnologías Utilizadas

### Frontend

- **React** (v18) - Librería principal
- **React Router** - Navegación
- **Redux** - Gestión de estado
- **apiClient** - Comunicación con API
- **Bootstrap** - Estilos y componentes
- **Sass** - Preprocesador CSS

### Backend

- **Node.js** - Entorno de ejecución
- **Express** - Framework web
- **MongoDB** - Base de datos
- **Mongoose** - ODM para MongoDB
- **JWT** - Autenticación
- **Bcrypt** - Encriptación de contraseñas

### Herramientas

- **Webpack** - Empaquetamiento
- **Git** - Control de versiones
- **Postman** - Pruebas de API

## 🚀 Instalación y Configuración

### Prerrequisitos

- Node.js (v14+)
- npm (v6+)
- MongoDB (v4.4+)

### Pasos para la instalación

1. **Clonar el repositorio**:

```bash
git clone https://github.com/98141/ecommerceTejiendoSue-os.git
cd ecommerceTejiendoSueños


# 🛠️ Gestión de Productos - Admin Panel eCommerce

Este módulo permite al administrador gestionar los productos del eCommerce de manera completa: creación, edición, eliminación, manejo de imágenes múltiples y asignación de categorías.

---

## 📁 Estructura del Proyecto

```
src/
│
├── pages/
│   ├── AdminProductPage.jsx         # Vista principal de productos
│   ├── AdminNewProductPage.jsx      # Formulario de nuevo producto
│   └── AdminEditProductPage.jsx     # Formulario de edición de producto
│
├── blocks/
│   ├── AdminProductRow.jsx          # Fila de la tabla de productos
│   └── ConfirmModal.jsx             # Modal de confirmación
│
├── contexts/
│   ├── AuthContext.jsx              # Contexto de autenticación
│   └── ToastContext.jsx             # Contexto de notificaciones
```

---

## ⚙️ Backend - Rutas de Productos

- `GET /api/products` → Obtener todos los productos
- `GET /api/products/:id` → Obtener un producto específico
- `POST /api/products` → Crear nuevo producto (`multipart/form-data`)
- `PUT /api/products/:id` → Editar producto (`multipart/form-data`)
- `DELETE /api/products/:id` → Eliminar producto

### Middleware de subida (`uploadMiddleware.js`):

```js
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const ensureUploadsFolderExists = require("../utils/products");

ensureUploadsFolderExists();
const uploadDir = path.join(__dirname, "../uploads/products");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp/;
  const extValid = allowed.test(path.extname(file.originalname).toLowerCase());
  const mimeValid = allowed.test(file.mimetype);
  if (extValid && mimeValid) cb(null, true);
  else cb(new Error("Solo se permiten archivos de imagen."));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

module.exports = upload;
```

---

## 🧩 Componentes Clave

### `AdminProductPage.jsx`

- Muestra tabla de productos.
- Permite editar o eliminar productos.
- Llama a `ConfirmModal` para confirmación de eliminación.

### `AdminNewProductPage.jsx`

- Formulario con:
  - Campos de nombre, descripción, precio, stock.
  - `<select>` para categoría.
  - Subida múltiple de imágenes.
- Envía `FormData` al backend.

### `AdminEditProductPage.jsx`

- Carga el producto por ID.
- Preselecciona la categoría actual.
- Permite modificar texto, categoría, stock e imágenes.
- Elimina imágenes existentes.
- Envía `FormData` con `existingImages[]`.

---

## 📦 Modelo de Producto

```js
const ProductSchema = new mongoose.Schema({
  name: String,
  description: String,
  price: Number,
  stock: Number,
  images: [String],
  categories: [String], // Solo se usa un valor desde frontend
});
```

---

## 🗂️ Gestión de Categorías

- `GET /api/categories` → Obtener categorías disponibles.
- Las categorías deben crearse antes de crear productos.
- En el frontend se muestran en un `<select>` (una sola categoría por producto).

---

## ✅ Validaciones Frontend

- Verifica campos obligatorios.
- Muestra errores con `ToastContext`.
- Valida imágenes (formato y tamaño).
- Elimina imágenes visualmente antes de enviar.

---

## 🔐 Seguridad

- Todas las rutas protegidas por JWT (`Authorization: Bearer <token>`).
- Solo usuarios con rol admin pueden crear, editar o eliminar productos.

---

## 🚀 Próximos Pasos

- Implementar gestión CRUD de categorías en panel admin.
- Validar unicidad de nombre del producto.
- Paginación y búsqueda en `AdminProductPage`.
- Dashboard de ventas por producto.

---

## 👨‍💻 Autor

**Raíces Tejidas eCommerce**  
Desarrollado por equipo interno – 2025  
Tecnologías: React, Node.js, Express, MongoDB, JWT
