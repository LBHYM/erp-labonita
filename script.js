const URL_GOOGLE =
  "https://script.google.com/macros/s/AKfycbxVzDzyLA2pb2Zhsti1ttd9SpLt79ldnCdLGjoDxlgKSuDFRTw1ssWdFsY9xnu-5rLAow/exec";

let datos = [];
let graficaActual = null;

// Edición
let modoEdicion = false;
let idEditando = null;

/* ================= UTILIDADES ================= */

function money(n) {
  const num = Number(n) || 0;
  return "$" + num.toFixed(2);
}

function safeStr(x) {
  return (x ?? "").toString().trim();
}

function safeNum(x) {
  const n = Number(x);
  return isNaN(n) ? 0 : n;
}

function safeDateISO(valor) {
  if (!valor) return "";
  try {
    const d = new Date(valor);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  } catch {
    return "";
  }
}

function safeDateDisplay(valor) {
  if (!valor) return "";
  try {
    const d = new Date(valor);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}

/* ================= NORMALIZAR FILA ================= */
/*
  Orden esperado (8 columnas):
  [0] ID
  [1] PROVEEDOR
  [2] PRODUCTO
  [3] CANTIDAD
  [4] COSTO
  [5] TOTAL
  [6] FECHA
  [7] NOTAS
*/
function normalizarFila(fila) {
  if (!Array.isArray(fila)) return null;

  const f = [...fila];

  while (f.length < 8) f.push("");
  if (f.length > 8) f.length = 8;

  const id = safeStr(f[0]);
  if (!id || id.toLowerCase() === "id") return null;

  const proveedor = safeStr(f[1]);
  const producto = safeStr(f[2]);

  if (!proveedor || !producto) return null;

  const cantidad = safeNum(f[3]);
  const costo = safeNum(f[4]);
  const total = safeNum(f[5]);

  const fecha = f[6] || "";
  const notas = safeStr(f[7]);

  return [id, proveedor, producto, cantidad, costo, total, fecha, notas];
}

/* ================= POST GOOGLE ================= */

async function postGoogle(payload) {
  const res = await fetch(URL_GOOGLE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return await res.json().catch(() => ({}));
}

/* ================= CARGAR DATOS ================= */

async function cargarDatos() {
  const res = await fetch(URL_GOOGLE);
  const json = await res.json();

  if (!Array.isArray(json)) {
    alert("Google Sheets no devolvió datos válidos.");
    return;
  }

  const header = json[0];
  const filas = json.slice(1);

  const limpias = filas.map(normalizarFila).filter(Boolean);

  datos = [header, ...limpias];

  mostrar();
  actualizarDashboard();
  cargarSelectorProductos();
  actualizarProveedoresDeProducto();
  cargarAutocompletado();
}

/* ================= AUTOCOMPLETADO ================= */

function cargarAutocompletado() {
  const listaProductos = document.getElementById("listaProductos");
  const listaProveedores = document.getElementById("listaProveedores");

  if (!listaProductos || !listaProveedores) return;

  listaProductos.innerHTML = "";
  listaProveedores.innerHTML = "";

  const registros = datos.slice(1);

  const productos = [...new Set(registros.map((f) => safeStr(f[2])))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const proveedores = [...new Set(registros.map((f) => safeStr(f[1])))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  productos.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p;
    listaProductos.appendChild(opt);
  });

  proveedores.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p;
    listaProveedores.appendChild(opt);
  });
}

/* ================= MOSTRAR TABLA ================= */

function mostrar() {
  const tabla = document.getElementById("tabla");
  const buscador = document.getElementById("buscador");

  if (!tabla || !buscador) return;

  const filtro = buscador.value.toLowerCase();
  tabla.innerHTML = "";

  datos.slice(1).forEach((fila) => {
    const id = safeStr(fila[0]);
    const proveedor = safeStr(fila[1]);
    const producto = safeStr(fila[2]);

    if (
      !proveedor.toLowerCase().includes(filtro) &&
      !producto.toLowerCase().includes(filtro)
    )
      return;

    const cantidad = safeNum(fila[3]);
    const costo = safeNum(fila[4]);
    const total = safeNum(fila[5]);
    const fecha = safeDateDisplay(fila[6]);
    const notas = safeStr(fila[7]);

    tabla.innerHTML += `
      <tr>
        <td>${proveedor}</td>
        <td>${producto}</td>
        <td>${cantidad}</td>
        <td>${money(costo)}</td>
        <td>${money(total)}</td>
        <td>${fecha}</td>
        <td>${notas}</td>
        <td class="acciones">
          <button class="btn-mini btn-edit" data-id="${id}">Editar</button>
          <button class="btn-mini btn-del" data-id="${id}">Borrar</button>
        </td>
      </tr>
    `;
  });

  // Eventos (IMPORTANTE para que NO se rompan)
  document.querySelectorAll(".btn-edit").forEach((btn) => {
    btn.onclick = () => cargarEdicion(btn.dataset.id);
  });

  document.querySelectorAll(".btn-del").forEach((btn) => {
    btn.onclick = () => eliminar(btn.dataset.id);
  });
}

