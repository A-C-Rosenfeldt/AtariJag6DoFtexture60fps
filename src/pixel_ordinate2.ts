
export class Polygon_in_cameraSpace {
	screen = [320, 200];
	half_screen = this.screen.map(s => s / 2);

	private pixOrd_common(gradient: number[], b: number, on_the_border: number, position: number) {
		let chosen_gradient = gradient[1 ^ (b & 1)]; // int 

		//if (chosen_gradient!=0) throw new Error("averted a crash") //chosen_gradient=100 // probably some bug
		const compensate_along_border = chosen_gradient == 0 ? 0 : on_the_border / chosen_gradient
		const pixel_ordinate = position - compensate_along_border; // compensate means minus

		let cond = ((b >> 1) & 1) ^ (gradient[b & 1] < 0 ? 1 : 0) ^ (gradient[1 ^ b & 1] < 0 ? 1 : 0);
		if ((b & 1) == 0) cond = 1;
		const pixel_ordinate_int = cond == 0 ? Math.floor(pixel_ordinate) : Math.ceil(pixel_ordinate)
		return pixel_ordinate_int
	}

	pixel_ordinate2(b: number, gradient: number[]) {
		const to_border_signed = this.half_screen[b & 1] * ((b & 2) - 1); // from center (0,0) where bias. Same as other coordinate 

		//const gradient=[gradient[1],-gradient[0]]
		const gradient_build_up = to_border_signed * gradient[b & 1];
		const on_the_border = gradient_build_up + gradient[2]; // todo rename slop(2). Unify edge test with : get slope
		const position = 0
		return this.pixOrd_common(gradient, b, on_the_border, position);
	}	
}