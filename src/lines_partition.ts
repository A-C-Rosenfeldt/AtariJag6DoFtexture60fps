import {BSPtree, Polygon_in_cameraSpace, Vertex_OnScreen} from "./BSP.js"
import { Vec2 } from "./clipping.js";

window.document.getElementById("forward").addEventListener("click",
	(event) => {

	}
)



function drawCanvasGame() {
	const canvas = document.getElementById("Canvas2d") as HTMLCanvasElement;
	canvas.style.background = '#111'; // Set background color
	const ctx = canvas.getContext("2d");
	if (ctx) {
		ctx.strokeStyle = 'lightblue'
		// ctx.beginPath(); // Start a new path
		// ctx.moveTo(30, 50); // Move the pen to (30, 50)
		// ctx.lineTo(150, 100); // Draw a line to (150, 100)
		// ctx.stroke(); // Render the path

		// ctx.fillStyle = "red";
		// ctx.fillRect(100, 40, 3, 3);

		// ctx.fillStyle = "#911";
		let v:Vertex_OnScreen
		// v.xy=new Vec2([[90,50]])
		// ctx.fillRect(100, 40, 3, 3);

		
		const vs=[]
		v=new Vertex_OnScreen();v.xy=new Vec2([[20,80]]);vs.push(v)
		v=new Vertex_OnScreen();v.xy=new Vec2([[120,30]]);vs.push(v)
		v=new Vertex_OnScreen();v.xy=new Vec2([[80,70]]);vs.push(v)
		const p=new Polygon_in_cameraSpace(vs)
		p.toCanvas(ctx)
		const t=new BSPtree()
		t.insertPolygon(p)
		t.toCanvas(ctx)
	}
}

drawCanvasGame()