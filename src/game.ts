import "clippling"
import { Camera, Mesh } from "./Transform"

let controller=new Camera()
let mesh=new Mesh()

document.addEventListener(
  "keydown",  //  repeats liek keypressed
  (event) => {
    const keyName = event.key;

    // if (keyName === "Control") {
    //   // do not alert when only Control key is pressed.
    //   return;
    // }


    switch (keyName) {
      case "Left":
      controller.rotation.Rotate_along_axis_Orthonormalize(1, controller.sine);
      break;
      case "Right":
      controller.rotation.Rotate_along_axis_Orthonormalize(1, [controller.sine[0], -controller.sine[1]]);
      break;
      case "up":
      controller.rotation.Rotate_along_axis_Orthonormalize(0, controller.sine);
      break;
      case "down":
      controller.rotation.Rotate_along_axis_Orthonormalize(0, [controller.sine[0], -controller.sine[1]]);
      break;      
      case "w":
      controller.position.subtract(controller.rotation.nominator[2]);
      break;
      case "s":
      controller.position.subtract(controller.rotation.nominator[2].scalarProduct(-1));
      break
    }

    // if (event.ctrlKey) {
    //   // Even though event.key is not 'Control' (e.g., 'a' is pressed),
    //   // event.ctrlKey may be true if Ctrl key is pressed at the same time.
    //   alert(`Combination of ctrlKey + ${keyName}`);
    // } else {
    //   alert(`Key pressed ${keyName}`);
    // }
  },
  false,
);

// document.addEventListener(
//   "keyup",
//   (event) => {
//     const keyName = event.key;

//     // As the user releases the Ctrl key, the key is no longer active,
//     // so event.ctrlKey is false.
//     if (keyName === "Control") {
//       alert("Control key was released");
//     }
//   },
//   false,
// );

