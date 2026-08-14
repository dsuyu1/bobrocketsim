/**
 * generate-rocket-glb.mjs
 *
 * Procedurally builds a Falcon-9-class two-stage rocket as a binary GLB file.
 * No external dependencies — pure Node.js Buffer manipulation following the
 * glTF 2.0 spec.
 *
 * Geometry pieces (all in local +Y-up rocket frame, metres):
 *   Stage-1 fuselage  — white cylinder, r=1.85m, h=42m
 *   Stage-2 fuselage  — white cylinder, r=1.85m, h=13m
 *   Nose cone         — orange cone,    r=1.85m, h=7m
 *   Payload fairing   — white cylinder, r=1.0m,  h=5m
 *   Interstage ring   — dark grey cylinder, r=1.95m, h=2m
 *   9x Merlin nozzles — dark grey truncated cones
 *   4x Grid fins      — dark flat boxes at top of S1
 *   4x Landing legs   — dark flat boxes at base of S1
 *
 * Usage:  node generate-rocket-glb.mjs
 * Output: ./frontend/public/rocket.glb
 */
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = join(__dirname, "frontend", "public");
const OUT_FILE  = join(OUT_DIR, "rocket.glb");

mkdirSync(OUT_DIR, { recursive: true });

// ─── Geometry helpers ───────────────────────────────────────────────────────

function cylinder(radiusBottom, radiusTop, height, cx, cy, cz, segs = 24) {
  const verts = [], norms = [], idxs = [];

  const slopeAngle = Math.atan2(radiusBottom - radiusTop, height);
  const cosSlope   = Math.cos(slopeAngle);
  const sinSlope   = Math.sin(slopeAngle);

  for (let i = 0; i <= segs; i++) {
    const theta = (i / segs) * Math.PI * 2;
    const cos   = Math.cos(theta);
    const sin   = Math.sin(theta);
    verts.push(cx + cos * radiusBottom, cy,          cz + sin * radiusBottom);
    norms.push(cos * cosSlope, sinSlope, sin * cosSlope);
    verts.push(cx + cos * radiusTop,    cy + height, cz + sin * radiusTop);
    norms.push(cos * cosSlope, sinSlope, sin * cosSlope);
  }

  for (let i = 0; i < segs; i++) {
    const b0 = i*2, b1 = b0+1, t0 = (i+1)*2, t1 = t0+1;
    idxs.push(b0, t0, b1, b1, t0, t1);
  }

  const sv = verts.length / 3;
  verts.push(cx, cy, cz); norms.push(0,-1,0);
  for (let i = 0; i < segs; i++) {
    const theta = (i / segs) * Math.PI * 2;
    verts.push(cx + Math.cos(theta)*radiusBottom, cy, cz + Math.sin(theta)*radiusBottom);
    norms.push(0,-1,0);
  }
  for (let i = 0; i < segs; i++) idxs.push(sv, sv+1+(i+1)%segs, sv+1+i);

  const tv = verts.length / 3;
  verts.push(cx, cy+height, cz); norms.push(0,1,0);
  for (let i = 0; i < segs; i++) {
    const theta = (i / segs) * Math.PI * 2;
    verts.push(cx + Math.cos(theta)*radiusTop, cy+height, cz + Math.sin(theta)*radiusTop);
    norms.push(0,1,0);
  }
  for (let i = 0; i < segs; i++) idxs.push(tv, tv+1+i, tv+1+(i+1)%segs);

  return { positions: new Float32Array(verts), normals: new Float32Array(norms), indices: new Uint16Array(idxs) };
}

function box(cx, cy, cz, w, h, d) {
  const hx=w/2, hy=h/2, hz=d/2;
  const positions = new Float32Array([
    cx-hx,cy-hy,cz-hz, cx+hx,cy-hy,cz-hz, cx+hx,cy+hy,cz-hz, cx-hx,cy+hy,cz-hz,
    cx-hx,cy-hy,cz+hz, cx+hx,cy-hy,cz+hz, cx+hx,cy+hy,cz+hz, cx-hx,cy+hy,cz+hz,
  ]);
  const normals = new Float32Array([
    0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1,
    0,0, 1, 0,0, 1, 0,0, 1, 0,0, 1,
  ]);
  const indices = new Uint16Array([
    0,1,2, 0,2,3, 4,6,5, 4,7,6,
    0,4,5, 0,5,1, 2,6,7, 2,7,3,
    0,3,7, 0,7,4, 1,5,6, 1,6,2,
  ]);
  return { positions, normals, indices };
}

