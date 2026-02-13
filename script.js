/* =========================
   CONFIGURACIÓN
========================= */

const URL_GOOGLE = "https://script.google.com/macros/s/AKfycbxVzDzyLA2pb2Zhsti1ttd9SpLt79ldnCdLGjoDxlgKSuDFRTw1ssWdFsY9xnu-5rLAow/exec";

/*
ORDEN ESPERADO EN SHEETS:
0 ID
1 PROVEEDOR
2 PRODUCTO
3 CANTIDAD
4 COSTO
5 TOTAL
6 FECHA
7 NOTAS
8 ESTATUS
9 PAGO
*/

let datos = [];
let graficaActual = null;

// Edición
let modoEdicion = false;
let idEditando = null;

/* =========================
   UTILIDADES
========================= */

function money(n) {
  const num = Number(n) || 0;
  return "$" + num.toFixed(2);
}

function safeStr(x) {
  return (x ?? "").toString().trim();
}

function normUpper(x) {
  return safeStr(x).toUpperCase();
}

function toISODateOnly(valor) {
  if (!valor) return "";
  try {
    return new Date(valor).toISOString().split("T")[0];
  } catch {
    return "";
  }
}

function getFiltrosFecha() {
  const desde = document.getElementById("filtroDesde").value;
  const hasta = document.getElementById("filtroHasta").value;

  const d1 = desde ? new Date(desde + "T00:00:00") : null;
  const d2 = hasta ? new Date(hasta + "T23:59:59") : null;

  return { d1, d2 };
}

function pasaFiltroFecha(fechaISO) {
  const { d1, d2 } = getFiltrosFecha();
  if (!d1 && !d2) return true;

  const f = fechaISO ? new Date(fechaISO) : null;
  if (!f) return false;

  if (d1 && f < d1) return false;
  if (d2 && f > d2) return false;

  return true;
}

/* =========================
   POST GOOGLE
========================= */

