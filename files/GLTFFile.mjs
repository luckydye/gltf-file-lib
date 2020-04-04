import { TextFile } from "binary-file-lib";
import { S3Texture } from "./S3Texture.mjs";

// https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#gltf-basics
// https://github.com/KhronosGroup/glTF-Tutorials/blob/master/gltfTutorial/gltfTutorial_005_BuffersBufferViewsAccessors.md

export default class GLTFFile extends TextFile {

    static fromGeometry(geometry = {}) {
        /* geometry:
            vertecies: [0, 0, 0],
            uvs: [0, 0, 0],
            normals: [0, 0, 0],
            indices: [0, 0, 0],
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [0, 0, 0],
            material: {}
        */

        const gltf = new this();

        for(let key in geometry) {

            if(Array.isArray(geometry[key])) {
                const geometryList = geometry[key];

                const parent = gltf.createNode({
                    name: key,
                    translation: geometryList.position || [0, 0, 0],
                    rotation: eulerDegreeToQuaternion(geometryList.rotation || [0, 0, 0]),
                    scale: geometryList.scale || [1, 1, 1],
                    children: []
                });

                gltf.rootNode.children.push(parent);

                for(let geo of geometryList) {
                    gltf.addObject(geo, parent);
                }
            }
        }

        return gltf;
    }

    static async fromBlob(gLTFFile) {
        if(gLTFFile instanceof Blob) {
            const fileString = await gLTFFile.text();
            const jsonData = JSON.parse(fileString);
            const gltfFile = new GLTFFile(jsonData);
            return gltfFile;
        } else {
            throw new Error('Not a blob');
        }
    }

    get generator() {
        return this.asset.asset.generator;
    }

    get copyright() {
        return this.asset.asset.copyright;
    }

    get version() {
        return this.asset.asset.version;
    }

    get nodes() {
        return this.asset.nodes;
    }

    get meshes() {
        return this.asset.meshes;
    }

    get materials() {
        return this.asset.materials;
    }

    get textures() {
        return this.asset.textures;
    }

    get images() {
        return this.asset.images;
    }

    get accessors() {
        return this.asset.accessors;
    }

    get bufferViews() {
        return this.asset.bufferViews;
    }

    get buffers() {
        return this.asset.buffers;
    }

    get _loaded() {
        return this.loadedBufferCount == this.asset.buffers.length;
    }

    get rootNode() {
        return this.asset.nodes[0];
    }

    constructor(jsonGltfData) {
        super();

        if(jsonGltfData) {
            if(!jsonGltfData.asset) {
                throw new Error('Missing "asset" section.');
            }
        }

        this.loadedBufferCount = 0;
        
        this.asset = jsonGltfData || {
            asset: {
                copyright: "2020 (c) Valve Software",
                generator: "gltf-file-lib v1.0.0",
                version: "2.0"
            },
            scene: 0,
            scenes: [
                {
                    name: "Scene",
                    nodes: [ 0 ]
                }
            ],
            nodes: [
                {
                    name: "Map",
                    children: []
                }
            ],
            meshes: [],
            // cameras: [],
            materials: [],
            textures: [],
            images: [],
            samplers: [
                {
                    "magFilter": 9729,
                    "minFilter": 9987,
                    "wrapS": 10497,
                    "wrapT": 10497
                }
            ],
            accessors: [],
            bufferViews: [],
            buffers: [],
        };
    }

    getBufferByAccessor(accessor) {
        const bufferView = accessor.bufferView;
        const byteOffset = accessors.byteOffset;
        const count = accessor.count;
        const max = accessor.max;
        const min = accessor.min;

        const componentType = TYPE[accessor.componentType];
        const type = TYPE[accessor.type];

        const buffer = this.getBufferByView(bufferView);
        const arrayBuffer = buffer.slice(byteOffset);

        for(let i = 0; i < count; i++) {
            
        }

        // TODO: convert into Float32Array etc.
    }

    getBufferByView(bufferView) {
        const buffer = this.buffers[bufferView.buffer];

        const byteOffset = bufferView.byteOffset;
        const byteLength = bufferView.byteLength;

        const byteStride = bufferView.byteStride;
        // TODO: use byteStride

        const bufferByteLength = buffer.byteLength;
        const uri = buffer.uri;

        if(uri.match("data:application/octet-stream;base64")) {
            const base64 = uri.split(',')[1];
            const decoder = new TextEncoder();
    
            return decoder.encode(base64).buffer.slice(byteOffset, byteOffset + byteLength);
        }
    }