// ─── Build mesh pieces ──────────────────────────────────────────────────────

const pieces = [];

// Stage 1 fuselage: y = 0 → 42
pieces.push({ geo: cylinder(1.85, 1.85, 42, 0, 0, 0),    mat: "white"    });
// Stage 2 fuselage: y = 44 → 57
pieces.push({ geo: cylinder(1.85, 1.85, 13, 0, 44, 0),   mat: "white"    });
// Nose cone: y = 57 → 64
pieces.push({ geo: cylinder(1.85, 0.02, 7, 0, 57, 0),    mat: "orange"   });
// Payload fairing: y = 62 → 67
pieces.push({ geo: cylinder(1.0, 0.02, 5, 0, 62, 0),     mat: "white"    });
// Interstage: y = 42 → 44
pieces.push({ geo: cylinder(1.95, 1.95, 2, 0, 42, 0),    mat: "darkgrey" });

// 9 Merlin nozzles at y = -2.5 → 0
const nozzlePos = [
  [0,0], [1.0,0], [-1.0,0], [0,1.0], [0,-1.0],
  [0.8,0.8], [-0.8,0.8], [0.8,-0.8], [-0.8,-0.8],
];
for (const [nx, nz] of nozzlePos) {
  pieces.push({ geo: cylinder(0.45, 0.28, 2.5, nx, -2.5, nz, 10), mat: "darkgrey" });
}

// 4 grid fins at y = 33 → 36.5
for (let i = 0; i < 4; i++) {
  const a = (i / 4) * Math.PI * 2;
  pieces.push({ geo: box(Math.cos(a)*2.0, 34.75, Math.sin(a)*2.0, 0.12, 3.5, 1.6), mat: "darkgrey" });
}

// 4 landing legs at base
for (let i = 0; i < 4; i++) {
  const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
  pieces.push({ geo: box(Math.cos(a)*2.0, 3.0, Math.sin(a)*2.0, 0.12, 5.0, 0.3), mat: "darkgrey" });
}

// Thrust skirt (reinforcement ring at base)
pieces.push({ geo: cylinder(2.0, 2.0, 0.5, 0, -0.5, 0, 24), mat: "darkgrey" });

// ─── Materials ──────────────────────────────────────────────────────────────

const MATS = {
  white:    { baseColor: [0.93, 0.93, 0.96, 1.0], metallic: 0.08, roughness: 0.38 },
  orange:   { baseColor: [0.99, 0.35, 0.08, 1.0], metallic: 0.10, roughness: 0.50 },
  darkgrey: { baseColor: [0.16, 0.18, 0.21, 1.0], metallic: 0.65, roughness: 0.40 },
};
const matNames = Object.keys(MATS);
const matIdx   = Object.fromEntries(matNames.map((n,i) => [n,i]));

// ─── Pack binary buffer ─────────────────────────────────────────────────────

const bufferViewDefs = [];
const accessorDefs   = [];
const meshPrimDefs   = [];
const binaryChunks   = [];
let   byteOffset     = 0;

