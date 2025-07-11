class a_i{
	accumulator = 0
	increment = [0, 0]
	projected=0
	propagate_along(direction: boolean) { // Bresenham gives bool: Direction from last to get back on track
		this.accumulator+=this.increment[direction?1:0]
	}	
}

export class EdgeShader {
	zst:Array<a_i>=new a_i[3]

	constructor() {  // @ vertex2d

	}
	propagate_along(direction: boolean) { // Bresenham gives bool: Direction from last to get back on track
		this.zst.forEach(s=>s.propagate_along)
	}
	perspective() {
		let w=this.zst[0].accumulator
		if (w==0) return
		let z = 1 /w     // perspective correction  // Attention: JRISC bug: use register "left" before next division instruction!
		for (let st = 1; st < 2; st++) {
			this.zst[st].projected = this.zst[st].accumulator*z
		}
	}
}

export class PixelShader{
	es:Array<EdgeShader> =EdgeShader[2]

	span(x:number,d,y) { 

		if (d==1){

		}
		this.es.map(e=>{
			e.perspective(x + (d-1))  // Perspective is calculated within  aka closed interval
			return (s,t)
		})

		if (span_within) blitter_slope[1 + uv] = d;
			else blitter_slope[1 + uv] = d / span_within; // linear interpolation. Quake bloats the code for small values. I have some JRISC ideas in the project: scan for first bit. shift one more. Zero flag? then apply shift to argument. Else: div
			

				//xo = x
		// As in Doom on Jaguar, we do the full persepective calculation for the first and last pixel ( for walls and floors this is perfect, inbetween: some warp . Todo: check diagonals)
		// then the Jaguar blitter interpolates linearly. Quake and Descent use subspans on large polygons. Code is straight forward. Add later.
		for (; x < integer[1]; x++) { // the blitter does this. Todo: move this code ... . But what about perspective correction? Also not in this source file!
			m.putpixel([x, y], fragment)
			blitter_slope.forEach((p, i) => { fragment[i] += p[1] })  // x-gradient = slope ( different name for 1-dimensional aka scalar case )
		}
	
		/*
		Use other register bank, so it does not hurt that we need to keep 2*2 increments around
		MVFA 04,01
		NOP
		ADD  01,02
		// interleave

		div w,05   // I could interleave w and x. w is pixel shader, x is rasterizer. Not clean

		MVFA 04,01
		MVFA 14,11
		ADD  01,02    s
		ADD  11,12    t
		mv   02,03      // I hate JRISC for this
		mv   12,13              
		mul  05,03
		mul  15,13
		*/

		/* With Bresenham it is actually . So it looks similar. But I need to separate it here in code. Even in production a glitch in texture looks totally different from a glitch in the edge. So it does not even interleave cleanly? I may bloat code? I would be fast in hardware, but this is software!
		Edges
		MVFA 04,01
		--MVFA 14,11
		ADD  01,02
		--ADD  11,12
		branch on negative
		-- no idaa what to do in the slot
		*/

		//for
		let s=0
		return
	};

