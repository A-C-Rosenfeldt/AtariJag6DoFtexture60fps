import {  Matrix, Matrix_frac, Vec } from "clipping"
import {Gradient,Item } from "rasterizer"
import { Mapper } from "./infinite_plane_mapper"

// Define Gradient type (adjust as needed for your code)


class a_i{
	increment = [0, 0]	
	accumulator = 0
	projected=0
	propagate_along(direction: boolean) { // Bresenham gives bool: Direction from last to get back on track
		this.accumulator+=this.increment[direction?1:0]
	}	
}


export class EdgeShader {
	uvz=new Array<a_i>(3)    // along edge and edge shifted 1 to the right
	x_at_y_int: number
	Bresenham: a_i
	slope: number

	constructor(x_at_y_int:number,y:number, slope_floored:number,Bresenham_k_gradient:Gradient,payload:Matrix){ //edge:Item , x_at_y_int:number , slope_inc:number ) {  // number is int   @ vertex2d
		this.x_at_y_int=x_at_y_int
		this.slope=slope_floored
		this.Bresenham=new a_i()
		
		{							
			const _=Bresenham_k_gradient
			const floored = this.slope*_[0]  + _[1]  // We always go down by one
			this.Bresenham.increment = [floored, floored+_[0]]
			this.Bresenham.accumulator = Bresenham_k_gradient.accumulator + this.Bresenham.increment[0] // We set up the decision value for the next line (y+1)
		}

		console.log("edge",slope_floored,this.Bresenham.increment,this.Bresenham.accumulator)

		this.uvz = payload.nominator.map(v3 => {
				const a = new a_i(),v=v3.v //; a.accumulator =0; // accumulator is set by vertex using MUL
				a.accumulator=v[0] * x_at_y_int + v[1] * y + v[2]  // So all addressing will be relative now? // Why is Bresenham different?
				const floored = v[0] * slope_floored + v[1]  // We always go down by one
				a.increment=[floored, floored+v[0]]
				return a 
			})
	}

	// += is more efficient in JRISC than C= A*B 
	propagate_along(): number { // Bresenham gives bool: Direction from last to get back on track
		let ca = this.Bresenham.accumulator < 0   // Check the constructor to properly set this up. Bresenham needs to already sit on the next y
		this.Bresenham.propagate_along(ca) 		
		this.x_at_y_int+=this.slope + (ca ? 1 : 0)  //  JRISC: Either ADC or if I have enough registers free: put in the ca branches.		
		this.uvz.forEach(s => s.propagate_along(ca))
		return this.x_at_y_int
	}

	perspective() {
		let w=this.uvz[0].accumulator
		if (w==0) return
		let z = 1 /w     // perspective correction  // Attention: JRISC bug: use register "left" before next division instruction!
		for (let st = 0; st < 2; st++) {
			this.uvz[st].projected = this.uvz[st].accumulator*z
		}
		this.uvz[2].projected=z
	}
}


export class PixelShader{
	y:number

	//  Element [0] as denominator  in the code is to easy to confuse to [0] in less critical roles like sides, directions
	// to implement a_i in a loop, I could work with getters and setters for everyone else?
	// OpenGL uses homogenous coordinates where the denominator is just one element at the border. They use last to keep indices familiar

	// PixelShader does not increment along axis units:  zst:Array<a_i>=new a_i[3]  // along axes units
	// Rather we keep the data format from the 3d side
	uvz_from_viewvecto: Matrix
	half_screen: any
	// and only on vertices convert from 3d Matrix structure to mutable a incr structure



	span(x0: number, width: number, m: Mapper, es:EdgeShader[]) { 

		// debugging perspective is easier with coordinates around (0,0)

		let blitter_slope=[0,0,0]
		if (width==1){ // slithers and corners  (width 0 never calls) Assert
			var esp=es.slice(0,1).map(e=>{
			e.perspective() // Edges propagate / use cursors. No parameter here //  x + (width-1))  // Perspective is calculated within  aka closed interval
			return e.uvz.map(u=>u.projected )})
			esp[1]=esp[0]
			// slope is not set because it will never be read
		}else{
			var esp=es.map(e=>{
			e.perspective() //x + (width-1))  // Perspective is calculated within  aka closed interval
			return e.uvz.map(u=>u.projected )})
			for(let uvz=0;uvz<2;uvz++){
				blitter_slope[uvz] = (esp[1][uvz]-esp[1][uvz]) / width  ; // linear interpolation. Quake bloats the code for small values. I have some JRISC ideas in the project: scan for first bit. shift one more. Zero flag? then apply shift to argument. Else: div			
			}
		}

		// Hardware specific
				//xo = x
		// As in Doom on Jaguar, we do the full persepective calculation for the first and last pixel ( for walls and floors this is perfect, inbetween: some warp . Todo: check diagonals)
		// then the Jaguar blitter interpolates linearly. Quake and Descent use subspans on large polygons. Code is straight forward. Add later.
		let source=esp[0]  // todo: accumulator increment pairs
		const xu=x0+ this.half_screen[0] // Jaguar Blitter uses 12-bit unsigned values
		const yu=this.y+ this.half_screen[1]
		for (let x=xu; x < xu+width; x++) { // the blitter does this. Todo: move this code ... . But what about perspective correction? Also not in this source file!
			m.putpixel(source, [x, yu])
			blitter_slope.forEach((p, i) => { source[i] += p})  // x-gradient = slope ( different name for 1-dimensional aka scalar case )
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

	
	constructor( uvz_from_viewvector:Matrix, half_screen:number[] ){
		this.half_screen=half_screen
		this.uvz_from_viewvecto=uvz_from_viewvector

	// Todo : harmonize
			//let payload_w = []//Payload.nominator.map( v3=> [v3.v[2],v3.v[0],v3.v[1] ]) 
			// bias
			// I adjusted 	uvz_from_viewvector(C:number[]):Matrix{ so that I can simply.

			// let payload_w= uvz_from_viewvector.nominator.slice();

			// let blitter_slope = payload_w.map(p => p[1])

		

			// payload_w[0][0] = uvz_from_viewvector.nominator[0][2]  // multiply with [2]=1 compontent of view vector gives us the const coeeficient [][0] for the linerar function. Here: denominaotr [0][]
			// payload_w[1][0] = uvz_from_viewvector.nominator[1][2]  // same for nominator of s
			// payload_w[2][0] = uvz_from_viewvector.nominator[2][2]  // and t

			// gradient .. So, this was a swap
			// payload_w[0][1] = uvz_from_viewvector.nominator[0][0]  // gradient of denominator along a span ( x ) . Yeah, I probably should reconsider the numbering or transform a matrix or so
			// payload_w[0][2] = uvz_from_viewvector.nominator[0][1]  // gradient of denominator along the edges ( y ) 

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
			// I don't know anymore what this is. I don't skew because JRISC MAC wants signed int. My beam tree and subpixel code works just the same with 0,0 on pixel or corner
			// payload_w[0][0] -= uvz_from_viewvector.nominator[0][1]  // same for nominator of s
			// payload_w[0][0] -= uvz_from_viewvector.nominator[0][2]

			//let payload=[payload_w]  // Payload is given to use only with UV offsets (for perspective). Affine Gouraud probably needs its own code path with triangles?


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
		
	}

}