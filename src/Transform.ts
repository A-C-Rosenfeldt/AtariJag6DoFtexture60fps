import { Matrix, Matrix_Rotation, Vec3 } from "./clipping";

export class Camera {
  sine=[Math.cos(0.1),Math.sin(0.1)]
  position = new Vec3([[0, 0, -5]]); // input device => position
  rotation = new Matrix_Rotation(); // this is actually the rotation of the scene, not the camera. It is the transpose.
  constructor() {
    // I did not need unity matrix elsewhere. IF that happens: move to clipping.ts
    let nos = [0, 0, 1]; // Matlab equivalent: eye(3)
    for (let i = 2; i >= 0; i--) {
      this.rotation.nominator[i] = new Vec3([nos]); // Vec3 has a copy-constructor
      nos.shift();
      nos.concat(0);
    }



  }
}
// game.ts right now creates the test data for the rasterizer
// In the future I may need to rename this to transfomer ?
// Mesh and camere kinda use the same math. I even decided on a specific implementation : Matrix over quaternions
export class Mesh {
  polygon=[new Vec3([[1,0,0]]),new Vec3([[-1,0,0]]),new Vec3([[0,2,0]])]
  transformed: Vec3[];

  transform(c:Camera) {
    this.transformed= this.polygon.map((v) => {
      return  c.rotation.MUL_left_transposed( v.subtract(c.position)  )as Vec3
    });
}
}