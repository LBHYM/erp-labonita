const URL_GOOGLE = "https://script.google.com/macros/s/AKfycbxVzDzyLA2pb2Zhsti1ttd9SpLt79ldnCdLGjoDxlgKSuDFRTw1ssWdFsY9xnu-5rLAow/exec";

let datos = [];
let graficaActual = null;

let modoEdicion = false;
let filaEditando = null;

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

/* ================= MOSTRAR TABLA ================= */

function mostrar() {
  const tabla = document.getElementById("tabla");
  const filtro = document.getElementById("buscador").value.toLowerCase();
  tabla.innerHTML = "";

  datos.slice(1).forEach((fila, index) => {

    // ORDEN REAL (SIN ID):
    // 0 PROVEEDOR
    // 1 PRODUCTO
    // 2 CANTIDAD
    // 3 COSTO
    // 4 TOTAL
    // 5 FECHA
    // 6 NOTAS

    const proveedor = (fila[0] || "").toString();
    const producto = (fila[1] || "").toString();

    if (
      !proveedor.toLowerCase().includes(filtro) &&
      !producto.toLowerCase().includes(filtro)
    ) return;

    const cantidad = Number(fila[2]) || 0;
    const costo = Number(fila[3]) || 0;
    const total = Number(fila[4]) || 0;
    const fecha = fila[5] ? new Date(fila[5]).toLocaleDateString() : "";
    const notas = fila[6] || "";

    const filaRealSheets = index + 2;

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
          <button class="btn-mini btn-edit" onclick="cargarEdicion(${filaRealSheets}, ${index})">Editar</button>
          <button class="btn-mini btn-del" onclick="eliminar(${filaRealSheets})">Borrar</button>
        </td>
      </tr>
    `;
  });
}

/* ================= DASHBOARD ================= */

function actualizarDashboard() {
  const registros = datos.slice(1);

  let total = 0;
  let resumen = {};

  registros.forEach(fila => {
    const prod = fila[1];
    const cant = Number(fila[2]) || 0;
    const tot = Number(fila[4]) || 0;

    total += tot;

    if (!resumen[prod]) resumen[prod] = 0;
    resumen[prod] += cant;
  });

  document.getElementById("totalInvertido").innerText = "$" + total.toFixed(2);
  document.getElementById("totalCompras").innerText = registros.length;

  let top = "-";
  let max = 0;
  Object.keys(resumen).forEach(p => {
    if (resumen[p] > max) {
      max = resumen[p];
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
      fila: filaEditando,
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

function cargarEdicion(filaRealSheets, index) {

  const fila = datos[index + 1];

  document.getElementById("proveedor").value = fila[0] || "";
  document.getElementById("producto").value = fila[1] || "";
  document.getElementById("cantidad").value = fila[2] || "";
  document.getElementById("costo").value = fila[3] || "";

  const fecha = fila[5] ? fila[5].toString().split("T")[0] : "";
  document.getElementById("fecha").value = fecha;

  document.getElementById("notas").value = fila[6] || "";

  modoEdicion = true;
  filaEditando = filaRealSheets;

  document.getElementById("btnGuardar").innerText = "Actualizar";
  document.getElementById("btnCancelar").style.display = "inline-block";
  document.getElementById("tituloFormulario").innerText = "Editar Compra";
}

/* ================= CANCELAR EDICION ================= */

function cancelarEdicion() {
  modoEdicion = false;
  filaEditando = null;

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

async function eliminar(filaRealSheets) {
  if (!confirm("¿Seguro que deseas borrar este registro?")) return;

  await postGoogle({
    accion: "eliminar",
    fila: filaRealSheets
  });

  cargarDatos();
}

/* ================= EXPORTAR ================= */

function exportarExcel() {
  const exportar = datos.slice(1).map(f => ({
    Proveedor: f[0],
    Producto: f[1],
    Cantidad: f[2],
    Costo: f[3],
    Total: f[4],
    Fecha: f[5],
    Notas: f[6]
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

  const productos = [...new Set(datos.slice(1).map(f => f[1]))].filter(Boolean);

  productos.forEach(p => {
    selectorProducto.innerHTML += `<option value="${p}">${p}</option>`;
  });
}

function actualizarProveedoresDeProducto() {
  const producto = document.getElementB





