import "./clipping.js";
import { Camera, Mesh } from "./Transform.js";
import { Polygon_in_cameraSpace, Vertex_in_cameraSpace } from "./rasterizer.js";
import { Mapper } from "./infinite_plane_mapper.js";
let controller = new Camera();
let mesh = new Mesh();
let mapper = new Mapper(); // Loads assets (names are just one hop away). So Better invert control! Load it here in the start-up script and inject into the business logic (infinite plane). OOP would make the plane logic hide this because no one else here deals with bitmaps when this runs in production. But here we need to see the bitmap to debug the rasterizer.
let p = new Polygon_in_cameraSpace(mapper);
mesh.transform(controller); //.polygon
// Todo: Test assert that transform is not 000
p.project(mesh.transformed.map(cs => new Vertex_in_cameraSpace(cs.v))); // Interleave 3d and projected vertices for debugging and easy loops when back tracking. I guess that for debugging a reference at both places helps
document.addEventListener("keydown", //  repeats liek keypressed
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
            controller.position.add(controller.rotation.nominator[2], 1);
            break;
        case "s":
            controller.position.add(controller.rotation.nominator[2], -1);
            break;
        case "d":
            controller.position.add(controller.rotation.nominator[0], 1);
            break;
        case "a":
            controller.position.add(controller.rotation.nominator[0], -1);
            break;
    }
    // if (event.ctrlKey) {
    //   // Even though event.key is not 'Control' (e.g., 'a' is pressed),
    //   // event.ctrlKey may be true if Ctrl key is pressed at the same time.
    //   alert(`Combination of ctrlKey + ${keyName}`);
    // } else {
    //   alert(`Key pressed ${keyName}`);
    // }
}, false);
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
//# sourceMappingURL=game.js.map