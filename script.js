/* =========================================================
   LA BONITA - ERP COMPRAS (MODO GRATIS SIN APPS SCRIPT)
   - Lee datos desde Google Sheets como CSV (sin CORS)
   - Registra compras desde Google Form (link)
   - Borrar/Editar: se hace manual en Sheets (evita bloqueos)
   ========================================================= */

/* =================== CONFIG =================== */

const SHEET_ID = "1TyDxOtgkaxqhPCPTCSkpCkE7aCkZTNiC1XvS1AmiNnw";
const GID_RESPUESTAS = "1801367087";

const FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLScU3WYqUEGqQmgcWajim9ZZvBcpwt8ZOONEOOSzRCueI9xygQ/viewform";

const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID_RESPUESTAS}`;

/* =================== ESTADO =================== */

let registros = []; // array de objetos
let graficaActual = null;

/* =================== HELPERS =================== */

function money(n) {
  const num = Number(n) || 0;
  return "$" + num.toFixed(2);
}

function safeStr(x) {
  return (x ?? "").toString().trim();
}

function normalizarFecha(valor) {
  // Form puede traer dd/mm/yyyy o yyyy-mm-dd
  // Convertimos a Date confiable
  if (!valor) return null;

  // Si ya es tipo Date (por si acaso)
  if (valor instanceof Date) return valor;

  const s = safeStr(valor);

  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }

  // dd/mm/yyyy
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
    const [dd, mm, yyyy] = s.split("/");
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    return isNaN(d) ? null : d;
  }

  // timestamp
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function fechaToISO(d) {
  if (!d) return "";
  try {
    return new Date(d).toISOString().split("T")[0];
  } catch {
    return "";
  }
}

function parseCSVLine(line) {
  // Parser CSV simple con comillas
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"' && line[i + 1] === '"') {
      current += '"';
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result.map(x => safeStr(x));
}

function parseCSV(text) {
  const lines = text
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const rows = lines.map(parseCSVLine);

  // Encabezados (Google Forms)
  // Marca temporal, Proveedor, Producto, Cantidad, Costo unitario, Fecha, Nota, Estatus, Pago
  const header = rows[0].map(h => safeStr(h).toLowerCase());

  const idx = {
    timestamp: header.findIndex(h => h.includes("marca") || h.includes("timestamp")),
    proveedor: header.findIndex(h => h.includes("proveedor")),
    producto: header.findIndex(h => h.includes("producto")),
    cantidad: header.findIndex(h => h.includes("cantidad")),
    costo: header.findIndex(h => h.includes("costo")),
    fecha: header.findIndex(h => h === "fecha" || h.includes("fecha")),
    nota: header.findIndex(h => h.includes("nota")),
    estatus: header.findIndex(h => h.includes("estatus")),
    pago: header.findIndex(h => h.includes("pago"))
  };

  const dataRows = rows.slice(1);

  const objs = dataRows.map((r, i) => {
    const proveedor = safeStr(r[idx.proveedor]);
    const producto = safeStr(r[idx.producto]);

    const cantidad = Number((r[idx.cantidad] || "").replace(",", ".")) || 0;
    const costo = Number((r[idx.costo] || "").replace(",", ".")) || 0;

    const total = cantidad * costo;

    const fechaCompra = normalizarFecha(r[idx.fecha]);
    const fechaRegistro = normalizarFecha(r[idx.timestamp]);

    const nota = safeStr(r[idx.nota]);
    const estatus = safeStr(r[idx.estatus]);
    const pago = safeStr(r[idx.pago]);

    // ID estable: timestamp + proveedor + producto + index
    const id = `${safeStr(r[idx.timestamp])}-${proveedor}-${producto}-${i}`;

    return {
      id,
      proveedor,
      producto,
      cantidad,
      costo,
      total,
      fechaCompra,
      fechaRegistro,
      nota,
      estatus,
      pago
    };
  });

  // Quitamos filas vacías
  return objs.filter(o => o.proveedor || o.producto);
}

/* =================== CARGA DATOS =================== */

async function cargarDatos() {
  try {
    const res = await fetch(CSV_URL, { cache: "no-store" });
    const csv = await res.text();

    registros = parseCSV(csv);

    // Orden por fecha de compra (más reciente arriba)
    registros.sort((a, b) => {
      const da = a.fechaCompra ? a.fechaCompra.getTime() : 0;
      const db = b.fechaCompra ? b.fechaCompra.getTime() : 0;
      return db - da;
    });

    pintarTodo();
  } catch (err) {
    console.error(err);
    alert("No se pudieron cargar los datos. Revisa que el Sheet sea público o compartido correctamente.");
  }
}

/* =================== FILTROS =================== */

function getFiltros() {
  const q = safeStr(document.getElementById("buscador").value).toLowerCase();

  const inicio = document.getElementById("fechaInicio").value;
  const fin = document.getElementById("fechaFin").value;

  const dIni = inicio ? new Date(inicio + "T00:00:00") : null;
  const dFin = fin ? new Date(fin + "T23:59:59") : null;

  return { q, dIni, dFin };
}

function filtrarRegistros(lista) {
  const { q, dIni, dFin } = getFiltros();

  return lista.filter(r => {
    // Buscar
    if (q) {
      const ok =
        r.proveedor.toLowerCase().includes(q) ||
        r.producto.toLowerCase().includes(q);
      if (!ok) return false;
    }

    // Fecha compra
    if (dIni && r.fechaCompra && r.fechaCompra < dIni) return false;
    if (dFin && r.fechaCompra && r.fechaCompra > dFin) return false;

    // Si no tiene fechaCompra, lo dejamos pasar solo si no hay filtros de fecha
    if ((dIni || dFin) && !r.fechaCompra) return false;

    return true;
  });
}

/* =================== TABLA =================== */

function tagHTML(texto, tipo) {
  const t = safeStr(texto);
  if (!t) return `<span class="tag neutral">—</span>`;
  return `<span class="tag ${tipo}">${t}</span>`;
}

function mostrarTabla() {
  const tbody = document.getElementById("tabla");
  tbody.innerHTML = "";

  const lista = filtrarRegistros(registros);

  if (!lista.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="padding:18px; opacity:.75;">
          No hay registros con estos filtros.
        </td>
      </tr>
    `;
    return;
  }

  lista.forEach(r => {
    const fecha = r.fechaCompra ? r.fechaCompra.toLocaleDateString() : "—";

    const estatus = safeStr(r.estatus).toLowerCase();
    const pago = safeStr(r.pago).toLowerCase();

    const estatusTag =
      estatus.includes("recib") || estatus.includes("ok")
        ? tagHTML(r.estatus, "ok")
        : estatus.includes("pend") || estatus.includes("falta")
          ? tagHTML(r.estatus, "warn")
          : tagHTML(r.estatus, "neutral");

    const pagoTag =
      pago.includes("pag") || pago.includes("liquid")
        ? tagHTML(r.pago, "ok")
        : pago.includes("pend")
          ? tagHTML(r.pago, "warn")
          : tagHTML(r.pago, "neutral");

    tbody.innerHTML += `
      <tr>
        <td>${r.proveedor}</td>
        <td>${r.producto}</td>
        <td>${r.cantidad}</td>
        <td>${money(r.costo)}</td>
        <td><b>${money(r.total)}</b></td>
        <td>${fecha}</td>
        <td>${estatusTag}</td>
        <td>${pagoTag}</td>
        <td>${r.nota || ""}</td>
      </tr>
    `;
  });
}

