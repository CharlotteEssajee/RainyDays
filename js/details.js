const queryString = document.location.search;

const params = new URLSearchParams(queryString);

const id = params.get("id");

if (id === null) {
  location.href = "/";
}

const url = "https://rainydays.flowerpower.one/wp-json/wc/store/products/";
const corsFix = url + id;

const idContainer = document.querySelector(".id");
const detailContainer = document.querySelector(".details");

idContainer.innerHTML = "";

async function getId() {
  try {
    const response = await fetch(corsFix);
    const product = await response.json();

    console.log(product);
    createHtml(product);
  } catch (error) {
    console.log(error);
    detailContainer.innerHTML = error;
  }
}

getId();

function createHtml(product) {
  detailContainer.innerHTML = `<div class ="cardDetail">
                                    <div class="imageContainer">
                                    <img src="${product.images[0].src}" alt="${product.name}">
                                </div>
                                <div class="productContainer">
                                    <h2>${product.name}</h2>
                                    <p class="priceTag">${product.prices.price}£</p>
                                    <select>
                                        <option>Small</option>
                                        <option>Medium</option>
                                        <option>Large</option>
                                        <option>X-Large</option>
                                    </select>
                                    <button>Add to cart</button>
                                    <h2 class="productDetails">Product Details</h2>
                                    <p class="productDescription">${product.description}</p>
                                </div>
                              </div>`;
}

function changeTitle() {
  document.title = `${product.name}`;
}

changeTitle();
