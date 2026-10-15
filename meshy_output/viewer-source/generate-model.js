import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { smoothNormals } from './smooth-normals.js';

async function generate() {
  const { width, height } = window.CONTOURS;
  const parsed = new SVGLoader().parse(window.CONTOUR_SVG);
  const shapes = parsed.paths.flatMap(path=>SVGLoader.createShapes(path));
  const texture = await new THREE.TextureLoader().loadAsync(window.SOURCE_IMAGE);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const unit = 3.4 / height;
  const front = new THREE.MeshStandardMaterial({map:texture, color:0xffffff, roughness:0.38, metalness:0.3, alphaTest:0.14, side:THREE.DoubleSide});
  front.name = 'Original Aurora artwork';
  const edge = new THREE.MeshStandardMaterial({color:0xffffff, vertexColors:true, metalness:0.76, roughness:0.28});
  edge.name = 'Cyan to violet beveled metal';
  const uvGenerator = {
    generateTopUV(geometry, vertices, a, b, c) {
      return [a,b,c].map(i => new THREE.Vector2(vertices[i*3]/(width*unit)+0.5, vertices[i*3+1]/(height*unit)+0.5));
    },
    generateSideWallUV() { return [new THREE.Vector2(0,0),new THREE.Vector2(1,0),new THREE.Vector2(1,1),new THREE.Vector2(0,1)]; }
  };
  const group = new THREE.Group();
  group.name = 'Aurora Production - smooth 3D relief v2';
  group.userData = {version:2,method:'Full-resolution fitted cubic Bezier curves with original image texture',source:'aurora-logo-generated-cutout-not-approved.png',status:'Concept derived from the user-selected unapproved artwork'};
  const transformPath = path => {
    const points=new Set([path.currentPoint]);
    for(const curve of path.curves) {
      if(!curve.isCubicBezierCurve&&!curve.isLineCurve) throw new Error('Unexpected outline curve type: '+curve.type);
      for(const key of ['v0','v1','v2','v3']) if(curve[key]) points.add(curve[key]);
    }
    for(const point of points) point.set((point.x-width/2)*unit,(height/2-point.y)*unit);
  };
  let cubicSegments=0;
  shapes.forEach((shape,index) => {
    const outline=shape.getPoints(8);
    const centerY = outline.reduce((sum,p)=>sum+p.y,0)/outline.length;
    const area=Math.abs(THREE.ShapeUtils.area(outline));
    const emblem = centerY < height*0.75 && area > 6000;
    for(const path of [shape,...shape.holes]) {
      cubicSegments+=path.curves.filter(c=>c.isCubicBezierCurve).length;
      transformPath(path);
    }
    const depth = emblem ? 0.22 : 0.12;
    const extruded = new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:true,bevelThickness:0.012,bevelSize:0.006,bevelSegments:6,curveSegments:12,UVGenerator:uvGenerator});
    const geometry = new THREE.BufferGeometry().copy(smoothNormals(extruded,Math.PI/3));
    const pos = geometry.attributes.position;
    const colors = new Float32Array(pos.count*3);
    const cyan = new THREE.Color('#11cde9'), blue = new THREE.Color('#3157cc'), violet = new THREE.Color('#b74cf3');
    const color = new THREE.Color();
    for(let i=0;i<pos.count;i++){
      const t = THREE.MathUtils.clamp(pos.getX(i)/(width*unit)+0.5,0,1);
      if(t<0.5) color.copy(cyan).lerp(blue,t*2); else color.copy(blue).lerp(violet,(t-0.5)*2);
      color.toArray(colors,i*3);
    }
    // glTF applies COLOR_0 to every material, so keep textured caps white.
    geometry.groups.filter(g=>g.materialIndex===0).forEach(g=>{
      for(let i=g.start;i<g.start+g.count;i++) {
        colors.set([1,1,1],i*3);
        geometry.attributes.normal.setXYZ(i,0,0,pos.getZ(i)>depth/2?1:-1);
      }
    });
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    // Export concrete UV/color/normal attributes, including through ObjectLoader JSON.
    const mesh = new THREE.Mesh(mergeVertices(geometry,1e-6),[front,edge]);
    mesh.name = `Aurora relief component ${String(index+1).padStart(2,'0')}`;
    mesh.position.z = -depth/2;
    group.add(mesh);
  });
  group.userData.cubicSegments=cubicSegments;
  group.userData.holes=shapes.reduce((sum,shape)=>sum+shape.holes.length,0);
  window.generatedModel = group;
  window.exportModel = async () => {
    const buffer = await new GLTFExporter().parseAsync(group,{binary:true,onlyVisible:true});
    const blob = new Blob([buffer]);
    const base64 = await new Promise(resolve => {const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.readAsDataURL(blob);});
    const three = group.toJSON();
    const restored = await new THREE.ObjectLoader().parseAsync(three);
    const roundtrip = {components:restored.children.length,holes:group.userData.holes,cubicSegments,attributesPreserved:restored.children.every(mesh=>['position','normal','uv','color'].every(key=>!!mesh.geometry.attributes[key])),textureRestored:!!restored.children[0].material[0].map?.image};
    if(roundtrip.components!==shapes.length||!roundtrip.attributesPreserved||!roundtrip.textureRestored) throw new Error('Three.js JSON round-trip validation failed.');
    return {glb:base64,three,roundtrip};
  };
  window.modelReady = true;
}
generate().catch(error=>{window.modelError=error.message;console.error(error);});
