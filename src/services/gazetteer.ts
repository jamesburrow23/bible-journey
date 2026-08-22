import type { RawStop, Stop } from '../types';

export interface GazetteerEntry {
  name: string;
  lat: number;
  lng: number;
  aliases?: string[];
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/^the\s+/, '');
}

export const GAZETTEER: GazetteerEntry[] = [
  // — Israel / Canaan —
  { name: 'Jerusalem', lat: 31.778, lng: 35.235, aliases: ['Salem', 'Jebus', 'Zion', 'Mount Moriah', 'City of David', 'Golgotha', 'Calvary'] },
  { name: 'Bethel', lat: 31.930, lng: 35.221, aliases: ['Luz'] },
  { name: 'Shechem', lat: 32.213, lng: 35.282, aliases: ['Sychar'] },
  { name: 'Hebron', lat: 31.525, lng: 35.110, aliases: ['Kiriath-arba', 'Mamre'] },
  { name: 'Beersheba', lat: 31.245, lng: 34.840, aliases: ['Beer-sheba'] },
  { name: 'Bethlehem', lat: 31.705, lng: 35.210, aliases: ['Ephrath', 'Ephrathah'] },
  { name: 'Jericho', lat: 31.871, lng: 35.444 },
  { name: 'Nazareth', lat: 32.702, lng: 35.298 },
  { name: 'Capernaum', lat: 32.881, lng: 35.575 },
  { name: 'Cana', lat: 32.747, lng: 35.339 },
  { name: 'Bethsaida', lat: 32.910, lng: 35.631 },
  { name: 'Chorazin', lat: 32.911, lng: 35.564 },
  { name: 'Magdala', lat: 32.825, lng: 35.516 },
  { name: 'Bethany', lat: 31.771, lng: 35.256 },
  { name: 'Bethphage', lat: 31.778, lng: 35.245 },
  { name: 'Emmaus', lat: 31.839, lng: 35.089 },
  { name: 'Mount of Olives', lat: 31.778, lng: 35.245, aliases: ['Olivet', 'Gethsemane'] },
  { name: 'Jordan River', lat: 31.837, lng: 35.550, aliases: ['Jordan'] },
  { name: 'Sea of Galilee', lat: 32.833, lng: 35.583, aliases: ['Lake Gennesaret', 'Sea of Tiberias', 'Lake of Gennesaret'] },
  { name: 'Dan', lat: 33.249, lng: 35.652, aliases: ['Laish'] },
  { name: 'Shiloh', lat: 32.055, lng: 35.289 },
  { name: 'Ai', lat: 31.917, lng: 35.261 },
  { name: 'Gilgal', lat: 31.870, lng: 35.500 },
  { name: 'Gibeon', lat: 31.847, lng: 35.185 },
  { name: 'Gibeah', lat: 31.823, lng: 35.231 },
  { name: 'Ramah', lat: 31.833, lng: 35.231 },
  { name: 'Mizpah', lat: 31.885, lng: 35.181, aliases: ['Mizpeh'] },
  { name: 'Nob', lat: 31.790, lng: 35.240 },
  { name: 'Anathoth', lat: 31.810, lng: 35.270 },
  { name: 'Tekoa', lat: 31.630, lng: 35.220 },
  { name: 'Kiriath-jearim', lat: 31.795, lng: 35.103 },
  { name: 'Samaria', lat: 32.276, lng: 35.190, aliases: ['Sebaste'] },
  { name: 'Dothan', lat: 32.417, lng: 35.318 },
  { name: 'Megiddo', lat: 32.585, lng: 35.183 },
  { name: 'Jezreel', lat: 32.559, lng: 35.331 },
  { name: 'Beth-shan', lat: 32.503, lng: 35.504, aliases: ['Beth-shean', 'Bethshan'] },
  { name: 'Mount Carmel', lat: 32.733, lng: 35.050, aliases: ['Carmel'] },
  { name: 'Mount Tabor', lat: 32.687, lng: 35.390 },
  { name: 'Mount Gilboa', lat: 32.520, lng: 35.417 },
  { name: 'Endor', lat: 32.632, lng: 35.389, aliases: ['En-dor'] },
  { name: 'Mount Gerizim', lat: 32.200, lng: 35.273 },
  { name: 'Mount Ebal', lat: 32.234, lng: 35.273 },
  { name: 'En-gedi', lat: 31.462, lng: 35.388, aliases: ['Engedi'] },
  { name: 'Negev', lat: 30.985, lng: 34.930, aliases: ['Negeb', 'the South'] },
  { name: 'Gaza', lat: 31.505, lng: 34.464 },
  { name: 'Ashkelon', lat: 31.663, lng: 34.546 },
  { name: 'Ashdod', lat: 31.755, lng: 34.655 },
  { name: 'Ekron', lat: 31.780, lng: 34.850 },
  { name: 'Gath', lat: 31.700, lng: 34.847 },
  { name: 'Lachish', lat: 31.565, lng: 34.849 },
  { name: 'Azekah', lat: 31.700, lng: 34.936 },
  { name: 'Valley of Elah', lat: 31.690, lng: 34.963, aliases: ['Elah'] },
  { name: 'Ziklag', lat: 31.380, lng: 34.870 },
  { name: 'Adullam', lat: 31.650, lng: 34.980, aliases: ['Cave of Adullam'] },
  { name: 'Gerar', lat: 31.380, lng: 34.600 },
  { name: 'Joppa', lat: 32.054, lng: 34.752, aliases: ['Jaffa'] },
  { name: 'Aphek', lat: 32.105, lng: 34.930 },
  { name: 'Caesarea', lat: 32.500, lng: 34.892, aliases: ['Caesarea Maritima'] },
  { name: 'Caesarea Philippi', lat: 33.248, lng: 35.694 },
  { name: 'Sodom', lat: 31.130, lng: 35.400, aliases: ['Gomorrah'] },
  { name: 'Zoar', lat: 30.950, lng: 35.470 },
  // — Transjordan / neighbors —
  { name: 'Mount Nebo', lat: 31.768, lng: 35.725, aliases: ['Nebo', 'Pisgah'] },
  { name: 'Penuel', lat: 32.190, lng: 35.700, aliases: ['Peniel'] },
  { name: 'Mahanaim', lat: 32.190, lng: 35.770 },
  { name: 'Jabbok River', lat: 32.190, lng: 35.650, aliases: ['Jabbok'] },
  { name: 'Moab', lat: 31.500, lng: 35.750, aliases: ['Plains of Moab'] },
  { name: 'Edom', lat: 30.600, lng: 35.400, aliases: ['Seir', 'Mount Seir'] },
  { name: 'Sela', lat: 30.329, lng: 35.442, aliases: ['Petra'] },
  { name: 'Rabbah', lat: 31.950, lng: 35.930, aliases: ['Rabbath-ammon', 'Ammon'] },
  { name: 'Gilead', lat: 32.300, lng: 35.800 },
  { name: 'Bashan', lat: 32.900, lng: 36.000 },
  { name: 'Gerasa', lat: 32.281, lng: 35.891, aliases: ['Jerash'] },
  { name: 'Gadara', lat: 32.650, lng: 35.680 },
  { name: 'Zarephath', lat: 33.460, lng: 35.300, aliases: ['Sarepta'] },
  { name: 'Tyre', lat: 33.270, lng: 35.196 },
  { name: 'Sidon', lat: 33.561, lng: 35.369, aliases: ['Zidon'] },
  { name: 'Damascus', lat: 33.511, lng: 36.306 },
  // — Egypt / Sinai / wilderness —
  { name: 'Egypt', lat: 30.588, lng: 31.500, aliases: ['Land of Egypt'] },
  { name: 'Goshen', lat: 30.879, lng: 31.594, aliases: ['Land of Goshen'] },
  { name: 'Rameses', lat: 30.799, lng: 31.834, aliases: ['Raamses'] },
  { name: 'Pithom', lat: 30.550, lng: 32.100 },
  { name: 'Succoth', lat: 30.550, lng: 32.100 },
  { name: 'Memphis', lat: 29.845, lng: 31.251, aliases: ['Noph'] },
  { name: 'On', lat: 30.129, lng: 31.307, aliases: ['Heliopolis'] },
  { name: 'Alexandria', lat: 31.200, lng: 29.919 },
  { name: 'Red Sea', lat: 29.500, lng: 32.600, aliases: ['Sea of Reeds', 'Yam Suph'] },
  { name: 'Marah', lat: 29.870, lng: 32.650 },
  { name: 'Elim', lat: 29.350, lng: 32.950 },
  { name: 'Rephidim', lat: 28.720, lng: 33.750 },
  { name: 'Mount Sinai', lat: 28.539, lng: 33.975, aliases: ['Sinai', 'Horeb', 'Mount Horeb'] },
  { name: 'Wilderness of Zin', lat: 30.550, lng: 34.850, aliases: ['Zin'] },
  { name: 'Wilderness of Paran', lat: 29.800, lng: 34.900, aliases: ['Paran'] },
  { name: 'Kadesh-barnea', lat: 30.687, lng: 34.494, aliases: ['Kadesh'] },
  { name: 'Midian', lat: 28.400, lng: 34.800, aliases: ['Land of Midian'] },
  // — Mesopotamia / Persia —
  { name: 'Haran', lat: 36.864, lng: 39.031, aliases: ['Harran', 'Paddan-aram', 'Padan-aram'] },
  { name: 'Ur', lat: 30.962, lng: 46.103, aliases: ['Ur of the Chaldeans', 'Ur of the Chaldees'] },
  { name: 'Babylon', lat: 32.542, lng: 44.421 },
  { name: 'Nineveh', lat: 36.359, lng: 43.153 },
  { name: 'Susa', lat: 32.190, lng: 48.258, aliases: ['Shushan'] },
  { name: 'Mount Ararat', lat: 39.702, lng: 44.298, aliases: ['Ararat'] },
  // — Asia Minor / Greece / Mediterranean (Acts & Revelation) —
  { name: 'Antioch', lat: 36.200, lng: 36.160, aliases: ['Antioch of Syria', 'Syrian Antioch'] },
  { name: 'Tarsus', lat: 36.917, lng: 34.895 },
  { name: 'Salamis', lat: 35.183, lng: 33.900 },
  { name: 'Paphos', lat: 34.757, lng: 32.406 },
  { name: 'Perga', lat: 36.961, lng: 30.854 },
  { name: 'Antioch of Pisidia', lat: 38.306, lng: 31.189, aliases: ['Pisidian Antioch'] },
  { name: 'Iconium', lat: 37.875, lng: 32.493 },
  { name: 'Lystra', lat: 37.579, lng: 32.454 },
  { name: 'Derbe', lat: 37.350, lng: 33.350 },
  { name: 'Attalia', lat: 36.885, lng: 30.705 },
  { name: 'Troas', lat: 39.751, lng: 26.159 },
  { name: 'Philippi', lat: 41.013, lng: 24.286 },
  { name: 'Thessalonica', lat: 40.640, lng: 22.944 },
  { name: 'Berea', lat: 40.524, lng: 22.203, aliases: ['Beroea'] },
  { name: 'Athens', lat: 37.972, lng: 23.726 },
  { name: 'Corinth', lat: 37.906, lng: 22.879 },
  { name: 'Cenchreae', lat: 37.888, lng: 22.994, aliases: ['Cenchrea'] },
  { name: 'Ephesus', lat: 37.941, lng: 27.342 },
  { name: 'Miletus', lat: 37.530, lng: 27.276 },
  { name: 'Rhodes', lat: 36.435, lng: 28.217 },
  { name: 'Patara', lat: 36.260, lng: 29.314 },
  { name: 'Patmos', lat: 37.309, lng: 26.548 },
  { name: 'Smyrna', lat: 38.419, lng: 27.139 },
  { name: 'Pergamum', lat: 39.132, lng: 27.184, aliases: ['Pergamos'] },
  { name: 'Thyatira', lat: 38.921, lng: 27.841 },
  { name: 'Sardis', lat: 38.488, lng: 28.040 },
  { name: 'Philadelphia', lat: 38.350, lng: 28.520 },
  { name: 'Laodicea', lat: 37.836, lng: 29.107 },
  { name: 'Colossae', lat: 37.789, lng: 29.261 },
  { name: 'Fair Havens', lat: 34.945, lng: 24.809 },
  { name: 'Crete', lat: 35.240, lng: 24.810 },
  { name: 'Malta', lat: 35.917, lng: 14.400, aliases: ['Melita'] },
  { name: 'Syracuse', lat: 37.069, lng: 15.287 },
  { name: 'Rhegium', lat: 38.110, lng: 15.647 },
  { name: 'Puteoli', lat: 40.826, lng: 14.122 },
  { name: 'Rome', lat: 41.893, lng: 12.483 },
  { name: 'Cyrene', lat: 32.821, lng: 21.858 },
];

const index = new Map<string, GazetteerEntry>();
for (const entry of GAZETTEER) {
  index.set(norm(entry.name), entry);
  for (const a of entry.aliases ?? []) index.set(norm(a), entry);
}

export function lookupPlace(name: string): GazetteerEntry | null {
  return index.get(norm(name)) ?? null;
}

export function applyGazetteer(raw: RawStop[]): Stop[] {
  return raw.map((r) => {
    const hit = lookupPlace(r.name);
    return {
      ...r,
      id: crypto.randomUUID(),
      lat: hit ? hit.lat : r.lat,
      lng: hit ? hit.lng : r.lng,
      coordSource: hit ? 'gazetteer' : 'model',
    };
  });
}
