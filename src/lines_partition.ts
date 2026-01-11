import { BSPtree, Polygon_in_cameraSpace, Vertex_OnScreen } from "./BSP.js"
import { Vec2 } from "./clipping.js";

window.document.getElementById("forward").addEventListener("click",
	(event) => {
		p.selected++
		drawCanvasGame()
	}
)

window.document.getElementById("backward").addEventListener("click",
	(event) => {
		p.selected--
		if (p.selected < 0) p.selected = p.vertices.length - 1
		drawCanvasGame()
	}
)

window.document.getElementById("p0").addEventListener("click",
	(event) => {
		if (sequence >= 0) pse--; else pse = 0;
		selPoly();
	}
)

window.document.getElementById("p1").addEventListener("click",
	(event) => {
		pse = 1
		selPoly();
	}
)
window.document.getElementById("p2").addEventListener("click",
	(event) => {
		if (sequence >= 0) pse++; else pse = 2;
		selPoly();
	}
)

// Indices: [0=self=none. 1 = previous => [vertex on poly] , implicit the whole edge], >1 single vertex to let me choose orientation
const fileFormat = [
	[[0, 160, 140], [0, 240, 60], [0, 40, 160]],
	[[0, 6, 260], [1,0 ], [1, 2]],
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
const parserDic:Vertex_OnScreen[][]=[]  // same as ps
const add_poly_sequen = (event: Event): void => {
	if (sequence == -1 || sequence >= fileFormat.length) {
		sequence = 0;
		while (ps.length > 0) {
			ps.pop();
		}
	}
	
	pse = sequence;
	let poly = fileFormat[sequence++];
	let vs = poly.map(vertex => {
		if (vertex[0] == 0) {
			const v = new Vertex_OnScreen();
			v.xy = new Vec2([vertex.slice(1)]);
			return v;
		}
		//console.log("undeg",sequence-1-vertex[0],vertex[1],sequence,vertex)
		return parserDic[sequence - 1 - vertex[0]][vertex[1]];
	});
	let parser_vs=vs.slice(0) // to be able to turn back faces to front without messing up the indices
	// Constructor bad: let p = new Polygon_in_cameraSpace(parser_vs) // "rgb(" + cst + " / 20%)");
	parserDic.push(parser_vs);	
	// let vs = []
	// let	v = new Vertex_OnScreen(); v.xy = new Vec2([[40, 160]]); vs.push(v)
	// 	v = new Vertex_OnScreen(); v.xy = new Vec2([[240, 60]]); vs.push(v)
	// 	v = new Vertex_OnScreen(); v.xy = new Vec2([[160, 140]]); vs.push(v)
	let cst = "";
	for (let i = 0; i < 3; i++) cst += (Math.round((Math.random() * 200))+55).toFixed(0) + " "   //   toFixed(0) + " ";   // toString(16)
	p = new Polygon_in_cameraSpace(vs, "#" + cst + "2") // "rgb(" + cst + " / 20%)");
	ps.push(p);
	//let pse = 0
	//let p = ps[pse]
	p.selected = 0;
	selPoly();
};
window.document.getElementById("sequence").addEventListener("click", add_poly_sequen)

window.document.getElementById("up").addEventListener("click", touch_button(0, -1))
window.document.getElementById("down").addEventListener("click", touch_button(0, +1))
window.document.getElementById("left").addEventListener("click", touch_button(-1, 0))
window.document.getElementById("right").addEventListener("click", touch_button(+1, 0))

function touch_button(a: number, b: number) {
	return (event) => {
		if ((p.selected >= 0)) {
			p.vertices[p.selected].xy.add(new Vec2([[a, b]]))
		}
		drawCanvasGame()
	}
}

const ps = (function initSample() {
	let v: Vertex_OnScreen
	// v.xy=new Vec2([[90,50]])
	// ctx.fillRect(100, 40, 3, 3);


	let vs = []
	v = new Vertex_OnScreen(); v.xy = new Vec2([[40, 160]]); vs.push(v)
	v = new Vertex_OnScreen(); v.xy = new Vec2([[240, 60]]); vs.push(v)
	v = new Vertex_OnScreen(); v.xy = new Vec2([[160, 140]]); vs.push(v)
	const p = new Polygon_in_cameraSpace(vs)
	vs = []
	v = new Vertex_OnScreen(); v.xy = new Vec2([[140, 265]]); vs.push(v)
	v = new Vertex_OnScreen(); v.xy = new Vec2([[340, 125]]); vs.push(v)
	v = new Vertex_OnScreen(); v.xy = new Vec2([[340, 247]]); vs.push(v)
	v = new Vertex_OnScreen(); v.xy = new Vec2([[320, 377]]); vs.push(v)
	const q = new Polygon_in_cameraSpace(vs, "rgba(170, 0, 204, 0.16)")
	vs = []
	v = new Vertex_OnScreen(); v.xy = new Vec2([[440, 360]]); vs.push(v)
	v = new Vertex_OnScreen(); v.xy = new Vec2([[540, 260]]); vs.push(v)
	v = new Vertex_OnScreen(); v.xy = new Vec2([[500, 240]]); vs.push(v)
	const t = new Polygon_in_cameraSpace(vs, "rgba(173, 204, 0, 0.16)")
	return [p, q, t]
})()

let pse = 0
let p = ps[pse]
p.selected = 0

function drawCanvasGame() {
	const canvas = document.getElementById("Canvas2d") as HTMLCanvasElement;
	canvas.style.background = '#000'; // Set background color
	const ctx = canvas.getContext("2d");
	if (ctx) {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.strokeStyle = 'lightblue'
		// ctx.beginPath(); // Start a new path
		// ctx.moveTo(30, 50); // Move the pen to (30, 50)
		// ctx.lineTo(150, 100); // Draw a line to (150, 100)
		// ctx.stroke(); // Render the path

		// ctx.fillStyle = "red";
		// ctx.fillRect(100, 40, 3, 3);

		// ctx.fillStyle = "#911";

		const t = new BSPtree()
		ps.forEach(p => t.insertPolygon(p))
		t.toCanvas(ctx)

		ps.forEach(p => p.toCanvas(ctx))
	}
}

drawCanvasGame()


document.addEventListener(
	"keydown",  //  repeats liek keypressed
	(event) => {
		const keyName = event.key;


		if (keyName.startsWith("Arrow") && (p.selected >= 0)) {
			const tail = keyName.substring(5)
			const d = new Vec2([[0, 0]])
			const v = d.v
			switch (tail) {
				case "Left":
					v[0] = -1
					break;
				case "Right":
					v[0] = +1
					break;
				case "Down":
					v[1] = +1
					break;
				case "Up":
					v[1] = -1
					break;
				default: return
			}

			if (v[0] != 0 || v[1] != 0) {
				p.vertices[p.selected].xy.add(d)
				drawCanvasGame()
				event.preventDefault(); // Prevent the default action to avoid scrolling when pressing arrow keys
			}

			return;
		}

		var factor = 1.1
		switch (keyName) {

			case "-":
				p.selected--
				if (p.selected < 0) p.selected = p.vertices.length - 1
				drawCanvasGame()
				break;

			case "+":
				p.selected++
				drawCanvasGame()
				break
			case "0":
				pse = 0
				selPoly();
				break
			case "1":
				pse = 1
				selPoly();
				break
			case "2":
				pse = 2
				selPoly();
				break
			case "s":
				add_poly_sequen(event)
				break;
			case "z":
			case "t":

				let d = 0 //new Vec2([[0, 0]])
				//const v = d.v
				switch (keyName) {
					case "t":
						d = -1
						break;
					case "z":
						d = +1
						break;
					default: return
				}

				if (d != 0) {
					p.vertices[p.selected].z += (d)
					drawCanvasGame()
					event.preventDefault(); // Prevent the default action to avoid scrolling when pressing arrow keys
				}
				break;
			default: return
		}


	},
	false,
);

function selPoly() {
	p.selected = -1;
	if (pse < 0) pse = ps.length - 1
	if (pse >= ps.length) pse = 0
	p = ps[pse] //;console.log(pse)
	p.selected = 0;
	drawCanvasGame();
}
