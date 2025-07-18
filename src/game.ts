import "clippling"
import { Matrix, Vec3 } from "./clipping"

class Controller{
	camera=new Matrix(3) // input device => position 
	constructor(){
		// I did not need unity matrix elsewhere. IF that happens: move to clipping.ts
		let nos=[0,0,1]
		for(let i=2;i>=0;i--){
			this.camera.nominator[i]=new Vec3([nos]) // Vec3 has a copy-constructor
			nos.shift()
			nos.concat(0)
		}



	}
}

let controller=new Controller()

document.addEventListener(
  "keydown",  //  repeats liek keypressed
  (event) => {
    const keyName = event.key;

    if (keyName === "Control") {
      // do not alert when only Control key is pressed.
      return;
    }

    if (event.ctrlKey) {
      // Even though event.key is not 'Control' (e.g., 'a' is pressed),
      // event.ctrlKey may be true if Ctrl key is pressed at the same time.
      alert(`Combination of ctrlKey + ${keyName}`);
    } else {
      alert(`Key pressed ${keyName}`);
    }
  },
  false,
);

document.addEventListener(
  "keyup",
  (event) => {
    const keyName = event.key;

    // As the user releases the Ctrl key, the key is no longer active,
    // so event.ctrlKey is false.
    if (keyName === "Control") {
      alert("Control key was released");
    }
  },
  false,
);

