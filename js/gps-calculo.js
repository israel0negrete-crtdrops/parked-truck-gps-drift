/* El cálculo del simulador del camión estacionado, sin nada de pantalla, para
   poder probarlo aparte (node gps-calculo.js --prueba).

   Arma una noche: el camión estacionado con su GPS ruidoso, y si se piden,
   una maniobra lenta en el patio, una grúa que se lo lleva despacio con el
   motor apagado y el viaje de la mañana. De ahí salen los reportes que
   mandaría el equipo (posición con error, velocidad, encendido, vibración y
   calidad del fix) y se cuentan de tres maneras: sumar puntos, el recorte de
   velocidad y el ancla con varias señales. Las cifras son ilustrativas, como
   las de la nota; el azar lleva semilla para que un enlace repita la noche. */

const GpsCalculo = (() => {
  'use strict';

  // Dónde pasa la noche. sigma: error de cada eje en metros; saltos: la
  // probabilidad de un rebote de 20 a 50 m; mala: la fracción de reportes con
  // fix pobre; vRuido: el ruido de la velocidad en km/h.
  const ENTORNOS = {
    abierto: { sigma: 2.5, saltos: 0, mala: 0.02, vRuido: 0.4 },
    lamina: { sigma: 6, saltos: 0.005, mala: 0.3, vRuido: 1 },
    techado: { sigma: 15, saltos: 0.03, mala: 0.7, vRuido: 2.5 },
  };
  const SIGMA_CAMINO = 2.5;   // en la calle, cielo abierto

  const PREDETERMINADO = {
    entorno: 'lamina', intervalo: 30, horas: 10,
    maniobra: true, remolque: true, viaje: true,
    umbralBajo: 5, recorteAlto: 130, radio: 30, semilla: 1,
  };

  // ------------------------------------------------------------ azar con semilla

  function generador(semilla) {
    let a = (semilla >>> 0) || 1;
    const u = () => {   // mulberry32
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const normal = () => {
      let x = 0;
      while (x === 0) x = u();
      return Math.sqrt(-2 * Math.log(x)) * Math.cos(2 * Math.PI * u());
    };
    return { u, normal };
  }

  // ------------------------------------------------------------ trayectorias

  /* Recorre tramos (rectas y curvas) a un paso de un segundo y devuelve los
     puntos reales. Cada tramo: { recta: m } o { curva: grados, r: m }, con v
     en km/h. El rumbo va en radianes, 0 = este. */
  function recorrer(inicio, rumbo, tramos) {
    const puntos = [];
    let { x, y } = inicio;
    for (const t of tramos) {
      const ms = t.v / 3.6;
      const largo = t.recta !== undefined ? t.recta : Math.abs(t.curva) * Math.PI / 180 * t.r;
      const pasos = Math.max(1, Math.round(largo / ms));
      const giro = t.curva !== undefined ? (t.curva * Math.PI / 180) / pasos : 0;
      const paso = largo / pasos;
      for (let i = 0; i < pasos; i++) {
        rumbo += giro / 2;
        x += paso * Math.cos(rumbo);
        y += paso * Math.sin(rumbo);
        rumbo += giro / 2;
        puntos.push({ x, y, v: t.v });
      }
    }
    return { puntos, fin: { x, y }, rumbo };
  }

  const MANIOBRA = [
    { recta: 40, v: 3 }, { curva: 90, r: 6, v: 3 }, { recta: 50, v: 3 },
    { curva: 90, r: 6, v: 3 }, { recta: 30, v: 3 },
  ];
  const REMOLQUE = [
    { recta: 60, v: 3 }, { curva: -90, r: 8, v: 3 }, { recta: 330, v: 3 },
  ];
  const VIAJE = [
    { recta: 300, v: 30 }, { curva: 90, r: 12, v: 15 }, { recta: 800, v: 45 },
    { curva: -90, r: 15, v: 20 }, { recta: 1500, v: 50 }, { curva: 90, r: 20, v: 25 },
    { recta: 2000, v: 60 }, { curva: -45, r: 60, v: 60 }, { recta: 9000, v: 110 },
    { recta: 6000, v: 140 }, { recta: 6000, v: 110 }, { curva: 90, r: 40, v: 40 },
    { recta: 1200, v: 40 }, { curva: -90, r: 12, v: 15 }, { recta: 400, v: 25 },
    { curva: 90, r: 10, v: 12 }, { recta: 100, v: 8 },
  ];

  /* La verdad, segundo a segundo: dónde está, a qué velocidad, si el motor
     está encendido, si vibra y en qué fase de la noche va. */
  function verdad(p) {
    const seg = [];
    let pos = { x: 0, y: 0 };
    let rumbo = Math.PI / 2;
    const parado = (n, fase) => { for (let i = 0; i < n; i++) seg.push({ ...pos, v: 0, enc: false, vib: false, fase }); };
    const mover = (tramos, enc, fase) => {
      const r = recorrer(pos, rumbo, tramos);
      for (const q of r.puntos) seg.push({ ...q, enc, vib: true, fase });
      pos = r.fin; rumbo = r.rumbo;
    };
    const total = Math.round(p.horas * 3600);
    const eventos = [];
    if (p.maniobra) eventos.push({ en: Math.round(total * 0.15), tramos: MANIOBRA, enc: true, fase: 'maniobra' });
    if (p.remolque) eventos.push({ en: Math.round(total * 0.5), tramos: REMOLQUE, enc: false, fase: 'remolque' });
    for (const e of eventos) {
      parado(Math.max(0, e.en - seg.length), 'parado');
      mover(e.tramos, e.enc, e.fase);
    }
    parado(Math.max(0, total - seg.length), 'parado');
    if (p.viaje) {
      mover(VIAJE, true, 'viaje');
      parado(600, 'parado');
    }
    return seg;
  }

  /* Lo que manda el equipo: un reporte cada `intervalo` segundos. */
  function reportes(p, seg, azar) {
    const ent = ENTORNOS[p.entorno] || ENTORNOS.lamina;
    const salida = [];
    for (let t = 0; t < seg.length; t += p.intervalo) {
      const s = seg[t];
      const enPatio = s.fase !== 'viaje';
      const sigma = enPatio ? ent.sigma : SIGMA_CAMINO;
      const mala = enPatio && azar.u() < ent.mala;
      let ex = sigma * azar.normal(), ey = sigma * azar.normal();
      let salto = false;
      if (enPatio && azar.u() < ent.saltos) {
        const d = 20 + 30 * azar.u(), a = 2 * Math.PI * azar.u();
        ex += d * Math.cos(a); ey += d * Math.sin(a); salto = true;
      }
      const vRuido = enPatio ? ent.vRuido : 0.5;
      let v = s.v === 0 ? Math.abs(vRuido * azar.normal()) : Math.max(0, s.v + vRuido * azar.normal());
      if (salto) v = Math.max(v, 3 + 12 * azar.u());
      // la vibración: con el camión quieto, de vez en cuando un golpe suelto
      const vib = s.vib || azar.u() < 0.002;
      salida.push({ t, x: s.x + ex, y: s.y + ey, v, enc: s.enc, vib, buena: !(mala || salto),
                    real: { x: s.x, y: s.y, v: s.v, fase: s.fase } });
    }
    return salida;
  }

  // ------------------------------------------------------------ las tres maneras de contar

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  /* Cada método recibe los reportes y devuelve, por reporte, la posición que
     muestra, cuánto suma desde el anterior, la velocidad que enseña y si
     levanta la alerta de movimiento con el motor apagado. */

  function sumarPuntos(rs) {
    return rs.map((r, i) => ({ x: r.x, y: r.y, suma: i ? dist(r, rs[i - 1]) : 0, v: r.v, alerta: false }));
  }

  function recorte(rs, p) {
    let ultimo = rs[0];
    return rs.map((r, i) => {
      if (i === 0) return { x: r.x, y: r.y, suma: 0, v: r.v < p.umbralBajo ? 0 : Math.min(r.v, p.recorteAlto), alerta: false };
      if (r.v < p.umbralBajo) return { x: ultimo.x, y: ultimo.y, suma: 0, v: 0, alerta: false };
      const suma = dist(r, ultimo);
      ultimo = r;
      return { x: r.x, y: r.y, suma, v: Math.min(r.v, p.recorteAlto), alerta: false };
    });
  }

  /* Lo que haría hoy: estacionado, el punto se ancla y se ignoran los saltos
     dentro del radio; hay movimiento si hay vibración sostenida, si el motor
     está encendido y la velocidad es de verdad, o si la posición sale del
     radio con buen fix y se queda fuera. Sólo se suma lo recorrido en
     movimiento y con buen fix. Moverse con el motor apagado es la alerta. */
  function ancla(rs, p) {
    const SOSTENIDO = 2, FUERA = 4, QUIETO = 3;
    let enMovimiento = false, ancla = null, n = 0, vibSeguidas = 0, fueraSeguidas = 0, quietas = 0;
    let ultimoBueno = null;
    return rs.map((r) => {
      vibSeguidas = r.vib ? vibSeguidas + 1 : 0;
      if (!enMovimiento) {
        if (ancla === null) {
          if (r.buena) { ancla = { x: r.x, y: r.y }; n = 1; }
        } else if (r.buena) {
          fueraSeguidas = dist(r, ancla) > p.radio ? fueraSeguidas + 1 : 0;
        }
        const arranca = vibSeguidas >= SOSTENIDO || (r.enc && r.v >= 3 && r.vib) || fueraSeguidas >= FUERA;
        if (!arranca) {
          if (r.buena && ancla && dist(r, ancla) <= p.radio) {   // el ancla se afina con cada punto bueno
            n += 1; ancla = { x: ancla.x + (r.x - ancla.x) / n, y: ancla.y + (r.y - ancla.y) / n };
          }
          const a = ancla || r;
          return { x: a.x, y: a.y, suma: 0, v: 0, alerta: false };
        }
        enMovimiento = true; quietas = 0; ultimoBueno = ancla;
      }
      // en movimiento
      const quieto = !r.vib && (r.v < 3 || !r.enc);
      quietas = quieto ? quietas + 1 : 0;
      let suma = 0;
      if (r.buena) {
        if (ultimoBueno) suma = dist(r, ultimoBueno);
        ultimoBueno = { x: r.x, y: r.y };
      }
      // la alerta pide evidencia en el mismo reporte: motor apagado y algo que se mueve
      const alerta = !r.enc && (r.vib || (r.buena && r.v >= 3));
      const salida = { x: (ultimoBueno || r).x, y: (ultimoBueno || r).y, suma, v: r.buena ? r.v : 0, alerta };
      if (quietas >= QUIETO) {
        enMovimiento = false; fueraSeguidas = 0;
        ancla = ultimoBueno ? { ...ultimoBueno } : { x: r.x, y: r.y }; n = 1;
      }
      return salida;
    });
  }

  const METODOS = { puntos: sumarPuntos, recorte, ancla };

  // ------------------------------------------------------------ resumen

  function simular(entrada) {
    const p = { ...PREDETERMINADO, ...entrada };
    const azar = generador(p.semilla);
    const seg = verdad(p);
    const rs = reportes(p, seg, azar);
    // la verdad, contada al mismo paso que los reportes
    // cada intervalo entre dos reportes es de la fase en la que el camión se
    // movió dentro de él; si no se movió ningún segundo, es 'parado'
    const fases = rs.map(() => 'parado');
    const realSuma = rs.map((r, i) => {
      if (!i) return 0;
      let d = 0;
      for (let t = rs[i - 1].t + 1; t <= r.t; t++) {
        d += dist(seg[t], seg[t - 1]);
        if (seg[t].v > 0 && fases[i] === 'parado') fases[i] = seg[t].fase;
      }
      return d;
    });
    const kmEn = (sumas, fase) => sumas.reduce((s, d, i) => s + (fases[i] === fase ? d : 0), 0) / 1000;

    const real = {
      fantasma: 0, viaje: kmEn(realSuma, 'viaje'), maniobra: kmEn(realSuma, 'maniobra') * 1000,
      remolque: kmEn(realSuma, 'remolque') * 1000, vMax: Math.max(0, ...seg.map(s => s.v)),
    };
    // dónde quedó el camión diez minutos después de la grúa
    const finGrua = p.remolque ? rs.findIndex((r, i) => i > 0 && rs[i - 1].real.fase === 'remolque' && r.real.fase !== 'remolque') : -1;
    const despues = finGrua >= 0 ? Math.min(rs.length - 1, finGrua + Math.round(600 / p.intervalo)) : -1;

    const metodos = {};
    for (const [nombre, f] of Object.entries(METODOS)) {
      const m = f(rs, p);
      const sumas = m.map(x => x.suma);
      let acumulado = 0;
      metodos[nombre] = {
        fantasma: kmEn(sumas, 'parado'),
        viaje: kmEn(sumas, 'viaje'),
        maniobra: kmEn(sumas, 'maniobra') * 1000,
        remolque: kmEn(sumas, 'remolque') * 1000,
        vMax: Math.max(0, ...m.map(x => x.v)),
        alerta: m.some((x, i) => x.alerta && rs[i].real.fase === 'remolque'),
        falsasAlertas: m.filter((x, i) => x.alerta && rs[i].real.fase !== 'remolque').length,
        errorTrasGrua: despues >= 0 ? dist(m[despues], rs[despues].real) : null,
        curva: m.map((x) => (acumulado += x.suma) / 1000),
        posiciones: m.map(x => ({ x: x.x, y: x.y })),
      };
    }
    let acumuladoReal = 0;
    real.curva = realSuma.map(d => (acumuladoReal += d) / 1000);
    return { p, reportes: rs, real, metodos, finGrua, despues };
  }

  return { simular, ENTORNOS, PREDETERMINADO, generador, recorrer, VIAJE };
})();

if (typeof module !== 'undefined') {
  module.exports = GpsCalculo;
  if (require.main === module && process.argv.includes('--prueba')) {
    const assert = require('assert');
    const { simular } = GpsCalculo;

    // La cifra de la nota: 10 h parado, un punto cada 30 s, unos 6 m de error:
    // 1,200 saltos de unos 11 m, casi 13 km. Sin eventos, varias semillas.
    for (const semilla of [1, 2, 3, 4, 5]) {
      const r = simular({ maniobra: false, remolque: false, viaje: false, semilla });
      const f = r.metodos.puntos.fantasma;
      assert(f > 12 && f < 14.5, `fantasma con semilla ${semilla}: ${f}`);
      assert(r.metodos.recorte.fantasma < 0.5, `el recorte deja ${r.metodos.recorte.fantasma} km`);
      assert(r.metodos.ancla.fantasma < 0.1, `el ancla deja ${r.metodos.ancla.fantasma} km`);
    }

    // La noche completa, con lo que el recorte esconde.
    const n = simular({});
    const { puntos, recorte, ancla } = n.metodos;
    assert(n.real.vMax === 140);
    assert(recorte.vMax <= 130, 'el recorte enseña más de 130');
    assert(ancla.vMax > 135, 'el ancla debe dejar ver los 140');
    // con el recorte, la maniobra y la grúa casi no existen: a lo más un brinco
    // suelto cuando el ruido empuja la velocidad arriba del umbral
    assert(recorte.maniobra < 0.6 * n.real.maniobra, `el recorte ve ${recorte.maniobra} m de maniobra`);
    assert(recorte.remolque < 0.3 * n.real.remolque, `el recorte ve ${recorte.remolque} m de grúa`);
    assert(recorte.errorTrasGrua > 300, `el recorte deja el camión a ${recorte.errorTrasGrua} m`);
    assert(ancla.alerta, 'el ancla debe levantar la alerta de la grúa');
    assert.strictEqual(ancla.falsasAlertas, 0, 'el ancla no debe alarmar fuera de la grúa');
    assert(!recorte.alerta && !puntos.alerta);
    assert(ancla.errorTrasGrua < 40, `el ancla deja el camión a ${ancla.errorTrasGrua} m`);
    assert(ancla.remolque > 0.5 * n.real.remolque, `el ancla ve ${ancla.remolque} de ${n.real.remolque} m de grúa`);
    // moviéndose, sumar puntos se queda corto (las curvas se cuentan como cuerdas)
    assert(puntos.viaje < n.real.viaje, 'en el viaje, los puntos no deben pasar de lo real');

    // misma semilla, misma noche
    assert.strictEqual(JSON.stringify(simular({ semilla: 7 }).metodos.puntos.fantasma),
                       JSON.stringify(simular({ semilla: 7 }).metodos.puntos.fantasma));

    const f1 = x => x.toFixed(1), f0 = x => Math.round(x);
    console.log('ok · real: viaje', f1(n.real.viaje), 'km, maniobra', f0(n.real.maniobra), 'm, grúa', f0(n.real.remolque), 'm');
    for (const [k, m] of Object.entries(n.metodos)) {
      console.log(`  ${k.padEnd(8)} fantasma ${f1(m.fantasma).padStart(5)} km · viaje ${f1(m.viaje)} km · maniobra ${f0(m.maniobra)} m · grúa ${f0(m.remolque)} m`
        + ` · vmáx ${f0(m.vMax)} · alerta ${m.alerta} (falsas ${m.falsasAlertas}) · tras la grúa a ${f0(m.errorTrasGrua)} m`);
    }
    for (const e of ['abierto', 'techado']) {
      const r = simular({ entorno: e });
      console.log(`  ${e}: fantasma puntos ${f1(r.metodos.puntos.fantasma)} · recorte ${f1(r.metodos.recorte.fantasma)} · ancla ${f1(r.metodos.ancla.fantasma)} km`
        + ` · alerta ancla ${r.metodos.ancla.alerta} (falsas ${r.metodos.ancla.falsasAlertas})`);
    }
  }
}
