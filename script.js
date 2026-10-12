/* =====================================================================
  CALCULADORA MÉTODO GRÁFICO (2 variables -> x, y)
  Usa Crammer para obtener la x y y con respecto a las restricciones y con ello la Z

  Documentación por si me olvido: 
  Numbers: https://developer.mozilla.org/es/docs/Web/JavaScript/Reference/Global_Objects/Number
  Math: https://developer.mozilla.org/es/docs/Web/JavaScript/Reference/Global_Objects/Math 
  Array: https://developer.mozilla.org/es/docs/Web/JavaScript/Reference/Global_Objects/Array
   ===================================================================== */

/* Tolerancia numérica. Los números decimales en la computadora tienen pequeños errores de redondeo (0.1+0.2 = 0.30000000000000004), por no vamos a comparar valores calculados con "==", decimos que dos valores son iguales si su diferencia en valor absoluto es menor que E  de Épsilon (representa una cantidad > 0 pero puede acercarse a cero tanto como se desee). */
const EPS = 1e-9;
/* Tolerancia un poco más holgada, usada para decidir si dos vértices son el mismo punto (los errores de Cramer se acumulan algo más). */
const EPS_DUP = 1e-7;

//* Formateo
/* fmt(n): redondea un número a 4 decimales como máximo. */
// Recordatorio: Math.abs() devuelve el valor absoluto de un número
function fmt(n) {
  return Math.round(n * 10000) / 10000;
}

//* Formatear puntos
/* fmtPunto(p): "(x, y)" con fmt se formatea con 4 puntos decimales */
function fmtPunto(p) {
  return "(" + fmt(p.x) + ", " + fmt(p.y) + ")";
}

/* num(n): número  a string */
function num(n) {
  return String(parseFloat(n.toFixed(4)));
}

// * formateo restricción
/* textoRestriccion(r): escribe la restricción como "6x + 4y ≤ 24".
  Recibe {a,b,signo,C}; devuelve texto, pero omite términos con coeficiente 0 */
function textoRestriccion(r) {
  // Entrada: pares [coeficiente, letra] de las restriccioens
  const terminos = [
    [r.a, "x"],
    [r.b, "y"],
  ];
  // Salida: constante para guardar los terminos formaterados
  const partes = [];

  // Arma el texto de un término: coeficiente 6, letra x -> "6x"
  function termino(coef, letra) {
    const vAbs = Math.abs(coef);
    return (vAbs === 1 ? "" : num(vAbs)) + letra;
  }

  terminos.forEach(function (par) {
    const coef = par[0],
      letra = par[1];
    if (coef === 0) return; // término ausente: se salta la vuelta
    const t = termino(coef, letra);
    // El primer término no necesita el "+", pero si "−" si es < 0
    if (partes.length === 0) partes.push(coef < 0 ? "−" + t : t);
    else partes.push((coef < 0 ? "− " : "+ ") + t);
  });

  const simbolo = { "<=": "≤", ">=": "≥", "=": "=" }[r.signo];
  // join crea un string nuevo uniendo los textos con espacios por estetica: "6x + 4y"
  return partes.join(" ") + " " + simbolo + " " + num(r.C);
}

//-----------------------------------------------------------------
// * Funciones de entrada, validación y conversión
// ------------------------------------------------------------------

/* leerEntrada(): lee los campos del formulario
  Devuelve {tipo, objA, objB, restricciones:[{a,b,signo,C}]} con los valores como TEXTO */
function leerEntrada() {
  //- Todos los elementos con clase fila que esten dentro de <div id="filas"></div>  
  const filas = document.querySelectorAll("#filas .fila");
  const restricciones = [];
  
  filas.forEach(function (f) {
    restricciones.push({
      a: f.querySelector(".ra").value,
      b: f.querySelector(".rb").value,
      signo: f.querySelector(".rs").value,
      C: f.querySelector(".rc").value,
    });
  });

  // tipo -> max o min, objA -> coef x en Z y objB es y en Z
  return {
    tipo: document.getElementById("tipo").value,
    objA: document.getElementById("objA").value,
    objB: document.getElementById("objB").value,
    restricciones: restricciones,
  };
}

/* Conversor de string a number, acepta coma como decimal. Devuelve NaN si está vacío o no es un número. */
function toNumber(texto) {
  const t = String(texto).trim().replace(",", ".");
  if (t === "") return NaN;
  return Number(t); // Number("abc") = NaN, Number("") = 0 (ya filtrado)
}

