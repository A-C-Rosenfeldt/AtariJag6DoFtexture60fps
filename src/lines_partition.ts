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

const p = (function initSample() {
	let v: Vertex_OnScreen
	// v.xy=new Vec2([[90,50]])
	// ctx.fillRect(100, 40, 3, 3);


	const vs = []
	v = new Vertex_OnScreen(); v.xy = new Vec2([[40, 160]]); vs.push(v)
	v = new Vertex_OnScreen(); v.xy = new Vec2([[240, 60]]); vs.push(v)
	v = new Vertex_OnScreen(); v.xy = new Vec2([[160, 140]]); vs.push(v)
	const p = new Polygon_in_cameraSpace(vs)
	return p
})()

function drawCanvasGame() {
	const canvas = document.getElementById("Canvas2d") as HTMLCanvasElement;
	canvas.style.background = '#111'; // Set background color
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
		t.insertPolygon(p)
		t.toCanvas(ctx)

		p.toCanvas(ctx)
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

			default: return
		}


	},
	false,
);