    getTexture(tex) {
        const texture = this.textures[tex.index];
        const texCoord = tex.texCoord;
        const scale = tex.scale;

        const image = this.images[texture.source];
        const sampler = texture.sampler;

        const uri = image.uri;
        const bufferView = image.bufferView;
        const mimeType = image.mimeType;

        const textureImage = new Image();
        textureImage.decoding = 'sync';

        if(uri) {
            textureImage.src = uri;
        } else if(bufferView) {
            const blob = new Blob([ this.getBufferByView(bufferView) ], mimeType);
            textureImage.srcObject = blob;
        }
        
        return textureImage;
    }

    getPBRMaterial(material) {
        const name = material.name;
        const normalTexture = material.normalTexture;
        const pbrMetallicRoughness = material.pbrMetallicRoughness;

        const baseColorFactor = pbrMetallicRoughness.baseColorFactor;
        const metallicFactor = pbrMetallicRoughness.metallicFactor;
        const roughnessFactor = pbrMetallicRoughness.roughnessFactor;

        const baseColorTexture = pbrMetallicRoughness.baseColorTexture;
        const metallicRoughnessTexture = pbrMetallicRoughness.metallicRoughnessTexture;

        return {
            name,
            baseColor,
            metallic,
            roughness,

            texture: this.getTexture(baseColorTexture),
            normalTexture: this.getTexture(normalTexture),
            metallicRoughnessTexture: this.getTexture(metallicRoughnessTexture),
        }
    }

    getGeometry() {
        const geo = [];

        for(let node of this.nodes) {
            // node
            const name = node.name;
            const rotation = node.rotation;
            const scale = node.scale;
            const translation = node.translation;
            // mesh
            const mesh = this.meshes[node.mesh];
            const primitives = mesh.primitives;
            // primitives
            for(let primitive of primitives) {
                const mode = primitive.mode;
                const attributes = primitives.attributes;
                const material = this.materials[primitives.material];
                const indices = this.accessors[primitives.indices];

                const normal = this.accessors[attributes['NORMAL']];
                const position = this.accessors[attributes['POSITION']];
                const texcoord = this.accessors[attributes['TEXCOORD_0']];

                const geometry = {
                    name: name,
                    vertecies: this.getBufferByAccessor(position),
                    uvs: this.getBufferByAccessor(texcoord),
                    normals: this.getBufferByAccessor(normal),
                    indices: this.getBufferByAccessor(indices),
                    position: translation,
                    rotation: rotation,
                    scale: scale,
                    material: this.getPBRMaterial(material),
                }

                geo.push(geometry);
            }
        }

        return geo;
    }

    createBuffer(bufferArray) {

        const gltfBuffer = {
            byteLength: bufferArray.buffer.byteLength,
            uri: "data:application/octet-stream;base64,"
        }

        if(typeof Buffer !== "undefined") {
            // nodejs
            gltfBuffer.uri += Buffer.from(bufferArray.buffer).toString('base64');
            this.loadedBufferCount++;

            if(this._loaded) {
                this._finalize();
            }
        } else {
            // chrome
            const blob = new Blob([ bufferArray.buffer ], { type : 'binary' });

            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = reader.result;
                const base64 = dataUrl.split(',')[1];

                gltfBuffer.uri += base64;
                this.loadedBufferCount++;

                if(this._loaded) {
                    this._finalize();
                }
            };

            reader.readAsDataURL(blob);
        }

