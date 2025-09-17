const mongoose = require("mongoose");
const Product = require("../models/Product");
const Category = require("../models/Category");

// === Helpers de parsing/seguridad ===
const isId = (v) => /^[0-9a-fA-F]{24}$/.test(String(v));
const parseIntSafe = (v, d) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
};
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const asArray = (v) => (Array.isArray(v) ? v : v != null ? [v] : []);
const now = () => new Date();
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function computeEffectiveExpr() {
  // Devuelve una expresión de agregación que calcula effectivePrice
  return {
    $let: {
      vars: {
        enabled: { $ifNull: ["$discount.enabled", false] },
        type: { $ifNull: ["$discount.type", "PERCENT"] },
        value: { $ifNull: ["$discount.value", 0] },
        startAt: "$discount.startAt",
        endAt: "$discount.endAt",
        now: new Date(),
        price: { $ifNull: ["$price", 0] },
      },
      in: {
        $let: {
          vars: {
            inWindow: {
              $and: [
                {
                  $or: [
                    { $eq: ["$$startAt", null] },
                    { $lte: ["$$startAt", "$$now"] },
                  ],
                },
                {
                  $or: [
                    { $eq: ["$$endAt", null] },
                    { $gte: ["$$endAt", "$$now"] },
                  ],
                },
              ],
            },
          },
          in: {
            $cond: [
              { $and: ["$$enabled", "$$inWindow"] },
              {
                $let: {
                  vars: {
                    calc: {
                      $cond: [
                        { $eq: ["$$type", "PERCENT"] },
                        {
                          $subtract: [
                            "$$price",
                            {
                              $multiply: [
                                "$$price",
                                { $divide: ["$$value", 100] },
                              ],
                            },
                          ],
                        },
                        { $subtract: ["$$price", "$$value"] },
                      ],
                    },
                  },
                  in: {
                    $cond: [
                      { $lt: ["$$calc", 0] },
                      0,
                      { $round: ["$$calc", 2] },
                    ],
                  },
                },
              },
              "$$price",
            ],
          },
        },
      },
    },
  };
}

function discountPercentExpr() {
  return {
    $let: {
      vars: {
        price: { $ifNull: ["$price", 0] },
        eff: computeEffectiveExpr(),
      },
      in: {
        $cond: [
          { $lte: ["$$price", 0] },
          0,
          {
            $max: [
              0,
              {
                $round: [
                  {
                    $subtract: [
                      100,
                      { $multiply: [{ $divide: ["$$eff", "$$price"] }, 100] },
                    ],
                  },
                  0,
                ],
              },
            ],
          },
        ],
      },
    },
  };
}

function sortMap(sort) {
  switch (sort) {
    case "price_asc":
      return { effectivePrice: 1, _id: -1 };
    case "price_desc":
      return { effectivePrice: -1, _id: -1 };
    case "best_sellers":
      return { salesCount: -1, _id: -1 };
    case "newest":
      return { createdAt: -1, _id: -1 };
    case "discount_desc":
      return { discountPercent: -1, _id: -1 };
    case "trending":
      return { trendingScore: -1, _id: -1 };
    // "relevance": si usas $text, usarías score. Aquí caemos a createdAt:
    case "relevance":
    default:
      return { createdAt: -1, _id: -1 };
  }
}

async function resolveCategoryId(categorySlugOrId) {
  if (!categorySlugOrId) return null;
  if (isId(categorySlugOrId))
    return new mongoose.Types.ObjectId(categorySlugOrId);
  const cat = await Category.findOne({
    slug: String(categorySlugOrId).toLowerCase(),
    isActive: true,
  }).lean();
  return cat ? cat._id : null;
}

