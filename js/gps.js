/* La pantalla del simulador del camión estacionado. El cálculo vive en
   gps-calculo.js; aquí se leen los controles, se pinta la tabla y las dos
   gráficas. La noche completa (con su semilla) viaja en la dirección (#…),
   para que un enlace copiado repita lo mismo. Nada se manda a ningún lado. */

(() => {
  'use strict';

  const { simular, PREDETERMINADO } = GpsCalculo;
  const $ = s => document.querySelector(s);
  const lang = () => (document.body.dataset.idioma === 'en' ? 'en' : 'es');
  const SVG = 'http://www.w3.org/2000/svg';
  const HORA_INICIO = 19;   // la noche empieza a las 19:00

  const T = {
    es: {
      metodos: { puntos: 'Sumar puntos', recorte: (b, a) => `Recorte ${b}–${a} km/h`, ancla: 'Ancla y varias señales' },
      real: 'Lo que pasó',
      filas: {
        fantasma: 'Kilómetros con el camión parado',
        viaje: 'Kilómetros del viaje de la mañana',
        maniobra: 'Metros de la maniobra en el patio',
        remolque: 'Metros de la grúa, con el motor apagado',
        vMax: 'Velocidad máxima que enseña (km/h)',
        alerta: 'Alerta de movimiento con el motor apagado',
        errorTrasGrua: 'Dónde dice que está, 10 min después de la grúa',
      },
      si: 'sí', no: 'no', falsas: n => ` (+${n} falsa${n === 1 ? '' : 's'})`, aqui: 'ahí',
      aMetros: m => `a ${m} m`,
      km: 'km', copiado: 'Enlace copiado', copiar: 'Copiar enlace con esta noche',
      ver: {
        puntos: km => `Sumando puntos, el camión parado acumuló ${km} km sin mover una rueda.`,
        recorte: (km, cosas) => `El recorte deja ${km} km parado${cosas.length ? ', pero ' + cosas.join(', ') : ''}.`,
        noGrua: 'no vio la grúa', lejos: m => `deja el camión a ${m} m de donde está`, oculta140: a => `enseña ${a} donde hubo 140`,
        noManiobra: 'borró la maniobra',
        ancla: (km, grua) => `Con el ancla, ${km} km parado${grua}.`,
        anclaGrua: ' y la grúa levantó la alerta',
      },
      horas: h => `${h}:00`, metros: 'm',
      corto: { real: 'Real', puntos: 'Puntos', recorte: 'Recorte', ancla: 'Ancla' },
    },
    en: {
      metodos: { puntos: 'Adding up points', recorte: (b, a) => `Clip ${b}–${a} km/h`, ancla: 'Anchor and several signals' },
      real: 'What happened',
      filas: {
        fantasma: 'Kilometers with the truck parked',
        viaje: 'Kilometers of the morning trip',
        maniobra: 'Meters of the yard maneuver',
        remolque: 'Meters of the tow, ignition off',
        vMax: 'Top speed it shows (km/h)',
        alerta: 'Alert for movement with ignition off',
        errorTrasGrua: 'Where it says the truck is, 10 min after the tow',
      },
      si: 'yes', no: 'no', falsas: n => ` (+${n} false)`, aqui: 'there',
      aMetros: m => `${m} m off`,
      km: 'km', copiado: 'Link copied', copiar: 'Copy link with this night',
      ver: {
        puntos: km => `Adding up points, the parked truck racked up ${km} km without turning a wheel.`,
        recorte: (km, cosas) => `The clip leaves ${km} km while parked${cosas.length ? ', but ' + cosas.join(', ') : ''}.`,
        noGrua: 'it missed the tow', lejos: m => `puts the truck ${m} m from where it is`, oculta140: a => `shows ${a} where there was 140`,
        noManiobra: 'it erased the maneuver',
        ancla: (km, grua) => `With the anchor, ${km} km while parked${grua}.`,
        anclaGrua: ' and the tow raised the alert',
      },
      horas: h => `${h}:00`, metros: 'm',
      corto: { real: 'Real', puntos: 'Points', recorte: 'Clip', ancla: 'Anchor' },
    },
  };
  const t = () => T[lang()];
  const num = (x, d = 1) => x.toLocaleString(lang() === 'en' ? 'en-US' : 'es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });

  // ------------------------------------------------------------ parámetros

  const CAMPOS = {
    entorno: ['#g-entorno', 'e', v => v],
    intervalo: ['#g-intervalo', 'i', Number],
    horas: ['#g-horas', 'h', Number],
    umbralBajo: ['#g-bajo', 'b', Number],
    recorteAlto: ['#g-alto', 'a', Number],
    radio: ['#g-radio', 'r', Number],
  };
  const MARCAS = { maniobra: ['#g-maniobra', 'm'], remolque: ['#g-remolque', 'g'], viaje: ['#g-viaje', 'v'] };

  function cargar() {
    const p = { ...PREDETERMINADO };
    const q = new URLSearchParams(location.hash.slice(1));
    for (const [k, [, c, conv]] of Object.entries(CAMPOS)) if (q.has(c)) p[k] = conv(q.get(c));
    for (const [k, [, c]] of Object.entries(MARCAS)) if (q.has(c)) p[k] = q.get(c) === '1';
    if (q.has('s')) p.semilla = Number(q.get('s')) || 1;
    return limpiar(p);
  }

  function limpiar(p) {
    const lim = (x, a, b, d) => (Number.isFinite(x) ? Math.min(b, Math.max(a, x)) : d);
    p.entorno = ['abierto', 'lamina', 'techado'].includes(p.entorno) ? p.entorno : 'lamina';
    p.intervalo = [10, 30, 60].includes(p.intervalo) ? p.intervalo : 30;
    p.horas = lim(p.horas, 2, 14, 10);
    p.umbralBajo = lim(p.umbralBajo, 0, 30, 5);
    p.recorteAlto = lim(p.recorteAlto, 40, 250, 130);
    p.radio = lim(p.radio, 5, 200, 30);
    return p;
  }

  function aFormulario(p) {
    for (const [k, [sel]] of Object.entries(CAMPOS)) $(sel).value = p[k];
    for (const [k, [sel]] of Object.entries(MARCAS)) $(sel).checked = p[k];
  }

  function leer() {
    const p = { ...estado };
    for (const [k, [sel, , conv]] of Object.entries(CAMPOS)) p[k] = conv($(sel).value);
    for (const [k, [sel]] of Object.entries(MARCAS)) p[k] = $(sel).checked;
    return limpiar(p);
  }

  function enlace(p) {
    const q = new URLSearchParams();
    for (const [k, [, c]] of Object.entries(CAMPOS)) q.set(c, p[k]);
    for (const [k, [, c]] of Object.entries(MARCAS)) q.set(c, p[k] ? '1' : '0');
    q.set('s', p.semilla);
    return q.toString();
  }

  // ------------------------------------------------------------ tabla y veredicto

  function celda(tr, texto, clase) {
    const td = document.createElement('td');
    td.textContent = texto;
    if (clase) td.className = clase;
    tr.appendChild(td);
  }

  const califica = {
    fantasma: v => (v < 0.5 ? 'bien' : v > 2 ? 'mal' : 'ojo'),
    viaje: () => '',
    maniobra: (v, real) => (v >= 0.7 * real && v <= 1.3 * real ? 'bien' : v < 0.3 * real ? 'mal' : 'ojo'),
    remolque: (v, real) => (v >= 0.7 * real && v <= 1.3 * real ? 'bien' : v < 0.3 * real ? 'mal' : 'ojo'),
    vMax: (v, real) => (Math.abs(v - real) <= 5 ? 'bien' : v < real - 5 ? 'mal' : 'ojo'),
    alerta: v => (v ? 'bien' : 'mal'),
    errorTrasGrua: v => (v < 50 ? 'bien' : v > 150 ? 'mal' : 'ojo'),
  };

  function pintarTabla(r) {
    const tx = t();
    const p = r.p;
    const cab = $('#tabla thead tr');
    cab.replaceChildren();
    for (const h of ['', tx.real, tx.metodos.puntos, tx.metodos.recorte(p.umbralBajo, p.recorteAlto), tx.metodos.ancla]) {
      const th = document.createElement('th'); th.textContent = h; cab.appendChild(th);
    }
    const filas = ['fantasma'];
    if (p.viaje) filas.push('viaje', 'vMax');
    if (p.maniobra) filas.push('maniobra');
    if (p.remolque) filas.push('remolque', 'alerta', 'errorTrasGrua');
    const cuerpo = $('#tabla tbody');
    cuerpo.replaceChildren();
    for (const f of filas) {
      const tr = document.createElement('tr');
      celda(tr, tx.filas[f]);
      const real = r.real[f];
      const fmt = {
        fantasma: v => `${num(v)} ${tx.km}`, viaje: v => `${num(v)} ${tx.km}`,
        maniobra: v => `${num(v, 0)} ${tx.metros}`, remolque: v => `${num(v, 0)} ${tx.metros}`,
        vMax: v => num(v, 0),
      }[f];
      if (f === 'alerta') celda(tr, '—', 'real');
      else if (f === 'errorTrasGrua') celda(tr, tx.aqui, 'real');
      else celda(tr, fmt(real), 'real');
      for (const k of ['puntos', 'recorte', 'ancla']) {
        const m = r.metodos[k];
        if (f === 'alerta') {
          celda(tr, (m.alerta ? tx.si : tx.no) + (m.falsasAlertas ? tx.falsas(m.falsasAlertas) : ''),
                califica.alerta(m.alerta) + (m.falsasAlertas && m.alerta ? '' : ''));
        } else if (f === 'errorTrasGrua') {
          const v = Math.round(m.errorTrasGrua);
          celda(tr, tx.aMetros(v), califica.errorTrasGrua(v));
        } else {
          celda(tr, fmt(m[f]), califica[f](m[f], real));
        }
      }
      cuerpo.appendChild(tr);
    }
  }

  function pintarVeredicto(r) {
    const v = t().ver;
    const { puntos, recorte, ancla } = r.metodos;
    const frases = [v.puntos(num(puntos.fantasma))];
    const cosas = [];
    if (r.p.remolque && recorte.remolque < 0.3 * r.real.remolque) cosas.push(v.noGrua);
    if (r.p.remolque && recorte.errorTrasGrua > 150) cosas.push(v.lejos(Math.round(recorte.errorTrasGrua)));
    if (r.p.maniobra && recorte.maniobra < 0.3 * r.real.maniobra) cosas.push(v.noManiobra);
    if (r.p.viaje && recorte.vMax < r.real.vMax - 5) cosas.push(v.oculta140(r.p.recorteAlto));
    frases.push(v.recorte(num(recorte.fantasma), cosas));
    frases.push(v.ancla(num(ancla.fantasma), r.p.remolque && ancla.alerta ? v.anclaGrua : ''));
    $('#veredicto').textContent = frases.join(' ');
  }

  // ------------------------------------------------------------ gráficas

  const el = (nombre, attrs, padre) => {
    const e = document.createElementNS(SVG, nombre);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (padre) padre.appendChild(e);
    return e;
  };
  const texto = (padre, x, y, s, attrs = {}) => { const e = el('text', { x, y, ...attrs }, padre); e.textContent = s; return e; };

  /* Kilómetros acumulados, hora por hora, de lo real y de cada método. */
  function pintarCurvas(r) {
    const svg = $('#g-curvas');
    svg.replaceChildren();
    // se dibuja al ancho real, para que la letra no se encoja en el teléfono
    const W = Math.max(300, Math.round(svg.parentNode.clientWidth)), H = W < 500 ? 260 : 300;
    const m = { i: 38, d: 118, a: 14, b: 30 };
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const tFin = r.reportes[r.reportes.length - 1].t / 3600;
    const series = [['real', r.real.curva], ['puntos', r.metodos.puntos.curva],
                    ['recorte', r.metodos.recorte.curva], ['ancla', r.metodos.ancla.curva]];
    const yMax = Math.max(1, ...series.map(([, c]) => c[c.length - 1])) * 1.05;
    const x = h => m.i + (h / tFin) * (W - m.i - m.d);
    const y = km => H - m.b - (km / yMax) * (H - m.a - m.b);
    // rejilla y ejes
    const paso = yMax > 40 ? 10 : yMax > 15 ? 5 : yMax > 6 ? 2 : 1;
    for (let k = 0; k <= yMax; k += paso) {
      el('line', { x1: m.i, x2: W - m.d, y1: y(k), y2: y(k), class: 'rejilla' }, svg);
      texto(svg, m.i - 8, y(k) + 4, String(k), { 'text-anchor': 'end' });
    }
    texto(svg, m.i - 8, m.a - 2, t().km, { 'text-anchor': 'end' });
    const cadaH = Math.max(1, Math.ceil(tFin / Math.max(2, Math.floor((W - m.i - m.d) / 58))));
    for (let h = 0; h <= tFin + 1e-9; h += cadaH) {
      texto(svg, x(h), H - m.b + 18, t().horas((HORA_INICIO + Math.round(h)) % 24), { 'text-anchor': 'middle' });
    }
    el('line', { x1: m.i, x2: W - m.d, y1: y(0), y2: y(0), class: 'eje' }, svg);
    // líneas
    const nombres = t().corto;
    const finales = [];
    for (const [k, c] of series) {
      const d = c.map((km, i) => `${i ? 'L' : 'M'}${x(r.reportes[i].t / 3600).toFixed(1)},${y(km).toFixed(1)}`).join('');
      el('path', { d, class: `linea ${k}` }, svg);
      finales.push({ k, y: y(c[c.length - 1]), km: c[c.length - 1] });
    }
    // etiquetas al final de cada línea, sin encimarse
    finales.sort((a, b) => a.y - b.y);
    for (let i = 1; i < finales.length; i++) if (finales[i].y - finales[i - 1].y < 15) finales[i].y = finales[i - 1].y + 15;
    for (const f of finales) texto(svg, W - m.d + 8, f.y + 4, `${nombres[f.k]} ${num(f.km)}`, { class: f.k });
  }

  /* El patio desde arriba: los puntos que mandó el equipo antes del viaje,
     el camino real, dónde lo deja el recorte y dónde el ancla. */
  function pintarPatio(r) {
    const svg = $('#g-patio');
    svg.replaceChildren();
    const W = Math.max(300, Math.round(svg.parentNode.clientWidth)), H = W < 500 ? 300 : 360;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    // la noche termina donde empieza el viaje (lo de después ya es otro lugar)
    const inicioViaje = r.reportes.findIndex(q => q.real.fase === 'viaje');
    const corte = inicioViaje > 0 ? inicioViaje : r.reportes.length;
    const noche = r.reportes.slice(0, corte);
    const caja = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    for (const q of noche) {
      for (const pt of [q, q.real]) {
        caja.x0 = Math.min(caja.x0, pt.x); caja.x1 = Math.max(caja.x1, pt.x);
        caja.y0 = Math.min(caja.y0, pt.y); caja.y1 = Math.max(caja.y1, pt.y);
      }
    }
    const pad = 20;
    const esc = Math.min((W - 2 * pad) / Math.max(1, caja.x1 - caja.x0), (H - 2 * pad - 20) / Math.max(1, caja.y1 - caja.y0));
    const cx = (caja.x0 + caja.x1) / 2, cy = (caja.y0 + caja.y1) / 2;
    const X = v => W / 2 + (v - cx) * esc;
    const Y = v => (H - 20) / 2 - (v - cy) * esc;
    for (const q of noche) el('circle', { cx: X(q.x).toFixed(1), cy: Y(q.y).toFixed(1), r: 1.8, class: q.buena ? 'punto-gps' : 'punto-gps malo' }, svg);
    // camino real (sin el viaje)
    const d = noche.map((q, i) => `${i ? 'L' : 'M'}${X(q.real.x).toFixed(1)},${Y(q.real.y).toFixed(1)}`).join('');
    el('path', { d, class: 'camino-real' }, svg);
    // el ancla: su radio al final de la noche
    const fin = r.metodos.ancla.posiciones[corte - 1];
    el('circle', { cx: X(fin.x), cy: Y(fin.y), r: r.p.radio * esc, class: 'radio-ancla' }, svg);
    el('circle', { cx: X(fin.x), cy: Y(fin.y), r: 5, class: 'marca-ancla' }, svg);
    // dónde lo deja el recorte
    const rec = r.metodos.recorte.posiciones[corte - 1];
    el('rect', { x: X(rec.x) - 5, y: Y(rec.y) - 5, width: 10, height: 10, class: 'marca-recorte' }, svg);
    // la posición real al final de la noche
    const real = noche[corte - 1].real;
    el('circle', { cx: X(real.x), cy: Y(real.y), r: 3, class: 'marca-real' }, svg);
    // escala
    const metros = [10, 20, 50, 100, 200, 500].find(mm => mm * esc >= 60) || 500;
    el('line', { x1: pad, x2: pad + metros * esc, y1: H - 8, y2: H - 8, class: 'eje' }, svg);
    texto(svg, pad + metros * esc + 8, H - 4, `${metros} m`);
  }

  // ------------------------------------------------------------ todo junto

  let estado = cargar();
  let ultimo = null;

  function correr() {
    ultimo = simular(estado);
    pintarTabla(ultimo);
    pintarVeredicto(ultimo);
    pintarCurvas(ultimo);
    pintarPatio(ultimo);
    history.replaceState(null, '', `#${enlace(estado)}`);
  }

  aFormulario(estado);
  for (const sel of [...Object.values(CAMPOS).map(c => c[0]), ...Object.values(MARCAS).map(c => c[0])]) {
    $(sel).addEventListener('change', () => { estado = leer(); correr(); });
  }
  $('#otra').addEventListener('click', () => { estado = { ...leer(), semilla: (estado.semilla % 9999) + 1 }; correr(); });
  $('#copiar').addEventListener('click', async () => {
    const b = $('#copiar');
    try {
      await navigator.clipboard.writeText(location.href);
      b.textContent = t().copiado;
      setTimeout(() => { b.textContent = t().copiar; }, 1800);
    } catch (e) { /* sin portapapeles: el enlace ya está en la barra */ }
  });
  document.addEventListener('idioma', () => { if (ultimo) { pintarTabla(ultimo); pintarVeredicto(ultimo); pintarCurvas(ultimo); } });
  let espera = 0;
  window.addEventListener('resize', () => {
    clearTimeout(espera);
    espera = setTimeout(() => { if (ultimo) { pintarCurvas(ultimo); pintarPatio(ultimo); } }, 150);
  });
  correr();
})();
