// import { Edge_on_Screen, Vertex_OnScreen } from "./BSP.js";
import { Vec2, CanvasObject, Edge2 } from "./clipping.js";

const canvas: HTMLCanvasElement = document.getElementById("Canvas2d") as HTMLCanvasElement
CanvasObject.ctx = canvas.getContext("2d");

console.log("pre")
var vs = [new Vec2([[-10, 0]]), new Vec2([[+10, 0]])];
console.log("post");

// Todo: Constructor draws. So please actually construct an object
var e = new Edge2(vs) // todo use vec<2> instead of tupel
//var t=vs.map( s=>{let f=new Vertex_OnScreen();f.v=s.v;return f; } ) // Todo: Can't create new objects because they would draw => Need a bare Edge ?

//e.vs=[t[0],t[1]]  ;

var v1 = [vs[1], new Vec2([[0, 7]])]
// var e = new Edge2(v1)

// inserting in tree should not create anything new



// from lines_partitions 2026-05-31
// Converting to the Jaguar: LoadP is fast. We go step by step: vertex buffer, edge buffer, faces
// Indices: [0=self=no index.  !0 [relative index in the list of polygons] [vertex on poly]   > 0 => edge . < 0 => vertex .  [x,y] y<0 => flip vertices on an edges
// forward indices are not allow ( single pass parser to prevent weird error states ). So I use negative indices to indicate orientation swapped edges
const fileFormat = [
    [[0, 160, 140], [0, 240, 60], [0, 40, 160]],
    [[0, 6, 260], [1, 0], [1, 2]],
    [[0, 106, 260], [1, 1], [1, 0]],
    [[0, 140, 265], [0, 340, 125], [0, 340, 247], [0, 320, 377]],
    [[0, 100, 350], [1, 0], [1, 3]],
    [[0, 440, 360], [0, 540, 260], [0, 500, 240]],
    [[0, 400, 260], [1, 0], [1, 2]],
    [[0, 380, 380], [1, 0], [1, 1]],
    [[0, 500, 380], [1, 0], [1, 2]],
    [[4, 1], [1, 2], [1, 0]]
]


var sequence = -1

// class Vertex_inPoly {
//     vertex: Vec2
//     edge: Edge2
//     flipOrientation = false  // to reuse edge objects. BSP wants to reuse them. Polygon might be confused going around its border.
//     public getEdge(): number[] {  // avoid the new ! Factories ?
//         return [] // flipped vertices
//     }
// }

// I need this data structure so that I can press down the face through the sieve that the BSP is.
class Polygon {    
    es: Edge2[]  // may be flipped, but
    vs: Vec2[]    // we have the vertices
}

const dic:Polygon[]=[]

// const parserDic: Vec2[][] = []  // same as ps, but pointers instead of idRef  
// // ( code.ts friendly MemoryAddresses instead of debugable Id )
// // sign of IdRef is used to mirror edges. How to do with pointers?
// const EdgeDic: Edge2[][] = []
// // class Pair {
// //     RefOr0: number
//     v: Vec2
// }
const add_poly_sequen = (event: Event): void => {
    if (sequence == -1 || sequence >= fileFormat.length) {
        sequence = 0;
        //     while (ps.length > 0) {
        //         ps.pop();
        //     }
    }

    // pse = sequence;
    let poly = fileFormat[sequence++];
    let vs_se: Vec2[] = [];
    let window: Vec2[] = [null]  // as in the window in LZW or register window in SPARC
    let es_se: Edge2[] = [];
    (poly.concat(poly[0])).forEach(vertex => {
        let RefOr0 = vertex[0]
        if (RefOr0 <= 0) {
            if (RefOr0 < 0) {
                const polygon = dic[sequence - 1 + RefOr0].vs;
                window.push( polygon[vertex[1]] )
            } else {
                window.push( new Vec2([vertex.slice(1)])) ;
            }
            // new vertex

            if (window != null) { // todo: local function for closure
                es_se.push(new Edge2(window))
            }
            //const v = new Vertex_OnScreen();
            //v.xy = 
            vs_se.push(window[1]);
            window.shift() // removes the first element. So last==0
            return

            //return v;
        } else {
            const resp_orient = Math.abs(vertex[1]);
            const polygon = dic[sequence - 1 - RefOr0].es;

            const edge = polygon[resp_orient] //,(resp_orient+1)%polygon.length]            
            if (window[0] != null) { // todo: local function for closure

                const e = vertex[1] < 0 ? [edge.vs[1], edge.vs[0]] : edge.vs
                window.push(...e)
                // I want all edges referenced explitcitely in order not to search ( and produce weird errors)
                // so two cases can happen. Either two consecutive edges already close the border == share a vertex, or I have a single gap. No new vertices needed, but an edge. Looks easier in code than in comment.
                if (window[0] != window[1]) { es_se.push(new Edge2(window.slice(0, 2))); vs_se.push(window[1]) }
                window.shift();
            }
            es_se.push(edge)
            window.shift();
            vs_se.push(window[0]);
            // so this is weird. What if I close a hole? What if it has 3 edges? So closure of the loop may not be necessary.            
        }
    });
};