// ============================= /search =============================
exports.searchProducts = async (req, res) => {
  try {
    const page = clamp(parseIntSafe(req.query.page, 10) || 1, 1, 1000000);
    const limit = clamp(parseIntSafe(req.query.limit, 24) || 24, 1, 60);
    const skip = (page - 1) * limit;

    const sort = String(req.query.sort || "relevance");
    const qRaw = (req.query.q || "").toString().slice(0, 64).trim();
    const q = qRaw ? escapeRegex(qRaw) : null;

    const onSale = String(req.query.onSale || "") === "1";
    const inStock = String(req.query.inStock || "") === "1";
    const priceMin = Number.isFinite(Number(req.query.priceMin))
      ? Number(req.query.priceMin)
      : null;
    const priceMax = Number.isFinite(Number(req.query.priceMax))
      ? Number(req.query.priceMax)
      : null;

    const sizes = asArray(req.query.sizes)
      .filter(isId)
      .map((s) => new mongoose.Types.ObjectId(s));
    const colors = asArray(req.query.colors)
      .filter(isId)
      .map((c) => new mongoose.Types.ObjectId(c));

    const categoryId = await resolveCategoryId(req.query.category);

    const isAdmin = req.user?.role === "admin";

    // $match base
    const match = {};
    if (categoryId) match.categories = categoryId;
    if (q) match.name = { $regex: q, $options: "i" };

    if (onSale) {
      match["discount.enabled"] = true;
      match.$expr = {
        $and: [
          {
            $or: [
              { $eq: ["$discount.startAt", null] },
              { $lte: ["$discount.startAt", "$$NOW"] },
            ],
          },
          {
            $or: [
              { $eq: ["$discount.endAt", null] },
              { $gte: ["$discount.endAt", "$$NOW"] },
            ],
          },
        ],
      };
    }

    const andVariant = [];
    if (inStock) andVariant.push({ "variants.stock": { $gt: 0 } });
    if (sizes.length) andVariant.push({ "variants.size": { $in: sizes } });
    if (colors.length) andVariant.push({ "variants.color": { $in: colors } });
    if (andVariant.length) Object.assign(match, { $and: andVariant });

    // Pipeline principal
    const pipeline = [
      { $match: match },

      // Campos calculados para ordenar/proyectar
      {
        $addFields: {
          effectivePrice: computeEffectiveExpr(),
          discountPercent: discountPercentExpr(),
          totalStock: { $sum: "$variants.stock" },
        },
      },

      // Ocultar al público cuando totalStock === 0
      ...(!isAdmin ? [{ $match: { totalStock: { $gt: 0 } } }] : []),

      // Facets: data + total + facets (sizes/colors)
      {
        $facet: {
          data: [
            { $sort: sortMap(sort) },
            { $skip: skip },
            { $limit: limit },

            // opcional: join categoría para traer nombre/slug
            {
              $lookup: {
                from: "categories",
                localField: "categories",
                foreignField: "_id",
                as: "cat",
              },
            },
            { $unwind: { path: "$cat", preserveNullAndEmptyArrays: true } },

            {
              $project: {
                _id: 1,
                name: 1,
                price: 1,
                effectivePrice: 1,
                discountPercent: 1,
                images: 1,
                salesCount: 1,
                createdAt: 1,
                totalStock: 1,
                category: {
                  _id: "$categories",
                  name: "$cat.name",
                  slug: "$cat.slug",
                },
                // puedes exponer flags útiles:
                onSale: { $gt: ["$discountPercent", 0] },
              },
            },
          ],
          meta: [{ $count: "total" }],
          sizes: [
            { $unwind: "$variants" },
            ...(sizes.length
              ? [{ $match: { "variants.size": { $in: sizes } } }]
              : []),
            { $group: { _id: "$variants.size", count: { $sum: 1 } } },
            {
              $lookup: {
                from: "sizes",
                localField: "_id",
                foreignField: "_id",
                as: "s",
              },
            },
            { $unwind: { path: "$s", preserveNullAndEmptyArrays: true } },
            { $project: { _id: 1, count: 1, label: "$s.label" } },
            { $sort: { count: -1 } },
          ],
          colors: [
            { $unwind: "$variants" },
            ...(colors.length
              ? [{ $match: { "variants.color": { $in: colors } } }]
              : []),
            { $group: { _id: "$variants.color", count: { $sum: 1 } } },
            {
              $lookup: {
                from: "colors",
                localField: "_id",
                foreignField: "_id",
                as: "c",
              },
            },
            { $unwind: { path: "$c", preserveNullAndEmptyArrays: true } },
            { $project: { _id: 1, count: 1, name: "$c.name" } },
            { $sort: { count: -1 } },
          ],
        },
      },
    ];

    const agg = await Product.aggregate(pipeline).option({
      allowDiskUse: true,
    });
    const first = agg[0] || { data: [], meta: [], sizes: [], colors: [] };
    const total = first.meta[0]?.total || 0;

    return res.json({
      data: first.data,
      page,
      limit,
      total,
      facets: {
        sizes: first.sizes,
        colors: first.colors,
      },
      appliedFilters: {
        category: req.query.category || null,
        q: qRaw || null,
        onSale: onSale ? 1 : 0,
        inStock: inStock ? 1 : 0,
        priceMin,
        priceMax,
        sizes: sizes.map(String),
        colors: colors.map(String),
      },
      sort,
    });
  } catch (err) {
    console.error("searchProducts error:", err);
    return res.status(500).json({ error: "Error en búsqueda de productos" });
  }
};