/* ================= DASHBOARD ================= */

function actualizarDashboard() {
  const registros = datos.slice(1);

  let totalInvertido = 0;
  let totalCompras = registros.length;

  let resumenCantidad = {};

  registros.forEach((fila) => {
    const producto = safeStr(fila[2]);
    const cantidad = safeNum(fila[3]);
    const total = safeNum(fila[5]);

    totalInvertido += total;

    if (!resumenCantidad[producto]) resumenCantidad[producto] = 0;
    resumenCantidad[producto] += cantidad;
  });

  document.getElementById("totalInvertido").innerText = money(totalInvertido);
  document.getElementById("totalCompras").innerText = totalCompras;

  let top = "-";
  let max = 0;

  Object.keys(resumenCantidad).forEach((p) => {
    if (resumenCantidad[p] > max) {
      max = resumenCantidad[p];
      top = p;
    }
  });

  document.getElementById("productoTop").innerText = top;

  const promedioGeneral = totalCompras ? totalInvertido / totalCompras : 0;
  document.getElementById("promedioGeneral").innerText = money(promedioGeneral);
}

/* ================= GUARDAR / EDITAR ================= */

async function guardarRegistro() {
  const proveedor = safeStr(document.getElementById("proveedor").value);
  const producto = safeStr(document.getElementById("producto").value);

  const cantidad = safeNum(document.getElementById("cantidad").value);
  const costo = safeNum(document.getElementById("costo").value);

  const fecha = document.getElementById("fecha").value;
  const notas = safeStr(document.getElementById("notas").value);

  if (!proveedor || !producto || !cantidad || !costo || !fecha) {
    alert("Completa los campos obligatorios");
    return;
  }

  const total = cantidad * costo;

  if (modoEdicion) {
    await postGoogle({
      accion: "editar",
      id: idEditando,
      proveedor,
      producto,
      cantidad,
      costo,
      total,
      fecha,
      notas,
    });

    cancelarEdicion();
  } else {
    await postGoogle({
      accion: "agregar",
      id: Date.now().toString(),
      proveedor,
      producto,
      cantidad,
      costo,
      total,
      fecha,
      notas,
    });

    limpiarFormulario();
  }

  await cargarDatos();
}

/* ================= CARGAR EDICION ================= */

function cargarEdicion(id) {
  const registros = datos.slice(1);
  const fila = registros.find((f) => safeStr(f[0]) === safeStr(id));
  if (!fila) return;

  document.getElementById("proveedor").value = safeStr(fila[1]);
  document.getElementById("producto").value = safeStr(fila[2]);
  document.getElementById("cantidad").value = fila[3] ?? "";
  document.getElementById("costo").value = fila[4] ?? "";
  document.getElementById("fecha").value = safeDateISO(fila[6]);
  document.getElementById("notas").value = safeStr(fila[7]);

  modoEdicion = true;
  idEditando = safeStr(id);

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
    id: safeStr(id),
  });

  await cargarDatos();
}

/* ================= EXPORTAR ================= */

function exportarExcel() {
  const exportar = datos.slice(1).map((f) => ({
    ID: f[0],
    Proveedor: f[1],
    Producto: f[2],
    Cantidad: f[3],
    Costo: f[4],
    Total: f[5],
    Fecha: f[6],
    Notas: f[7],
  }));

  const hoja = XLSX.utils.json_to_sheet(exportar);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Compras");
  XLSX.writeFile(libro, "Compras_LaBonita.xlsx");
}

/* ================= SELECTORES ANALISIS ================= */

