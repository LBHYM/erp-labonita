const URL_GOOGLE = "https://script.google.com/macros/s/AKfycbxVzDzyLA2pb2Zhsti1ttd9SpLt79ldnCdLGjoDxlgKSuDFRTw1ssWdFsY9xnu-5rLAow/exec";

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

/* ================= LIMPIAR FILAS ROTAS ================= */
/*
  Esperamos siempre 8 columnas:
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

  // Rellenar faltantes
  const f = [...fila];
  while (f.length < 8) f.push("");

  // Cortar extras
  if (f.length > 8) f.length = 8;

  // Si no tiene ID, no sirve
  const id = safeStr(f[0]);
  if (!id || id.toLowerCase() === "id") return null;

  // Proveedor y producto deben ser texto
  const proveedor = safeSt






