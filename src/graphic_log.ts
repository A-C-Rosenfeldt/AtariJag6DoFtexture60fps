import { Edge_on_Screen, Vertex_OnScreen } from "./BSP.js";
import { Vec2 ,CanvasObject} from "./clipping.js";

const canvas:HTMLCanvasElement = document.getElementById("Canvas2d") as HTMLCanvasElement
CanvasObject.ctx = canvas.getContext("2d");

console.log("pre")
var vs=[new Vec2([[-10,0]]),new Vec2([[-10,0]])];
console.log("post");

var e=new Edge_on_Screen() // todo use vec<2> instead of tupel
e.vs=vs.map( s=>{let f=new Vertex_OnScreen();f.v=s.v;return f; } )

