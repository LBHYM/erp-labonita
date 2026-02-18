/* ===========================
   CONFIG
=========================== */

// CSV publicado de tu Sheet (Form_Responses)
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQtVGAhTNEJpkWKmTnzUMtiumBO8voTHx56Rds_oHCzzyRI-hXBuAlXKpSJoymnhhPQS4O5jkmHTWRL/pub?gid=1801367087&single=true&output=csv";

// Link directo de tu Google Form (para registrar compras)
const FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLScU3WYqUEGqQmgcWajim9ZZvBcpwt8ZOONEOOSzRCueI9xygQ/viewform";

let RAW = [];      // registros crudos (objetos)
let FILTRADOS = []; // registros filtrados

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

function toNumber(n) {
  if (n === null || n === undefined) return 0;
  const s = safeStr(n).replace(/[$,]/g, "");
  const num = Number(s);
  return isNaN(num) ? 0 : num;
}

function parseDateFlexible(x) {
  // Acepta:
  // - 2026-02-04T06:00:00.000Z
  // - 13/02/2026
  // - 2026-02-13
  const v = safeStr(x);
  if (!v) return null;

  // ISO
  if (v.includes("T") || v.includes("-")) {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d;
  }

  // dd/mm/yyyy
  if (v.includes("/")) {
    const parts = v.split("/");
    if (parts.length === 3) {
      const dd = Number(parts[0]);
      const mm = Number(parts[1]);
      const yyyy = Number(parts[2]);
      const d = new Date(yyyy, mm - 1, dd);
      if (!isNaN(d.getTime())) return d;
    }
  }

  const d = new Date(v);
  if (!isNaN(d.getTime())) return d;

  return null;
}

function dateToISO(d) {
  if (!d) return "";
  try {
    return new Date(d).toISOString().split("T")[0];
  } catch {
    return "";
  }
}

