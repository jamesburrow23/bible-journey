import type { OverlayPreset } from './index';
import { region } from './index';

// Divided Kingdom era (~930-722 BC).
//
// Neighbor regions are the 50%-confidence contours from OpenBible.info's
// Bible Geocoding Data (https://github.com/openbibleinfo/Bible-Geocoding-Data,
// CC-BY 4.0) — polygons aggregated from 10+ scholarly sources per region.
// Israel and Judah have no polygons in that dataset (it avoids political
// kingdoms), so they are hand-traced to the conventional atlas layout,
// anchored to the real coastline, the Jordan rift, and the Dead Sea shore.
// Overlay fills render beneath the basemap's water layer, so seas and lakes
// clip these shapes automatically.

const KINGDOM_ISRAEL = { fill: '#A3542F', stroke: '#7E3E20', opacity: 0.2 };
const KINGDOM_JUDAH = { fill: '#6B7A3A', stroke: '#4F5C2A', opacity: 0.2 };
const NEIGHBOR = { fill: '#8A7A5F', stroke: '#6E6349', opacity: 0.1 };

export const dividedKingdom: OverlayPreset = {
  id: 'divided-kingdom',
  name: 'Divided Kingdom (~930–722 BC)',
  regions: [
    // Hand-traced: coast north of Joppa, up to the Phoenician border below
    // Tyre, across Upper Galilee to Dan, out to Bashan, down the Gilead
    // frontier past Ammon, over the Jordan, then the Mizpah-Bethel border
    // line north of Jerusalem back to Gezer and the coast.
    region('Israel', KINGDOM_ISRAEL, [35.32, 32.38], [
      [34.75, 32.08], [34.82, 32.30], [34.87, 32.50], [34.92, 32.66], [34.95, 32.80],
      [35.00, 32.92], [35.18, 33.02], [35.38, 33.08], [35.55, 33.20], [35.68, 33.28],
      [35.90, 33.20], [36.10, 33.05], [36.30, 32.90], [36.35, 32.70], [36.25, 32.45],
      [36.05, 32.20], [35.95, 32.00], [35.80, 31.90], [35.62, 31.87], [35.52, 31.82],
      [35.35, 31.88], [35.18, 31.89], [35.05, 31.88], [34.92, 31.87], [34.82, 31.95],
    ]),
    // Hand-traced: Mizpah-Bethel line north of Jerusalem, down the Dead Sea's
    // western shore, an arc through the northern Negev toward Kadesh, then up
    // the Shephelah along the Philistine frontier to Gezer.
    region('Judah', KINGDOM_JUDAH, [35.02, 31.35], [
      [34.92, 31.86], [35.05, 31.87], [35.18, 31.88], [35.35, 31.87], [35.50, 31.81],
      [35.47, 31.60], [35.44, 31.40], [35.42, 31.20], [35.43, 31.02], [35.30, 30.90],
      [35.10, 30.82], [34.85, 30.78], [34.62, 30.90], [34.68, 31.10], [34.74, 31.30],
      [34.80, 31.50], [34.85, 31.68],
    ]),
    // OpenBible.info 50%-confidence bands (coordinates rounded to 3 decimals).
    region('Philistia', NEIGHBOR, [34.594, 31.593], [
      [34.787, 32.084], [34.753, 32.054], [34.176, 31.297], [34.21, 31.267], [34.312, 31.238],
      [34.346, 31.238], [34.38, 31.238], [34.414, 31.238], [34.448, 31.238], [34.482, 31.238],
      [34.516, 31.238], [34.55, 31.238], [34.583, 31.238], [34.617, 31.267], [34.753, 31.501],
      [34.787, 31.559], [34.821, 31.617], [34.855, 31.675], [34.889, 31.792], [34.889, 31.821],
      [34.889, 31.85], [34.889, 31.88], [34.889, 31.909], [34.889, 31.938], [34.889, 31.967],
      [34.855, 32.054],
    ]),
    region('Phoenicia', NEIGHBOR, [35.443, 33.379], [
      [34.99, 32.608], [35.036, 32.646], [35.585, 33.109], [35.95, 34.149], [35.95, 34.188],
      [35.905, 34.265], [35.859, 34.226], [35.402, 33.687], [35.356, 33.61], [35.31, 33.532],
      [35.265, 33.455], [35.128, 33.186], [34.945, 32.8], [34.899, 32.608], [34.899, 32.569],
      [34.945, 32.569],
    ]),
    region('Aram', NEIGHBOR, [36.304, 33.244], [
      [36.159, 33.724], [35.994, 33.654], [35.912, 33.515], [35.666, 32.888], [35.748, 32.819],
      [36.405, 32.749], [36.488, 32.819], [36.57, 32.888], [36.652, 32.958], [36.899, 33.236],
      [36.899, 33.306], [36.899, 33.376], [36.899, 33.445], [36.899, 33.515], [36.899, 33.585],
      [36.488, 33.724], [36.405, 33.724], [36.323, 33.724], [36.241, 33.724],
    ]),
    region('Ammon', NEIGHBOR, [36.152, 31.987], [
      [35.782, 31.924], [35.782, 31.894], [35.782, 31.864], [36.135, 31.742], [36.276, 31.773],
      [36.593, 32.015], [36.558, 32.106], [36.311, 32.166], [35.993, 32.197], [35.958, 32.197],
      [35.852, 32.166],
    ]),
    region('Moab', NEIGHBOR, [35.766, 31.315], [
      [35.934, 31.737], [35.899, 31.737], [35.865, 31.737], [35.831, 31.737], [35.796, 31.737],
      [35.762, 31.737], [35.727, 31.737], [35.693, 31.737], [35.658, 31.737], [35.624, 31.737],
      [35.59, 31.737], [35.417, 31.263], [35.452, 31.056], [35.486, 31.027], [35.968, 30.849],
      [36.003, 30.938], [36.037, 31.056], [36.072, 31.293], [36.072, 31.322], [36.072, 31.352],
      [36.037, 31.5], [35.968, 31.737],
    ]),
    region('Edom', NEIGHBOR, [35.483, 30.519], [
      [34.943, 30.769], [34.943, 30.71], [34.943, 30.652], [34.943, 30.534], [34.943, 30.475],
      [34.943, 30.416], [35.145, 29.946], [35.618, 30.005], [36.023, 30.475], [36.09, 30.887],
      [35.955, 30.946], [35.685, 31.005], [35.618, 31.005], [35.55, 31.005], [35.483, 31.005],
      [35.415, 31.005],
    ]),
  ],
};
