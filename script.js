/* ===========================
   CONFIGURACION
=========================== */

// 1) TU FORM (para registrar)
const FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLScU3WYqUEGqQmgcWajim9ZZvBcpwt8ZOONEOOSzRCueI9xygQ/viewform";

// 2) TU SHEET PUBLICADO COMO CSV (YA PUESTO)
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQtVGAhTNEJpkWKmTnzUMtiumBO8voTHx56Rds_oHCzzyRI-hXBuAlXKpSJoymnhhPQS4O5jkmHTWRL/pub?gid=1801367087&single=true&output=csv";

/* ===========================
   VARIABLES
=========================== */

let datos = [];
let graficaActual = null;

/* ===========================
   UTILIDADES
=========================== */

function safeStr(x) {
  return (x ?? "").toString().trim();
}

function money(n) {
  const num = Number(n) || 0;
  return "$" + num.toFixed(2);
}

function parseNumber(n) {
  if (n === null || n === undefined) return 0;

  // Si viene como "350.00" o "367,25"
  const s = n.toString().replace(",", ".");
  const val = Number(s);
  return isNaN(val) ? 0 : val;
}

function parseFecha(valor) {
  if (!valor) return null;

  // Si viene como "13/02/2026" (Forms)
  if (valor.includes("/")) {
    const [d, m, y] = valor.split("/");
    return new Date(Number(y), Number(m) - 1, Number(d));
  }

  // Si viene como ISO
  return new Date(valor);
}