function sameDayISO(d) {
  if (!d) return "";
  const dt = new Date(d);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* ===========================
   CSV PARSER
=========================== */

function parseCSV(text) {
  // parser simple (soporta comillas)
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
      continue;
    }

    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (c === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((c === "\n" || c === "\r") && !inQuotes) {
      if (cell.length > 0 || row.length > 0) {
        row.push(cell);
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += c;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter(r => r.some(x => safeStr(x) !== ""));
}

/* ===========================
   CARGA
=========================== */

async function cargarCSV() {
  const res = await fetch(CSV_URL + "&cache=" + Date.now());
  const text = await res.text();
  const data = parseCSV(text);

  // Esperamos encabezados tipo:
  // Marca temporal, Proveedor, Producto, Cantidad, Costo unitario, Fecha, Nota, Estatus, Pago
  const headers = data[0].map(h => safeStr(h).toLowerCase());

  const idx = {
    timestamp: headers.findIndex(h => h.includes("marca")),
    proveedor: headers.findIndex(h => h.includes("proveedor")),
    producto: headers.findIndex(h => h.includes("producto")),
    cantidad: headers.findIndex(h => h.includes("cantidad")),
    costo: headers.findIndex(h => h.includes("costo")),
    fecha: headers.findIndex(h => h.includes("fecha")),
    nota: headers.findIndex(h => h.includes("nota")),
    estatus: headers.findIndex(h => h.includes("estatus")),
    pago: headers.findIndex(h => h.includes("pago")),
  };

  RAW = data.slice(1).map(r => {
    const proveedor = safeStr(r[idx.proveedor]);
    const producto = safeStr(r[idx.producto]);
    const cantidad = toNumber(r[idx.cantidad]);
    const costo = toNumber(r[idx.costo]);
    const fecha = parseDateFlexible(r[idx.fecha]) || parseDateFlexible(r[idx.timestamp]);

    const estatus = safeStr(r[idx.estatus]) || "Activo";
    const pago = safeStr(r[idx.pago]) || "Pendiente";
    const nota = safeStr(r[idx.nota]);

    return {
      proveedor,
      producto,
      cantidad,
      costo,
      total: cantidad * costo,
      fecha,
      fechaISO: sameDayISO(fecha),
      estatus,
      pago,
      nota
    };
  });

  // Limpiar basura: filas vacías
  RAW = RAW.filter(x => x.proveedor || x.producto);

  // Inicializar selects y vista
  poblarSelects();
  aplicarFiltros();
}

/* ===========================
   FILTROS
=========================== */

function getFiltros() {
  const desde = document.getElementById("fDesde").value;
  const hasta = document.getElementById("fHasta").value;
  const proveedor = document.getElementById("fProveedor").value;
  const producto = document.getElementById("fProducto").value;
  const pago = document.getElementById("fPago").value;
  const verCancelados = document.getElementById("fVerCancelados").checked;

  return { desde, hasta, proveedor, producto, pago, verCancelados };
}

function pasaFiltroFecha(reg, desde, hasta) {
  if (!reg.fechaISO) return false;

  if (desde && reg.fechaISO < desde) return false;
  if (hasta && reg.fechaISO > hasta) return false;

  return true;
}

function aplicarFiltros() {
  const f = getFiltros();

  FILTRADOS = RAW.filter(r => {
    if (!pasaFiltroFecha(r, f.desde, f.hasta)) return false;

    if (f.proveedor !== "__TODOS__" && safeStr(r.proveedor) !== safeStr(f.proveedor)) return false;
    if (f.producto !== "__TODOS__" && safeStr(r.producto) !== safeStr(f.producto)) return false;

    if (f.pago !== "__TODOS__" && safeStr(r.pago).toLowerCase() !== safeStr(f.pago).toLowerCase()) return false;

    // ESTATUS:
    // Por default: NO mostrar cancelados
    if (!f.verCancelados && safeStr(r.estatus).toLowerCase() === "cancelado") return false;

    return true;
  });

  // Orden por fecha DESC
  FILTRADOS.sort((a, b) => (b.fecha?.getTime() || 0) - (a.fecha?.getTime() || 0));

  pintarTabla();
  actualizarKPIs();
  generarResumen();
}

/* ===========================
   SELECTS
=========================== */

function poblarSelects() {
  const sProv = document.getElementById("fProveedor");
  const sProd = document.getElementById("fProducto");

  const proveedores = [...new Set(RAW.map(r => safeStr(r.proveedor)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const productos = [...new Set(RAW.map(r => safeStr(r.producto)).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  sProv.innerHTML = `<option value="__TODOS__">Todos</option>`;
  proveedores.forEach(p => sProv.innerHTML += `<option value="${p}">${p}</option>`);

  sProd.innerHTML = `<option value="__TODOS__">Todos</option>`;
  productos.forEach(p => sProd.innerHTML += `<option value="${p}">${p}</option>`);
}

/* ===========================
   TABLA
=========================== */

function pintarTabla() {
  const tabla = document.getElementById("tabla");
  const contador = document.getElementById("contador");

  tabla.innerHTML = "";

  FILTRADOS.forEach(r => {
    const fechaTxt = r.fecha ? r.fecha.toLocaleDateString() : "";

    const estatusLower = safeStr(r.estatus).toLowerCase();
    const badgeEstatus = estatusLower === "cancelado"
      ? `<span class="tag tag-cancel">Cancelado</span>`
      : `<span class="tag tag-ok">Activo</span>`;

    const pagoLower = safeStr(r.pago).toLowerCase();
    const badgePago = pagoLower === "pagado"
      ? `<span class="tag tag-paid">Pagado</span>`
      : `<span class="tag tag-pend">Pendiente</span>`;

    tabla.innerHTML += `
      <tr>
        <td>${safeStr(r.proveedor)}</td>
        <td>${safeStr(r.producto)}</td>
        <td>${r.cantidad}</td>
        <td>${money(r.costo)}</td>
        <td><b>${money(r.total)}</b></td>
        <td>${fechaTxt}</td>
        <td>${badgeEstatus}</td>
        <td>${badgePago}</td>
        <td>${safeStr(r.nota)}</td>
      </tr>
    `;
  });

  contador.innerText = `Mostrando ${FILTRADOS.length} compras (según filtros).`;
}

/* ===========================
   KPIs
=========================== */

function actualizarKPIs() {
  const total = FILTRADOS.reduce((a, b) => a + (b.total || 0), 0);
  document.getElementById("kpiTotal").innerText = money(total);
  document.getElementById("kpiCompras").innerText = FILTRADOS.length;

  // Producto top por TOTAL gastado
  const porProducto = {};
  FILTRADOS.forEach(r => {
    const k = safeStr(r.producto) || "-";
    if (!porProducto[k]) porProducto[k] = 0;
    porProducto[k] += r.total || 0;
  });

  let topProd = "-";
  let topProdVal = 0;
  Object.keys(porProducto).forEach(k => {
    if (porProducto[k] > topProdVal) {
      topProdVal = porProducto[k];
      topProd = k;
    }
  });
  document.getElementById("kpiProductoTop").innerText = topProd;

  // Proveedor top por TOTAL gastado
  const porProv = {};
  FILTRADOS.forEach(r => {
    const k = safeStr(r.proveedor) || "-";
    if (!porProv[k]) porProv[k] = 0;
    porProv[k] += r.total || 0;
  });

  let topProv = "-";
  let topProvVal = 0;
  Object.keys(porProv).forEach(k => {
    if (porProv[k] > topProvVal) {
      topProvVal = porProv[k];
      topProv = k;
    }
  });
  document.getElementById("kpiProveedorTop").innerText = topProv;
}

/* ===========================
   RESUMEN (PROMEDIO PONDERADO)
=========================== */

function generarResumen() {
  const contProd = document.getElementById("resumenProductos");
  const contProv = document.getElementById("resumenProveedores");

  contProd.innerHTML = "";
  contProv.innerHTML = "";

  // Resumen por producto:
  // total = suma(total)
  // cantidad = suma(cantidad)
  // promedio ponderado = total / cantidad
  const porProducto = {};
  FILTRADOS.forEach(r => {
    const k = safeStr(r.producto) || "-";
    if (!porProducto[k]) porProducto[k] = { total: 0, cantidad: 0 };
    porProducto[k].total += r.total || 0;
    porProducto[k].cantidad += r.cantidad || 0;
  });

  const listaProd = Object.entries(porProducto)
    .map(([k, v]) => {
      const prom = v.cantidad ? v.total / v.cantidad : 0;
      return { producto: k, total: v.total, cantidad: v.cantidad, promedio: prom };
    })
    .sort((a, b) => b.total - a.total);

  listaProd.forEach(x => {
    contProd.innerHTML += `
      <div class="item">
        <div>
          <b>${x.producto}</b>
          <small>Cantidad: ${x.cantidad} • Promedio ponderado: ${money(x.promedio)}</small>
        </div>
        <div class="monto">${money(x.total)}</div>
      </div>
    `;
  });

  // Resumen por proveedor:
  const porProveedor = {};
  FILTRADOS.forEach(r => {
    const k = safeStr(r.proveedor) || "-";
    if (!porProveedor[k]) porProveedor[k] = 0;
    porProveedor[k] += r.total || 0;
  });

  const listaProv = Object.entries(porProveedor)
    .map(([k, v]) => ({ proveedor: k, total: v }))
    .sort((a, b) => b.total - a.total);

  listaProv.forEach(x => {
    contProv.innerHTML += `
      <div class="item">
        <div>
          <b>${x.proveedor}</b>
          <small>Total invertido</small>
        </div>
        <div class="monto">${money(x.total)}</div>
      </div>
    `;
  });
}

/* ===========================
   EXPORTAR EXCEL (3 HOJAS)
=========================== */

function exportarExcel() {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Compras filtradas
  const hojaCompras = FILTRADOS.map(r => ({
    Proveedor: r.proveedor,
    Producto: r.producto,
    Cantidad: r.cantidad,
    "Costo unitario": r.costo,
    Total: r.total,
    Fecha: r.fechaISO,
    Estatus: r.estatus,
    Pago: r.pago,
    Nota: r.nota
  }));

  const ws1 = XLSX.utils.json_to_sheet(hojaCompras);
  XLSX.utils.book_append_sheet(wb, ws1, "Compras");

  // Hoja 2: Resumen por producto
  const porProducto = {};
  FILTRADOS.forEach(r => {
    const k = safeStr(r.producto) || "-";
    if (!porProducto[k]) porProducto[k] = { total: 0, cantidad: 0 };
    porProducto[k].total += r.total || 0;
    porProducto[k].cantidad += r.cantidad || 0;
  });

  const hojaProd = Object.entries(porProducto).map(([producto, v]) => ({
    Producto: producto,
    Cantidad: v.cantidad,
    Total: v.total,
    "Costo promedio ponderado": v.cantidad ? (v.total / v.cantidad) : 0
  })).sort((a, b) => b.Total - a.Total);

  const ws2 = XLSX.utils.json_to_sheet(hojaProd);
  XLSX.utils.book_append_sheet(wb, ws2, "Resumen_Producto");

  // Hoja 3: Resumen por proveedor
  const porProv = {};
  FILTRADOS.forEach(r => {
    const k = safeStr(r.proveedor) || "-";
    if (!porProv[k]) porProv[k] = 0;
    porProv[k] += r.total || 0;
  });

  const hojaProv = Object.entries(porProv).map(([proveedor, total]) => ({
    Proveedor: proveedor,
    Total: total
  })).sort((a, b) => b.Total - a.Total);

  const ws3 = XLSX.utils.json_to_sheet(hojaProv);
  XLSX.utils.book_append_sheet(wb, ws3, "Resumen_Proveedor");

  // Descargar
  XLSX.writeFile(wb, "Compras_LaBonita.xlsx");
}

/* ===========================
   UI EVENTS
=========================== */

function limpiarFiltros() {
  document.getElementById("fDesde").value = "";
  document.getElementById("fHasta").value = "";
  document.getElementById("fProveedor").value = "__TODOS__";
  document.getElementById("fProducto").value = "__TODOS__";
  document.getElementById("fPago").value = "__TODOS__";
  document.getElementById("fVerCancelados").checked = false;

  aplicarFiltros();
}

/* ===========================
   INIT
=========================== */

window.onload = () => {
  // Botón al Forms
  const btnForm = document.getElementById("btnAbrirForm");
  btnForm.href = FORM_URL;

  // Botones
  document.getElementById("btnAplicar").onclick = aplicarFiltros;
  document.getElementById("btnLimpiar").onclick = limpiarFiltros;
  document.getElementById("btnExportar").onclick = exportarExcel;

  // Cargar datos
  cargarCSV().catch(err => {
    console.error(err);
    alert("No pude cargar el CSV del Sheet. Revisa que esté publicado como CSV.");
  });
};

/* ===========================
   TAGS (inyectado por JS)
=========================== */

(function injectTagStyles(){
  const css = `
  .tag{
    display:inline-block;
    padding:6px 10px;
    border-radius:999px;
    font-size:12px;
    font-weight:900;
    border:1px solid rgba(0,0,0,.08);
    white-space:nowrap;
  }
  .tag-ok{ background: rgba(34,197,94,.12); color:#14532d; }
  .tag-cancel{ background: rgba(239,68,68,.12); color:#7f1d1d; }
  .tag-paid{ background: rgba(59,130,246,.12); color:#1e3a8a; }
  .tag-pend{ background: rgba(245,158,11,.14); color:#7c2d12; }
  `;
  const style = document.createElement("style");
  style.innerHTML = css;
  document.head.appendChild(style);
})();








