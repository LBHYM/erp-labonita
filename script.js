// ========== CONFIG ===================
const SHEET_JSON =
  "https://opensheet.elk.sh/1TyDxOtgkaxqhPCPTCSkpCkE7aCkZTNiC1XvS1AmiNnw/Sheet1";

// Link de tu formulario
const FORM_LINK =
  "https://docs.google.com/forms/d/e/1FAIpQLScU3WYqUEGqQmgcWajim9ZZvBcpwt8ZOONEOOSzRCueI9xygQ/viewform?usp=publish-editor";

let datos = [];
let graficaActual = null;

// -------------- UTILS ----------------
function money(n) { return "$" + (Number(n) || 0).toFixed(2); }
function safeStr(x){ return (x ?? "").toString().trim(); }

// ========== DATOS ===============
async function cargarDatos() {
  try {
    const res = await fetch(SHEET_JSON);
    const json = await res.json();
    datos = json;
    mostrar();
    actualizarDashboard();
    cargarSelectorProductos();
    graficar();
  } catch (err) {
    console.error("Error al cargar datos:", err);
  }
}

// ========== MOSTRAR TABLA =============
function mostrar(){
  const tabla = document.getElementById("tabla");
  const filtro = document.getElementById("buscador").value.toLowerCase();
  tabla.innerHTML = "";

  datos.forEach((fila, i) => {
    const proveedor = safeStr(fila[1]);
    const producto = safeStr(fila[2]);

    if (
      !proveedor.toLowerCase().includes(filtro) &&
      !producto.toLowerCase().includes(filtro)
    ) return;

    tabla.innerHTML += `
      <tr>
        <td>${proveedor}</td>
        <td>${producto}</td>
        <td>${money(fila[3])}</td>
        <td>${money(fila[4])}</td>
        <td>${money(fila[5])}</td>
        <td>${fila[6] || ""}</td>
        <td>${fila[7] || ""}</td>
      </tr>
    `;
  });
}

// ========== DASHBOARD =============
function actualizarDashboard(){
  let totalInv=0;
  let totalComp=datos.length;
  let counts={};

  datos.forEach(f=>{
    totalInv+=Number(f[5])||0;
    counts[safeStr(f[2])] =
      (counts[safeStr(f[2])]||0) + (Number(f[3])||0);
  });

  document.getElementById("totalInvertido").innerText=money(totalInv);
  document.getElementById("totalCompras").innerText=totalComp;

  let top="-", mx=0;
  Object.keys(counts).forEach(p=>{
    if(counts[p]>mx){ mx=counts[p]; top=p; }
  });

  document.getElementById("productoTop").innerText=top;
  document.getElementById("promedioGeneral").innerText=money(totalInv/totalComp);
}

// ========== ABRIR LINKS ==========
function abrirSheet(){
  window.open(
    "https://docs.google.com/spreadsheets/d/1TyDxOtgkaxqhPCPTCSkpCkE7aCkZTNiC1XvS1AmiNnw",
    "_blank"
  );
}

function abrirForm(){
  window.open(FORM_LINK, "_blank");
}

// ========== SELECTORES ANALISIS ==========
function cargarSelectorProductos(){
  const sel = document.getElementById("selectorProducto");
  sel.innerHTML="";
  const productos = [...new Set(datos.map(f=>safeStr(f[2])))].filter(Boolean);
  productos.forEach(p=>{
    sel.innerHTML+=`<option value="${p}">${p}</option>`;
  });
}

// ========== GRAFICA ==========
function graficar(){
  const prod = document.getElementById("selectorProducto").value;
  const ctx = document.getElementById("grafica");
  const historial = datos.filter(f=>safeStr(f[2])===prod);

  const labels = historial.map(f=>f[6]||"");
  const precios=historial.map(f=>Number(f[4])||0);

  if(graficaActual) graficaActual.destroy();
  graficaActual = new Chart(ctx,{type:"line",
    data:{labels,datasets:[{label:prod,data:precios,borderColor:"#C29B40",fill:false}]},
    options:{responsive:true,maintainAspectRatio:false}
  });
}

// ========== INICIO ==========
window.onload = cargarDatos;










