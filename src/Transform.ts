import { Matrix, Matrix_Rotation, Vec3 } from "./clipping.js";

export class Camera {
  sine=[Math.cos(0.1),Math.sin(0.1)]
  position = new Vec3([[0, 0, -5]]); // input device => position
  rotation = new Matrix_Rotation(3); // this is actually the rotation of the scene, not the camera. It is the transpose.
  constructor() {
    // I did not need unity matrix elsewhere. IF that happens: move to clipping.ts
    let nos = [0, 0, 1]; // Matlab equivalent: eye(3)
    for (let i = 2; i >= 0; i--) {
      this.rotation.nominator[i] = new Vec3([nos]); // Vec3 has a copy-constructor
      nos.shift();
      nos=nos.concat(0);
    }



  }
}
// game.ts right now creates the test data for the rasterizer
// In the future I may need to rename this to transfomer ?
// Mesh and camere kinda use the same math. I even decided on a specific implementation : Matrix over quaternions
export class Mesh {
  rotate() {
    for (let i = 0; i < this.polygon.length; i++) { // In-place screams C-style for 
      const v = this.polygon[i];
      const copy=v.v.slice()
      const sin=[0.1, Math.sqrt(1-0.01)]
      let s=1
      for (let k = 1; k < 3;k++){ // x axis })v.v.length; k++) {
        v.v[k] =v.v[k]*sin[1]+sin[0]*copy[3-k]*(s);s=-s
      }
    }
  }
  private polygon = [new Vec3([[1, 0, 0]]), new Vec3([[-1, 0, 0]]), new Vec3([[-1, -2, 0]])];

  scale(factor: number) {
    for (let i = 0; i < this.polygon.length; i++) { // In-place screams C-style for 
      const v = this.polygon[i];
      for (let k = 0; k < v.v.length; k++) {
        v.v[k] *= factor;
      }
    }
  }

  transformed: Vec3[];

  transform(c:Camera) {
    this.transformed= this.polygon.map((v) => {
      const test=v.subtract(c.position);
      const rotated=c.rotation.mul_left_vec( test )  
      return  rotated as Vec3 ;  // cast should work
    });
}
}