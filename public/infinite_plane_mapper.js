/**
 * This is used to map (x,y) to (z(w),u,v)
 * Like the early engine that Looking Glass designed, it goes via (s,t) of two edges of a polygon
 */
import { Vec3, Vec } from "./clipping";
// component z=2 is the bias due to how the view vector is [x,y,1]
import { Matrix } from "./clipping";
export class CV {
}
export class Camera_in_stSpace {
    constructor() {
        this.pg = [[1, 0], [0, 1]]; // can load uv mapping into this: z needs to be generated
    }
    /*
    Here is the proof. I want it to be inline of the code to be available. At least in short form. We try to avoid the notion of matrix inversion because I want wide flow, not a long cascade

    S,T are vectors spanning the plane around its orgin (yeah, not so plane like, but surely a texture and even z needs an origin) O   ( O is a point )
    C is the Camera position at 0,0,0 . After transformation it will be elsewhere. So it got a name: C
    V is the view vector. It's transformation needs to follow homogenous coordinates to be understood by the rasterizer
    */
    transform_into_texture_space_ctr(S, T) {
        this.z = [S.v[2], T.v[2]]; // not affected by clipping. No flipping around of chosen vertex with adjacent edgesr to invert
        let n = S.crossProduct(T);
        this.normal = n.scalarProduct(1 / n.innerProduct(n)); // uh I need special scalar Product to avoid typeCast ??!
        let coupling = S.innerProduct(T); // symmetric
        let ST = [[S, T], [T, S]]; // pointer even in JS ( and Java, and C#, and please in JRISC -- or loop unroll)
        this.only = ST.map(st => st[0].subtract(st[1].scalarProduct(coupling / st[1].innerProduct(st[1]))));
        for (let i = 0; i < this.only.length; i++) {
            let effect_of_1st = this.only[i].innerProduct(ST[i][0]);
            if (Math.abs(effect_of_1st) > 0.001)
                this.only[i] = this.only[i].scalarProduct(1 / effect_of_1st);
        }
    }
    generate_payload(C, V) {
        let factor_on_the_right = this.infinte_checkerBoard(C, V);
        // First occurence of matrix mul. Not sure about interface. Clearly I need this for rotation (frame to frame), and generally transformation (within frame)
        let pl = ([this.z].concat(this.pg).map(p => p.reduce((s, c, i) => s + c * factor_on_the_right[i]))); // need a way to transform this into gradients for rasterizer
        return pl;
    }
    generate_payload_m(C) {
        let cv = this.infinte_checkerBoard_m(C);
        // First occurence of matrix mul. Not sure about interface. Clearly I need this for rotation (frame to frame), and generally transformation (within frame)
        let mesh = new Matrix();
        // the first row is the w component of homogenouc coordinates. It feeds the 1/ve[2] through
        mesh.nominator = [new Vec3([[0, 0, 1]])].concat(this.pg.map(p => new Vec3([p])));
        let cv_p = new CV;
        cv_p.cameraPosition = Matrix.mul([mesh.nominator, cv.cameraPosition.nominator]);
        cv_p.viewVector = Matrix.mul([mesh.nominator, cv.viewVector.nominator]);
        return cv_p;
    }
    infinte_checkerBoard(C, V) {
        let c = this.transform_into_texture_space(C); // pos point of camera
        let v = this.transform_into_texture_space(V); // view vector  ( many vectors for one camera ? )
        let tau = c[2] / v[2]; // todo: use law of ascocitaten to change order of matrix mul and div
        let texel = [0, 0];
        for (let st = 0; st < 2; st++) {
            texel[st] = c[st] + tau * v[st];
        }
        return texel;
    }
    infinte_checkerBoard_m(C) {
        let cv = new CV;
        cv.cameraPosition.nominator[0] = new Vec([this.transform_into_texture_space(C)]); // pos point of camera
        cv.viewVector = this.transform_into_texture_space_m(); // view vector  ( many vectors for one camera ? )
        //let tau=c[2]  /v[2]     // todo: use law of ascocitaten to change order of matrix mul and div
        for (let st = 0; st < 2; st++) {
            // cameraPostion just stays	texel[st]=c[st]		 
            cv.viewVector.nominator[st] = cv.viewVector.nominator[st].scalarProduct(cv.cameraPosition.nominator[0][2]); // // +  tau * v[st]     
            // v[2] is left as "w"" to defer the division
            // but why does payload want to multiply with the z components of s and t?
        }
        return cv; // v[2] is 1/z aka w   c[2] needs to be multiplied with v
    }
    transform_into_texture_space(v) {
        let v3 = new Vec3([v]);
        let coords = [0, 0, 0];
        coords[2] = this.normal.innerProduct(v3);
        for (let st = 0; st < 2; st++) {
            coords[st] = this.only[st].innerProduct(v3);
        }
        return coords;
    }
    transform_into_texture_space_m() {
        let m = new Matrix();
        m.nominator = [...this.only, this.normal];
        return m;
    }
    // Camera below surface?
    backface_culling() {
    }
}
export class Mapper {
    putpixel(coords, fragment) {
        const pixel = new Uint8Array(4); // 2+4+4 = 10
        pixel[0] = 0; //[0, 0, 255, 255];  // opaque blue
        pixel[1] = 0;
        pixel[2] = 255;
        pixel[3] = 255;
    }
    affine() {
        // Span.render();
    }
    span() {
        // Maybe start with "The hidden below": Do end points exaclty and then span. Then add Quake subspans?
    }
    constZ() {
        // this would need calculations above this for the horizon
        // also check if Jaguar can really draw diagonals.
        // to minimize splits, they better are only introduced when needed. For example tiles (2d vectors and decals) need splits anyway. Decals (examples: 5* , hexagon) need a beam tree
        // so we have the real const z which governs split (2^n spans). The approx const z ( horiztontal, vertical, diagonal ) for the blitter
        // even if diagonal does not work, the other two are more important anyway
    }
}
//# sourceMappingURL=infinite_plane_mapper.js.map