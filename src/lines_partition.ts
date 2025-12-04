window.document.getElementById("forward").addEventListener("click",
  (event) => {

  }
)

function drawCanvasGame(){
		const canvas = document.getElementById("Canvas2d") as HTMLCanvasElement;
		canvas.style.background = '#111'; // Set background color
		const ctx = canvas.getContext("2d");
		if (ctx) {
ctx.strokeStyle='lightblue'
ctx.beginPath(); // Start a new path
ctx.moveTo(30, 50); // Move the pen to (30, 50)
ctx.lineTo(150, 100); // Draw a line to (150, 100)
ctx.stroke(); // Render the path

	ctx.fillStyle = "red";
ctx.fillRect(100,40, 3, 3);
			
		}
	}

drawCanvasGame()