	constructor(){
	// Todo : harmonize
			let payload_w = []//Payload.nominator.map( v3=> [v3.v[2],v3.v[0],v3.v[1] ]) 
			// bias
			payload_w[0][0] = Payload.nominator[0][2]  // multiply with [2]=1 compontent of view vector gives us the const coeeficient [][0] for the linerar function. Here: denominaotr [0][]
			payload_w[1][0] = Payload.nominator[1][2]  // same for nominator of s
			payload_w[2][0] = Payload.nominator[1][2]  // and t

			// gradient
			payload_w[0][1] = Payload.nominator[0][0]  // gradient of denominator along a span ( x ) . Yeah, I probably should reconsider the numbering or transform a matrix or so
			payload_w[0][2] = Payload.nominator[0][1]  // gradient of denominator along the edges ( y ) 

			// same for the s,t gradients
			// the nominator gradient for z is [0,0] . Failed proof in "infintie plane", but hand wave is easy: Imagine an Amiga copper sky. Color marks z. Fog is far away, dark blue sky is close, as is red-brown ground.
			// All const-z lines are aligned to the horizon. Perspective is like this: lines become lines. As known from the checkerboard: the const-z lines are all parallel to each other after projection
			// So we only need one gradient to know z . After that a scaler function follows (1/z), but z-buffer works without application of this function
			// => perfect z sorting even in case of linear interpolation between 1/z points. We need this on Jaguar ( N64 may have a real z-buffer)
			// I read that in OpenGL a big use of the 4x4 Matrices is to combine multiple transformations
			// I don't do this. First I substract the camera position using 32bit SUB
			// Then I multiply the rotate and aspectRatio Matrix, which are just 3x3
			// the product is then multiplied with vertices 
			// Perhaps with guard space I will drop the aspectRatio Matrix


			// the const bias to go from texture oriented w to indpendent z is generated by the factor new Vec3( [this.z]
			// Assert that gradients are really epsilon.

			//payload_w[0]+=Payload.viewVector.nominator[0][2] // 0 goes to the left and marks 1/z aka w in payload (xy not there, uv behind). 2 goes to the right and accepts z from xyz viewing vector. z=1 
			// skew onto the pixel coordinates which don't have int[] in the center of the screen (center is between pixels). I calculate the bias for top-left , still in NDC , so  [-1,-1].
			payload_w[0][0] -= Payload.nominator[0][1]  // same for nominator of s
			payload_w[0][0] -= Payload.nominator[0][2]

			//let payload=[payload_w]  // Payload is given to use only with UV offsets (for perspective). Affine Gouraud probably needs its own code path with triangles?

			let fragment = [].fill(0, 0, payload_w.length) // malloc (reg)
			let fralment = [].fill(0, 0, payload_w.length) // malloc (reg)
			

			// premature optimizationlet ny = Math.min(...active_vertices.map(a => vertex[a[1]][1])), xo: number, anchor = false
			// premature optimization (blows up code size, may not even be faster in JRISC ) for (; y < ny; y++) {  // floating point trick to get from NDC to pixel cooridinates. 256x256px tech demo. Square pixels. Since I don't round, any factor is possible. Easy one is 256  * 5/4-> 320  .. 256 * 3/4 = 192				
			let integer = slope_accu_c.map(sa => sa[1])
			/*
			Don't catter to fuzzy beam tree edges too much! The idea of the beam tree is that still linear edges dominate!				
				a.sort() // Until I debug my sign errors
				let integer = a   // Bresenham     if (mode_slope=="fixed") a.map(a_if => Math.floor(a_if))  // Should be cheap in JRISC despite the wild look in TypeScript
				let x = integer[0]; if (x < integer[1]) {  // dragged out of the for loop. Not an actual additional jump in JRISC
					// linear interpolation
					// this is  an experiment. Gradients ADD or ADC on 32 bit should work great in JRISC, right?
					// When debugged: precalc the gradient in the coordinate system spanne dup by slope floor and ceiling!
					// Though this primitve approach woudl even work if I use and active-edge (on multiple sectors of a beamtree)
					if (anchor) {  // This makes no sense. Even if occlusion happens, most edges will be straigth. That's why we calculation a slope. So let's calculate a slopw for payload.
						let dx = x - xo
						switch (dx) {
							case -1: payload_w.forEach((p, i) => { fragment[i] += p[2] - p[1] }); break
							case +1: payload_w.forEach((p, i) => { fragment[i] += p[2] + p[1] }); break
							case 0: payload_w.forEach((p, i) => { fragment[i] += p[2] }); break   // this will speed up all edges clipped at the screen borders
							default: anchor = false
						}
					}
					if (!anchor) {  // too fat for inner loop, but where do I put this?
						anchor = true, xo = x
						// 16.16 internals: let fraction=a[0] % 1 // sub-pixel correction for z and Gouraud or the texture to fight PS1 wobble
						fralment = payload_w.map((p,i) => p[0] + p[1] * a[i] + p[2] * y)   // IMAC is fast in JRISC
					}
					fragment = fralment // would feel weird to use the fragemt from the other side to "carriage return" like a typeWriter
					*/

			// I should fully commit to bresenham at the top of this loop. This is not readable.
			let blitter_slope = payload_w.map(p => p[1])		
	}

}