import assert from 'node:assert/strict';
import * as THREE from 'three';
const baseline=process.argv.includes('--baseline');
const { smoothNormals } = baseline
  ? { smoothNormals:(await import('three/addons/utils/BufferGeometryUtils.js')).toCreasedNormals }
  : await import('./smooth-normals.js');
// Separate nearby surfaces must not be welded by a coarse position hash.
const geometry=new THREE.BufferGeometry();
geometry.setAttribute('position',new THREE.Float32BufferAttribute([
  0,0,0, 0.002,0,0, 0,0.002,0,
  0.004,0,0.001, 0.006,0,0.001, 0.004,0.002,0.002,
],3));
const expected=[new THREE.Vector3(0,0,1),new THREE.Vector3(0,-1,2).normalize()];
const result=smoothNormals(geometry,Math.PI/3);
for(let i=0;i<6;i++) {
  const actual=new THREE.Vector3().fromBufferAttribute(result.attributes.normal,i);
  assert.ok(actual.distanceTo(expected[Math.floor(i/3)])<1e-5,`Disconnected surface ${Math.floor(i/3)} changed normal: ${actual.toArray()}`);
}
console.log('PASS: nearby separate surfaces keep their own normals.');