/* validación de los input, recibe lo que devuelve leerEntrada. No debe haber errores para calcular 
1. Revisa los datos
2. Convierte los datos a números
Regresa: return {errores: errores, / lista de mensajes de error
  datos: {
    tipo: entrada.tipo, // "max" o "min"
    obj: { a: oa, b: ob }, // coeficientes de Z, como nums
    restricciones: restricciones, // restricciones válidas con números
  },
};
*/
function validar(entrada) {
  const errores = [];
  const oa = toNumber(entrada.objA), ob = toNumber(entrada.objB);
  if (!isFinite(oa) || !isFinite(ob)) {
    errores.push("La función objetivo tiene campos vacíos o no numéricos.");
  } else if (oa === 0 && ob === 0) {
    // Los coeficientes los escribe el usuario, así que 0 exacto es válido.
    errores.push("La función objetivo no puede tener a = 0 y b = 0.");
  }

  const restricciones = [];

  entrada.restricciones.forEach(function (r, i) {
    const a = toNumber(r.a),
      b = toNumber(r.b),
      C = toNumber(r.C);
    if (!isFinite(a) || !isFinite(b) || !isFinite(C)) {
      errores.push(
        "Restricción " + (i + 1) + ": hay campos vacíos o no numéricos.",
      );
    } else if (a === 0 && b === 0) {
      errores.push(
        "Restricción " + (i + 1) + ": con a = 0 y b = 0 no es una recta.",
      );
    } else {
      restricciones.push({ a: a, b: b, signo: r.signo, C: C });
    }
  });

  return {
    errores: errores,
    datos: {
      tipo: entrada.tipo,
      obj: { a: oa, b: ob },
      restricciones: restricciones,
    },
  };
}

//-----------------------------------------------------------------
// * 3 pasos del modelo: variables, función obj, restricciones
// -----------------------------------------------------------------

/* Recibe los datos validados; devuelve {tipo, obj, restriccionesUsuario:[...], noNeg:[x>=0, y>=0]}. */
function construirModelo(datos) {
  return {
    tipo: datos.tipo,  // ej: max
    obj: datos.obj, // a:5 b:4 (Con respecto a Z)
    restriccionesUsuario: datos.restricciones, // Aquí van las restriccioens
    noNeg: [
      { a: 1, b: 0, signo: ">=", C: 0 }, // x >= 0
      { a: 0, b: 1, signo: ">=", C: 0 }, // y >= 0
    ],
  };
}

//-----------------------------------------------------------------
// * Calculo de puntos para restricciones 
// -----------------------------------------------------------------

/* calcularIntersecciones(restricciones): para cada recta ax + by = c obtiene los puntos por despeje directo. 
Recibe la lista de restricciones -> devuelve una lista de {restriccion, puntos:[{x,y}], nota:texto}. */
function calcularIntersecciones(restricciones) {
  return restricciones.map(function (r) {
    const puntos = [];
    // Punto con el eje Y: y = c/b  (solo si b != 0)
    if (r.b !== 0) puntos.push({ x: 0, y: r.C / r.b });
    // Punto con el eje X:  x = c/a  (solo si a != 0)
    if (r.a !== 0) puntos.push({ x: r.C / r.a, y: 0 });
    // Si c = 0 entonces la recta pasa por el origen:  (0,0), para tener un segundo punto que dibuje la recta damos x = 1:  a·1, y = -a/b.
    if (r.C === 0 && r.b !== 0) puntos.push({ x: 1, y: -r.a / r.b });

    // Quitar puntos repetidos (ej. (0,0) aparece dos veces si c = 0)
    const unicos = [];

    puntos.forEach(function (p) {
      // ¿Alguno de los puntos ya guardados es igual a p?
      const repetido = unicos.some(function (q) {
        return Math.abs(p.x - q.x) < EPS && Math.abs(p.y - q.y) < EPS;
      });
      if (!repetido) unicos.push(p);
    });

    let nota = "";
    if (r.b === 0) nota = "Recta vertical x = " + fmt(r.C / r.a);
    else if (r.a === 0) nota = "Recta horizontal y = " + fmt(r.C / r.b);

    return { restriccion: r, puntos: unicos, nota: nota };
  });
}

