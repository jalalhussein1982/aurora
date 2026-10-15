import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const modelPath = resolve(process.argv[2] ?? resolve(root, '../aurora-logo-relief.glb'));
const outputPath = resolve(process.argv[3] ?? resolve(root, '../../index.html'));
const model = await readFile(modelPath);
if (model.toString('ascii', 0, 4) !== 'glTF') throw new Error('Expected a GLB file.');
await build({ entryPoints: [resolve(root, 'viewer.js')], bundle: true, minify: true, outfile: resolve(root, 'viewer.bundle.js'), format: 'iife', legalComments: 'inline' });
const bundled = await readFile(resolve(root, 'viewer.bundle.js'), 'utf8');
const template = await readFile(resolve(root, 'template.html'), 'utf8');
const license = await readFile(resolve(root,'node_modules/three/LICENSE'),'utf8');
const html = template.replace('__MODEL_BASE64__', () => model.toString('base64')).replace('/* EMBED_VIEWER */', () => bundled.replaceAll('</script', '<\\/script')).replace('</head>',()=>`<!-- Three.js license\n${license}\n-->\n</head>`);
await writeFile(outputPath, html);
await writeFile(resolve(dirname(outputPath),'THIRD_PARTY_NOTICES.txt'),`Three.js 0.180.0\n\n${license}`);
console.log(JSON.stringify({ modelPath, outputPath, modelBytes: model.length, htmlBytes: Buffer.byteLength(html) }, null, 2));
