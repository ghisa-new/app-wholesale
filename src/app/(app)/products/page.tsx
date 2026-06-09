"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { Product } from "@/lib/types";
import Link from "next/link";
import Image from "next/image";

type SortOption = "newest" | "price-asc" | "price-desc" | "name-asc" | "name-desc";

function stripGhisaPrefix(title: string): string {
  return title.replace(/^Ghisa\s+/i, "");
}

export default function ProductsPage() {
  return (
    <Suspense>
      <ProductsPageInner />
    </Suspense>
  );
}

function ProductsPageInner() {
  const { t } = useI18n();
  const { formatPrice } = useCurrency();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortOption>("newest");
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  useEffect(() => {
    const cat = searchParams.get("category");
    if (cat) setSelectedCategory(cat);
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => {
        setProducts(data.products || []);
        setCategories(data.categories || []);
      })
      .catch(() => {
        setProducts([]);
        setCategories([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!selectedCategory) return products;
    return products.filter((p) =>
      p.tags.some(
        (tag) => tag.toLowerCase() === selectedCategory.toLowerCase()
      )
    );
  }, [products, selectedCategory]);

  const sorted = useMemo(() => {
    const items = [...filtered];
    switch (sort) {
      case "price-asc":
        return items.sort(
          (a, b) => parseFloat(a.price.amount) - parseFloat(b.price.amount)
        );
      case "price-desc":
        return items.sort(
          (a, b) => parseFloat(b.price.amount) - parseFloat(a.price.amount)
        );
      case "name-asc":
        return items.sort((a, b) =>
          stripGhisaPrefix(a.title).localeCompare(
            stripGhisaPrefix(b.title),
            "tr"
          )
        );
      case "name-desc":
        return items.sort((a, b) =>
          stripGhisaPrefix(b.title).localeCompare(
            stripGhisaPrefix(a.title),
            "tr"
          )
        );
      case "newest":
        return items.sort((a, b) => {
          const idA = parseInt(a.id.split("/").pop() || "0");
          const idB = parseInt(b.id.split("/").pop() || "0");
          return idB - idA;
        });
      default:
        return items;
    }
  }, [filtered, sort]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <p className="text-gray-500">{t("loading")}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Hero */}
      <section className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold tracking-wider">
            {t("heroTitle")}
          </h1>
          <p className="mt-3 text-gray-300 text-base">{t("heroSubtitle")}</p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory("")}
                className={`px-3 py-1.5 text-sm rounded-lg border ${
                  !selectedCategory
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-gray-200 text-gray-700 hover:border-gray-400"
                }`}
              >
                {t("allCategories")}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 text-sm rounded-lg border capitalize ${
                    selectedCategory === cat
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-gray-200 text-gray-700 hover:border-gray-400"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
          <div className="ml-auto">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="newest">{t("sortNewest")}</option>
              <option value="price-asc">{t("sortPriceLow")}</option>
              <option value="price-desc">{t("sortPriceHigh")}</option>
              <option value="name-asc">{t("sortNameAZ")}</option>
              <option value="name-desc">{t("sortNameZA")}</option>
            </select>
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          {sorted.length} {t("allProducts").toLowerCase()}
        </p>

        {sorted.length === 0 ? (
          <p className="text-center text-gray-500 py-12">{t("noProducts")}</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {sorted.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                formatPrice={formatPrice}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ProductCard({
  product,
  formatPrice,
}: {
  product: Product;
  formatPrice: (n: number) => string;
}) {
  const hasCampaign = product.campaignDiscount > 0;

  return (
    <Link href={`/products/${product.handle}`} className="group block">
      <div className="aspect-[3/4] relative overflow-hidden bg-gray-100 rounded-lg">
        {product.images[0] && (
          <Image
            src={product.images[0].url}
            alt={product.images[0].altText || product.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        )}
        {hasCampaign && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded uppercase tracking-wider">
            %{product.campaignDiscount}
          </span>
        )}
      </div>
      <div className="mt-3">
        <h3 className="text-sm font-medium text-gray-900">
          {stripGhisaPrefix(product.title)}
        </h3>
        <div className="mt-1 flex items-center gap-2">
          <span
            className={`text-sm ${
              hasCampaign ? "text-red-500 font-semibold" : "text-gray-900"
            }`}
          >
            {formatPrice(parseFloat(product.price.amount))}
          </span>
          {hasCampaign && product.compareAtPrice && (
            <span className="text-xs text-gray-400 line-through">
              {formatPrice(parseFloat(product.compareAtPrice.amount))}
            </span>
          )}
        </div>
        {product.siblings.length > 0 && (
          <div className="mt-2 flex gap-1">
            {product.siblings.slice(0, 5).map((s) => (
              <div
                key={s.id}
                className="w-4 h-4 rounded-full border border-gray-300 overflow-hidden"
                title={s.color || s.title}
              >
                {s.featuredImage && (
                  <Image
                    src={s.featuredImage}
                    alt={s.color || ""}
                    width={16}
                    height={16}
                    className="object-cover"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
