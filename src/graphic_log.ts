import { Vec2 ,CanvasObject} from "./clipping.js";

const canvas:HTMLCanvasElement = document.getElementById("Canvas2d") as HTMLCanvasElement
CanvasObject.ctx = canvas.getContext("2d");

console.log("pre")
var t=new Vec2([[0,0]]);
console.log("post");