async function postGoogle(payload) {
  const res = await fetch(URL_GOOGLE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  return await res.json().catch(() => ({}));
}

/* =========================
   CARGAR DATOS
========================= */

async function cargarDatos() {
  const res = await fetch(URL_GOOGLE);
  const json = await res.json();

  datos = json;

  mostrar();
  actualizarDashboard();
  actualizarResumenProveedor();
  cargarSelectorProductos();
  actualizarProveedoresDeProducto();
  cargarAutocompletado();
}

/* =========================
   AUTOCOMPLETAR
========================= */

function cargarAutocompletado() {
  const listaProductos = document.getElementById("listaProductos");
  const listaProveedores = document.getElementById("listaProveedores");

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

/* =========================
   MOSTRAR TABLA
========================= */

function mostrar() {
  const tabla = document.getElementById("tabla");
  const filtro = document.getElementById("buscador").value.toLowerCase();

  tabla.innerHTML = "";

  const registros = datos.slice(1);

  registros.forEach((fila) => {

    const id = safeStr(fila[0]);
    const proveedor = safeStr(fila[1]);
    const producto = safeStr(fila[2]);

    const cantidad = Number(fila[3]) || 0;
    const costo = Number(fila[4]) || 0;
    const total = Number(fila[5]) || (cantidad * costo);

    const fechaISO = fila[6];
    const fecha = fechaISO ? new Date(fechaISO).toLocaleDateString() : "";

    const notas = safeStr(fila[7]);
    const estatus = normUpper(fila[8] || "ACTIVO");
    const pago = normUpper(fila[9] || "PENDIENTE");

    // Filtro texto
    if (
      !proveedor.toLowerCase().includes(filtro) &&
      !producto.toLowerCase().includes(filtro)
    ) return;

    // Filtro fecha
    if (!pasaFiltroFecha(fechaISO)) return;

    const estatusTag = estatus === "CANCELADO"
      ? `<span style="font-weight:900;color:#D38686;">CANCELADO</span>`
      : `<span style="font-weight:900;color:#5C4033;">ACTIVO</span>`;

    const pagoTag = pago === "PAGADO"
      ? `<span style="font-weight:900;color:#A4C639;">PAGADO</span>`
      : `<span style="font-weight:900;color:#C29B40;">PENDIENTE</span>`;

    tabla.innerHTML += `
      <tr>
        <td>${proveedor}</td>
        <td>${producto}</td>
        <td>${cantidad}</td>
        <td>${money(costo)}</td>
        <td>${money(total)}</td>
        <td>${fecha}</td>
        <td>${estatusTag}</td>
        <td>${pagoTag}</td>
        <td>${notas}</td>
        <td class="acciones">
          <button class="btn-mini btn-edit" onclick="cargarEdicion('${id}')">Editar</button>
          <button class="btn-mini btn-del" onclick="cancelarRegistro('${id}')">Cancelar</button>
        </td>
      </tr>
    `;
  });
}

/* =========================
   DASHBOARD
========================= */

function actualizarDashboard() {
  const registros = datos.slice(1);

  let totalInvertido = 0;
  let totalCompras = 0;
  let totalPendiente = 0;

  let resumenCantidad = {};

  registros.forEach(fila => {
    const estatus = normUpper(fila[8] || "ACTIVO");
    const pago = normUpper(fila[9] || "PENDIENTE");

    const fechaISO = fila[6];
    if (!pasaFiltroFecha(fechaISO)) return;

    if (estatus === "CANCELADO") return;

    const producto = safeStr(fila[2]);
    const cantidad = Number(fila[3]) || 0;
    const total = Number(fila[5]) || 0;

    totalInvertido += total;
    totalCompras += 1;

    if (pago === "PENDIENTE") {
      totalPendiente += total;
    }

    if (!resumenCantidad[producto]) resumenCantidad[producto] = 0;
    resumenCantidad[producto] += cantidad;
  });

  document.getElementById("totalInvertido").innerText = money(totalInvertido);
  document.getElementById("totalCompras").innerText = totalCompras;
  document.getElementById("totalPendiente").innerText = money(totalPendiente);

  let top = "-";
  let max = 0;

  Object.keys(resumenCantidad).forEach(p => {
    if (resumenCantidad[p] > max) {
      max = resumenCantidad[p];
      top = p;
    }
  });

  document.getElementById("productoTop").innerText = top;
}

/* =========================
   RESUMEN PROVEEDORES
========================= */

function actualizarResumenProveedor() {
  const tabla = document.getElementById("tablaProveedores");
  tabla.innerHTML = "";

  const registros = datos.slice(1);

  const resumen = {};

  registros.forEach(f => {
    const proveedor = safeStr(f[1]);
    const estatus = normUpper(f[8] || "ACTIVO");
    const pago = normUpper(f[9] || "PENDIENTE");

    const fechaISO = f[6];
    if (!pasaFiltroFecha(fechaISO)) return;

    if (estatus === "CANCELADO") return;

    const total = Number(f[5]) || 0;

    if (!resumen[proveedor]) {
      resumen[proveedor] = {
        compras: 0,
        total: 0,
        pendiente: 0
      };
    }

    resumen[proveedor].compras += 1;
    resumen[proveedor].total += total;

    if (pago === "PENDIENTE") {
      resumen[proveedor].pendiente += total;
    }
  });

  const proveedoresOrdenados = Object.keys(resumen)
    .sort((a, b) => resumen[b].total - resumen[a].total);

  proveedoresOrdenados.forEach(p => {
    tabla.innerHTML += `
      <tr>
        <td><b>${p}</b></td>
        <td>${resumen[p].compras}</td>
        <td>${money(resumen[p].total)}</td>
        <td>${money(resumen[p].pendiente)}</td>
      </tr>
    `;
  });

  if (proveedoresOrdenados.length === 0) {
    tabla.innerHTML = `
      <tr>
        <td colspan="4" style="opacity:.7;">Sin datos en el rango de fechas.</td>
      </tr>
    `;
  }
}

/* =========================
   GUARDAR / EDITAR
========================= */

async function guardarRegistro() {
  const proveedor = safeStr(document.getElementById("proveedor").value);
  const producto = safeStr(document.getElementById("producto").value);

  const cantidad = Number(document.getElementById("cantidad").value);
  const costo = Number(document.getElementById("costo").value);

  const fecha = document.getElementById("fecha").value;
  const notas = safeStr(document.getElementById("notas").value);

  const estatus = normUpper(document.getElementById("estatus").value);
  const pago = normUpper(document.getElementById("pago").value);

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
      estatus,
      pago
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
      estatus,
      pago
    });

    limpiarFormulario();
  }

  cargarDatos();
}

/* =========================
   CARGAR EDICION
========================= */

