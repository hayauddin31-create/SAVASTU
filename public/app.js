let products=[], cart=JSON.parse(localStorage.getItem("savastu-cart")||"[]"), currentCat="All";
const money=n=>"Rs. "+Number(n).toLocaleString("en-PK");
async function loadProducts(){ products=await fetch("/api/products").then(r=>r.json()); renderProducts(); }
function renderProducts(){
  const list=products.filter(p=>currentCat==="All"||p.category===currentCat);
  document.querySelector("#products").innerHTML=list.map(p=>`
  <article class="product"><img class="product-img" src="${p.image}" alt="${escapeHtml(p.name)}">
  <div class="product-info"><p class="eyebrow">${escapeHtml(p.category)} · ${escapeHtml(p.size)}</p><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.description)}</p><b class="price">${money(p.price)}</b>
  <button class="btn gold buy" onclick="addToCart(${p.id})">Add to Bag</button></div></article>`).join("");
}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function save(){localStorage.setItem("savastu-cart",JSON.stringify(cart));document.querySelector("#cartCount").textContent=cart.reduce((a,x)=>a+x.qty,0)}
function addToCart(id){let p=products.find(x=>x.id===id);let x=cart.find(x=>x.id===id);if(x)x.qty++;else cart.push({id:p.id,name:p.name,price:p.price,image:p.image,qty:1});save();openCart()}
function openCart(){renderCart();document.querySelector("#cartModal").classList.add("open")}
function closeCart(){document.querySelector("#cartModal").classList.remove("open")}
function renderCart(){let box=document.querySelector("#cartItems");if(!cart.length){box.innerHTML="<p>Your bag is empty.</p>";document.querySelector("#cartTotal").textContent="Rs. 0";return}
box.innerHTML=cart.map(x=>`<div class="cart-row"><img src="${x.image}" alt=""><div><b>${escapeHtml(x.name)}</b><div>${money(x.price)}</div><div class="qty"><button onclick="changeQty(${x.id},-1)">−</button> ${x.qty} <button onclick="changeQty(${x.id},1)">+</button></div></div><b>${money(x.price*x.qty)}</b></div>`).join("");
document.querySelector("#cartTotal").textContent=money(cart.reduce((a,x)=>a+x.price*x.qty,0))}
function changeQty(id,d){let x=cart.find(x=>x.id===id);if(!x)return;x.qty+=d;if(x.qty<=0)cart=cart.filter(x=>x.id!==id);save();renderCart()}
function openCheckout(){if(!cart.length)return;closeCart();document.querySelector("#checkoutModal").classList.add("open")}
function closeCheckout(){document.querySelector("#checkoutModal").classList.remove("open")}
document.querySelectorAll(".filters button").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".filters button").forEach(x=>x.classList.remove("active"));b.classList.add("active");currentCat=b.dataset.cat;renderProducts()}));
document.querySelector("#checkoutForm").addEventListener("submit",async e=>{e.preventDefault();let f=new FormData(e.target);let subtotal=cart.reduce((a,x)=>a+x.price*x.qty,0);let delivery=0;let body={customer:{name:f.get("name"),phone:f.get("phone"),city:f.get("city"),address:f.get("address")},items:cart.map(x=>({id:x.id,name:x.name,price:x.price,qty:x.qty})),subtotal,delivery,total:subtotal+delivery};let r=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});let data=await r.json();let msg=document.querySelector("#orderMsg");if(r.ok){msg.textContent="Order received! Your order number is "+data.orderId;cart=[];save();e.target.reset()}else msg.textContent=data.error||"Could not place order."});
loadProducts();save();