        return this.asset.buffers.push(gltfBuffer) - 1;
    }

    createBufferView(options) {
        const bufferView = options;
        return this.asset.bufferViews.push(bufferView) - 1;
    }

    createAccessor(options) {
        const accessors = options;
        return this.asset.accessors.push(accessors) - 1;
    }

    createMesh(options) {
        const mesh = options;
        return this.asset.meshes.push(mesh) - 1;
    }

    createNode(options) {
        const node = options;
        const nodeIndex = this.asset.nodes.push(node) - 1;
        return nodeIndex;
    }

    createPrimitive(indices, vertecies, normals, uvs, color) {
        const indexCount = indices.length;
        const vertexCount = vertecies.length;

        const vertexBufferArray = vertecies.map((vert, i) => {
            const vertex = [
                vert[0],
                vert[1],
                vert[2],

                uvs[i][0],
                uvs[i][1],

                normals[i][0],
                normals[i][1],
                normals[i][2]
            ];

            if(color) {
                vertex.push(
                    color[i][0],
                    color[i][1],
                    color[i][2],
                    color[i][3]
                );
            }

            return vertex;
        }).flat();

        // asset buffers
        const indexBuffer = new Uint32Array(indices);
        const vertexBuffer = new Float32Array(vertexBufferArray);

        const indexBufferIndex = this.createBuffer(indexBuffer);
        const vertexBufferIndex = this.createBuffer(vertexBuffer);

        // buffer views
        let byteStride =  TYPE.VEC3.components * TYPE.FLOAT.byteLength +
                            TYPE.VEC2.components * TYPE.FLOAT.byteLength +
                            TYPE.VEC3.components * TYPE.FLOAT.byteLength;

        if(color) {
            byteStride += TYPE.VEC4.components * TYPE.FLOAT.byteLength;
        }

        const indexBufferViewIndex = this.createBufferView({
            buffer: indexBufferIndex, 
            byteOffset: 0, 
            byteLength: indexBuffer.byteLength
        });

        const posBufferViewIndex = this.createBufferView({
            buffer: vertexBufferIndex, 
            byteOffset: 0, 
            byteLength: vertexBuffer.byteLength,
            byteStride: byteStride,
        });

        const texBufferByteOffset = TYPE.VEC3.components * TYPE.FLOAT.byteLength;
        const texBufferViewIndex = this.createBufferView({
            buffer: vertexBufferIndex, 
            byteOffset: texBufferByteOffset, 
            byteLength: vertexBuffer.byteLength - texBufferByteOffset,
            byteStride: byteStride,
        });

        const normalBufferByteOffset = texBufferByteOffset + TYPE.VEC2.components * TYPE.FLOAT.byteLength;
        const normBufferViewIndex = this.createBufferView({
            buffer: vertexBufferIndex, 
            byteOffset: normalBufferByteOffset,
            byteLength: vertexBuffer.byteLength - normalBufferByteOffset,
            byteStride: byteStride,
        });

        let colorBufferByteOffset;
        let colorBufferViewIndex;

        if(color) {
            colorBufferByteOffset = normalBufferByteOffset + TYPE.VEC3.components * TYPE.FLOAT.byteLength;
            colorBufferViewIndex = this.createBufferView({
                buffer: vertexBufferIndex, 
                byteOffset: colorBufferByteOffset,
                byteLength: vertexBuffer.byteLength - colorBufferByteOffset,
                byteStride: byteStride,
            });
        }

        // accessors
        const indexAccessor = this.createAccessor({
            bufferView: indexBufferViewIndex,
            componentType: TYPE.UNSIGNED_INT,
            count: indexCount,
            type: TYPE.SCALAR,
        });

        const positionAccessor = this.createAccessor({
            bufferView: posBufferViewIndex,
            componentType: TYPE.FLOAT,
            count: vertexCount,
            max: [ 1000.0, 1000.0, 1000.0 ],
            min: [ -1000.0, -1000.0, -1000.0 ],
            type: TYPE.VEC3,
        });

        const textureAccessor = this.createAccessor({
            bufferView: texBufferViewIndex,
            componentType: TYPE.FLOAT,
            count: vertexCount,
            type: TYPE.VEC2,
        });

        const normalAccessor = this.createAccessor({
            bufferView: normBufferViewIndex,
            componentType: TYPE.FLOAT,
            count: vertexCount,
            max: [ 1, 1, 1 ],
            min: [ -1, -1, -1 ],
            type: TYPE.VEC3,
        });

        if(color) {
            const colorAccessor = this.createAccessor({
                bufferView: colorBufferViewIndex,
                componentType: TYPE.FLOAT,
                count: vertexCount,
                max: [ 1, 1, 1, 1 ],
                min: [ 0, 0, 0, 0 ],
                type: TYPE.VEC4,
            });

            return {
                attributes: {
                    "POSITION": positionAccessor,
                    "TEXCOORD_0": textureAccessor,
                    "NORMAL": normalAccessor,
                    "COLOR_0": colorAccessor,
                },
                indices: indexAccessor,
            }

        } else {

            return {
                attributes: {
                    "POSITION": positionAccessor,
                    "TEXCOORD_0": textureAccessor,
                    "NORMAL": normalAccessor,
                },
                indices: indexAccessor,
            }
        }
    }

    createMaterial(options) {
        const material = options;
        return this.asset.materials.push(material) - 1;
    }

    createTexture(imageDataBuffer, options) {

        const imageBuffer = this.createBuffer({ buffer: imageDataBuffer });

        const imageBufferView = this.createBufferView({
            buffer: imageBuffer, 
            byteOffset: 0, 
            byteLength: imageDataBuffer.byteLength
        });

        const image = Object.assign({
            bufferView: imageBufferView,
            mimeType: "image/png"
        }, options);

        const textureSource = this.asset.images.push(image) - 1;

        const texture = {
            sampler: 0,
            source: textureSource,
        };

        return this.asset.textures.push(texture) - 1;
    }

    createMaterialFromObjectMaterial(objectMaterial) {

        const materialName = objectMaterial.name.toString().replace(/\//g, "_");

        const baseTexture = objectMaterial.texture;
        const baseTexture2 = objectMaterial.texture2;
        const bumpmapTexture = objectMaterial.bumpmap;
        const translucent = objectMaterial.translucent;

        const existingMaterial = this.getMaterialByName(materialName);

        if(existingMaterial) {
            return existingMaterial;
        }

        let texture = null, 
            texture2 = null, 
            bumpmap = null, 
            reflectivity = 0;

        if(baseTexture) {
            const textureImage = S3Texture.fromDataArray(
                baseTexture.imageData, 
                baseTexture.format.type,
                baseTexture.format.width, 
                baseTexture.format.height
            );
            const ddsBuffer = textureImage.toDDS();
    
            texture = this.createTexture(ddsBuffer, {
                name: materialName + "_texture.dds",
            });

            reflectivity = 1 - ((baseTexture.reflectivity[0] +
                                baseTexture.reflectivity[1] +
                                baseTexture.reflectivity[2]) / 3);
        }

        if(bumpmapTexture) {
            const textureImage = S3Texture.fromDataArray(
                bumpmapTexture.imageData, 
                bumpmapTexture.format.type,
                bumpmapTexture.format.width, 
                bumpmapTexture.format.height
            );
            const ddsBuffer = textureImage.toDDS();
    
            bumpmap = this.createTexture(ddsBuffer, {
                name: materialName + "_normal_texture.dds",
            });
        }

        if(baseTexture2) {
            const textureImage = S3Texture.fromDataArray(
                baseTexture2.imageData, 
                baseTexture2.format.type,
                baseTexture2.format.width, 
                baseTexture2.format.height
            );
            const ddsBuffer = textureImage.toDDS();
    
            texture2 = this.createTexture(ddsBuffer, {
                name: materialName + "_normal_texture2.dds",
            });
        }

        const matOptions = {
            name: materialName,
            doubleSided: true,
            alphaMode: translucent ? "MASK" : "OPAQUE",
            pbrMetallicRoughness: {
                baseColorFactor: [ 1, 1, 1, 1 ],
                metallicFactor: 0,
                roughnessFactor: reflectivity
            }
        };

        if(texture != null) {
            matOptions.pbrMetallicRoughness.baseColorTexture = {
                index: texture,
                texCoord: 0
            };
        }

        if(texture2 != null) {
            matOptions.occlusionTexture = {
                index: texture2,
                texCoord: 0
            };
        }

        if(bumpmap != null) {
            matOptions.normalTexture = {
                scale: 1,
                index: bumpmap,
                texCoord: 0
            }
        }

        return this.createMaterial(matOptions);
    }

    getMaterialByName(name) {
        for(let mat of this.asset.materials) {
            if(mat.name == name) {
                return this.asset.materials.indexOf(mat);
            }
        }
    }

    createObjectMesh(object) {
        // geometry buffer
        const indices = object.indices;
        const vertecies = object.vertecies;
        const normals = object.normals;
        const uvs = object.uvs;
        const color = object.color;

        const mesh = {
            name: object.name,
            primitives: []
        };

        let objectMaterial = object.material;

        if(objectMaterial) {
            const material = this.createMaterialFromObjectMaterial(objectMaterial);
            const primitive = this.createPrimitive(indices, vertecies, normals, uvs, color);
            
            mesh.primitives.push({
                attributes: primitive.attributes,
                indices: primitive.indices,
                material: material,
            });
        } else {
            const primitive = this.createPrimitive(indices, vertecies, normals, uvs, color);
            
            mesh.primitives.push({
                attributes: primitive.attributes,
                indices: primitive.indices,
            });
        }

        // mesh
        return this.createMesh(mesh);
    }

    addObject(object, parentNode) {
        let mesh = null;

        // find existing mesh with same name
        for(let assetMesh of this.asset.meshes) {
            if(object.name == assetMesh.name) {
                mesh = this.asset.meshes.indexOf(assetMesh);
            }
        }

        if(object.vertecies && object.vertecies.length > 0) {
            mesh = mesh || this.createObjectMesh(object);
        }

        const quat = eulerDegreeToQuaternion(object.rotation);

        // node
        const nodeIndex = this.createNode({
            name: object.name,
            mesh: mesh,
            scale: [
                object.scale[0],
                object.scale[1],
                object.scale[2]
            ],
            rotation: [
                // blender import swaps z and y -,-
                quat[0],
                quat[2],
                -quat[1],
                quat[3],
            ],
            translation: object.position,
        });

        if(parentNode) {
            const node = this.asset.nodes[parentNode];
            node.children = node.children || [];
            node.children.push(nodeIndex);
        } else {
            this.rootNode.children.push(nodeIndex);
        }

        return nodeIndex;
    }

    _finalize() { }

    async toString() {
        return new Promise((resolve) => {
            if(this._loaded) {
                resolve(JSON.stringify(this.asset, null, '\t'));
            } else {
                this._finalize = () => {
                    resolve(JSON.stringify(this.asset, null, '\t'));
                }
            }
        })
    }

    async toBlob() {
        const stringData = await this.toString();
        const blob = new Blob([ stringData ], { type: "model/gltf+json" });
        return blob;
    }
}

