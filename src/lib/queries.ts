// Product fields fragment used across queries
const PRODUCT_FIELDS = `
  id
  title
  handle
  description
  tags
  productType
  availableForSale
  priceRange {
    minVariantPrice {
      amount
      currencyCode
    }
  }
  compareAtPriceRange {
    minVariantPrice {
      amount
      currencyCode
    }
  }
  images(first: 10) {
    edges {
      node {
        url
        altText
      }
    }
  }
  variants(first: 50) {
    edges {
      node {
        id
        title
        sku
        priceV2 {
          amount
          currencyCode
        }
        compareAtPriceV2 {
          amount
          currencyCode
        }
        availableForSale
        selectedOptions {
          name
          value
        }
        image {
          url
          altText
        }
      }
    }
  }
  metafield(namespace: "custom", key: "model_kodu_2") {
    references(first: 20) {
      edges {
        node {
          ... on Product {
            id
            handle
            title
            featuredImage {
              url
            }
            variants(first: 1) {
              edges {
                node {
                  selectedOptions {
                    name
                    value
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

// Fetch a single product by handle
export const GET_PRODUCT_BY_HANDLE = `
  query getProduct($handle: String!) {
    productByHandle(handle: $handle) {
      ${PRODUCT_FIELDS}
      descriptionHtml
    }
  }
`;

// Search products
export const SEARCH_PRODUCTS = `
  query searchProducts($query: String!, $first: Int!) {
    products(query: $query, first: $first, sortKey: RELEVANCE) {
      edges {
        node {
          ${PRODUCT_FIELDS}
        }
      }
    }
  }
`;
