const URL_GOOGLE = "https://script.google.com/macros/s/AKfycbxVzDzyLA2pb2Zhsti1ttd9SpLt79ldnCdLGjoDxlgKSuDFRTw1ssWdFsY9xnu-5rLAow/exec";

let datos = [];
let graficaActual = null;

// Login
let modoEdicion = false;
let filaEditando = null;

/* ================= LOGIN ================= */

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

/* ================= CARGAR DATOS ================= */

async function cargarDatos() {
  const res = await fetch(URL_GOOGLE);
  const json = await res.json();

  datos = json; // incluye encabezados

  mostrar();
  actualizarDashboard();
  cargarSelector();
}

/* ================= MOSTRAR ================= */

function mostrar() {
  const tabla = document.getElementById("tabla");
  const filtro = document.getElementById("buscador").value.toLowerCase();
  tabla.innerHTML = "";

  datos.slice(1).forEach((fila, index) => {

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

    const filaRealSheets = index + 2; // fila 1 = encabezados

    tabla.innerHTML += `
      <tr>
        <td>${proveedor}</td>
        <td>${producto}</td>
        <td>${cantidad}</td>
        <td>$${costo.toFixed(2)}</td>
        <td>$${total.toFixed(2)}</td>
        <td>${fecha}</td>
        <td>${notas}</td>
        <td>
          <button style="background:#C29B40;color:white;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;"
            onclick="cargarEdicion(${filaRealSheets}, ${index})">Editar</button>

          <button style="background:#D38686;color:white;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;"
            onclick="eliminar(${filaRealSheets})">Borrar</button>
        </td>
      </tr>
    `;
  });
}

/* ================= DASHBOARD ================= */

function actualizarDashboard() {
  const totalInvertido = document.getElementById("totalInvertido");
  const totalCompras = document.getElementById("totalCompras");
  const productoTop = document.getElementById("productoTop");
  const promedioGeneral = document.getElementById("promedioGeneral");

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

  totalInvertido.textContent = "$" + total.toFixed(2);
  totalCompras.textContent = registros.length;

  let top = "-";
  let max = 0;
  Object.keys(resumen).forEach(p => {
    if (resumen[p] > max) {
      max = resumen[p];
      top = p;
    }
  });

  productoTop.textContent = top;
  promedioGeneral.textContent = "$" + (registros.length ? total / registros.length : 0).toFixed(2);
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

    await fetch(URL_GOOGLE, {
      method: "POST",
      body: JSON.stringify({
        accion: "editar",
        fila: filaEditando,
        proveedor,
        producto,
        cantidad,
        costo,
        total: cantidad * costo,
        fecha,
        notas
      })
    });

    cancelarEdicion();

  } else {

    await fetch(URL_GOOGLE, {
      method: "POST",
      body: JSON.stringify({
        accion: "agregar",
        proveedor,
        producto,
        cantidad,
        costo,
        total: cantidad * costo,
        fecha,
        notas
      })
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

  await fetch(URL_GOOGLE, {
    method: "POST",
    body: JSON.stringify({
      accion: "eliminar",
      fila: filaRealSheets
    })
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

/* ================= SELECTOR + GRAFICA ================= */

function cargarSelector() {
  const selector = document.getElementById("selectorProducto");
  selector.innerHTML = "";

  const productos = [...new Set(datos.slice(1).map(f => f[1]))];

  productos.forEach(p => {
    selector.innerHTML += `<option value="${p}">${p}</option>`;
  });

  if (productos.length) graficar();
}

function graficar() {
  const selector = document.getElementById("selectorProducto");
  const variacion = document.getElementById("variacion");

  const prod = selector.value;
  const historial = datos.slice(1).filter(f => f[1] === prod);

  const labels = historial.map(f => new Date(f[5]).toLocaleDateString());
  const precios = historial.map(f => Number(f[3]) || 0);

  if (graficaActual) graficaActual.destroy();

  graficaActual = new Chart(document.getElementById("grafica"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Costo unitario",
        data: precios,
        borderColor: "#C29B40",
        fill: false
      }]
    }
  });

  if (precios.length >= 2) {
    const diff = precios[precios.length - 1] - precios[precios.length - 2];
    variacion.innerText =
      diff > 0 ? `🔺 Subió $${diff.toFixed(2)} vs compra anterior`
      : diff < 0 ? `🔻 Bajó $${Math.abs(diff).toFixed(2)} vs compra anterior`
      : "➖ Sin cambio vs compra anterior";
  } else {
    variacion.innerText = "";
  }
}





