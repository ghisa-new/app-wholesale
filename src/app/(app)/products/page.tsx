"use client";

import { Suspense, useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { Product } from "@/lib/types";
import { Category, normalizeType } from "@/lib/categories";
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
  const { t, locale } = useI18n();
  const { formatPrice } = useCurrency();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortOption>("newest");
  const PAGE = 48;
  const [visibleCount, setVisibleCount] = useState(48);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [season, setSeason] = useState<"" | "ss" | "aw">("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  useEffect(() => {
    const cat = searchParams.get("category");
    if (cat) setSelectedCategory(cat);
  }, [searchParams]);

  useEffect(() => {
    fetch(`/api/products?locale=${locale}`)
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
  }, [locale]);

  const filtered = useMemo(() => {
    let base = products;
    if (season) base = base.filter((p) => p.season === season);
    if (!selectedCategory) return base;
    const target = normalizeType(selectedCategory);
    return base.filter((p) => normalizeType(p.productType) === target);
  }, [products, selectedCategory, season]);

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

  // infinite scroll: render in pages of 48; the sentinel below the grid loads
  // the next page. Reset when any filter/sort changes.
  useEffect(() => {
    setVisibleCount(PAGE);
  }, [selectedCategory, season, sort, products]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((c) => Math.min(c + PAGE, sorted.length));
        }
      },
      { rootMargin: "600px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [sorted.length]);


  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <p className="text-gray-500">{t("loading")}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Hero: teaser video, then the banner after 15s */}
      <HeroBanner />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory("")}
                className={`px-4 py-2 text-xs uppercase tracking-[0.1em] border transition-colors ${
                  !selectedCategory
                    ? "border-ink bg-ink text-white"
                    : "border-line text-ink-soft hover:border-ink"
                }`}
              >
                {t("allCategories")}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.slug}
                  onClick={() => setSelectedCategory(cat.slug)}
                  className={`px-4 py-2 text-xs uppercase tracking-[0.1em] border transition-colors ${
                    normalizeType(selectedCategory) === cat.slug
                      ? "border-ink bg-ink text-white"
                      : "border-line text-ink-soft hover:border-ink"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2 w-full sm:w-auto">
            {(
              [
                ["", "Tümü"],
                ["ss", "İlkbahar / Yaz"],
                ["aw", "Sonbahar / Kış"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setSeason(val)}
                className={`px-4 py-2 text-xs uppercase tracking-[0.1em] border transition-colors ${
                  season === val
                    ? "border-ink bg-ink text-white"
                    : "border-line text-ink-soft hover:border-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="ml-auto">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="border border-line px-3 py-2 text-sm text-ink-soft bg-white focus:outline-none focus:border-ink"
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
            {sorted.slice(0, visibleCount).map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                formatPrice={formatPrice}
              />
            ))}
          </div>
        )}
        {visibleCount < sorted.length && (
          <div ref={sentinelRef} className="py-8 text-center text-xs text-gray-400">
            {visibleCount} / {sorted.length}
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
      <div className="aspect-[3/4] relative overflow-hidden bg-gray-100">
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
          <span className="absolute top-2 left-2 bg-sale text-white text-[10px] px-2 py-1 uppercase tracking-wider">
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
              hasCampaign ? "text-sale font-semibold" : "text-gray-900"
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


// Hero slider — slide 0: teaser video, slide 1: banner image. Auto-advances
// to the banner when the 15s video finishes; arrows + dots for manual swap.
function HeroBanner() {
  const [slide, setSlide] = useState(0);
  const [auto, setAuto] = useState(true); // manual interaction stops auto-advance
  useEffect(() => {
    if (!auto || slide !== 0) return;
    const t = setTimeout(() => setSlide(1), 15000);
    return () => clearTimeout(t);
  }, [auto, slide]);
  const go = (i: number) => {
    setAuto(false);
    setSlide(i);
  };
  return (
    <section className="relative w-full overflow-hidden group">
      <div className={slide === 1 ? "" : "invisible"}>
        <Image
          src="https://ghisa.com/cdn/shop/files/Artboard_55_b5d0bc53-8947-44b7-aab9-480365c6214a.jpg?v=1774956667&width=2000"
          alt="GHISA"
          width={2000}
          height={1000}
          className="w-full h-auto"
          sizes="100vw"
          priority
        />
      </div>
      <video
        src="/hero-teaser.mp4"
        autoPlay
        muted
        playsInline
        onEnded={() => auto && setSlide(1)}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
          slide === 0 ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      {/* arrows */}
      {[0, 1].map((dir) => (
        <button
          key={dir}
          aria-label={dir === 0 ? "Önceki" : "Sonraki"}
          onClick={() => go(slide === 0 ? 1 : 0)}
          className={`absolute top-1/2 -translate-y-1/2 ${
            dir === 0 ? "left-3" : "right-3"
          } w-9 h-9 rounded-full bg-black/30 hover:bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity`}
        >
          {dir === 0 ? "‹" : "›"}
        </button>
      ))}
      {/* dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
        {[0, 1].map((i) => (
          <button
            key={i}
            aria-label={`Slayt ${i + 1}`}
            onClick={() => go(i)}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              slide === i ? "bg-white" : "bg-white/40 hover:bg-white/70"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