//-----------------------------------------------------------------
// * Calculo de vertices 
// -----------------------------------------------------------------

/* calcularCaja(rectas): calcula limite para el "área artificial" x <= limite,
  y <= limite.
  Recibe las rectas (restricciones del usuario + no negatividad, sin la caja) y devuelve el número limite.
  Esto se calcula para evitar que el punto óptimo este en infinito, por eso lo restringimos a una "caja" como área */
function calcularCaja(rectas) {
  let mayor = 0;
  for (let i = 0; i < rectas.length; i++) {
    for (let j = i + 1; j < rectas.length; j++) {
      const p = interseccion(rectas[i], rectas[j]); // null si son paralelas
      if (p !== null) {
        mayor = Math.max(mayor, Math.abs(p.x), Math.abs(p.y));
      }
    }
  }
  return Math.max(100, 10 * mayor);
}

/* interseccion(r1, r2): corta dos rectas con la regla de Cramer.
  Recibe dos restricciones y devuelve {x,y} o null si son paralelas*/
function interseccion(r1, r2) {
  const det = r1.a * r2.b - r2.a * r1.b;
  // det = 0 -> rectas paralelas o coincidentes (puntos infinito): en ambos casos no hay un vértice único
  if (Math.abs(det) < EPS) return null;
  return {
    x: (r1.C * r2.b - r2.C * r1.b) / det,
    y: (r1.a * r2.C - r2.a * r1.C) / det,
  };
}

/* esFactible(p, restricciones): ¿el punto cumple todas las restricciones? Se compara con tolerancia porque p viene de un cálculo con redondeo */
function esFactible(p, restricciones) {
  return restricciones.every(function (r) {
    const valor = r.a * p.x + r.b * p.y;
    if (r.signo === "<=") return valor <= r.C + EPS;
    if (r.signo === ">=") return valor >= r.C - EPS;
    return Math.abs(valor - r.C) <= EPS; // signo "="
  });
}

/* calcularVertices(todas): intersecta todos los pares de rectas, filtra por factibilidad y elimina duplicados. Recibe las restricciones (usuario + no negatividad + caja) y devuelve la lista de puntos {x,y} factibles y distintos.
Si el problema tiene óptimo, está en un vértice, y cada vértice es la intersección de dos rectas frontera */
function calcularVertices(todas) {
  const candidatos = [];
  
  for (let i = 0; i < todas.length; i++) {
    for (let j = i + 1; j < todas.length; j++) {
      const p = interseccion(todas[i], todas[j]);
      if (p !== null && esFactible(p, todas)) candidatos.push(p);
    }
  }
  // Quitar duplicados: tres rectas pueden cruzarse en el mismo punto
  const unicos = [];
  candidatos.forEach(function (p) {
    const repetido = unicos.some(function (q) {
      return Math.abs(p.x - q.x) < EPS_DUP && Math.abs(p.y - q.y) < EPS_DUP;
    });
    if (!repetido) unicos.push(p);
  });
  return unicos;
}

//-----------------------------------------------------------------
// * Evaluar Z 
// -----------------------------------------------------------------

/* evaluarZ(vertices, obj, limite): calcula Z = ax + by en cada vértice y marca si el vértice está sobre la caja artificial (límite)
Devuelve [{x, y, z, enCaja}] */
function evaluarZ(vertices, obj, limite) {
  return vertices.map(function (p) {
    return {
      x: p.x,
      y: p.y,
      z: obj.a * p.x + obj.b * p.y,
      // Un vértice "de la caja" tiene x ≈ limite o y ≈ limite (no es un vértice real)
      enCaja: Math.abs(p.x - limite) < EPS_DUP || Math.abs(p.y - limite) < EPS_DUP,
    };
  });
}

