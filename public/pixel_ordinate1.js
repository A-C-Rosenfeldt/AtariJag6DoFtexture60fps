export class Polygon_in_cameraSpace {
    constructor() {
        this.screen = [320, 200];
        this.half_screen = this.screen.map(s => s / 2);
    }
    pixOrd_common(gradient, b, on_the_border, position) {
        let chosen_gradient = gradient[1 ^ (b & 1)]; // int 
        //if (chosen_gradient!=0) throw new Error("averted a crash") //chosen_gradient=100 // probably some bug
        const compensate_along_border = chosen_gradient == 0 ? 0 : on_the_border / chosen_gradient;
        const pixel_ordinate = position - compensate_along_border; // compensate means minus
        let cond = ((b >> 1) & 1) ^ (gradient[b & 1] < 0 ? 1 : 0) ^ (gradient[1 ^ b & 1] < 0 ? 1 : 0);
        if ((b & 1) == 0)
            cond = 1;
        const pixel_ordinate_int = cond == 0 ? Math.floor(pixel_ordinate) : Math.ceil(pixel_ordinate);
        return pixel_ordinate_int;
    }
    pixel_ordinate1(verts, b, gradient, vs) {
        const v = verts.v;
        const position = vs[0].onScreen.position[1 ^ (b & 1)];
        //////////
        // 	return this.pix_ord1(v          , b        , gradient          , position);  }
        // private pix_ord1        (v: number[], b: number, gradient: number[], position: number) {
        const to_border_signed = v[b & 1];
        const on_the_border = to_border_signed * gradient[b & 1];
        return this.pixOrd_common(gradient, b, on_the_border, position);
    }
}
//# sourceMappingURL=pixel_ordinate1.js.map