// helper functions

function eulerDegreeToQuaternion([ roll, pitch, yaw ]) { // [ x, y, z ]

    roll = roll * (Math.PI / 180);
    pitch = pitch * (Math.PI / 180);
    yaw = yaw * (Math.PI / 180);

    // Abbreviations for the various angular functions
    const cy = Math.cos(yaw * 0.5);
    const sy = Math.sin(yaw * 0.5);
    const cp = Math.cos(pitch * 0.5);
    const sp = Math.sin(pitch * 0.5);
    const cr = Math.cos(roll * 0.5);
    const sr = Math.sin(roll * 0.5);

    let q = {};
    q.w = cy * cp * cr + sy * sp * sr;
    q.x = cy * cp * sr - sy * sp * cr;
    q.y = sy * cp * sr + cy * sp * cr;
    q.z = sy * cp * cr - cy * sp * sr;

    return [
        Math.floor(q.x * 100000) / 100000, 
        Math.floor(q.y * 100000) / 100000, 
        Math.floor(q.z * 100000) / 100000, 
        Math.floor(q.w * 100000) / 100000,
    ];
}

// type definitions
class ComponentType extends Number {
    
    get byteLength() {
        return this._byteLength;
    }

    constructor(type, n, byteLength) {
        super(n);

        this._type = type;
        this._byteLength = byteLength;
    }
}

class Type extends String {

    get components() {
        return this._components;
    }

    constructor(type, components) {
        super(type);

        this._components = components;
    }
}

// type

const TYPE = {
    BYTE: new ComponentType("BYTE", 5120, 1),
    UNSIGNED_BYTE: new ComponentType("UNSIGNED_BYTE", 5121, 1),
    SHORT: new ComponentType("SHORT", 5122, 2),
    UNSIGNED_SHORT: new ComponentType("UNSIGNED_SHORT", 5123, 2),
    UNSIGNED_INT: new ComponentType("UNSIGNED_INT", 5125, 4),
    SCALAR: new Type("SCALAR", 1),
    FLOAT: new ComponentType("FLOAT", 5126, 4),
    VEC2: new Type("VEC2", 2),
    VEC3: new Type("VEC3", 3),
    VEC4: new Type("VEC4", 4),
    MAT2: new Type("MAT2", 4),
    MAT3: new Type("MAT2", 9),
    MAT4: new Type("MAT4", 16),
}
