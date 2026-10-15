import { BufferAttribute, Vector3 } from 'three';

// Average only truly coincident vertices, with corner-angle weighting.
// A 0.01-unit spatial bucket would merge distinct details on this small logo.
export function smoothNormals(geometry, creaseAngle=Math.PI/3) {
  const result=geometry.index?geometry.toNonIndexed():geometry;
  const positions=result.attributes.position;
  const normals=new Float32Array(positions.count*3);
  const faceNormals=new Float32Array(positions.count*3);
  const adjacency=new Map();
  const keys=new Array(positions.count);
  const vertices=[new Vector3(),new Vector3(),new Vector3()];
  const u=new Vector3(),v=new Vector3(),n=new Vector3();
  for(let i=0;i<positions.count;i+=3) {
    vertices.forEach((p,j)=>p.fromBufferAttribute(positions,i+j));
    n.crossVectors(u.subVectors(vertices[1],vertices[0]),v.subVectors(vertices[2],vertices[0])).normalize();
    for(let j=0;j<3;j++) {
      const point=vertices[j];
      const key=[point.x,point.y,point.z].map(value=>Math.round(value*1e6)).join(',');
      keys[i+j]=key;
      u.subVectors(vertices[(j+1)%3],point).normalize();
      v.subVectors(vertices[(j+2)%3],point).normalize();
      const weight=Math.acos(Math.max(-1,Math.min(1,u.dot(v))));
      if(!adjacency.has(key)) adjacency.set(key,[]);
      adjacency.get(key).push([n.x,n.y,n.z,weight]);
      n.toArray(faceNormals,(i+j)*3);
    }
  }
  const cutoff=Math.cos(creaseAngle),sum=new Vector3();
  for(let i=0;i<positions.count;i++) {
    n.fromArray(faceNormals,i*3);
    sum.set(0,0,0);
    for(const [x,y,z,weight] of adjacency.get(keys[i])) {
      if(n.x*x+n.y*y+n.z*z>cutoff) {
        sum.x+=x*weight;sum.y+=y*weight;sum.z+=z*weight;
      }
    }
    if(sum.lengthSq()===0) sum.copy(n);
    sum.normalize().toArray(normals,i*3);
  }
  result.setAttribute('normal',new BufferAttribute(normals,3));
  return result;
}
