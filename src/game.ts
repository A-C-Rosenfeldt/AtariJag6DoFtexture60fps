import "./clipping.js"
import { Camera, Mesh } from "./Transform.js"
import { Polygon_in_cameraSpace } from "./rasterizer.js";
import { Vertex_in_cameraSpace } from './Item.js';
import { Mapper } from "./infinite_plane_mapper.js";

let controller = new Camera()
let mesh = new Mesh()
let mapper = new Mapper() // Loads assets (names are just one hop away). So Better invert control! Load it here in the start-up script and inject into the business logic (infinite plane). OOP would make the plane logic hide this because no one else here deals with bitmaps when this runs in production. But here we need to see the bitmap to debug the rasterizer.
let p = new Polygon_in_cameraSpace(mapper)
p.dbuggy=document.getElementById("cameraHover")
mesh.transform(controller) //.polygon

// Todo: Test assert that transform is not 000

p.project(mesh.transformed.map(cs => new Vertex_in_cameraSpace(cs.v)))  // Interleave 3d and projected vertices for debugging and easy loops when back tracking. I guess that for debugging a reference at both places helps

document.getElementById("forward").addEventListener("click",
  (event) => {
    idle_animation_stopped = true
    controller.position.add(controller.rotation.nominator[2], 0.1)
    mesh.transform(controller)
    p.project(mesh.transformed.map(cs => new Vertex_in_cameraSpace(cs.v)))    
  }
)

var t = document.getElementById("nick");
t.addEventListener("click",
  (event) => {
    idle_animation_stopped = true
    controller.rotation.Rotate_along_axis_Orthonormalize(0, controller.sine)
    mesh.transform(controller)
    p.project(mesh.transformed.map(cs => new Vertex_in_cameraSpace(cs.v)))    
  }
)
t.removeAttribute("disabled")

var t = document.getElementById("up");
t.addEventListener("click",
  (event) => {
    controller.rotation.Rotate_along_axis_Orthonormalize(0, [controller.sine[0], -controller.sine[1]]);
    boilerplate();    
  }
)
t.removeAttribute("disabled")

var t = document.getElementById("roll");
t.addEventListener("click",
  (event) => {
      controller.rotation.Rotate_along_axis_Orthonormalize(2, [controller.sine[0], -controller.sine[1]]);
    boilerplate();    
  }
)
t.removeAttribute("disabled")

var t = document.getElementById("roll_l");
t.addEventListener("click",
  (event) => {
    controller.rotation.Rotate_along_axis_Orthonormalize(2, controller.sine);
    boilerplate();    
  }
)
t.removeAttribute("disabled")


var t = document.getElementById("triangle");
t.addEventListener("click",
  (event) => {
    mesh.rotate()
    boilerplate();    
  }
)
t.removeAttribute("disabled")




var t = document.getElementById("counter");
t.addEventListener("click",
  (event) => {
    controller.rotation.Rotate_along_axis_Orthonormalize(1, controller.sine);
    boilerplate();    
  }
)
t.removeAttribute("disabled")


var t = document.getElementById("back");
t.addEventListener("click",
  (event) => {
    controller.position.add(controller.rotation.nominator[2], -0.1);
    boilerplate();    
  }
)
t.removeAttribute("disabled")

var t = document.getElementById("left");
t.addEventListener("click",
  (event) => {
    controller.position.add(controller.rotation.nominator[0], -0.1);
    boilerplate();    
  }
)
t.removeAttribute("disabled")

var t = document.getElementById("right");
t.addEventListener("click",
  (event) => {
    controller.position.add(controller.rotation.nominator[0], 0.1);
    boilerplate();    
  }
)
t.removeAttribute("disabled")

var t = document.getElementById("rise");
t.addEventListener("click",
  (event) => {
    controller.position.add(controller.rotation.nominator[1], -0.1);
    boilerplate();    
  }
)
t.removeAttribute("disabled")