/* clasificar(evaluados, tipo): decide el tipo de resultado
Recibe los vértices con Z y 'max'/'min' y devuelve {estado:'infactible'|'no_acotado'|'multiple'|'unico', zOpt, optimos:[...]}. */
function clasificar(evaluados, tipo) {
  // Sin ningún vértice factible no hay región factible.
  if (evaluados.length === 0) {
    return { estado: "infactible", zOpt: null, optimos: [] };
  }
  // Mejor valor de Z entre todos los vértices
  let zOpt = evaluados[0].z;
  evaluados.forEach(function (v) {
    if (tipo === "max" ? v.z > zOpt : v.z < zOpt) zOpt = v.z;
  });
  // Vértices cuyo Z coincide con el óptimo
  const optimos = evaluados.filter(function (v) {
    return Math.abs(v.z - zOpt) < EPS;
  });
  // Si el óptimo toca el área/caja artificial, Z mejora sin límite.
  if (
    optimos.some(function (v) {
      return v.enCaja;
    })
  ) {
    return { estado: "no_acotado", zOpt: zOpt, optimos: [] };
  }
  // Dos vértices con el mismo Z óptimo -> todo el segmento es óptimo
  if (optimos.length >= 2) {
    return { estado: "multiple", zOpt: zOpt, optimos: optimos };
  }
  return { estado: "unico", zOpt: zOpt, optimos: optimos };
}

/* resolver(datos): ejecuta toda la parte matemática
  Recibe los datos validados y  devuelve un objeto con todo lo necesario para generar las tablas y la gráfica */
function resolver(datos) {
  const modelo = construirModelo(datos);
  const cortes = calcularIntersecciones(modelo.restriccionesUsuario); // puntos de corte
  const rectasReales = modelo.restriccionesUsuario.concat(modelo.noNeg); // rectas sin la caja
  const limite = calcularCaja(rectasReales);
  const caja = [
    { a: 1, b: 0, signo: "<=", C: limite }, // x <= limite
    { a: 0, b: 1, signo: "<=", C: limite }, // y <= limite
  ];
  const todas = rectasReales.concat(caja);
  const vertices = calcularVertices(todas);
  const evaluados = evaluarZ(vertices, modelo.obj, limite);
  const resultado = clasificar(evaluados, modelo.tipo);
  return {
    modelo: modelo,
    cortes: cortes,
    limite: limite,
    evaluados: evaluados, // con caja (para el polígono)
    reales: evaluados.filter(function (v) {
      return !v.enCaja;
    }),
    resultado: resultado,
  };
}

//-----------------------------------------------------------------
// * Imprimir tablas y advertencias
// -----------------------------------------------------------------

/* Llena las dos tablas y la alerta de resultado. Recibe lo que devuelve resolver*/
function mostrarTablas(sol) {
  // Tabla de puntos de cada restricción 
  let h = "<thead><tr><th>Restricción</th><th>Puntos</th></tr></thead><tbody>";
  sol.cortes.forEach(function (c) {
    let detalle;
    // c.nota para rectas verticales u horizontales
    if (c.nota) {
      detalle =
        c.nota +
        (c.puntos.length
          ? " &nbsp;→ " + c.puntos.map(fmtPunto).join(", ")
          : "");
    } else {
      detalle = c.puntos.map(fmtPunto).join(", ");
    }
    h +=
      "<tr><td>" +
      textoRestriccion(c.restriccion) +
      "</td><td>" +
      detalle +
      "</td></tr>";
  });
  document.getElementById("tablaCortes").innerHTML = h + "</tbody>";

  //  Tabla de vértices (solo reales, sin los de la caja)
  const res = sol.resultado;
  h = "<thead><tr><th>Vértice (x, y)</th><th>Z</th></tr></thead><tbody>";
  if (sol.reales.length === 0) {
    h +=
      '<tr><td colspan="2" class="text-center text-muted">Sin vértices</td></tr>';
  }
  sol.reales.forEach(function (v) {
    // Resaltamos la fila si es óptima
    const esOpt =
      (res.estado === "unico" || res.estado === "multiple") &&
      res.optimos.indexOf(v) !== -1;
    h +=
      "<tr" +
      (esOpt ? ' class="fila-optima"' : "") +
      "><td>" +
      fmtPunto(v) +
      "</td><td>" +
      fmt(v.z) +
      "</td></tr>";
  });
  document.getElementById("tablaVertices").innerHTML = h + "</tbody>";

  // Alerta de resultado
  let clase, texto;
  const tipoTxt = sol.modelo.tipo === "max" ? "máxima" : "mínima";
  if (res.estado === "infactible") {
    clase = "danger";
    texto = "<strong>INFACTIBLE:</strong> No existe región factible.";
  } else if (res.estado === "no_acotado") {
    clase = "warning";
    texto =
      "<strong>Sin limite:</strong> Z no está acotada (" +
      (sol.modelo.tipo === "max" ? "crece" : "decrece") +
      " sin límite).";
  } else if (res.estado === "multiple") {
    clase = "success";
    texto =
      "<strong>Soluciones múltiples:</strong> cualquier punto del segmento entre " +
      fmtPunto(res.optimos[0]) +
      " y " +
      fmtPunto(res.optimos[1]) +
      ".<br>Z " +
      tipoTxt +
      " = " +
      fmt(res.zOpt);
  } else {
    clase = "success";
    texto =
      "<strong>Óptimo:</strong> Z " +
      tipoTxt +
      " = " +
      fmt(res.zOpt) +
      " en " +
      fmtPunto(res.optimos[0]);
  }
  document.getElementById("resultadoAlerta").innerHTML =
    '<div class="alert alert-' + clase + '">' + texto + "</div>";
}