function cargarSelectorProductos() {
  const selectorProducto = document.getElementById("selectorProducto");
  if (!selectorProducto) return;

  selectorProducto.innerHTML = "";

  const productos = [...new Set(datos.slice(1).map((f) => safeStr(f[2])))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  productos.forEach((p) => {
    selectorProducto.innerHTML += `<option value="${p}">${p}</option>`;
  });
}

function actualizarProveedoresDeProducto() {
  const selectorProducto = document.getElementById("selectorProducto");
  const selectorProveedor = document.getElementById("selectorProveedor");

  if (!selectorProducto || !selectorProveedor) return;

  const producto = selectorProducto.value;

  const proveedores = [
    ...new Set(
      datos
        .slice(1)
        .filter((f) => safeStr(f[2]) === safeStr(producto))
        .map((f) => safeStr(f[1]))
    ),
  ]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  selectorProveedor.innerHTML = `<option value="__TODOS__">Todos los proveedores</option>`;

  proveedores.forEach((p) => {
    selectorProveedor.innerHTML += `<option value="${p}">${p}</option>`;
  });

  graficar();
}

/* ================= GRAFICA ================= */

function graficar() {
  const prod = document.getElementById("selectorProducto").value;
  const prov = document.getElementById("selectorProveedor").value;

  const variacion = document.getElementById("variacion");
  const mejorProveedor = document.getElementById("mejorProveedor");

  let historial = datos.slice(1).filter((f) => safeStr(f[2]) === safeStr(prod));

  if (prov !== "__TODOS__") {
    historial = historial.filter((f) => safeStr(f[1]) === safeStr(prov));
  }

  historial.sort((a, b) => new Date(a[6]) - new Date(b[6]));

  const labels = historial.map((f) => safeDateDisplay(f[6]));
  const precios = historial.map((f) => safeNum(f[4]));

  if (graficaActual) graficaActual.destroy();

  graficaActual = new Chart(document.getElementById("grafica"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label:
            prov === "__TODOS__"
              ? `Costo general: ${prod}`
              : `Costo ${prov}: ${prod}`,
          data: precios,
          borderColor: "#C29B40",
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });

  if (precios.length === 0) {
    variacion.innerText = "Sin datos para este filtro.";
  } else {
    const ultimo = precios[precios.length - 1];
    const promedio = precios.reduce((a, b) => a + b, 0) / precios.length;
    variacion.innerText = `📌 Último costo: ${money(ultimo)} • Promedio: ${money(
      promedio
    )}`;
  }

  // Mejor proveedor (ponderado)
  if (prov === "__TODOS__") {
    const porProveedor = {};

    datos
      .slice(1)
      .filter((f) => safeStr(f[2]) === safeStr(prod))
      .forEach((f) => {
        const proveedor = safeStr(f[1]);
        const cantidad = safeNum(f[3]);
        const total = safeNum(f[5]);

        if (!porProveedor[proveedor]) {
          porProveedor[proveedor] = { cantidad: 0, total: 0 };
        }

        porProveedor[proveedor].cantidad += cantidad;
        porProveedor[proveedor].total += total;
      });

    let mejor = null;
    let mejorProm = Infinity;

    Object.keys(porProveedor).forEach((p) => {
      const cant = porProveedor[p].cantidad;
      const prom = cant ? porProveedor[p].total / cant : Infinity;

      if (prom < mejorProm) {
        mejorProm = prom;
        mejor = p;
      }
    });

    if (mejor) {
      mejorProveedor.innerHTML = `🏆 <b>Mejor proveedor para "${prod}"</b>: ${mejor} (Promedio ponderado: ${money(
        mejorProm
      )})`;
    } else {
      mejorProveedor.innerHTML = "";
    }
  } else {
    mejorProveedor.innerHTML = "";
  }
}

/* ================= EVENTOS ================= */

function conectarEventos() {
  // Botón guardar
  document.getElementById("btnGuardar").onclick = guardarRegistro;

  // Cancelar
  document.getElementById("btnCancelar").onclick = cancelarEdicion;

  // Buscar
  document.getElementById("buscador").onkeyup = mostrar;

  // Exportar
  document.getElementById("btnExportar").onclick = exportarExcel;

  // Selectores análisis
  document.getElementById("selectorProducto").onchange =
    actualizarProveedoresDeProducto;

  document.getElementById("selectorProveedor").onchange = graficar;
}

/* ================= INICIO ================= */

window.onload = async () => {
  conectarEventos();
  await cargarDatos();
};








