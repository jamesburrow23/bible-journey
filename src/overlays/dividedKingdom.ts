import type { OverlayPreset } from './index';
import { region } from './index';

// Conventional atlas layout of the Divided Kingdom era (~930-722 BC).
// All boundaries are traditional scholarly approximations traced from
// standard Bible-atlas depictions — ancient borders were zones, not lines.

const KINGDOM_ISRAEL = { fill: '#A3542F', stroke: '#7E3E20', opacity: 0.2 };
const KINGDOM_JUDAH = { fill: '#6B7A3A', stroke: '#4F5C2A', opacity: 0.2 };
const NEIGHBOR = { fill: '#8A7A5F', stroke: '#6E6349', opacity: 0.1 };

export const dividedKingdom: OverlayPreset = {
  id: 'divided-kingdom',
  name: 'Divided Kingdom (~930–722 BC)',
  regions: [
    region('Israel', KINGDOM_ISRAEL, [35.35, 32.45], [
      [34.85, 32.05], [34.92, 32.45], [34.95, 32.80], [35.05, 32.90], [35.10, 33.00],
      [35.45, 33.15], [35.65, 33.28], [36.10, 33.10], [36.35, 32.80], [36.20, 32.40],
      [35.95, 31.95], [35.75, 31.85], [35.55, 31.85], [35.47, 31.82], [35.20, 31.85],
      [34.98, 31.88],
    ]),
    region('Judah', KINGDOM_JUDAH, [34.95, 31.30], [
      [34.98, 31.85], [35.20, 31.83], [35.45, 31.80], [35.45, 31.50], [35.40, 31.15],
      [35.40, 30.95], [35.25, 30.75], [34.90, 30.65], [34.55, 30.85], [34.55, 31.20],
      [34.75, 31.45], [34.85, 31.65],
    ]),
    region('Philistia', NEIGHBOR, [34.50, 31.48], [
      [34.25, 31.22], [34.20, 31.40], [34.45, 31.60], [34.70, 31.85], [34.90, 32.00],
      [34.95, 31.90], [34.85, 31.65], [34.75, 31.45], [34.55, 31.20],
    ]),
    region('Phoenicia', NEIGHBOR, [35.28, 33.30], [
      [35.05, 32.92], [35.12, 33.10], [35.20, 33.30], [35.35, 33.55], [35.50, 33.72],
      [35.62, 33.62], [35.45, 33.35], [35.35, 33.12], [35.18, 32.95],
    ]),
    region('Aram', NEIGHBOR, [36.40, 33.30], [
      [35.80, 33.45], [36.10, 33.60], [36.60, 33.70], [36.90, 33.40], [36.75, 33.00],
      [36.40, 32.85], [36.10, 33.00], [35.85, 33.20],
    ]),
    region('Ammon', NEIGHBOR, [36.00, 31.92], [
      [35.70, 31.80], [35.80, 32.10], [36.10, 32.20], [36.35, 32.00], [36.20, 31.70],
      [35.90, 31.60],
    ]),
    region('Moab', NEIGHBOR, [35.80, 31.30], [
      [35.55, 31.70], [35.75, 31.70], [36.05, 31.55], [36.05, 31.15], [35.80, 30.95],
      [35.55, 31.00],
    ]),
    region('Edom', NEIGHBOR, [35.50, 30.45], [
      [35.30, 30.90], [35.65, 30.95], [35.90, 30.60], [35.75, 30.20], [35.45, 29.95],
      [35.15, 30.20], [35.10, 30.55],
    ]),
  ],
};