function cargarEdicion(id) {
  const registros = datos.slice(1);
  const fila = registros.find(f => safeStr(f[0]) === safeStr(id));
  if (!fila) return;

  document.getElementById("proveedor").value = safeStr(fila[1]);
  document.getElementById("producto").value = safeStr(fila[2]);
  document.getElementById("cantidad").value = fila[3] ?? "";
  document.getElementById("costo").value = fila[4] ?? "";
  document.getElementById("fecha").value = toISODateOnly(fila[6]);
  document.getElementById("notas").value = safeStr(fila[7]);

  document.getElementById("estatus").value = normUpper(fila[8] || "ACTIVO");
  document.getElementById("pago").value = normUpper(fila[9] || "PENDIENTE");

  modoEdicion = true;
  idEditando = safeStr(id);

  document.getElementById("btnGuardar").innerText = "Actualizar";
  document.getElementById("btnCancelar").style.display = "inline-block";
  document.getElementById("tituloFormulario").innerText = "Editar Compra";
}

/* =========================
   CANCELAR EDICION
========================= */

function cancelarEdicion() {
  modoEdicion = false;
  idEditando = null;

  limpiarFormulario();

  document.getElementById("btnGuardar").innerText = "Registrar";
  document.getElementById("btnCancelar").style.display = "none";
  document.getElementById("tituloFormulario").innerText = "Registro de Compras";
}

/* =========================
   LIMPIAR
========================= */

function limpiarFormulario() {
  document.getElementById("proveedor").value = "";
  document.getElementById("producto").value = "";
  document.getElementById("cantidad").value = "";
  document.getElementById("costo").value = "";
  document.getElementById("fecha").value = "";
  document.getElementById("notas").value = "";

  document.getElementById("estatus").value = "ACTIVO";
  document.getElementById("pago").value = "PENDIENTE";
}

/* =========================
   CANCELAR REGISTRO
========================= */

async function cancelarRegistro(id) {
  if (!confirm("¿Seguro que deseas CANCELAR este registro? (No se borrará, solo se marcará como CANCELADO)")) return;

  // Buscar fila actual
  const registros = datos.slice(1);
  const fila = registros.find(f => safeStr(f[0]) === safeStr(id));
  if (!fila) return;

  const proveedor = safeStr(fila[1]);
  const producto = safeStr(fila[2]);
  const cantidad = Number(fila[3]) || 0;
  const costo = Number(fila[4]) || 0;
  const total = Number(fila[5]) || 0;
  const fecha = toISODateOnly(fila[6]);
  const notas = safeStr(fila[7]);

  await postGoogle({
    accion: "editar",
    id: safeStr(id),
    proveedor,
    producto,
    cantidad,
    costo,
    total,
    fecha,
    notas,
    estatus: "CANCELADO",
    pago: normUpper(fila[9] || "PENDIENTE")
  });

  cargarDatos();
}

/* =========================
   EXPORTAR EXCEL (3 HOJAS)
========================= */

