const URL_GOOGLE = "https://script.google.com/macros/s/AKfycbxVzDzyLA2pb2Zhsti1ttd9SpLt79ldnCdLGjoDxlgKSuDFRTw1ssWdFsY9xnu-5rLAow/exec";

let datos = [];
let graficaActual = null;

/* ================= UTILIDADES ================= */

function money(n) {
  const num = Number(n) || 0;
  return "$" + num.toFixed(2);
}

function safeStr(x) {
  return (x ?? "").toString().trim();
}

function toISODateOnly(valor) {
  if (!valor) return "";
  try {
    // Si ya viene como "2026-02-04" lo deja igual
    if (typeof valor === "string" && valor.includes("-") && valor.length >= 10) {
      return valor.substring(0, 10);
    }
    return new Date(valor).toISOString().split("T")[0];
  } catch {
    return "";
  }
}

/* ================= CARGAR DATOS ================= */

async function cargarDatos() {
  try {
    const res = await fetch(URL_GOOGLE);
    const json = await res.json();

    datos = json;

    mostrar();
    actualizarDashboard();
    cargarSelectorProductos();
    actualizarProveedoresDeProducto();
  } catch (e) {
    console.error("Error cargando datos:", e);
    alert("No se pudieron cargar los datos. Revisa el Apps Script.");
  }
}

/* ================= MOSTRAR TABLA ================= */

function mostrar() {
  const tabla = document.getElementById("tabla");
  const filtro = document.getElementById("buscador").value.toLowerCase();

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
        <td>${id}</td>
        <td>${proveedor}</td>
        <td>${producto}</td>
        <td>${cantidad}</td>
        <td>${money(costo)}</td>
        <td>${money(total)}</td>
        <td>${fecha}</td>
        <td>${notas}</td>
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

  document.getElementById("totalInvertido").innerText = money(totalInvertido);
  document.getElementById("totalCompras").innerText = totalCompras;

  let top = "-";
  let max = 0;
  Object.keys(resumenCantidad).forEach(p => {
    if (resumenCantidad[p] > max) {
      max = resumenCantidad[p];
      top = p;
    }
  });

  document.getElementById("productoTop").innerText = top;

  const promedioGeneral = totalCompras ? totalInvertido / totalCompras : 0;
  document.getElementById("promedioGeneral").innerText = money(promedioGeneral);
}

/* ================= EXPORTAR EXCEL (3 HOJAS) ================= */

function exportarExcel() {
  if (!datos || datos.length <= 1) {
    alert("No hay datos para exportar.");
    return;
  }

  const registros = datos.slice(1);

  /* -------------------------------
     HOJA 1: COMPRAS (HISTORIAL)
  -------------------------------- */
  const hojaCompras = registros.map(f => ({
    ID: f[0],
    Proveedor: f[1],
    Producto: f[2],
    Cantidad: f[3],
    Costo: f[4],
    Total: f[5],
    Fecha: toISODateOnly(f[6]),
    Notas: f[7]
  }));

  /* -------------------------------
     HOJA 2: TOTALES POR FECHA + PRODUCTO
  -------------------------------- */
  const resumenFechaProducto = {};
  registros.forEach(f => {
    const fecha = toISODateOnly(f[6]);
    const producto = safeStr(f[2]);
    const cantidad = Number(f[3]) || 0;
    const total = Number(f[5]) || 0;

    const key = `${fecha}||${producto}`;

    if (!resumenFechaProducto[key]) {
      resumenFechaProducto[key] = {
        Fecha: fecha,
        Producto: producto,
        Cantidad_Total: 0,
        Total_Gastado: 0
      };
    }

    resumenFechaProducto[key].Cantidad_Total += cantidad;
    resumenFechaProducto[key].Total_Gastado += total;
  });

  const hojaTotalesFechaProducto = Object.values(resumenFechaProducto)
    .sort((a, b) => {
      if (a.Fecha === b.Fecha) return a.Producto.localeCompare(b.Producto);
      return a.Fecha.localeCompare(b.Fecha);
    })
    .map(x => ({
      Fecha: x.Fecha,
      Producto: x.Producto,
      Cantidad_Total: x.Cantidad_Total,
      Total_Gastado: Number(x.Total_Gastado.toFixed(2))
    }));

  /* -------------------------------
     HOJA 3: TOTALES POR FECHA + PRODUCTO + PROVEEDOR
  -------------------------------- */
  const resumenFechaProductoProveedor = {};
  registros.forEach(f => {
    const fecha = toISODateOnly(f[6]);
    const producto = safeStr(f[2]);
    const proveedor = safeStr(f[1]);
    const cantidad = Number(f[3]) || 0;
    const total = Number(f[5]) || 0;

    const key = `${fecha}||${producto}||${proveedor}`;

    if (!resumenFechaProductoProveedor[key]) {
      resumenFechaProductoProveedor[key] = {
        Fecha: fecha,
        Producto: producto,
        Proveedor: proveedor,
        Cantidad_Total: 0,
        Total_Gastado: 0
      };
    }

    resumenFechaProductoProveedor[key].Cantidad_Total += cantidad;
    resumenFechaProductoProveedor[key].Total_Gastado += total;
  });

  const hojaTotalesFechaProductoProveedor = Object.values(resumenFechaProductoProveedor)
    .sort((a, b) => {
      if (a.Fecha !== b.Fecha) return a.Fecha.localeCompare(b.Fecha);
      if (a.Producto !== b.Producto) return a.Producto.localeCompare(b.Producto);
      return a.Proveedor.localeCompare(b.Proveedor);
    })
    .map(x => ({
      Fecha: x.Fecha,
      Producto: x.Producto,
      Proveedor: x.Proveedor,
      Cantidad_Total: x.Cantidad_Total,
      Total_Gastado: Number(x.Total_Gastado.toFixed(2))
    }));

  /* -------------------------------
     CREAR EXCEL CON 3 HOJAS
  -------------------------------- */
  const libro = XLSX.utils.book_new();

  const ws1 = XLSX.utils.json_to_sheet(hojaCompras);
  const ws2 = XLSX.utils.json_to_sheet(hojaTotalesFechaProducto);
  const ws3 = XLSX.utils.json_to_sheet(hojaTotalesFechaProductoProveedor);

  XLSX.utils.book_append_sheet(libro, ws1, "Compras");
  XLSX.utils.book_append_sheet(libro, ws2, "Totales_Fech_Prod");
  XLSX.utils.book_append_sheet(libro, ws3, "Totales_Fech_Prod_Prov");

  XLSX.writeFile(libro, "Compras_LaBonita.xlsx");
}

/* ================= SELECTORES ANALISIS ================= */

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

/* ================= GRAFICA + RESUMEN ================= */

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
        fill: false,
        tension: 0.25
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
