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

function toDateInputValue(valor) {
  if (!valor) return "";
  try {
    return new Date(valor).toISOString().split("T")[0];
  } catch {
    return "";
  }
}

/* ================= POST ================= */

async function postGoogle(payload) {
  const res = await fetch(URL_GOOGLE, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });

  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: "Respuesta no JSON: " + text };
  }
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
  cargarAutocompletado();
}

/* ================= AUTOCOMPLETAR ================= */

function cargarAutocompletado() {
  const listaProductos = document.getElementById("listaProductos");
  const listaProveedores = document.getElementById("listaProveedores");

  if (!listaProductos || !listaProveedores) return;

  listaProductos.innerHTML = "";
  listaProveedores.innerHTML = "";

  const registros = datos.slice(1);

  const productos = [...new Set(registros.map(f => safeStr(f[2])))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const proveedores = [...new Set(registros.map(f => safeStr(f[1])))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  productos.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p;
    listaProductos.appendChild(opt);
  });

  proveedores.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p;
    listaProveedores.appendChild(opt);
  });
}

/* ================= MOSTRAR TABLA ================= */

function mostrar() {
  const tabla = document.getElementById("tabla");
  const buscador = document.getElementById("buscador");

  if (!tabla) return;

  const filtro = buscador ? buscador.value.toLowerCase() : "";
  tabla.innerHTML = "";

  // ORDEN CON ID:
  // 0 ID
  // 1 PROVEEDOR
  // 2 PRODUCTO
  // 3 CANTIDAD
  // 4 COSTO
  // 5 TOTAL
  // 6 FECHA
  // 7 NOTAS

  datos.slice(1).forEach((fila) => {
    const id = safeStr(fila[0]);
    const proveedor = safeStr(fila[1]);
    const producto = safeStr(fila[2]);

    if (
      !proveedor.toLowerCase().includes(filtro) &&
      !producto.toLowerCase().includes(filtro)
    ) return;

    const cantidad = Number(fila[3]) || 0;
    const costo = Number(fila[4]) || 0;
    const total = Number(fila[5]) || 0;
    const fecha = fila[6] ? new Date(fila[6]).toLocaleDateString() : "";
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
          <button class="btn-mini btn-edit" onclick="cargarEdicion('${id}')">Editar</button>
          <button class="btn-mini btn-del" onclick="eliminarRegistro('${id}')">Borrar</button>
        </td>
      </tr>
    `;
  });
}

/* ================= DASHBOARD ================= */

function actualizarDashboard() {
  const registros = datos.slice(1);

  let totalInvertido = 0;
  let totalCompras = registros.length;

  let resumenCantidad = {};

  registros.forEach(fila => {
    const producto = safeStr(fila[2]);
    const cantidad = Number(fila[3]) || 0;
    const total = Number(fila[5]) || 0;

    totalInvertido += total;

    if (!resumenCantidad[producto]) resumenCantidad[producto] = 0;
    resumenCantidad[producto] += cantidad;
  });

  const elTotalInvertido = document.getElementById("totalInvertido");
  const elTotalCompras = document.getElementById("totalCompras");
  const elProductoTop = document.getElementById("productoTop");
  const elPromedioGeneral = document.getElementById("promedioGeneral");

  if (elTotalInvertido) elTotalInvertido.innerText = money(totalInvertido);
  if (elTotalCompras) elTotalCompras.innerText = totalCompras;

  let top = "-";
  let max = 0;
  Object.keys(resumenCantidad).forEach(p => {
    if (resumenCantidad[p] > max) {
      max = resumenCantidad[p];
      top = p;
    }
  });

  if (elProductoTop) elProductoTop.innerText = top;

  const promedioGeneral = totalCompras ? totalInvertido / totalCompras : 0;
  if (elPromedioGeneral) elPromedioGeneral.innerText = money(promedioGeneral);
}

/* ================= GUARDAR / EDITAR ================= */

async function guardarRegistro() {
  const proveedor = safeStr(document.getElementById("proveedor").value);
  const producto = safeStr(document.getElementById("producto").value);

  const cantidad = Number(document.getElementById("cantidad").value);
  const costo = Number(document.getElementById("costo").value);

  const fecha = document.getElementById("fecha").value;
  const notas = safeStr(document.getElementById("notas").value);

  if (!proveedor || !producto || !cantidad || !costo || !fecha) {
    alert("Completa los campos obligatorios");
    return;
  }

  const total = cantidad * costo;

  if (modoEdicion) {
    const r = await postGoogle({
      accion: "editar",
      id: idEditando,
      proveedor,
      producto,
      cantidad,
      costo,
      total,
      fecha,
      notas
    });

    if (!r.ok) {
      alert("Error al editar: " + (r.error || "desconocido"));
      return;
    }

    cancelarEdicion();
  } else {
    const nuevoID = Date.now().toString();

    const r = await postGoogle({
      accion: "agregar",
      id: nuevoID,
      proveedor,
      producto,
      cantidad,
      costo,
      total,
      fecha,
      notas
    });

    if (!r.ok) {
      alert("Error al guardar: " + (r.error || "desconocido"));
      return;
    }

    limpiarFormulario();
  }

  await cargarDatos();
}

/* ================= CARGAR EDICION ================= */

function cargarEdicion(id) {
  const registros = datos.slice(1);
  const fila = registros.find(f => safeStr(f[0]) === safeStr(id));
  if (!fila) return;

  document.getElementById("proveedor").value = safeStr(fila[1]);
  document.getElementById("producto").value = safeStr(fila[2]);
  document.getElementById("cantidad").value = fila[3] ?? "";
  document.getElementById("costo").value = fila[4] ?? "";
  document.getElementById("fecha").value = toDateInputValue(fila[6]);
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

async function eliminarRegistro(id) {
  if (!confirm("¿Seguro que deseas borrar este registro?")) return;

  const r = await postGoogle({
    accion: "eliminar",
    id: safeStr(id)
  });

  if (!r.ok) {
    alert("Error al borrar: " + (r.error || "desconocido"));
    return;
  }

  await cargarDatos();
}

/* ================= EXPORTAR ================= */

function exportarExcel() {
  const exportar = datos.slice(1).map(f => ({
    ID: f[0],
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
  if (!selectorProducto) return;

  selectorProducto.innerHTML = "";

  const productos = [...new Set(datos.slice(1).map(f => safeStr(f[2])))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  productos.forEach(p => {
    selectorProducto.innerHTML += `<option value="${p}">${p}</option>`;
  });
}

function actualizarProveedoresDeProducto() {
  const selectorProducto = document.getElementById("selectorProducto");
  const selectorProveedor = document.getElementById("selectorProveedor");

  if (!selectorProducto || !selectorProveedor) return;

  const producto = selectorProducto.value;

  const proveedores = [...new Set(
    datos.slice(1)
      .filter(f => safeStr(f[2]) === safeStr(producto))
      .map(f => safeStr(f[1]))
  )].filter(Boolean).sort((a, b) => a.localeCompare(b));

  selectorProveedor.innerHTML = `<option value="__TODOS__">Todos los proveedores</option>`;

  proveedores.forEach(p => {
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

  let historial = datos.slice(1).filter(f => safeStr(f[2]) === safeStr(prod));

  if (prov !== "__TODOS__") {
    historial = historial.filter(f => safeStr(f[1]) === safeStr(prov));
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
    options: { responsive: true, maintainAspectRatio: false }
  });

  if (precios.length === 0) {
    variacion.innerText = "Sin datos para este filtro.";
  } else {
    const ultimo = precios[precios.length - 1];
    const promedio = precios.reduce((a, b) => a + b, 0) / precios.length;

    let texto = `📌 Último costo: ${money(ultimo)} • Promedio: ${money(promedio)}`;

    if (precios.length >= 2) {
      const diff = ultimo - precios[precios.length - 2];
      texto += diff > 0 ? ` • 🔺 Subió ${money(diff)}`
        : diff < 0 ? ` • 🔻 Bajó ${money(Math.abs(diff))}`
        : ` • ➖ Sin cambio`;
    }

    variacion.innerText = texto;
  }

  // Mejor proveedor (promedio ponderado)
  if (prov === "__TODOS__") {
    const porProveedor = {};

    datos.slice(1)
      .filter(f => safeStr(f[2]) === safeStr(prod))
      .forEach(f => {
        const proveedor = safeStr(f[1]);
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
      mejorProveedor.innerHTML =
        `🏆 <b>Mejor proveedor para "${prod}"</b>: ${mejor} (Promedio ponderado: ${money(mejorProm)})`;
    } else {
      mejorProveedor.innerHTML = "";
    }
  } else {
    mejorProveedor.innerHTML = "";
  }
}

/* ================= INICIO ================= */

window.onload = () => {
  cargarDatos();
};











