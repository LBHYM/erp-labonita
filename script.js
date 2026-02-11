const URL_GOOGLE = "https://script.google.com/macros/s/AKfycbxVzDzyLA2pb2Zhsti1ttd9SpLt79ldnCdLGjoDxlgKSuDFRTw1ssWdFsY9xnu-5rLAow/exec";

let datos = [];
let graficaActual = null;

let modoEdicion = false;
let idEditando = null;

/* ================= LOGIN ================= */

function login() {
  const user = document.getElementById("usuario").value.trim();
  const pass = document.getElementById("password").value.trim();

  if (user === "LBHYM" && pass === "LB16082025") {
    localStorage.setItem("LB_LOGGED", "1");
    entrarSistema();
  } else {
    document.getElementById("errorLogin").innerText = "Credenciales incorrectas";
  }
}

function entrarSistema() {
  document.getElementById("loginContainer").style.display = "none";
  document.getElementById("sistema").style.display = "block";
  cargarDatos();
}

function logout() {
  localStorage.removeItem("LB_LOGGED");
  location.reload();
}

/* ================= POST SEGURO ================= */

async function postGoogle(payload) {
  const res = await fetch(URL_GOOGLE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  return await res.json().catch(() => ({}));
}

/* ================= CARGAR DATOS ================= */

async function cargarDatos() {
  const res = await fetch(URL_GOOGLE);
  const json = await res.json();

  datos = json;

  mostrar();
  actualizarDashboard();
  cargarSelectorProductos();
  actualizarProveedoresDeProducto();
}

/* ================= MOSTRAR ================= */

function mostrar() {
  const tabla = document.getElementById("tabla");
  const filtro = document.getElementById("buscador").value.toLowerCase();
  tabla.innerHTML = "";

  datos.slice(1).forEach((fila) => {

    // NUEVO ORDEN:
    // 0 ID
    // 1 PROVEEDOR
    // 2 PRODUCTO
    // 3 CANTIDAD
    // 4 COSTO
    // 5 TOTAL
    // 6 FECHA
    // 7 NOTAS

    const id = fila[0];
    const proveedor = (fila[1] || "").toString();
    const producto = (fila[2] || "").toString();

    if (
      !proveedor.toLowerCase().includes(filtro) &&
      !producto.toLowerCase().includes(filtro)
    ) return;

    const cantidad = Number(fila[3]) || 0;
    const costo = Number(fila[4]) || 0;
    const total = Number(fila[5]) || 0;
    const fecha = fila[6] ? new Date(fila[6]).toLocaleDateString() : "";
    const notas = fila[7] || "";

    tabla.innerHTML += `
      <tr>
        <td>${proveedor}</td>
        <td>${producto}</td>
        <td>${cantidad}</td>
        <td>$${costo.toFixed(2)}</td>
        <td>$${total.toFixed(2)}</td>
        <td>${fecha}</td>
        <td>${notas}</td>
        <td class="acciones">
          <button class="btn-mini btn-edit" onclick="cargarEdicion('${id}')">Editar</button>
          <button class="btn-mini btn-del" onclick="eliminar('${id}')">Borrar</button>
        </td>
      </tr>
    `;
  });
}

/* ================= DASHBOARD ================= */

function actualizarDashboard() {
  const registros = datos.slice(1);

  let total = 0;
  let resumenCantidades = {};
  let resumenTotalComprado = {};

  registros.forEach(fila => {
    const producto = fila[2];
    const cant = Number(fila[3]) || 0;
    const tot = Number(fila[5]) || 0;

    total += tot;

    if (!resumenCantidades[producto]) resumenCantidades[producto] = 0;
    resumenCantidades[producto] += cant;

    if (!resumenTotalComprado[producto]) resumenTotalComprado[producto] = 0;
    resumenTotalComprado[producto] += tot;
  });

  document.getElementById("totalInvertido").innerText = "$" + total.toFixed(2);
  document.getElementById("totalCompras").innerText = registros.length;

  let top = "-";
  let max = 0;
  Object.keys(resumenCantidades).forEach(p => {
    if (resumenCantidades[p] > max) {
      max = resumenCantidades[p];
      top = p;
    }
  });

  document.getElementById("productoTop").innerText = top;

  const promedioGeneral = registros.length ? total / registros.length : 0;
  document.getElementById("promedioGeneral").innerText = "$" + promedioGeneral.toFixed(2);
}

/* ================= GUARDAR / EDITAR ================= */

async function guardarRegistro() {

  const proveedor = document.getElementById("proveedor").value.trim();
  const producto = document.getElementById("producto").value.trim();
  const cantidad = Number(document.getElementById("cantidad").value);
  const costo = Number(document.getElementById("costo").value);
  const fecha = document.getElementById("fecha").value;
  const notas = document.getElementById("notas").value.trim();

  if (!proveedor || !producto || !cantidad || !costo || !fecha) {
    alert("Completa los campos obligatorios");
    return;
  }

  if (modoEdicion) {
    await postGoogle({
      accion: "editar",
      id: idEditando,
      proveedor,
      producto,
      cantidad,
      costo,
      total: cantidad * costo,
      fecha,
      notas
    });

    cancelarEdicion();

  } else {
    await postGoogle({
      accion: "agregar",
      proveedor,
      producto,
      cantidad,
      costo,
      total: cantidad * costo,
      fecha,
      notas
    });

    limpiarFormulario();
  }

  cargarDatos();
}

/* ================= CARGAR EDICION ================= */

function cargarEdicion(id) {

  const fila = datos.slice(1).find(f => String(f[0]) === String(id));
  if (!fila) return;

  document.getElementById("proveedor").value = fila[1] || "";
  document.getElementById("producto").value = fila[2] || "";
  document.getElementById("cantidad").value = fila[3] || "";
  document.getElementById("costo").value = fila[4] || "";

  const fecha = fila[6] ? fila[6].toString().split("T")[0] : "";
  document.getElementById("fecha").value = fecha;

  document.getElementById("notas").value = fila[7] || "";

  modoEdicion = true;
  idEditando = id;

  document.getElementById("btnGuardar").innerText = "Actualizar";
  document.getElementById("btnCancelar").style.display = "inline-block";
  document.getElementById("tituloFormulario").innerText = "Editar Compra";
}

/* ================= CANCELAR EDICION ================= */

function cancelarEdicion() {
  modoEdicion = false;
  idEditando = null;

  limpiarFormulario();

  document.getElementById("btnGuardar").innerText = "Registrar";
  document.getElementById("btnCancelar").style.display = "none";
  document.getElementById("tituloFormulario").innerText = "Registro de Compras";
}

/* ================= LIMPIAR ================= */

function limpiarFormulario() {
  document.getElementById("proveedor").value = "";
  document.getElementById("producto").value = "";
  document.getElementById("cantidad").value = "";
  document.getElementById("costo").value = "";
  document.getElementById("fecha").value = "";
  document.getElementById("notas").value = "";
}

/* ================= ELIMINAR ================= */

async function eliminar(id) {
  if (!confirm("¿Seguro que deseas borrar este registro?")) return;

  await postGoogle({
    accion: "eliminar",
    id
  });

  cargarDatos();
}

/* ================= EXPORTAR ================= */

function exportarExcel() {
  const exportar = datos.slice(1).map(f => ({
    Proveedor: f[1],
    Producto: f[2],
    Cantidad: f[3],
    Costo: f[4],
    Total: f[5],
    Fecha: f[6],
    Notas: f[7]
  }));

  const hoja = XLSX.utils.json_to_sheet(exportar);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Compras");
  XLSX.writeFile(libro, "Compras_LaBonita.xlsx");
}

/* ================= SELECTORES ANALISIS ================= */

function cargarSelectorProductos() {
  const selectorProducto = document.getElementById("selectorProducto");
  selectorProducto.innerHTML = "";

  const productos = [...new Set(datos.slice(1).map(f => f[2]))].filter(Boolean);

  productos.forEach(p => {
    selectorProducto.innerHTML += `<option value="${p}">${p}</option>`;
  });
}

function actualizarProveedoresDeProducto() {
  const producto = document.getElementById("selectorProducto").value;
  const selectorProveedor = document.getElementById("selectorProveedor");

  const proveedores = [...new Set(
    datos.slice(1)
      .filter(f => f[2] === producto)
      .map(f => f[1])
  )].filter(Boolean);

  selectorProveedor.innerHTML = `<option value="__TODOS__">Todos los proveedores</option>`;

  proveedores.forEach(p => {
    selectorProveedor.innerHTML += `<option value="${p}">${p}</option>`;
  });

  graficar();
}

/* ================= GRAFICA + RESUMEN ================= */

function graficar() {
  const prod = document.getElementById("selectorProducto").value;
  const prov = document.getElementById("selectorProveedor").value;

  const variacion = document.getElementById("variacion");
  const mejorProveedor = document.getElementById("mejorProveedor");

  let historial = datos.slice(1).filter(f => f[2] === prod);

  if (prov !== "__TODOS__") {
    historial = historial.filter(f => f[1] === prov);
  }

  historial.sort((a, b) => new Date(a[6]) - new Date(b[6]));

  const labels = historial.map(f => new Date(f[6]).toLocaleDateString());
  const precios = historial.map(f => Number(f[4]) || 0);

  if (graficaActual) graficaActual.destroy();

  graficaActual = new Chart(document.getElementById("grafica"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: prov === "__TODOS__" ? `Costo general: ${prod}` : `Costo ${prov}: ${prod}`,
        data: precios,
        borderColor: "#C29B40",
        fill: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });

  // Resumen claro
  if (precios.length === 0) {
    variacion.innerText = "Sin datos para este filtro.";
  } else {
    const ultimo = precios[precios.length - 1];
    const promedio = precios.reduce((a,b)=>a+b,0) / precios.length;

    let texto = `📌 Último costo: $${ultimo.toFixed(2)} • Promedio: $${promedio.toFixed(2)}`;

    if (precios.length >= 2) {
      const diff = ultimo - precios[precios.length - 2];
      texto += diff > 0 ? ` • 🔺 Subió $${diff.toFixed(2)}`
        : diff < 0 ? ` • 🔻 Bajó $${Math.abs(diff).toFixed(2)}`
        : ` • ➖ Sin cambio`;
    }

    variacion.innerText = texto;
  }

  // Mejor proveedor (solo si está en TODOS)
  if (prov === "__TODOS__") {
    const porProveedor = {};

    datos.slice(1)
      .filter(f => f[2] === prod)
      .forEach(f => {
        const proveedor = f[1];
        const cantidad = Number(f[3]) || 0;
        const total = Number(f[5]) || 0;

        if (!porProveedor[proveedor]) {
          porProveedor[proveedor] = { cantidad: 0, total: 0 };
        }
        porProveedor[proveedor].cantidad += cantidad;
        porProveedor[proveedor].total += total;
      });

    let mejor = null;
    let mejorProm = Infinity;

    Object.keys(porProveedor).forEach(p => {
      const cant = porProveedor[p].cantidad;
      const prom = cant ? porProveedor[p].total / cant : Infinity;

      if (prom < mejorProm) {
        mejorProm = prom;
        mejor = p;
      }
    });

    if (mejor) {
      mejorProveedor.innerHTML = `🏆 <b>Mejor proveedor para "${prod}"</b>: ${mejor} (Promedio ponderado: $${mejorProm.toFixed(2)})`;
    } else {
      mejorProveedor.innerHTML = "";
    }
  } else {
    mejorProveedor.innerHTML = "";
  }
}

/* ================= AUTO LOGIN ================= */

window.onload = () => {
  if (localStorage.getItem("LB_LOGGED") === "1") {
    entrarSistema();
  }
};





