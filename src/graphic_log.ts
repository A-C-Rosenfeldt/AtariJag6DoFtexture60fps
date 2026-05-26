// import { Edge_on_Screen, Vertex_OnScreen } from "./BSP.js";
import { Vec2 ,CanvasObject, Edge2} from "./clipping.js";

const canvas:HTMLCanvasElement = document.getElementById("Canvas2d") as HTMLCanvasElement
CanvasObject.ctx = canvas.getContext("2d");

console.log("pre")
var vs=[new Vec2([[-10,0]]),new Vec2([[+10,0]])];
console.log("post");

// Todo: Constructor draws. So please actually construct an object
var e=new Edge2(vs) // todo use vec<2> instead of tupel
//var t=vs.map( s=>{let f=new Vertex_OnScreen();f.v=s.v;return f; } ) // Todo: Can't create new objects because they would draw => Need a bare Edge ?

//e.vs=[t[0],t[1]]  ;