// ============================= /sections =============================
exports.getProductSections = async (req, res) => {
  try {
    const limit = clamp(parseIntSafe(req.query.limit, 12) || 12, 4, 24);
    const catId = await resolveCategoryId(req.query.category);

    const isAdmin = req.user?.role === "admin";
    const visibleMatch = !isAdmin
      ? [{ $match: { totalStock: { $gt: 0 } } }]
      : [];

    const baseMatch = {};
    if (catId) baseMatch.categories = catId;

    const nowDate = now();

    const onSalePipeline = [
      {
        $match: {
          ...baseMatch,
          "discount.enabled": true,
          $expr: {
            $and: [
              {
                $or: [
                  { $eq: ["$discount.startAt", null] },
                  { $lte: ["$discount.startAt", nowDate] },
                ],
              },
              {
                $or: [
                  { $eq: ["$discount.endAt", null] },
                  { $gte: ["$discount.endAt", nowDate] },
                ],
              },
            ],
          },
        },
      },
      {
        $addFields: {
          effectivePrice: computeEffectiveExpr(),
          discountPercent: discountPercentExpr(),
          totalStock: { $sum: "$variants.stock" },
        },
      },
      ...visibleMatch,
      { $sort: { discountPercent: -1, _id: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          name: 1,
          price: 1,
          effectivePrice: 1,
          discountPercent: 1,
          images: 1,
        },
      },
    ];

    const bestSellersPipeline = [
      { $match: baseMatch },
      {
        $addFields: {
          effectivePrice: computeEffectiveExpr(),
          totalStock: { $sum: "$variants.stock" },
        },
      },
      ...visibleMatch,
      { $sort: { salesCount: -1, _id: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          name: 1,
          price: 1,
          effectivePrice: 1,
          images: 1,
          salesCount: 1,
        },
      },
    ];

    const newArrivalsPipeline = [
      { $match: baseMatch },
      {
        $addFields: {
          effectivePrice: computeEffectiveExpr(),
          totalStock: { $sum: "$variants.stock" },
        },
      },
      ...visibleMatch,
      { $sort: { createdAt: -1, _id: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          name: 1,
          price: 1,
          effectivePrice: 1,
          images: 1,
          createdAt: 1,
        },
      },
    ];

    const trendingPipeline = [
      { $match: baseMatch },
      {
        $addFields: {
          effectivePrice: computeEffectiveExpr(),
          totalStock: { $sum: "$variants.stock" },
        },
      },
      ...visibleMatch,
      { $sort: { trendingScore: -1, _id: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          name: 1,
          price: 1,
          effectivePrice: 1,
          images: 1,
          trendingScore: 1,
        },
      },
    ];

    const [onSale, bestSellers, newArrivals, trending] = await Promise.all([
      Product.aggregate(onSalePipeline),
      Product.aggregate(bestSellersPipeline),
      Product.aggregate(newArrivalsPipeline),
      Product.aggregate(trendingPipeline),
    ]);

    return res.json({ onSale, bestSellers, newArrivals, trending });
  } catch (err) {
    console.error("getProductSections error:", err);
    return res.status(500).json({ error: "Error al obtener secciones" });
  }
};