var t = document.getElementById("fall");
t.addEventListener("click",
  (event) => {
    controller.position.add(controller.rotation.nominator[1], 0.1);
    boilerplate();    
  }
)
t.removeAttribute("disabled")


t.removeAttribute("disabled")

var t = document.getElementById("clock");
t.addEventListener("click",
  (event) => {
    controller.rotation.Rotate_along_axis_Orthonormalize(1, [controller.sine[0], -controller.sine[1]]);
    boilerplate();    
  }
)
t.removeAttribute("disabled")



var t = document.getElementById("enlarge");
t.addEventListener("click",
  (event) => {
    mesh.scale(1.1)
    boilerplate();    
  }
)
t.removeAttribute("disabled")

var t = document.getElementById("shrink");
t.addEventListener("click",
  (event) => {
    mesh.scale(1/1.1)
    boilerplate();    
  }
)
t.removeAttribute("disabled")


document.addEventListener("click",
  (event) => {
    idle_animation_stopped = true
  }
)

document.addEventListener(
  "keydown",  //  repeats liek keypressed
  (event) => {
    const keyName = event.key;
    idle_animation_stopped = true  // animation should be rotatio probably?
    // if (keyName === "Control") {
    //   // do not alert when only Control key is pressed.
    //   return;
    // }

    if (keyName.startsWith("Arrow")) {
      const tail = keyName.substring(5)
      switch (tail) {
        case "Left":
          controller.rotation.Rotate_along_axis_Orthonormalize(1, controller.sine);
          break;
        case "Right":
          controller.rotation.Rotate_along_axis_Orthonormalize(1, [controller.sine[0], -controller.sine[1]]);
          break;
        case "Down":
          controller.rotation.Rotate_along_axis_Orthonormalize(0, [controller.sine[0], -controller.sine[1]]);
          
          break;
        case "Up":
          controller.rotation.Rotate_along_axis_Orthonormalize(0, controller.sine);
          break;
        default: return
      }

      event.preventDefault(); // Prevent the default action to avoid scrolling when pressing arrow keys

      mesh.transform(controller)
      p.project(mesh.transformed.map(cs => new Vertex_in_cameraSpace(cs.v)))
      return;
    }

    var factor=1.1
    switch (keyName) {

      case "w":
        controller.position.add(controller.rotation.nominator[2], 0.1);
        break;
      case "s":
        controller.position.add(controller.rotation.nominator[2], -0.1);
        break
      case "d":
        controller.position.add(controller.rotation.nominator[0], 0.1);
        break;
      case "a":
        controller.position.add(controller.rotation.nominator[0], -0.1);
        break;
      case "f":
        controller.position.add(controller.rotation.nominator[1], 0.1);
        break;
      case "r":
        controller.position.add(controller.rotation.nominator[1], -0.1);
        break;        
      case ",":
        controller.rotation.Rotate_along_axis_Orthonormalize(2, controller.sine);
        break;
      case ".":
        controller.rotation.Rotate_along_axis_Orthonormalize(2, [controller.sine[0], -controller.sine[1]]);
        break;

      case "-":
        factor = 1 / factor
      case "+":
        mesh.scale(factor);
        break;                
        case "t":
          mesh.rotate()
          break;
      default: return
    }

    mesh.transform(controller)
    p.project(mesh.transformed.map(cs => new Vertex_in_cameraSpace(cs.v)))

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

var idle_animation_stopped = false
if (false)
{const idle_animation = window.setInterval(() => {
  if (idle_animation_stopped) { window.clearInterval(idle_animation) }
  else {
     controller.position.add(controller.rotation.nominator[2], 0.1);

         mesh.transform(controller)
    p.project(mesh.transformed.map(cs => new Vertex_in_cameraSpace(cs.v)))

   }
}, 200)}





function boilerplate() {
  idle_animation_stopped = true;
  mesh.transform(controller);
  p.project(mesh.transformed.map(cs => new Vertex_in_cameraSpace(cs.v)));
}
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