/* =================== DASHBOARD =================== */

function actualizarDashboard() {
  const lista = filtrarRegistros(registros);

  let totalInvertido = 0;
  let resumenCantidad = {}; // producto -> cantidad

  lista.forEach(r => {
    totalInvertido += r.total || 0;

    const p = r.producto || "—";
    if (!resumenCantidad[p]) resumenCantidad[p] = 0;
    resumenCantidad[p] += r.cantidad || 0;
  });

  document.getElementById("totalInvertido").innerText = money(totalInvertido);
  document.getElementById("totalCompras").innerText = lista.length;

  let top = "-";
  let max = 0;
  Object.keys(resumenCantidad).forEach(p => {
    if (resumenCantidad[p] > max) {
      max = resumenCantidad[p];
      top = p;
    }
  });

  document.getElementById("productoTop").innerText = top;

  const promedio = lista.length ? totalInvertido / lista.length : 0;
  document.getElementById("promedioGeneral").innerText = money(promedio);
}

/* =================== SELECTORES ANALISIS =================== */

function cargarSelectorProductos() {
  const sel = document.getElementById("selectorProducto");

  const productos = [...new Set(registros.map(r => r.producto))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  sel.innerHTML = "";
  productos.forEach(p => {
    sel.innerHTML += `<option value="${p}">${p}</option>`;
  });

  if (!productos.length) {
    sel.innerHTML = `<option value="">Sin productos</option>`;
  }
}

function actualizarProveedoresDeProducto() {
  const prod = document.getElementById("selectorProducto").value;
  const sel = document.getElementById("selectorProveedor");

  const proveedores = [...new Set(
    registros
      .filter(r => r.producto === prod)
      .map(r => r.proveedor)
  )]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  sel.innerHTML = `<option value="__TODOS__">Todos los proveedores</option>`;
  proveedores.forEach(p => {
    sel.innerHTML += `<option value="${p}">${p}</option>`;
  });

  graficar();
}

/* =================== GRAFICA =================== */

function graficar() {
  const prod = document.getElementById("selectorProducto").value;
  const prov = document.getElementById("selectorProveedor").value;

  const variacion = document.getElementById("variacion");
  const mejorProveedor = document.getElementById("mejorProveedor");

  if (!prod) return;

  let historial = registros.filter(r => r.producto === prod);

  if (prov !== "__TODOS__") {
    historial = historial.filter(r => r.proveedor === prov);
  }

  // Orden por fecha compra ascendente
  historial.sort((a, b) => {
    const da = a.fechaCompra ? a.fechaCompra.getTime() : 0;
    const db = b.fechaCompra ? b.fechaCompra.getTime() : 0;
    return da - db;
  });

  const labels = historial.map(r => r.fechaCompra ? r.fechaCompra.toLocaleDateString() : "—");
  const precios = historial.map(r => Number(r.costo) || 0);

  if (graficaActual) graficaActual.destroy();

  graficaActual = new Chart(document.getElementById("grafica"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: prov === "__TODOS__"
          ? `Costo general: ${prod}`
          : `Costo ${prov}: ${prod}`,
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

  if (!precios.length) {
    variacion.innerText = "Sin datos para este filtro.";
  } else {
    const ultimo = precios[precios.length - 1];
    const promedio = precios.reduce((a, b) => a + b, 0) / precios.length;

    let texto = `📌 Último costo: ${money(ultimo)} • Promedio: ${money(promedio)}`;

    if (precios.length >= 2) {
      const diff = ultimo - precios[precios.length - 2];
      texto += diff > 0
        ? ` • 🔺 Subió ${money(diff)}`
        : diff < 0
          ? ` • 🔻 Bajó ${money(Math.abs(diff))}`
          : ` • ➖ Sin cambio`;
    }

    variacion.innerText = texto;
  }

  // Mejor proveedor (solo en TODOS)
  if (prov === "__TODOS__") {
    const porProveedor = {};

    registros
      .filter(r => r.producto === prod)
      .forEach(r => {
        const proveedor = r.proveedor;
        if (!porProveedor[proveedor]) porProveedor[proveedor] = { cantidad: 0, total: 0 };

        porProveedor[proveedor].cantidad += r.cantidad || 0;
        porProveedor[proveedor].total += r.total || 0;
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

/* =================== EXPORTAR EXCEL (2 HOJAS) =================== */

function exportarExcel() {
  const lista = filtrarRegistros(registros);

  if (!lista.length) {
    alert("No hay registros para exportar con estos filtros.");
    return;
  }

  // Hoja 1: Compras (detalle)
  const detalle = lista.map(r => ({
    Proveedor: r.proveedor,
    Producto: r.producto,
    Cantidad: r.cantidad,
    "Costo unitario": r.costo,
    Total: r.total,
    Fecha: r.fechaCompra ? fechaToISO(r.fechaCompra) : "",
    Estatus: r.estatus,
    Pago: r.pago,
    Nota: r.nota
  }));

  // Hoja 2: Resumen por producto + fecha + proveedor
  // (esto es lo que pediste: que sí diga si fue 1 proveedor o varios)
  const resumenMap = {};

  lista.forEach(r => {
    const fecha = r.fechaCompra ? fechaToISO(r.fechaCompra) : "SIN_FECHA";
    const key = `${fecha}||${r.producto}||${r.proveedor}`;

    if (!resumenMap[key]) {
      resumenMap[key] = {
        Fecha: fecha,
        Producto: r.producto,
        Proveedor: r.proveedor,
        Cantidad: 0,
        Total: 0
      };
    }

    resumenMap[key].Cantidad += r.cantidad || 0;
    resumenMap[key].Total += r.total || 0;
  });

  const resumen = Object.values(resumenMap)
    .sort((a, b) => (a.Fecha || "").localeCompare(b.Fecha || ""));

  // Excel
  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.json_to_sheet(detalle);
  XLSX.utils.book_append_sheet(wb, ws1, "Compras");

  const ws2 = XLSX.utils.json_to_sheet(resumen);
  XLSX.utils.book_append_sheet(wb, ws2, "Resumen Producto-Fecha");

  XLSX.writeFile(wb, "Compras_LaBonita.xlsx");
}

/* =================== PINTAR TODO =================== */

function pintarTodo() {
  mostrarTabla();
  actualizarDashboard();
  cargarSelectorProductos();
  actualizarProveedoresDeProducto();
}

/* =================== EVENTOS =================== */

window.onload = () => {
  // Link del Form
  const btn = document.getElementById("btnAbrirForm");
  btn.href = FORM_URL;

  // Buscar
  document.getElementById("buscador").addEventListener("input", () => {
    mostrarTabla();
    actualizarDashboard();
  });

  // Filtros fecha
  document.getElementById("fechaInicio").addEventListener("change", () => {
    mostrarTabla();
    actualizarDashboard();
  });

  document.getElementById("fechaFin").addEventListener("change", () => {
    mostrarTabla();
    actualizarDashboard();
  });

  // Selectores análisis
  document.getElementById("selectorProducto").addEventListener("change", () => {
    actualizarProveedoresDeProducto();
  });

  document.getElementById("selectorProveedor").addEventListener("change", () => {
    graficar();
  });

  // Cargar
  cargarDatos();
};