//-----------------------------------------------------------------
// * Gráfica
// -----------------------------------------------------------------

/* recortarRecta(a, b, C, v): corta la recta ax + by = C con los BORDES de la ventana v = {xmin,xmax,ymin,ymax}. Devuelve dos puntos [{x,y},{x,y}] para dibujar o null. Funciona con rectas verticales, horizontales y las que pasan por el origen porque rueba los 4 bordes en vez de usar los ejes. */
function recortarRecta(a, b, C, v) {
  const cand = [];
  const tol =
    1e-9 * Math.max(1, Math.abs(v.xmax - v.xmin), Math.abs(v.ymax - v.ymin));
  // Bordes izquierdo y derecho (x fija): y = (C − ax)/b, requiere b != 0
  if (b !== 0) {
    [v.xmin, v.xmax].forEach(function (x) {
      const y = (C - a * x) / b;
      if (y >= v.ymin - tol && y <= v.ymax + tol) cand.push({ x: x, y: y });
    });
  }
  // Bordes inferior y superior (y fija): x = (C − by)/a, requiere a != 0
  if (a !== 0) {
    [v.ymin, v.ymax].forEach(function (y) {
      const x = (C - b * y) / a;
      if (x >= v.xmin - tol && x <= v.xmax + tol) cand.push({ x: x, y: y });
    });
  }
  // Quitar puntos repetidos (cuando la recta pasa justo por una esquina)
  const u = [];
  cand.forEach(function (p) {
    if (
      !u.some(function (q) {
        return Math.abs(p.x - q.x) < tol && Math.abs(p.y - q.y) < tol;
      })
    )
      u.push(p);
  });
  return u.length >= 2 ? [u[0], u[u.length - 1]] : null;
}

/* ordenarPorAngulo(puntos): ordena los vértices alrededor de su centroide para que el polígono se dibuje sin cruzarse. Recibe [{x,y}] y devuelve una lista nueva. */
function ordenarPorAngulo(puntos) {
  if (puntos.length === 0) return [];
  const cx = puntos.reduce(function (s, p) {
      return s + p.x;
    }, 0) / puntos.length;
  const cy =
    puntos.reduce(function (s, p) {
      return s + p.y;
    }, 0) / puntos.length;
  // atan2 da el ángulo de cada punto respecto al centroide, ordenar por se ángulo equivale a recorrer el contorno de la región
  return puntos.slice().sort(function (p, q) {
    return Math.atan2(p.y - cy, p.x - cx) - Math.atan2(q.y - cy, q.x - cx);
  });
}