function exportarExcel() {
  const registros = datos.slice(1);

  // APLICAR FILTRO FECHA Y SOLO ACTIVOS
  const filtrados = registros.filter(f => {
    const estatus = normUpper(f[8] || "ACTIVO");
    const fechaISO = f[6];
    return estatus !== "CANCELADO" && pasaFiltroFecha(fechaISO);
  });

  // -----------------------
  // HOJA 1: COMPRAS
  // -----------------------
  const hojaCompras = filtrados.map(f => ({
    ID: f[0],
    Proveedor: f[1],
    Producto: f[2],
    Cantidad: f[3],
    Costo: f[4],
    Total: f[5],
    Fecha: toISODateOnly(f[6]),
    Notas: f[7],
    Estatus: f[8],
    Pago: f[9]
  }));

  // -----------------------
  // HOJA 2: FECHA + PRODUCTO
  // -----------------------
  const resumenFP = {};
  filtrados.forEach(f => {
    const fecha = toISODateOnly(f[6]);
    const producto = safeStr(f[2]);
    const key = `${fecha}||${producto}`;

    const cantidad = Number(f[3]) || 0;
    const total = Number(f[5]) || 0;

    if (!resumenFP[key]) {
      resumenFP[key] = {
        Fecha: fecha,
        Producto: producto,
        CantidadTotal: 0,
        TotalGastado: 0
      };
    }

    resumenFP[key].CantidadTotal += cantidad;
    resumenFP[key].TotalGastado += total;
  });

  const hojaFechaProducto = Object.values(resumenFP)
    .sort((a, b) => (a.Fecha + a.Producto).localeCompare(b.Fecha + b.Producto));

  // -----------------------
  // HOJA 3: FECHA + PRODUCTO + PROVEEDOR
  // -----------------------
  const resumenFPP = {};
  filtrados.forEach(f => {
    const fecha = toISODateOnly(f[6]);
    const producto = safeStr(f[2]);
    const proveedor = safeStr(f[1]);
    const key = `${fecha}||${producto}||${proveedor}`;

    const cantidad = Number(f[3]) || 0;
    const total = Number(f[5]) || 0;

    if (!resumenFPP[key]) {
      resumenFPP[key] = {
        Fecha: fecha,
        Producto: producto,
        Proveedor: proveedor,
        CantidadTotal: 0,
        TotalGastado: 0,
        CostoPromedio: 0
      };
    }

    resumenFPP[key].CantidadTotal += cantidad;
    resumenFPP[key].TotalGastado += total;
  });

  // Calcular costo promedio ponderado
  Object.keys(resumenFPP).forEach(k => {
    const item = resumenFPP[k];
    item.CostoPromedio = item.CantidadTotal
      ? item.TotalGastado / item.CantidadTotal
      : 0;
  });

  const hojaFechaProductoProveedor = Object.values(resumenFPP)
    .sort((a, b) => (a.Fecha + a.Producto + a.Proveedor).localeCompare(b.Fecha + b.Producto + b.Proveedor))
    .map(x => ({
      Fecha: x.Fecha,
      Producto: x.Producto,
      Proveedor: x.Proveedor,
      CantidadTotal: x.CantidadTotal,
      TotalGastado: x.TotalGastado,
      CostoPromedio: Number(x.CostoPromedio.toFixed(2))
    }));

  // -----------------------
  // CREAR EXCEL
  // -----------------------
  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.json_to_sheet(hojaCompras);
  const ws2 = XLSX.utils.json_to_sheet(hojaFechaProducto);
  const ws3 = XLSX.utils.json_to_sheet(hojaFechaProductoProveedor);

  XLSX.utils.book_append_sheet(wb, ws1, "Compras");
  XLSX.utils.book_append_sheet(wb, ws2, "Fecha+Producto");
  XLSX.utils.book_append_sheet(wb, ws3, "Fecha+Prod+Prov");

  XLSX.writeFile(wb, "Compras_LaBonita.xlsx");
}

/* =========================
   SELECTORES ANALISIS
========================= */

function cargarSelectorProductos() {
  const selectorProducto = document.getElementById("selectorProducto");
  selectorProducto.innerHTML = "";

  const productos = [...new Set(datos.slice(1).map(f => safeStr(f[2])))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  productos.forEach(p => {
    selectorProducto.innerHTML += `<option value="${p}">${p}</option>`;
  });
}

function actualizarProveedoresDeProducto() {
  const producto = document.getElementById("selectorProducto").value;
  const selectorProveedor = document.getElementById("selectorProveedor");

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

/* =========================
   GRAFICA + RESUMEN
========================= */

function graficar() {
  const prod = document.getElementById("selectorProducto").value;
  const prov = document.getElementById("selectorProveedor").value;

  const variacion = document.getElementById("variacion");
  const mejorProveedor = document.getElementById("mejorProveedor");

  // Solo activos
  let historial = datos.slice(1)
    .filter(f => safeStr(f[2]) === safeStr(prod))
    .filter(f => normUpper(f[8] || "ACTIVO") !== "CANCELADO");

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
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
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

  // Mejor proveedor SOLO si está en TODOS
  if (prov === "__TODOS__") {
    const porProveedor = {};

    datos.slice(1)
      .filter(f => safeStr(f[2]) === safeStr(prod))
      .filter(f => normUpper(f[8] || "ACTIVO") !== "CANCELADO")
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
      mejorProveedor.innerHTML = `🏆 <b>Mejor proveedor para "${prod}"</b>: ${mejor} (Promedio ponderado: ${money(mejorProm)})`;
    } else {
      mejorProveedor.innerHTML = "";
    }
  } else {
    mejorProveedor.innerHTML = "";
  }
}

/* =========================
   INICIO
========================= */

window.onload = () => {
  cargarDatos();
};

