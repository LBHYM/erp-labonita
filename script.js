const URL_GOOGLE = "https://script.google.com/macros/s/AKfycbxVzDzyLA2pb2Zhsti1ttd9SpLt79ldnCdLGjoDxlgKSuDFRTw1ssWdFsY9xnu-5rLAow/exec";

let datos = [];
let graficaActual = null;

/* LOGIN */
function login() {
  const user = document.getElementById("usuario").value;
  const pass = document.getElementById("password").value;

  if (user === "LBHYM" && pass === "LB16082025") {
    document.getElementById("loginContainer").style.display = "none";
    document.getElementById("sistema").style.display = "block";
    cargarDatos();
  } else {
    document.getElementById("errorLogin").innerText = "Credenciales incorrectas";
  }
}

/* CARGAR DATOS */
async function cargarDatos() {
  const res = await fetch(URL_GOOGLE);
  const json = await res.json();

  datos = json.slice(1).map((fila, i) => ({
    id: i,
    proveedor: fila[0],
    producto: fila[1],
    cantidad: Number(fila[2]),
    costo: Number(fila[3]),
    total: Number(fila[4]),
    fecha: fila[5],
    notas: fila[6]
  }));

  mostrar();
  actualizarDashboard();
  cargarSelector();
}

/* AGREGAR */
async function agregar() {
  const data = {
    proveedor: proveedor.value,
    producto: producto.value,
    cantidad: cantidad.value,
    costo: costo.value,
    fecha: fecha.value,
    notas: notas.value
  };

  await fetch(URL_GOOGLE, {
    method: "POST",
    body: JSON.stringify(data)
  });

  cargarDatos();
}

/* MOSTRAR */
function mostrar() {
  tabla.innerHTML = "";
  const filtro = buscador.value.toLowerCase();

  datos
    .filter(d =>
      d.proveedor.toLowerCase().includes(filtro) ||
      d.producto.toLowerCase().includes(filtro)
    )
    .forEach(d => {
      tabla.innerHTML += `
      <tr>
        <td>${d.proveedor}</td>
        <td>${d.producto}</td>
        <td>${d.cantidad}</td>
        <td>$${d.costo.toFixed(2)}</td>
        <td>$${d.total.toFixed(2)}</td>
        <td>${d.fecha}</td>
        <td>${d.notas}</td>
      </tr>`;
    });
}

/* DASHBOARD */
function actualizarDashboard() {
  let total = datos.reduce((a,b)=>a+b.total,0);
  totalInvertido.textContent = "$" + total.toFixed(2);
  totalCompras.textContent = datos.length;

  let resumen = {};
  datos.forEach(d=>{
    resumen[d.producto]=(resumen[d.producto]||0)+d.cantidad;
  });

  let top = Object.keys(resumen).reduce((a,b)=> resumen[a]>resumen[b]?a:b,"-");
  productoTop.textContent = top;

  promedioGeneral.textContent = "$" + (total/datos.length || 0).toFixed(2);
}

/* SELECTOR */
function cargarSelector(){
  selectorProducto.innerHTML="";
  let productos=[...new Set(datos.map(d=>d.producto))];
  productos.forEach(p=>{
    selectorProducto.innerHTML+=`<option>${p}</option>`;
  });
  graficar();
}

/* GRAFICA */
function graficar(){
  let prod=selectorProducto.value;
  let historial=datos.filter(d=>d.producto===prod);

  let labels=historial.map(d=>d.fecha);
  let precios=historial.map(d=>d.costo);

  if(graficaActual) graficaActual.destroy();

  graficaActual=new Chart(grafica,{
    type:"line",
    data:{
      labels:labels,
      datasets:[{
        label:"Precio",
        data:precios,
        borderColor:"#C29B40",
        fill:false
      }]
    }
  });
}