/* graficar(sol): dibuja restricciones, región, vértices y recta de Z. Recibe lo que devuelve resolver. No devuelve nada. */
function graficar(sol) {
  const res = sol.resultado;
  const hayOptimo = res.estado === "unico" || res.estado === "multiple";

  // Ventana: cortes reales y vértices reales, +20 % de margen
  const xs = [0],
    ys = [0];
  sol.cortes.forEach(function (c) {
    c.puntos.forEach(function (p) {
      xs.push(p.x);
      ys.push(p.y);
    });
  });
  sol.reales.forEach(function (v) {
    xs.push(v.x);
    ys.push(v.y);
  });

  // vals:  la lista de coordenadas de un eje, lo = low (valor + bajo), hi = high (valor + alto)
  function limites(vals) {
    const lo = Math.min.apply(null, vals),
      hi = Math.max.apply(null, vals);
    const span = hi - lo || 1;
    // Un poco antes de 0 (10%) para que se vean los ejes, 20% después
    return [lo - 0.1 * span, hi + 0.2 * span];
  }
  const lx = limites(xs),
    ly = limites(ys);
  const v = { xmin: lx[0], xmax: lx[1], ymin: ly[0], ymax: ly[1] };

  const trazas = [];

  // Región factible (polígono con la caja si no es acotada, y la ventana lo recorta visualmente)
  if (sol.evaluados.length > 0) {
    const poli = ordenarPorAngulo(sol.evaluados);
    poli.push(poli[0]); // cerrar el contorno
    trazas.push({
      x: poli.map(function (p) {
        return p.x;
      }),
      y: poli.map(function (p) {
        return p.y;
      }),
      fill: "toself",
      fillcolor: "rgba(25,135,84,0.25)",
      mode: "lines",
      line: { color: "rgba(25,135,84,0.6)", width: 1 },
      name: "Región factible",
      hoverinfo: "skip",
    });
  }

  // Restricciones del usuario (todas azules) 
  sol.modelo.restriccionesUsuario.forEach(function (r) {
    const seg = recortarRecta(r.a, r.b, r.C, v);
    if (!seg) return;
    trazas.push({
      x: [seg[0].x, seg[1].x],
      y: [seg[0].y, seg[1].y],
      mode: "lines",
      line: { color: "#0d6efd", width: 2 },
      name: textoRestriccion(r),
    });
  });

  // Recta óptima de Z (roja) solo si hay óptimo 
  if (hayOptimo) {
    const o = sol.modelo.obj;
    const seg = recortarRecta(o.a, o.b, res.zOpt, v);
    if (seg) {
      trazas.push({
        x: [seg[0].x, seg[1].x],
        y: [seg[0].y, seg[1].y],
        mode: "lines",
        line: { color: "#dc3545", width: 3, dash: "dash" },
        name: "Z = " + fmt(res.zOpt),
      });
    }
  }

  // Otros puntos de las restricciones (grises)
  // Solo se grafican los que caen dentro de la ventana, los vértices ya se dibujan en negro, así que aquí se omiten (y los repetidos también)
  const otros = [];
  sol.cortes.forEach(function (c) {
    c.puntos.forEach(function (p) {
      const dentro =
        p.x >= v.xmin && p.x <= v.xmax && p.y >= v.ymin && p.y <= v.ymax;
      // Mismo criterio que los vértices duplicados: tolerancia EPS_DUP
      function igual(q) {
        return Math.abs(p.x - q.x) < EPS_DUP && Math.abs(p.y - q.y) < EPS_DUP;
      }
      if (dentro && !sol.reales.some(igual) && !otros.some(igual)) {
        otros.push({ x: p.x, y: p.y, texto: textoRestriccion(c.restriccion) });
      }
    });
  });
  if (otros.length > 0) {
    trazas.push({
      x: otros.map(function (p) {
        return p.x;
      }),
      y: otros.map(function (p) {
        return p.y;
      }),
      text: otros.map(function (p) {
        return p.texto;
      }),
      mode: "markers",
      marker: { color: "#adb5bd", size: 9, line: { color: "#6c757d", width: 1 } },
      name: "Otros puntos de las restricciones",
      hovertemplate: "(%{x:.4f}, %{y:.4f})<br>%{text}<extra></extra>",
    });
  }

  // Vértices reales (el óptimo, más grande y rojo) 
  const normales = sol.reales.filter(function (p) {
    return !(hayOptimo && res.optimos.indexOf(p) !== -1);
  });
  trazas.push({
    x: normales.map(function (p) {
      return p.x;
    }),
    y: normales.map(function (p) {
      return p.y;
    }),
    text: normales.map(function (p) {
      return "Z = " + fmt(p.z);
    }),
    mode: "markers",
    marker: { color: "#212529", size: 9 },
    name: "Vértices",
    hovertemplate: "(%{x:.4f}, %{y:.4f})<br>%{text}<extra></extra>",
  });
  if (hayOptimo) {
    trazas.push({
      x: res.optimos.map(function (p) {
        return p.x;
      }),
      y: res.optimos.map(function (p) {
        return p.y;
      }),
      text: res.optimos.map(function (p) {
        return "Z = " + fmt(p.z);
      }),
      mode: "markers",
      marker: {
        color: "#dc3545",
        size: 15,
        line: { color: "white", width: 2 },
      },
      name: "Óptimo",
      hovertemplate: "(%{x:.4f}, %{y:.4f})<br>%{text}<extra></extra>",
    });
  }

  // Plotly.newPlot( donde, que, aspecto, opciones )
  Plotly.newPlot(
    "grafica",
    trazas,
    {
      xaxis: {
        title: "x",
        range: [v.xmin, v.xmax],
        zeroline: true,
        zerolinewidth: 2,
      },
      yaxis: {
        title: "y",
        range: [v.ymin, v.ymax],
        zeroline: true,
        zerolinewidth: 2,
      },
      margin: { t: 20 },
      legend: { orientation: "h", y: -0.2 },
    },
    { responsive: true },
  );
}