for (const { geo, mat } of pieces) {
  const posBytes  = geo.positions.byteLength;
  const normBytes = geo.normals.byteLength;
  const idxBytes  = geo.indices.byteLength;
  const idxPad    = idxBytes % 4 ? 4 - (idxBytes % 4) : 0;

  const posViewIdx  = bufferViewDefs.length;
  bufferViewDefs.push({ byteOffset, byteLength: posBytes,  target: 34962 });
  byteOffset += posBytes;

  const normViewIdx = bufferViewDefs.length;
  bufferViewDefs.push({ byteOffset, byteLength: normBytes, target: 34962 });
  byteOffset += normBytes;

  const idxViewIdx  = bufferViewDefs.length;
  bufferViewDefs.push({ byteOffset, byteLength: idxBytes,  target: 34963 });
  byteOffset += idxBytes + idxPad;

  const nVerts = geo.positions.length / 3;
  let   minP = [ Infinity, Infinity, Infinity];
  let   maxP = [-Infinity,-Infinity,-Infinity];
  for (let i = 0; i < geo.positions.length; i += 3) {
    minP[0] = Math.min(minP[0], geo.positions[i]);
    minP[1] = Math.min(minP[1], geo.positions[i+1]);
    minP[2] = Math.min(minP[2], geo.positions[i+2]);
    maxP[0] = Math.max(maxP[0], geo.positions[i]);
    maxP[1] = Math.max(maxP[1], geo.positions[i+1]);
    maxP[2] = Math.max(maxP[2], geo.positions[i+2]);
  }

  const posAccIdx  = accessorDefs.length;
  accessorDefs.push({ bufferView: posViewIdx,  byteOffset: 0, componentType: 5126, count: nVerts,             type: "VEC3",   min: minP, max: maxP });
  const normAccIdx = accessorDefs.length;
  accessorDefs.push({ bufferView: normViewIdx, byteOffset: 0, componentType: 5126, count: nVerts,             type: "VEC3"   });
  const idxAccIdx  = accessorDefs.length;
  accessorDefs.push({ bufferView: idxViewIdx,  byteOffset: 0, componentType: 5123, count: geo.indices.length, type: "SCALAR" });

  meshPrimDefs.push({ attributes: { POSITION: posAccIdx, NORMAL: normAccIdx }, indices: idxAccIdx, material: matIdx[mat], mode: 4 });

  binaryChunks.push(Buffer.from(geo.positions.buffer));
  binaryChunks.push(Buffer.from(geo.normals.buffer));
  binaryChunks.push(Buffer.from(geo.indices.buffer));
  if (idxPad) binaryChunks.push(Buffer.alloc(idxPad, 0));
}

// ─── Assemble glTF JSON ─────────────────────────────────────────────────────

const gltf = {
  asset: { version: "2.0", generator: "RocketSims by Bob rocket builder" },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes:  [{ name: "rocket", mesh: 0 }],
  meshes: [{ name: "rocket_mesh", primitives: meshPrimDefs }],
  materials: matNames.map(n => ({
    name: n,
    pbrMetallicRoughness: {
      baseColorFactor: MATS[n].baseColor,
      metallicFactor:  MATS[n].metallic,
      roughnessFactor: MATS[n].roughness,
    },
    doubleSided: false,
  })),
  accessors:   accessorDefs,
  bufferViews: bufferViewDefs.map(bv => ({ ...bv, buffer: 0 })),
  buffers:     [{ byteLength: byteOffset }],
};

// ─── Write GLB ──────────────────────────────────────────────────────────────

const jsonBytes = Buffer.from(JSON.stringify(gltf), "utf8");
const jsonPad   = (4 - (jsonBytes.length % 4)) % 4;
const jsonChunk = Buffer.concat([jsonBytes, Buffer.alloc(jsonPad, 0x20)]);

const binData   = Buffer.concat(binaryChunks);
const binPad    = (4 - (binData.length % 4)) % 4;
const binChunk  = Buffer.concat([binData, Buffer.alloc(binPad, 0)]);

const totalLen  = 12 + 8 + jsonChunk.length + 8 + binChunk.length;
const hdr = Buffer.alloc(12);
hdr.writeUInt32LE(0x46546C67, 0);   // magic "glTF"
hdr.writeUInt32LE(2,          4);   // version
hdr.writeUInt32LE(totalLen,   8);

const jHdr = Buffer.alloc(8);
jHdr.writeUInt32LE(jsonChunk.length, 0);
jHdr.writeUInt32LE(0x4E4F534A,       4); // "JSON"

const bHdr = Buffer.alloc(8);
bHdr.writeUInt32LE(binChunk.length, 0);
bHdr.writeUInt32LE(0x004E4942,      4); // "BIN\0"

const glb = Buffer.concat([hdr, jHdr, jsonChunk, bHdr, binChunk]);
writeFileSync(OUT_FILE, glb);
console.log(`rocket.glb written: ${(glb.length / 1024).toFixed(1)} KB`);
console.log(`Primitives: ${pieces.length}, bufferViews: ${bufferViewDefs.length}, accessors: ${accessorDefs.length}`);