function toDateOnly(fecha) {
  if (!fecha) return "";
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

/* ===========================
   CSV -> ARRAY
=========================== */

function csvToArray(text) {
  const rows = [];
  let row = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      current += '"';
      i++;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (current.length || row.length) {
        row.push(current);
        rows.push(row);
        row = [];
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current.length || row.length) {
    row.push(current);
    rows.push(row);
  }

  return rows;
}

/* ===========================
   CARGAR DATOS
=========================== */

async function cargarDatos() {
  try {
    const res = await fetch(SHEET_CSV_URL);
    const csv = await res.text();

    const arr = csvToArray(csv);

    // Encabezados (Forms)
    // Marca temporal | Proveedor | Producto | Cantidad | Costo unitario | Fecha | Nota | Estatus | Pago
    const headers = arr[0].map(h => safeStr(h).toLowerCase());

    const idx = {
      proveedor: headers.indexOf("proveedor"),
      producto: headers.indexOf("producto"),
      cantidad: headers.indexOf("cantidad"),
      costo: headers.indexOf("costo unitario"),
      fecha: headers.indexOf("fecha"),
      nota: headers.indexOf("nota"),
      estatus: headers.indexOf("estatus"),
      pago: headers.indexOf("pago"),
    };

    const registros = arr.slice(1).filter(r => r.length > 1);

    datos = registros.map(r => {
      const proveedor = safeStr(r[idx.proveedor]);
      const producto = safeStr(r[idx.producto]);

      const cantidad = parseNumber(r[idx.cantidad]);
      const costo = parseNumber(r[idx.costo]);
      const fecha = parseFecha(r[idx.fecha]);

      const nota = safeStr(r[idx.nota]);
      const estatus = safeStr(r[idx.estatus]);
      const pago = safeStr(r[idx.pago]);

      const total = cantidad * costo;

      return {
        proveedor,
        producto,
        cantidad,
        costo,
        total,
        fecha,
        nota,
        estatus,
        pago,
      };
    });

    // Ordenar por fecha DESC
    datos.sort((a, b) => (b.fecha?.getTime() || 0) - (a.fecha?.getTime() || 0));

    // Pintar todo
    mostrar();
    actualizarDashboard();
    cargarSelectorProductos();
    actualizarProveedoresDeProducto();
    graficar();
    resumenTotales();
  } catch (err) {
    console.error(err);
    alert("No pude leer el CSV. Revisa que esté publicado en la web como CSV.");
  }
}

/* ===========================
   FILTROS
=========================== */

function getFiltros() {
  const buscador = safeStr(document.getElementById("buscador").value).toLowerCase();
  const inicio = document.getElementById("fechaInicio").value;
  const fin = document.getElementById("fechaFin").value;

  const dInicio = inicio ? new Date(inicio + "T00:00:00") : null;
  const dFin = fin ? new Date(fin + "T23:59:59") : null;

  return { buscador, dInicio, dFin };
}

function pasaFiltro(item) {
  const { buscador, dInicio, dFin } = getFiltros();

  if (buscador) {
    const p = (item.proveedor || "").toLowerCase();
    const pr = (item.producto || "").toLowerCase();
    if (!p.includes(buscador) && !pr.includes(buscador)) return false;
  }

  if (dInicio && item.fecha && item.fecha < dInicio) return false;
  if (dFin && item.fecha && item.fecha > dFin) return false;

  return true;
}

/* ===========================
   TABLA
=========================== */

function mostrar() {
  const tabla = document.getElementById("tabla");
  tabla.innerHTML = "";

  const filtrados = datos.filter(pasaFiltro);

  filtrados.forEach(item => {
    tabla.innerHTML += `
      <tr>
        <td>${safeStr(item.proveedor)}</td>
        <td>${safeStr(item.producto)}</td>
        <td>${item.cantidad}</td>
        <td>${money(item.costo)}</td>
        <td><b>${money(item.total)}</b></td>
        <td>${item.fecha ? item.fecha.toLocaleDateString() : ""}</td>
        <td>${safeStr(item.estatus) || "-"}</td>
        <td>${safeStr(item.pago) || "-"}</td>
        <td>${safeStr(item.nota)}</td>
      </tr>
    `;
  });

  document.getElementById("totalCompras").innerText = filtrados.length;
}

/* ===========================
   DASHBOARD
=========================== */

function actualizarDashboard() {
  const filtrados = datos.filter(pasaFiltro);

  let totalInvertido = 0;
  let resumenCantidad = {};

  filtrados.forEach(x => {
    totalInvertido += x.total;

    if (!resumenCantidad[x.producto]) resumenCantidad[x.producto] = 0;
    resumenCantidad[x.producto] += x.cantidad;
  });

  document.getElementById("totalInvertido").innerText = money(totalInvertido);

  let top = "-";
  let max = 0;

  Object.keys(resumenCantidad).forEach(p => {
    if (resumenCantidad[p] > max) {
      max = resumenCantidad[p];
      top = p;
    }
  });

  document.getElementById("productoTop").innerText = top;

  // Promedio ponderado del producto seleccionado
  const prodSel = document.getElementById("selectorProducto").value;
  const prom = promedioPonderado(prodSel, filtrados);
  document.getElementById("promedioProducto").innerText = prom ? money(prom) : "$0";
}

/* ===========================
   PROMEDIO PONDERADO
=========================== */

function promedioPonderado(producto, lista) {
  if (!producto) return 0;

  const rows = lista.filter(x => safeStr(x.producto) === safeStr(producto));
  if (!rows.length) return 0;

  const totalGastado = rows.reduce((a, b) => a + (b.total || 0), 0);
  const totalCantidad = rows.reduce((a, b) => a + (b.cantidad || 0), 0);

  if (!totalCantidad) return 0;
  return totalGastado / totalCantidad;
}

/* ===========================
   SELECTORES
=========================== */

function cargarSelectorProductos() {
  const selector = document.getElementById("selectorProducto");
  selector.innerHTML = "";

  const filtrados = datos.filter(pasaFiltro);
  const productos = [...new Set(filtrados.map(x => x.producto))].filter(Boolean).sort();

  productos.forEach(p => {
    selector.innerHTML += `<option value="${p}">${p}</option>`;
  });

  if (!selector.value && productos.length) selector.value = productos[0];
}

function actualizarProveedoresDeProducto() {
  const prod = document.getElementById("selectorProducto").value;
  const selectorProveedor = document.getElementById("selectorProveedor");

  const filtrados = datos.filter(pasaFiltro);
  const proveedores = [...new Set(
    filtrados
      .filter(x => safeStr(x.producto) === safeStr(prod))
      .map(x => x.proveedor)
  )].filter(Boolean).sort();

  selectorProveedor.innerHTML = `<option value="__TODOS__">Todos los proveedores</option>`;

  proveedores.forEach(p => {
    selectorProveedor.innerHTML += `<option value="${p}">${p}</option>`;
  });
}

/* ===========================
   GRAFICA
=========================== */

function graficar() {
  const prod = document.getElementById("selectorProducto").value;
  const prov = document.getElementById("selectorProveedor").value;

  const variacion = document.getElementById("variacion");
  const mejorProveedor = document.getElementById("mejorProveedor");

  const filtrados = datos.filter(pasaFiltro);

  let historial = filtrados.filter(x => safeStr(x.producto) === safeStr(prod));

  if (prov !== "__TODOS__") {
    historial = historial.filter(x => safeStr(x.proveedor) === safeStr(prov));
  }

  historial.sort((a, b) => (a.fecha?.getTime() || 0) - (b.fecha?.getTime() || 0));

  const labels = historial.map(x => x.fecha ? x.fecha.toLocaleDateString() : "");
  const precios = historial.map(x => x.costo);

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

  // Variación
  if (!precios.length) {
    variacion.innerText = "Sin datos para este filtro.";
  } else {
    const ultimo = precios[precios.length - 1];
    const promedio = precios.reduce((a, b) => a + b, 0) / precios.length;

    let texto = `📌 Último costo: ${money(ultimo)} • Promedio simple: ${money(promedio)}`;

    if (precios.length >= 2) {
      const diff = ultimo - precios[precios.length - 2];
      texto += diff > 0 ? ` • 🔺 Subió ${money(diff)}`
        : diff < 0 ? ` • 🔻 Bajó ${money(Math.abs(diff))}`
        : ` • ➖ Sin cambio`;
    }

    // PROMEDIO PONDERADO (el bueno)
    const promPond = promedioPonderado(prod, filtrados);
    texto += ` • ⭐ Promedio ponderado real: ${money(promPond)}`;

    variacion.innerText = texto;
  }

  // Mejor proveedor (solo si todos)
  if (prov === "__TODOS__") {
    const porProveedor = {};

    filtrados
      .filter(x => safeStr(x.producto) === safeStr(prod))
      .forEach(x => {
        const p = safeStr(x.proveedor);
        if (!porProveedor[p]) porProveedor[p] = { total: 0, cantidad: 0 };
        porProveedor[p].total += x.total;
        porProveedor[p].cantidad += x.cantidad;
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

    mejorProveedor.innerHTML = mejor
      ? `🏆 <b>Mejor proveedor para "${prod}"</b>: ${mejor} (Promedio ponderado: ${money(mejorProm)})`
      : "";
  } else {
    mejorProveedor.innerHTML = "";
  }
}

/* ===========================
   RESUMEN TOTALES
=========================== */

function resumenTotales() {
  const filtrados = datos.filter(pasaFiltro);

  const porProducto = {};
  const porProveedor = {};

  filtrados.forEach(x => {
    // producto
    if (!porProducto[x.producto]) porProducto[x.producto] = { total: 0, cantidad: 0 };
    porProducto[x.producto].total += x.total;
    porProducto[x.producto].cantidad += x.cantidad;

    // proveedor
    if (!porProveedor[x.proveedor]) porProveedor[x.proveedor] = { total: 0 };
    porProveedor[x.proveedor].total += x.total;
  });

  // Producto
  const contProd = document.getElementById("resumenProductos");
  contProd.innerHTML = "";

  Object.keys(porProducto)
    .sort((a, b) => porProducto[b].total - porProducto[a].total)
    .slice(0, 20)
    .forEach(p => {
      const total = porProducto[p].total;
      const cant = porProducto[p].cantidad;
      const prom = cant ? total / cant : 0;

      contProd.innerHTML += `
        <div class="resumen-item">
          <div>
            <b>${p}</b><br>
            <span style="color:#7a7a7a;font-size:12px;">
              Cantidad: ${cant} • Promedio ponderado: ${money(prom)}
            </span>
          </div>
          <div><b>${money(total)}</b></div>
        </div>
      `;
    });

  // Proveedor
  const contProv = document.getElementById("resumenProveedores");
  contProv.innerHTML = "";

  Object.keys(porProveedor)
    .sort((a, b) => porProveedor[b].total - porProveedor[a].total)
    .slice(0, 20)
    .forEach(p => {
      contProv.innerHTML += `
        <div class="resumen-item">
          <div><b>${p}</b></div>
          <div><b>${money(porProveedor[p].total)}</b></div>
        </div>
      `;
    });
}

/* ===========================
   EXPORTAR EXCEL (2 HOJAS)
=========================== */

function exportarExcel() {
  const filtrados = datos.filter(pasaFiltro);

  // Hoja 1: Compras
  const hojaCompras = filtrados.map(x => ({
    Proveedor: x.proveedor,
    Producto: x.producto,
    Cantidad: x.cantidad,
    "Costo unitario": x.costo,
    Total: x.total,
    Fecha: x.fecha ? toDateOnly(x.fecha) : "",
    Estatus: x.estatus,
    Pago: x.pago,
    Nota: x.nota
  }));

  // Hoja 2: Resumen
  const resumen = {};

  filtrados.forEach(x => {
    const key = `${x.producto}|||${x.proveedor}`;

    if (!resumen[key]) resumen[key] = {
      Producto: x.producto,
      Proveedor: x.proveedor,
      Cantidad: 0,
      Total: 0
    };

    resumen[key].Cantidad += x.cantidad;
    resumen[key].Total += x.total;
  });

  const hojaResumen = Object.values(resumen).map(r => ({
    Producto: r.Producto,
    Proveedor: r.Proveedor,
    Cantidad: r.Cantidad,
    Total: r.Total,
    "Costo promedio ponderado": r.Cantidad ? (r.Total / r.Cantidad) : 0
  }));

  // Crear excel
  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.json_to_sheet(hojaCompras);
  XLSX.utils.book_append_sheet(wb, ws1, "Compras");

  const ws2 = XLSX.utils.json_to_sheet(hojaResumen);
  XLSX.utils.book_append_sheet(wb, ws2, "Resumen");

  XLSX.writeFile(wb, "Compras_LaBonita.xlsx");
}

/* ===========================
   EVENTOS
=========================== */

function bindEventos() {
  document.getElementById("btnAbrirForm").href = FORM_URL;

  document.getElementById("btnRefrescar").addEventListener("click", () => {
    cargarDatos();
  });

  document.getElementById("btnExportar").addEventListener("click", () => {
    exportarExcel();
  });

  document.getElementById("buscador").addEventListener("keyup", () => {
    mostrar();
    actualizarDashboard();
    cargarSelectorProductos();
    actualizarProveedoresDeProducto();
    graficar();
    resumenTotales();
  });

  document.getElementById("fechaInicio").addEventListener("change", () => {
    mostrar();
    actualizarDashboard();
    cargarSelectorProductos();
    actualizarProveedoresDeProducto();
    graficar();
    resumenTotales();
  });

  document.getElementById("fechaFin").addEventListener("change", () => {
    mostrar();
    actualizarDashboard();
    cargarSelectorProductos();
    actualizarProveedoresDeProducto();
    graficar();
    resumenTotales();
  });

  document.getElementById("selectorProducto").addEventListener("change", () => {
    actualizarDashboard();
    actualizarProveedoresDeProducto();
    graficar();
    resumenTotales();
  });

  document.getElementById("selectorProveedor").addEventListener("change", () => {
    graficar();
  });
}

/* ===========================
   INICIO
=========================== */

window.onload = () => {
  bindEventos();
  cargarDatos();
};