//-----------------------------------------------------------------
// * Interfaz
// -----------------------------------------------------------------

/* renumerarFilas(): actualiza las etiquetas de accesibilidad de cada fila ("Restricción 1", "Restricción 2"...) para que un lector de pantalla sepa a cuál pertenece cada campo. Se llama al agregar o quitar filas. No recibe nada ni devuelve nada. */
function renumerarFilas() {
  document.querySelectorAll("#filas .fila").forEach(function (fila, i) {
    const n = i + 1;
    fila.setAttribute("aria-label", "Restricción " + n);
    fila.querySelector(".ra").setAttribute("aria-label", "Coeficiente de x, restricción " + n);
    fila.querySelector(".rb").setAttribute("aria-label", "Coeficiente de y, restricción " + n);
    fila.querySelector(".rs").setAttribute("aria-label", "Signo, restricción " + n);
    fila.querySelector(".rc").setAttribute("aria-label", "Valor C, restricción " + n);
    fila.querySelector(".btnQuitar").setAttribute("aria-label", "Quitar restricción " + n);
  });
}

// agregarFila(): añade una fila vacía de restricción al formulario. 
function agregarFila() {
  const div = document.createElement("div");
  div.className = "fila row g-2 align-items-center mb-2";
  div.setAttribute("role", "group"); // agrupa los campos de una restricción
  div.innerHTML =
    '<div class="col-auto"><input type="text" inputmode="decimal" class="form-control ra" style="width:80px" placeholder="a"></div>' +
    '<div class="col-auto">x +</div>' +
    '<div class="col-auto"><input type="text" inputmode="decimal" class="form-control rb" style="width:80px" placeholder="b"></div>' +
    '<div class="col-auto">y</div>' +
    '<div class="col-auto"><select class="form-select rs">' +
    '<option value="<=">≤</option><option value=">=">≥</option><option value="=">=</option></select></div>' +
    '<div class="col-auto"><input type="text" inputmode="decimal" class="form-control rc" style="width:90px" placeholder="C"></div>' +
    // type="button": dentro de un <form>, un botón sin tipo sería "submit" y enviaría el formulario
    '<div class="col-auto"><button type="button" class="btn btn-outline-danger btn-sm btnQuitar">Quitar</button></div>';
  div.querySelector(".btnQuitar").addEventListener("click", function () {
    // Se deja al menos una restricción en pantalla
    if (document.querySelectorAll("#filas .fila").length > 1) {
      div.remove();
      renumerarFilas();
    }
  });
  document.getElementById("filas").appendChild(div);
  renumerarFilas();
}

/* calcular(): se ejecuta al pulsar "Calcular": une todos los pasos. */
function calcular() {
  const cont = document.getElementById("alertas");
  cont.innerHTML = "";
  const v = validar(leerEntrada());
  if (v.errores.length > 0) {
    cont.innerHTML =
      '<div class="alert alert-danger"><ul class="mb-0">' +
      v.errores
        .map(function (e) {
          return "<li>" + e + "</li>";
        })
        .join("") +
      "</ul></div>";
    document.getElementById("resultados").style.display = "none";
    return; // validación fallida: no calcular
  }
  const sol = resolver(v.datos);
  document.getElementById("resultados").style.display = "block";
  mostrarTablas(sol);
  graficar(sol);
}

if (typeof document !== "undefined") {
  agregarFila();
  agregarFila(); // se empieza con 2 filas
  document.getElementById("btnAgregar").addEventListener("click", agregarFila);
  // El cálculo se dispara con el evento "submit" del formulario: así
  // funciona tanto con el botón Calcular como con la tecla Enter.
  document.getElementById("formulario").addEventListener("submit", function (evento) {
    evento.preventDefault(); // evita que el navegador recargue la página
    calcular();
  });
}
