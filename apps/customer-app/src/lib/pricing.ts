export interface ProductPricingSnapshot {
  rental_price_1d?: number | string | null;
  rental_price_2d?: number | string | null;
  rental_price_3d?: number | string | null;
  rental_price?: number | string | null;
  buy_price?: number | string | null;
  price?: number | string | null;
}

const parsePrice = (value: number | string | null | undefined): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const getBaseRentalPrice = (product: ProductPricingSnapshot): number => {
  return parsePrice(product.rental_price) ?? parsePrice(product.price) ?? 0;
};

export const getPlanPrice = (product: ProductPricingSnapshot | null | undefined, plan: string): number => {
  if (!product) return 0;

  const baseRentalPrice = getBaseRentalPrice(product);

  switch (plan) {
    case "1d":
      return parsePrice(product.rental_price_1d) ?? baseRentalPrice;
    case "2d":
      return parsePrice(product.rental_price_2d) ?? baseRentalPrice;
    case "3d":
      return parsePrice(product.rental_price_3d) ?? baseRentalPrice;
    case "buy":
      return parsePrice(product.buy_price) ?? (baseRentalPrice > 0 ? baseRentalPrice * 5 : 0);
    default:
      return baseRentalPrice;
  }
};
