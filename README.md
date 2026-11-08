# The parked truck: GPS drift

A browser simulator of one night in a truck yard. Nobody touches the truck,
and by morning the tracking platform says it drove several kilometers. The
simulator shows where those phantom kilometers come from and what the usual
filter that removes them hides.

The night has the GPS with its usual error, depending on where the truck is
parked: open sky (about 2.5 m), a sheet-metal roof (about 6 m) or a covered
parking lot (about 15 m), with occasional bounces of 20 to 50 m. Optionally it
adds a slow maneuver in the yard, a tow truck hauling the truck away slowly
with the ignition off, and the morning trip. Then it counts the kilometers
three ways:

- **Adding up points:** the distance between each position and the next.
- **The speed clip** almost everyone uses: below a threshold the speed is zero
  and the point does not move; above a cap the speed is clipped.
- **Anchoring the point with several signals:** when parked, the point is
  pinned and jumps inside a radius are ignored. There is movement if there is
  sustained vibration, if the ignition is on and the speed is real, or if the
  position leaves the radius with a good fix for four reports in a row.
  Moving with the ignition off raises an alert.

The figures are **illustrative**, like the ones in the note: GPS error is
drawn independently on each axis for every report, and the randomness is
seeded, so a copied link repeats the same night. What it does not model is
listed on the page: a real receiver's error changes slowly, coverage gaps,
tunnels, and the vehicle's odometer.

Live version: [crtdrops.mx/gps](https://crtdrops.mx/gps/).
Note: [The parked truck that kept racking up kilometers](https://crtdrops.mx/notas/the-parked-truck.html)
(Spanish: [El camión estacionado que seguía sumando kilómetros](https://crtdrops.mx/notas/el-camion-estacionado.html)).

The code, its comments and the page are in Spanish (the page has an English
toggle); this README is in English.

## Run it

```bash
node js/gps-calculo.js --prueba     # the simulator's checks, no browser
python3 -m http.server 8000         # then open http://localhost:8000/gps/
```

## Files

| Path | What |
|---|---|
| `js/gps-calculo.js` | the simulation, with no screen code: the night, the three ways of counting, and its checks |
| `js/gps.js` | the page: controls, chart and map |
| `gps/index.html` | the tool |

## License

Code: MIT (`LICENSE`). The site's design (CSS, logo and backgrounds) is
included only so the page renders; it is not part of the MIT license.
