const url = "https://rainydays.flowerpower.one/wp-json/wc/store/products";
const productContainer = document.querySelector(".products");

async function getProducts() {
  try {
    const response = await fetch(url);
    const getResults = await response.json();

    const product = getResults;

    createHTML(getResults);
  } catch (error) {}
}

getProducts();

function createHTML(products) {
  products.forEach(function (product) {
    productContainer.innerHTML += `<a href="details.html?id=${product.id}" class="product">
        <img src="${product.images[0].src}" alt="${product.name}">
        <p class="productName">${product.name}</p>
        <p class="productPrice">Price: ${product.prices.price}£</p>
      </a>`;
  });
}
