"use client";

import { useEffect, useState, useMemo, use } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { useCart } from "@/lib/cart";
import { Product } from "@/lib/types";
import { parseProductDescription } from "@/lib/description-parser";
import Link from "next/link";
import Image from "next/image";

function stripGhisaPrefix(title: string): string {
  return title.replace(/^Ghisa\s+/i, "");
}

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = use(params);
  const { t } = useI18n();
  const { formatPrice } = useCurrency();
  const { addToCart } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    fetch(`/api/products/${handle}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => {
        setProduct(data.product);
        // Auto-select color if only one
        const colors = getColors(data.product);
        if (colors.length === 1) setSelectedColor(colors[0]);
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [handle]);

  function getColors(p: Product): string[] {
    return [
      ...new Set(
        p.variants
          .map(
            (v) =>
              v.selectedOptions.find(
                (o) =>
                  o.name.toLowerCase() === "color" ||
                  o.name.toLowerCase() === "renk"
              )?.value
          )
          .filter(Boolean)
      ),
    ] as string[];
  }

  const colors = product ? getColors(product) : [];
  const hasColors = colors.length > 0;

  const seriDist = product?.seriDistribution || {};
  const seriEntries = Object.entries(seriDist);
  const totalPieces =
    seriEntries.reduce((sum, [, qty]) => sum + qty, 0) || 1;
  const unitPrice = product
    ? parseFloat(product.wholesalePrice.amount)
    : 0;
  const lotPrice = unitPrice * totalPieces;

  const hasCampaign = product ? product.campaignDiscount > 0 : false;

  const parsed = useMemo(
    () => parseProductDescription(product?.descriptionHtml),
    [product?.descriptionHtml]
  );

  const sku = useMemo(() => {
    if (!product) return null;
    const firstSku = product.variants[0]?.sku;
    if (!firstSku) return null;
    const parts = firstSku.split("-");
    return parts.length > 1 ? parts.slice(0, -1).join("-") : firstSku;
  }, [product]);

  function handleAddToCart() {
    if (!product) return;
    const variant = hasColors
      ? product.variants.find((v) => {
          const color = v.selectedOptions.find(
            (o) =>
              o.name.toLowerCase() === "color" ||
              o.name.toLowerCase() === "renk"
          )?.value;
          return color === selectedColor;
        })
      : product.variants[0];
    if (!variant) return;

    addToCart({
      variantId: `${product.handle}-${selectedColor || "default"}`,
      productHandle: product.handle,
      productTitle: stripGhisaPrefix(product.title),
      variantTitle: selectedColor || variant.title,
      price: lotPrice,
      quantity,
      image: product.images[0]?.url || null,
      color: selectedColor || "",
      seriDistribution: seriDist,
    });

    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  const canAdd = (!hasColors || !!selectedColor);
  const currentColor =
    selectedColor || (colors.length === 1 ? colors[0] : null);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <p className="text-gray-500">{t("loading")}</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <p className="text-gray-500">{t("noProducts")}</p>
      </div>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Image gallery */}
        <div className="flex flex-col-reverse md:flex-row gap-3">
          <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto md:max-h-[600px]">
            {product.images.map((img, i) => (
              <button
                key={i}
                onClick={() => setSelectedImage(i)}
                className={`shrink-0 w-16 h-20 relative border-2 rounded ${
                  selectedImage === i
                    ? "border-blue-600"
                    : "border-transparent"
                }`}
              >
                <Image
                  src={img.url}
                  alt={img.altText || ""}
                  fill
                  className="object-cover rounded"
                  sizes="64px"
                />
              </button>
            ))}
          </div>
          <div className="flex-1 aspect-[3/4] relative bg-gray-100 rounded-lg overflow-hidden">
            {product.images[selectedImage] && (
              <Image
                src={product.images[selectedImage].url}
                alt={product.images[selectedImage].altText || ""}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
              />
            )}
          </div>
        </div>

        {/* Product details */}
        <div className="space-y-6">
          <h1 className="text-3xl font-bold text-gray-900">
            {stripGhisaPrefix(product.title)}
          </h1>

          {currentColor && (
            <p className="text-sm text-gray-500">{currentColor}</p>
          )}

          {/* Price */}
          <div className="flex items-center gap-3">
            <span
              className={`text-2xl font-semibold ${
                hasCampaign ? "text-red-500" : "text-gray-900"
              }`}
            >
              {formatPrice(unitPrice)}
            </span>
            {hasCampaign && product.compareAtPrice && (
              <span className="text-lg text-gray-400 line-through">
                {formatPrice(parseFloat(product.compareAtPrice.amount))}
              </span>
            )}
            {hasCampaign && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded uppercase">
                %{product.campaignDiscount}
              </span>
            )}
          </div>

          {/* Sibling colors */}
          {product.siblings.length > 0 && (
            <div className="flex gap-2">
              {product.siblings.map((s) => (
                <Link
                  key={s.id}
                  href={`/products/${s.handle}`}
                  className="w-10 h-12 relative border border-gray-200 hover:border-blue-600 overflow-hidden rounded"
                  title={s.color || s.title}
                >
                  {s.featuredImage && (
                    <Image
                      src={s.featuredImage}
                      alt={s.color || ""}
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                  )}
                </Link>
              ))}
            </div>
          )}

          {/* Color selector */}
          {hasColors && colors.length > 1 && (
            <div>
              <label className="text-sm font-medium text-gray-900 uppercase tracking-wide">
                {t("selectColor")}
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`px-3 py-1.5 text-sm rounded-lg border ${
                      selectedColor === color
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-gray-200 text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Seri distribution */}
          {seriEntries.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg text-sm text-gray-600">
              <span className="font-medium text-gray-900">
                {t("lotSizes")}:
              </span>{" "}
              {seriEntries
                .flatMap(([size, qty]) => Array(qty).fill(size))
                .join("-")}{" "}
              ({totalPieces} {t("pieces")})
            </div>
          )}

          {/* Lot info */}
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm text-amber-800">
            {t("lotInfo")}
          </div>

          {/* Quantity + Add to cart */}
          <div className="flex items-center gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wide">
                {t("lotQuantity")}
              </label>
              <div className="flex items-center border border-gray-200 rounded-lg">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="px-3 py-2 hover:bg-gray-100 rounded-l-lg"
                >
                  -
                </button>
                <span className="px-4 py-2 min-w-[3rem] text-center">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  className="px-3 py-2 hover:bg-gray-100 rounded-r-lg"
                >
                  +
                </button>
              </div>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={!canAdd}
              className={`flex-1 py-3 text-sm uppercase tracking-wider rounded-lg font-semibold transition self-end ${
                added
                  ? "bg-green-600 text-white"
                  : canAdd
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              {added ? "OK" : t("addToCart")}
            </button>
          </div>

          {/* Description & specs */}
          {(parsed.description ||
            parsed.specs.length > 0 ||
            product.description) && (
            <div className="pt-6 border-t border-gray-200 space-y-4">
              {parsed.specs.length > 0 ? (
                <>
                  {parsed.description && (
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {parsed.description}
                    </p>
                  )}
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 uppercase tracking-wide mb-2">
                      {t("specifications")}
                    </h3>
                    <table className="w-full text-sm">
                      <tbody>
                        {parsed.specs.map((spec, i) => (
                          <tr
                            key={i}
                            className={i % 2 === 0 ? "bg-gray-50" : ""}
                          >
                            <td className="py-1.5 px-2 font-medium text-gray-900 w-1/3 rounded-l">
                              {spec.key}
                            </td>
                            <td className="py-1.5 px-2 text-gray-600 rounded-r">
                              {spec.value}
                            </td>
                          </tr>
                        ))}
                        {sku && (
                          <tr
                            className={
                              parsed.specs.length % 2 === 0 ? "bg-gray-50" : ""
                            }
                          >
                            <td className="py-1.5 px-2 font-medium text-gray-900 rounded-l">
                              {t("productCode")}
                            </td>
                            <td className="py-1.5 px-2 text-gray-600 rounded-r">
                              {sku}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : product.description ? (
                <p className="text-sm text-gray-600 leading-relaxed">
                  {product.description}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
