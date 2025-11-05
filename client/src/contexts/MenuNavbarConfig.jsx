// src/contexts/MenuNavbarConfig.jsx

const menuConfig = ({ role, hidePublic, dynamic = {}, loading = false }) => {
  const dynCafe = Array.isArray(dynamic.cafe) ? dynamic.cafe : [];
  const dynPanela = Array.isArray(dynamic.panela) ? dynamic.panela : [];
  const dynOtros = Array.isArray(dynamic.otros) ? dynamic.otros : [];

  const publicGroup = hidePublic
    ? []
    : [
        { label: "Inicio", to: "/", activeMatch: /^\/$/ },
        {
          label: "Artesanías",
          to: "/artesanias",
          activeMatch: /^\/artesanias(\/|$)/,
          children: [
            {
              label: "Sombrers",
              to: "/categoria/sombrero",
              activeMatch: /^\/categoria\/sombreros(\/|$)/,
            },
            {
              label: "Manualidades",
              to: "/categoria/manualidades",
              activeMatch: /^\/categoria\/manualidades(\/|$)/,
            },
            {
              label: "Aretes",
              to: "/categoria/aretes",
              activeMatch: /^\/categoria\/aretes(\/|$)/,
            },
            {
              label: "Miniaturas",
              to: "/categoria/miniaturas",
              activeMatch: /^\/categoria\/miniaturas(\/|$)/,
            },
            {
              label: "Carteras",
              to: "/categoria/carteras",
              activeMatch: /^\/categoria\/carteras(\/|$)/,
            },
            {
              label: "Hogar",
              to: "/categoria/hogar",
              activeMatch: /^\/categoria\/hogar(\/|$)/,
            },
            {
              label: "Letras",
              to: "/categoria/letras",
              activeMatch: /^\/categoria\/letras(\/|$)/,
            },
          ],
        },
        {
          label: "Café",
          to: "/origen/cafe-narino",
          activeMatch: /^\/origen\/cafe-narino(\/|$)/,
          children: dynCafe.length
            ? dynCafe
            : [
                {
                  label: "Productos",
                  to: "/categoria/cafe",
                  activeMatch: /^\/categoria\/cafe(\/|$)/,
                },
                {
                  label: "Origen Nariño",
                  to: "/origen/cafe-narino",
                  activeMatch: /^\/origen\/cafe-narino(\/|$)/,
                },
                {
                  label: "Tostiones",
                  to: "/origen/tostion",
                  activeMatch: /^\/origen\/tostion(\/|$)/,
                },
              ],
        },
        {
          label: "Panela",
          to: "/origen/panela-sandona",
          activeMatch: /^\/origen\/panela-sandona(\/|$)/,
          children: dynPanela.length
            ? dynPanela
            : [
                {
                  label: "Productos",
                  to: "/categoria/panela",
                  activeMatch: /^\/categoria\/panela(\/|$)/,
                },
                {
                  label: "Trapiche",
                  to: "/origen/panela-sandona#trapiche",
                  activeMatch: /^\/origen\/panela-sandona(\/|$)/,
                },
                {
                  label: "Recetas",
                  to: "/origen/recetas#recetas",
                  activeMatch: /^\/origen\/recetas(\/|$)/,
                },
              ],
        },
        ...(dynOtros.length
          ? [
              {
                label: "Otros",
                to: "/otros",
                activeMatch: /^\/otros(\/|$)/,
                children: dynOtros,
              },
            ]
          : []),
      ];

  const userOnly =
    role === "user"
      ? [
          { label: "Inicio", to: "/", activeMatch: /^\/$/ },
          {
            label: "Artesanías",
            to: "/artesanias",
            activeMatch: /^\/artesanias(\/|$)/,
            children: [
              {
                label: "Sombrero",
                to: "/categoria/sombreros",
                activeMatch: /^\/categoria\/sombreros(\/|$)/,
              },
              {
                label: "Manualidades",
                to: "/categoria/manualidades",
                activeMatch: /^\/categoria\/manualidades(\/|$)/,
              },
              {
                label: "Aretes",
                to: "/categoria/aretes",
                activeMatch: /^\/categoria\/aretes(\/|$)/,
              },
              {
                label: "Miniaturas",
                to: "/categoria/miniaturas",
                activeMatch: /^\/categoria\/miniaturas(\/|$)/,
              },
              {
                label: "Carteras",
                to: "/categoria/carteras",
                activeMatch: /^\/categoria\/carteras(\/|$)/,
              },
              {
                label: "Hogar",
                to: "/categoria/hogar",
                activeMatch: /^\/categoria\/hogar(\/|$)/,
              },
              {
                label: "Letras",
                to: "/categoria/letras",
                activeMatch: /^\/categoria\/letras(\/|$)/,
              },
            ],
          },
          {
            label: "Café",
            to: "/origen/cafe-narino",
            activeMatch: /^\/origen\/cafe-narino(\/|$)/,
            children: dynCafe.length
              ? dynCafe
              : [
                  {
                    label: "Productos",
                    to: "/categoria/cafe",
                    activeMatch: /^\/categoria\/cafe(\/|$)/,
                  },
                  {
                    label: "Origen Nariño",
                    to: "/origen/cafe-narino",
                    activeMatch: /^\/origen\/cafe-narino(\/|$)/,
                  },
                  {
                    label: "Tostiones",
                    to: "/origen/tostion",
                    activeMatch: /^\/origen\/tostion(\/|$)/,
                  },
                ],
          },
          {
            label: "Panela",
            to: "/origen/panela-sandona",
            activeMatch: /^\/origen\/panela-sandona(\/|$)/,
            children: dynPanela.length
              ? dynPanela
              : [
                  {
                    label: "Productos",
                    to: "/categoria/panela",
                    activeMatch: /^\/categoria\/panela(\/|$)/,
                  },
                  {
                    label: "Trapiche",
                    to: "/origen/panela-sandona#trapiche",
                    activeMatch: /^\/origen\/panela-sandona(\/|$)/,
                  },
                  {
                    label: "Recetas",
                    to: "/origen/recetas#recetas",
                    activeMatch: /^\/origen\/recetas(\/|$)/,
                  },
                ],
          },
          ...(dynOtros.length
            ? [
                {
                  label: "Otros",
                  to: "/otros",
                  activeMatch: /^\/otros(\/|$)/,
                  children: dynOtros,
                },
              ]
            : []),
          {
            label: "Mis pedidos",
            to: "/my-orders",
            activeMatch: /^\/my-orders(\/|$)/,
          },
        ]
      : [];

  const adminOnly =
    role === "admin"
      ? [
          {
            label: "Dashboard",
            to: "/admin/dashboard",
            activeMatch: /^\/admin\/dashboard(\/|$)/,
          },
          { label: "Pedidos", to: "/admin", activeMatch: /^\/admin\/?$/ },
          {
            label: "Historial",
            to: "/admin/orders",
            activeMatch: /^\/admin\/orders(\/|$)/,
          },
          {
            label: "Productos",
            to: "/admin/products",
            activeMatch: /^\/admin\/products(\/|$)/,
            children: [
              {
                label: "Ver productos",
                to: "/admin/products",
                activeMatch: /^\/admin\/products(\/|$)/,
              },
              {
                label: "Agregar producto",
                to: "/admin/products/new",
                activeMatch: /^\/admin\/products\/new(\/|$)/,
              },
              {
                label: "Categorias",
                to: "/admin/categories",
                activeMatch: /^\/admin\/categories(\/|$)/,
              },
              {
                label: "Tallas",
                to: "/admin/sizes",
                activeMatch: /^\/admin\/sizes(\/|$)/,
              },
              {
                label: "Colores",
                to: "/admin/colors",
                activeMatch: /^\/admin\/colors(\/|$)/,
              },
              {
                label: "Historial",
                to: "/admin/historial",
                activeMatch: /^\/admin\/history(\/|$)/,
              },
            ],
          },
          {
            label: "Usuarios",
            to: "/admin/users",
            activeMatch: /^\/admin\/users(\/|$)/,
          },
        ]
      : [];

  if (role === "admin") return adminOnly;
  if (role === "user") return userOnly;
  return publicGroup;
};

export default menuConfig;