//console.log("undeg",sequence-1-vertex[0],vertex[1],sequence,vertex)
// I duplicate the data. Polygon -> vertex    and Polygon -> edge-> vertex will both exist to let me formulate algorithms in the best ways.
// state is your enemy? No I don't think so, these refs will be const and ownership is clearly going over the edges and is not problem because I will purge the whole mesh every frame.
//         return [{ RefOr0: RefOr0, v: EdgeDic[sequence - 1 - vertex[0]][vertex[1]] }];  // re used vertices. This shortens and idRef chain. Short is important for edges. So I have to use pointers?
// }).flat();  // needs ES2019 in tsconfig.json

//let parser_vs = vs.slice(0) // Pixel shaders, z, backface cully all happen after the BSP and have to deal with the cards given to them! No : to be able to turn back faces to front without messing up the indices
// // // Constructor bad: let p = new Polygon_in_cameraSpace(parser_vs) // "rgb(" + cst + " / 20%)");
// parserDic.push(vs.map(pair => pair.v));

// // logically, edges happen after vertices. Just I try to keep the file human readable and the data structure cache friendly. So I hope to keep edge and vertex code in JRISC cache and pipeline the data as it comes.
// let edges = vs.map((pair, i_current) => {
//     if (pair.RefOr0 == 0) {
//         // new edge
//     } else {
//         let i_other = (i_current + 1) % vs.length
//         let vo = vs[i_other].v
//         EdgeDic.findIndex(poly => poly.findIndex((v, i_Dic) =>   // this is how it looks like if I don't want to introduce extra idRefs for edges
//             (pair.v == v.vs[0] && v.vs[1] == vo) ||
//             (pair.v == v.vs[1] && v.vs[0] == vo)  // Sooooo ugly
//         )); // Logic only needs to find any, but for debugging it would be nice to have an Id
//     }
// })  // all edges which use new vertices must be new  ( => )  .. later: find the others.

//     // // let vs = []
//     // // let	v = new Vertex_OnScreen(); v.xy = new Vec2([[40, 160]]); vs.push(v)
//     // // 	v = new Vertex_OnScreen(); v.xy = new Vec2([[240, 60]]); vs.push(v)
//     // // 	v = new Vertex_OnScreen(); v.xy = new Vec2([[160, 140]]); vs.push(v)
//     // let cst = "";
//     // for (let i = 0; i < 3; i++) cst += (Math.round((Math.random() * 200)) + 55).toFixed(0) + " "   //   toFixed(0) + " ";   // toString(16)
//     // p = new Polygon_in_cameraSpace(vs, "#" + cst + "2") // "rgb(" + cst + " / 20%)");
//     // ps.push(p);
//     // //let pse = 0
//     // //let p = ps[pse]
//     // p.selected = 0;
//     // selPoly();
// };



window.document.getElementById("sequence").addEventListener("click", add_poly_sequen)