import { Vec3,Matrix } from './clipping.js';
import {Camera_in_stSpace, Mapper,CV} from './infinite_plane_mapper.js'
// The rasterizer needs to projected points from the beam tree. The tree is the start, and the polygon only lives in the leaf
// I think that most polygons in a dense mesh are split by their neighbours. I would need extra code to check for back faces. This does neither fit into the MVP nor the cache
// So I guess that I can go full tree. Still need to switch cases per vertex: Projected, vs cut of two edges, though do I, both are rationals. Ah, but with one x and y share w. Even this is the same for both.
// A scanline oriented rasterizer first only wants the y range.
// It is weird to use a box and check each pixel independently, but it is not so weird to use a whole scanline and then find the edges without delta values from previous scanline (MVP).
// So I enter Y, then some MUL and DIV and gives me two x. Their integer part may be different. So a while loop (additional branch in JRISC .. basically jump to the end of the loop first ).
// Now yeah indeed for the following lines I can use delta for the MUL part and even the DIV part. If I have more than one line, no division by zero happens here. I only use slopes for more than 2 lines per trapez.
// Same for X: I calculate the first and last pixel. Ah, the blitter wants slope already with two pixels. So it is different. Though the slope is ridicoulous
// I could write JRISC to .. ah I don't have space in the cache. Yeah, so slope starting with two pixels it is.
// For subspan perspective correction, DIV is just fast enough. No need for LUT or shift cases (and not space in cache).

// Polygon first would mean to sort y of all fragments of a polygon split into the leafs. Then I need a list of x values. Sort again. When I do this in registers or even within the cache,
// there is a limit. So add fragment, check for overflow, roll back. So I should probably start from the leafs.
// Even if I use a 2d tree, the int(cut.y) is the result of a division.
// So the viewing frustum starts the tree
// cutting has to happen in 3d here, even if we use a 2d tree. At least the near plane needs to be processed in 3d.
// The Jaguar SDK code cuts the polygon to the frustum like the frustum was a tree.
// Can I use the fast track to avoid cuts which are themself cut off? We can on the frustum because we know that we broke the symmetry ..ah no we can do in convex, but we cannot on arbitrary trees. 
// But even then we don't gain to much. Cuts along the edge need divisions or a lot of mul before we can sort them. At least we can wait with U and V?
// Like maybe I should not cut UV along any edge. Just ray trace the pixels like in Thief or Mode-7 .
// we should not double cut for UV. So even with cutting, wait for the final cut. For each cut refer to the original vertices. Throw away the preliminar results.
// Do we care if where an edge passes the vertex (corner) of a clipping polygon? This sign tells where to cut. Have to check with the camera position.
// On the back mirror of the frustum the signs change.

// checks for overdraw
// rasterizes into canvas
// May include a z check or later even some antialias, interpolation
// but I should stick to Jaguar blitter capabilities
// I want SrcShade. There is a bug in z-buffer which makes it not compatible to srcShade
// Also pixel mode z-buffer is too slow. I have to JRISC SRAM free for cache, but color RAM
// Why don't people not always use color RAM?
// z resolution needs to happen in beam tree

class Span {
	// Jaguar innerloop does not waste energy on abort criterium
	// It wants integer x range

	render(x: number[], texture_base: number[], texture_delta: number[] /* vec2 ? */) {

	}
}

// Even without lazy precision, clipping and mapping tends to go back to the rotated vertex
class Vertex_in_cameraSpace {
	inSpace: Array<number>
	outside: boolean
	onScreen: Array<number>
}

enum modes{NDC,guard_band};


class Polygon_in_cameraSpace {
	near_plane = 0.001
	// vertex_to_vertex(){} transformation happens elsewhere
	// vertex_to_clip(up:boolean){}  this rasterizer does not work with clipping because edges become first class citizens
	// clip_to_clip(){}  // whatever this was

	// I don't see why I should have a happy path for triangles in my MVP. Doom has convex polygons as does Descent. Architecture tends to have those also in portals. And they are flat. Even true for low poly windshields.
	// I could not find a fundamental flaw which would crash a rasterizer due to rounding errors. I will probably go 32 bit on Jaguar. On the low resolution this is so much overkill. Glitches are only visible if they are holes. Jitter? Ha, don't care.
	// So, does hole density depend on resolution?

	vertices: Array<Vertex_in_cameraSpace>  // Inheritance or templates?
	outside: boolean[]
	corner11: number;

	mode:modes=modes.NDC  ; // This is public. Change it to GuardBand to compare both versions ( artefacts, instruction count )

		// NDC -> pixel
	screen = [320, 200]
	epsilon = 0.001  // epsilon depends on the number of bits goint into IMUL. We need to factor-- in JRISC . So that floor() will work.

	constructor(){
		// for rasterization of clipped edges ( potentially very long) we want max precision (similar to vertices on opposed corners). So we expand the fraction
		let whyDoWeCareBelo16=this.screen.map(s=> Math.ceil(Math.log2(s))  )   // the function is a native instruction in JRISC. Okay , two instructions. need to adjust the bias

	}

	project(vertices: Array<Vertex_in_cameraSpace>): boolean {
		this.outside = [false, false]; let pattern32 = 0
		vertices.forEach(v => {
			let z = v.inSpace[v.inSpace.length - 1], outside = false  // sometimes string would be easier: -1

			let l = v.inSpace.length - 1   // weird that special component z is last. Probably in assembler I will interate backwards
			for (let i = 0; i < l; i++) {
				if (Math.abs(v[i]) > z) { outside = true }  // symmetric NDC. For Jaguar with its 2-port register file it may makes sense to skew and check for the sign bit (AND r0,r0 sets N-flag). Jaguar has abs()
			}

			if (!outside && z > this.near_plane) {  // "pure" z checks last because they are not really specific. I need a near plane for z comparison. Far plane might be the level size as in Doom?
				v.onScreen = v.inSpace.slice(0, -1).map(c => c / z)
				// symmetric NDC. For Jaguar with its 2-port register file it may makes sense to skew and check for the sign bit (AND r0,r0 sets N-flag). Jaguar has abs()				
			} else { // else is expensive in JRISC, but perhaps I need special code here. Otherwise Todo: remove
				v.onScreen = null // null does exist on Jaguar, but for value type vertices I will have to use a flag field
			}

			pattern32 <= 1
			pattern32 |= outside ? 1 : 0

			v.outside = outside
			this.outside[0] ||= outside
			this.outside[1] &&= outside
		})

		pattern32 = pattern32 << vertices.length | pattern32// pattern allows look ahead
		// Edges
		let on_screen = [], cut = [], l = vertices.length
		this.corner11 = 0 // ref bitfield in JRISC ( or C# ) cannot do in JS
		vertices.forEach((v, i) => {// edge stage. In a polygon an edge follows every vertex while circulating. In mesh it does not.

			let k = (i + 1) % vertices.length
			switch ((pattern32 >> i) & 2) {
				case 3: // both outside, check if the edge is visble. In case of a guard band I need this code to avoid overflow later on

					let pattern4 = 0
					if (0 == (pattern4 = this.isEdge_visible([vertices[i], vertices[k]]))) break;
					this.edge_crossing_two_borders(vertices, pattern4, on_screen);
					//on_screen is pointer to collection:  on_screen.push(...cuts)
					break;
				case 1:
					on_screen.push(v)  // this push order is for a single polygon. In a mesh there would be references

					cut = this.edge_fromVertex_toBorder([vertices[i], vertices[k]], l);
					on_screen.push(cut)
					break
				case 2:
					cut = this.edge_fromVertex_toBorder([vertices[k], vertices[i]], l);
					on_screen.push(cut)// The asymmetry fits the counting: When the borders cut a corner of the polygon, the vertex count++ , but we have cuts=2

					break
				case 0: //none outside
					on_screen.push(v)  // Nothing to insert before   // of course in JRISC this would be in a fixed length pool
					break;

				// Doom has not near or far plane. The Jaguar SDK deals with them like with the other planes
				// For any limits in z precision later on ( interpolation not only with z-buffer ), those planes will help
				// slope on screen = normal.slice(0,2)
				// it only truncates vertices on screen (who have passed previous tests)
				// in many games the camera turns fast, but z does not
				// I may makes look better to run a delta algorithm and use sperical clipping within LoD / depth cuing / fog . Max distance gives the smalles w value. Use negative offset to still use all 16 bits in the z-buffer . -- basically not my problem anymore
				// Near plane could be set on the windshield. Anything within the cockpit is a hit => screen goes white
				// Or actually, near plane is probably an accident. Move close to something. w gets larger than 16 bit + offset => glitch. Set collision radius here!
				// I don't know if w for z comparison and for texture maps need to be the same on Jaguar. Rounding may be a problem. Beamtree is a pass before mapping.
				// near plane should only affect a very small number of polygons
			}
		})


		if (on_screen.length == 0) {
		let null_egal = (this.corner11 >> 2 & 1) ^ (this.corner11 & 1)
		if (null_egal == 0) return // polygon completely outside of viewing frustm
		// viewing frustum piercing through polygon
		}



		// screen as floats
		
		if (mode ==modes.NDC){}       // NDC -> pixel   . Rounding errors! Do this before beam tree. So beam tree is 2d and has no beams
		else   {}  // Guard band  . Faster rejection at portals ( no MUL needed with its many register fetches). Still no 3d because we operate on 16 bit rounded screen coordinates after projection and rotation!!


		let texturemap=new Camera_in_stSpace()  // I should probably pull the next line into the constructor
		//let s:Vec3=new Vec3([vertices[0].inSpace])
		let payload:Matrix
		{
			let t=vertices.slice(0,3).map( v=>(v.inSpace)  ) ;
			texturemap.transform_into_texture_space_ctr( new Vec3([t[0],t[1]]) ,new Vec3([t[2],t[1]]) )  // My first model will have the s and t vectors on edges 0-1-2  .  for z-comparison and texture maps		
			payload=texturemap.generate_payload_m(   t[1]   )
		}
		if (on_screen.length > 0) {
			// get z (depth) and texture  . Of course with occlusion culling this may be referenced before
	
			// you may rotate by 90° here for walls like in Doom. Also set blitter flag then
			let pixel_coords = on_screen.map(ndc => [(ndc[0] + 1) * (screen[0] - epsilon), (ndc[1] + 1) * (screen[1] - epsilon)]) // It may be a good idea to skew the pixels before this because even with floats, I uill use 2-complement in JRSIC and use half open interval?. Does the code grow?
			this.rasterize_onscreen(pixel_coords,payload); return true
		}

		// trace a single ray for check. But, can I use one of the patterns instead? pattern32=-1 because all vertices are outside. Pattern4 undefined because it is per vertex
		// tracing is so costly because I need to go over all vertices, actually edges, again.
		// Backface culling does not help.
		// 001 vector is simple to trace though
		// At least in 3d -- it looks -- I need official s,t edges (vertics) ( vertex 0 and 1)
		// v0 + s*S + t * T = z * 001  // we only care about the sign
		// normal = s x t 
		// ( vo | normal ) /  ( z | normal )      // similar equation to  UVZ mapping for txtures and occlusion


		this.rasterize_onscreen([[-1,-1],[+1,-1],[+1,+1],[-1,+1]],payload)  // full screen
		return
	}

	private edge_crossing_two_borders(vertex: Vertex_in_cameraSpace[], pattern4: number, on_screen) {
		let slope = this.get_edge_slope_onScreen(vertex);

		for (let border = 0; border < 4; border++) {
			if ((pattern4 >> border & 1) != (pattern4 >> (border + 1) & 1)) {

				// code duplicated from v->edge
				let coords = [0, 0]
				coords[border & 1] = (border & 2) - 1;
				coords[~border & 1] = (slope[2] + ((border & 2) - 1) * slope[border & 1]) / slope[~border & 1];

				on_screen.push(coords)
			}
		}
		return on_screen
	}

	isEdge_visible(vertices: Array<Vertex_in_cameraSpace>): number {
		// rough and fast
		let z = vertices[0].inSpace[2]
		for (let orientation = 0; orientation < 2; orientation++) {
			let xy = vertices.map(v => v.inSpace[orientation])
			for (let side = 0; side < 2; side++) {
				if (+xy[0] > z && +xy[1] > z) return 0 //false
				if (-xy[0] > z && -xy[1] > z) return 0 //false
			}
		}
		// precise and unoptimized
		let v0 = new Vec3([vertices[0].inSpace])
		let edge = new Vec3([vertices[0].inSpace, vertices[1].inSpace])   // todo: consolidate with edges with one vertex on screen
		let cross = v0.crossProduct(edge) // Like a water surface
		let corner_screen = [0, 0]
		let bias = corner_screen[2] * cross.v[2]

		let head = [false, false]  // any corner under water any over water?
		let pattern4 = 0, inside = 0
		for (corner_screen[1] = -1; corner_screen[1] <= +1; corner_screen[1] += 2) {
			for (corner_screen[0] = -1; corner_screen[0] <= +1; corner_screen[0] += 2) {
				inside = bias + corner_screen[0] * cross.v[0] + corner_screen[1] * cross.v[1]
				pattern4 <= 1; if (inside > 0) pattern4 |= 1
			}
		}
		this.corner11 |= 1 << (Math.sign(inside) + 1) // accumulate compact data to check if polygon covers the full screen or is invisible


		if (pattern4 == 15 || pattern4 == 0) return 0
		// check for postive z
		let base = new Vec3([vertices[0].inSpace])
		let direction = new Vec3([vertices[0].inSpace, vertices[1].inSpace]);
		// Gramm-Schmidt
		let corrector = direction.scalarProduct(base.innerProduct(direction) / direction.innerProduct(direction));
		let close = vertices[0].inSpace[2] - corrector.v[2] // Does nearest point have positive z?  full equation. base - corrector  
		if (close < 0) return 0

		// compfort repeat for caller
		pattern4 |= pattern4 << 4  // |= 1<<8 for zero temrination in JRISC
		// for(let i=0;i<4;i++){
		// 	let t=((pattern4 >> i)&1)
		// 	head[t]=true
		// }

		return pattern4 //head[0] && head[1]
	}

	rasterize_onscreen(vertex: Array<number[]>,Payload:Matrix) {  // may be a second pass like in the original JRISC. Allows us to wait for the backbuffer to become available.
		let l = vertex.length, min = [0, vertex[0][1]]   //weird to proces second component first. Rotate?
		for (let i = 1; i < l; i++) {
			if (vertex[i][1] < min[1]) min = [i, vertex[i][1]]
		}

		let i = min[0]
		let v = vertex[i]
		let active_vertices = [[0,i],[0,i]] // happens in loop first iteration, (i + l - 1) % l], [i, (i + 1) % l]]

		// active_vertices.forEach(a => {
		// 	let vs = a.map(b => this.vertices[b])
		// 	if (vs[0].outside != vs[1].outside) {
		// 		// get edge data. Needs a data structure (for sure). Somehow for the rasterizer I calculate it on the fly now
		// 		 this.edge_fromVertex_toBorder(vs, l);
		// 	}
		// 	let v = this.vertices[a[1]]
		// 	v.outside
		// })
		let m=new Mapper()   // our interface to the hardware dependent side. Used for the whole mesh

		// this is probably pretty standard code. Just I want to explicitely show how what is essential for the inner loop and what is not
		// JRISC is slow on branches, but unrolling is easy (for my compiler probably), while compacting code is hard. See other files in this project.
		let y = Math.floor(v[1])
		let slope_accu_c=[[0,0],[0,0]]  // (counter) circle around polygon edges as ordered in space / level-mesh geometry
		// let slope_accu_s=[[0,0],[0,0]]  // sorted by x on screen  .. uh pre-mature optimization: needs to much code. And time. Check for backfaces in a prior pass? Solid geometry in a portal renderer or beam tree will cull back-faces automatically
		do {
			for(let k=0;k<2;k++){
				if (y==vertex[active_vertices[k][1]][1]){
					active_vertices[k][0]=active_vertices[k][1]
					active_vertices[k][1]=active_vertices[k][1]+(k*2-1+l)%l  
					// JRISC has a reminder, but it is quirky and needs helper code. Probably I'd rather do: 
					/* 	
						;prep
						CPY len_spring,len
						XOR zero,zero
						; carry trick
						ADDQ 1,i 
						SUB	 i,len
						SBC zero, zero   ; on JRISC carry is normal. Not as on 6502
						AND zero,i
						; sign trick  // alternative, shorter
						ADDQ 1,i 
						SUB	 i,len
						SAR 31,len   ; on JRISC carry is normal. Not as on 6502
						AND len,i
					*/
					let v_val=active_vertices[k].map(a=>vertex[a]) 		// JRISC does not like addressing modes, but automatic caching in registers is easy for a compiler. I may even want to pack data to save on LOADs with Q-displacement
					let d=[0,0] // delta, diff
					for(let i=0;i< v_val[0].length;i++){
						d[i]=v_val[1][i]-v_val[0][i]
					}
					if  (d[1]!=0)	slope_accu_c[k][0]=d[0]/d[1]  // we only care for edges with actual height on screen. And exact vertical will not glitch too badly
					// I am going all in to floats / fixed point. No rounding => No DAA  aka  Bresenham. Let the glitches come. 4 kB might be enough code to have a macro to convert all MUL to 16.16*16 muls. I want to check that!
					// sub-pixel correction against PlayStation1 (TM) wobble
					slope_accu_c[k][1]= slope_accu_c[k][0] * (y-v_val[0][1])

					// Do I allow back faces ? I cannot belive that I want to support non-planar poylgons in any way. Use this as assert / for initial debugging?
					//let no_mirror= slope_accu_c[0][0]<slope_accu_c[1][0]  
					//for_mapper.sort()  // non-planar poylgons will vanish. Once again: 16.16 will eliminate this glitch to 1 px every hour. 16.16 still fast than guarding IF commands here! Level is checked for planarity. Keyframe animated characters use triangles. Only stuff like head or armor has poylgons.
				}
			}

			 // Todo : harmonize
			let payload_w=[]//Payload.nominator.map( v3=> [v3.v[2],v3.v[0],v3.v[1] ]) 
			// bias
			payload_w[0][0]=Payload.nominator[0][2]  // multiply with [2]=1 compontent of view vector gives us the const coeeficient [][0] for the linerar function. Here: denominaotr [0][]
			payload_w[1][0]=Payload.nominator[1][2]  // same for nominator of s
			payload_w[2][0]=Payload.nominator[1][2]  // and t

			// gradient
			payload_w[0][1]=Payload.nominator[0][0]  // gradient of denominator along a span ( x ) . Yeah, I probably should reconsider the numbering or transform a matrix or so
			payload_w[0][2]=Payload.nominator[0][1]  // gradient of denominator along the edges ( y ) 

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
 			payload_w[0][0]-=Payload.nominator[0][1]  // same for nominator of s
			payload_w[0][0]-=Payload.nominator[0][2]

			//let payload=[payload_w]  // Payload is given to use only with UV offsets (for perspective). Affine Gouraud probably needs its own code path with triangles?

			let fragment=[].fill(0,0,payload_w.length) // malloc (reg)
			let fralment=[].fill(0,0,payload_w.length) // malloc (reg)

			let ny = Math.min(...active_vertices.map(a => vertex[a[1]][1])) ,xo:number,anchor=false
			for (; y < ny; y ++) {  // floating point trick to get from NDC to pixel cooridinates. 256x256px tech demo. Square pixels. Since I don't round, any factor is possible. Easy one is 256  * 5/4-> 320  .. 256 * 3/4 = 192				
				let a=slope_accu_c.map(sa=>sa[1])
				a.sort() // Until I debug my sign errors
				let integer=a.map(a_if=>Math.floor(a_if))  // Should be cheap in JRISC despite the wild look in TypeScript
				let x=integer[0];if (x<integer[1]){  // dragged out of the for loop. Not an actual additional jump in JRISC
					// linear interpolation
					// this is  an experiment. Gradients ADD or ADC on 32 bit should work great in JRISC, right?
					// When debugged: precalc the gradient in the coordinate system spanne dup by slope floor and ceiling!
					// Though this primitve approach woudl even work if I use and active-edge (on multiple sectors of a beamtree)
					if ( anchor){  // I run out of registers, but actually would like to keep more temporary values. MOVTA ? So her is just a quick hack for half of all slopes
						let dx=x-xo
						switch(dx)
						{
							case -1:payload_w.forEach((p,i)=>{fragment[i]+=p[2]-p[1]})	;break
							case +1:payload_w.forEach((p,i)=>{fragment[i]+=p[2]+p[1]})	;break
							case 0	:payload_w.forEach((p,i)=>{fragment[i]+=p[2]})	;break   // this will speed up all edges clipped at the screen borders
							default: anchor=false
						}
					}
					if (!anchor){  // too fat for inner loop, but where do I put this?
						anchor=true,xo=x
						// 16.16 internals: let fraction=a[0] % 1 // sub-pixel correction for z and Gouraud or the texture to fight PS1 wobble
						fralment=payload_w.map(p=> p[0]+p[1]*a[0] + p[2]*y )   // IMAC is fast in JRISC
					}				
					fragment=fralment // would feel weird to use the fragemt from the other side to "carriage return" like a typeWriter
					let blitter_slope=payload_w.map(p=> p[1])
					if (fralment.length>2){// Z=0 U=1 V=2 coordinates need perspective correction. Gouraud on this blitter is Z=0 G=1
						let span_within=integer[1]-x
						if (span_within>0 && fralment[0]>0.001){  // z>0 safety first
							let right_side=payload_w.map((p,i)=>fralment[i]+p[1]*span_within)
							let w=1/fralment[0]		// perspective correction  I feel stupid because at 16 bit even the Jaguar has enough RAM for a LUT
							for (let uv=0;uv<2 ;uv++){
								let left=fralment[uv+1]*w
								fragment[1+uv]=left
							}
							if (span_within==0 || right_side[0]<=0.001) continue
							w=1/right_side[0]    // perspective correction  // Attention: JRISC bug: use register "left" before next division instruction!
							for (let uv=0;uv<2 ;uv++){
								let right=right_side[uv+1]*w  
								let d=(right-fragment[1+uv])  // JRISC is a load-store architecture. There would be a physical register with the d variable. So this line adds no cost
								// Quake 1 demake to keep code small. Ah, >> and /2 relation is undefined in C. In JRISC I would inlcude the span_within==2 case
								if ( span_within) blitter_slope[1+uv]=d;									
								else blitter_slope[1+uv]= d/ span_within	; // linear interpolation. Quake bloats the code for small values. I have some JRISC ideas in the project: scan for first bit. shift one more. Zero flag? then apply shift to argument. Else: div
							}
						}
					}
					xo=x
					// As in Doom on Jaguar, we do the full persepective calculation for the first and last pixel ( for walls and floors this is perfect, inbetween: some warp . Todo: check diagonals)
					// then the Jaguar blitter interpolates linearly. Quake and Descent use subspans on large polygons. Code is straight forward. Add later.
					for (;x<integer[1];x++){ // the blitter does this. Todo: move this code ... . But what about perspective correction? Also not in this source file!
						m.putpixel([x,y],fragment)
						blitter_slope.forEach((p,i)=>{fragment[i]+=p[1]})  // x-gradient = slope ( different name for 1-dimensional aka scalar case )
					}
				}
				for(let k=0;k<2;k++) slope_accu_c[k][1]+= slope_accu_c[k][0]				
			}

		} while (active_vertices[0][1] != active_vertices[1][1]) // full circle, bottom vertex found on the fly
	}

	private edge_fromVertex_toBorder(vs: Vertex_in_cameraSpace[], l: number) {
		let slope = this.get_edge_slope_onScreen(vs).slice(0, 2); // 3d cros  product with meaningful sign. Swap x,y to get a vector pointint to the outside vertex. float the fractions

		var abs=slope.map(s=>Math.abs(s))

		switch( this.mode){
			case modes.NDC:
				var swap=abs[0] > abs[1]
				if (swap) { slope.reverse() }				

				if (slope[0]==0) return
				break
			case modes.guard_band:
				// I guess that this is not really about guard bands, but the second version of my code where roudning of slope can have ( polymorphism, will need a branch ) with positions.
				if ( Math.abs(slope[0]) * this.screen[0] < Math.abs(slope[1]) ) return
				break
		}

		// check the top screen corners. Why not check all corners (ah that is the case if both vertices are outside) ? Or rather one!
		// similar code for both cases
		vs[1].onScreen = vs[0].onScreen.slice()
		var si=slope.map(l=>Math.sign(l))  // sign bitTest in JRISC

		vs[0].onScreen
		// Rasterizer sub pixel-precision start value. No NDC or GuardBand here. Just full 32bit maths
		let scanline=(vs[0].onScreen[1] * this.screen[1]  ) 
		let flip=false;if (slope[1]<0) {slope[1]=-slope[1]; scanline=-scanline;flip=true}
		let fraction=scanline % 1
		let integer=Math.floor(scanline)

		// To avoid overflow, I also need x
		let x=vs[0].onScreen[0] ,mirror=false;if (slope[0]<0) { slope[0]=-slope[0];x=-x;mirror=true }

		let implicit=(this.screen[0]/2-x )*slope[1]+fraction*slope[0]
		if (implicit <0 ) { return }  //edge leaves screen (to the side) before next scanlinline
		
		// no overflow will happen
		let slope_float=vs[1].onScreen[1] / vs[1].onScreen[0] // 16.8 bits. => two MUL instructions . Difficult to calculate cuts ( 48 bits ? )
		// Or is it: For cut DMZs I only calcualte on scanlines. Subract 24 bits from eacht other. Integer result .
		// How do I calculate DMZ with light slopes? So where x needs the higher precision?
		// No Problem: insert the result for y ( 16/24 ) into the linear equation : 32/24
		// With fractions this would be 16(bias)*16(transpose') / 32(det) .. the same

		let corner=implicit+integer*slope[0] // I reuse implict because JRISC only accepts 16 bit factors in  singe instruction  
		if (corner < 0 ) {} // edge passes through vertical border. Use this to start beam tree.
		

		if (si[1]<0) 

		if (slope[0]==0) {vs[1].onScreen[1] = sl[1]*this.screen[1] }  // I cannot use epsilon here because the vertex could have a fraction of (0) or (F)



		if (  slope[0] > slope[1]) { // Nonsense  slope tells us that the edge comes from above.  This is branching only for NDC
			// correct order . At least every other vertex need to be on inside for this function

			 
			let cc = 0;

			for (let corner = -1; corner <= +1; corner += 2) {
				if ((corner - vs[0].onScreen[0]) * slope[1] > (-1 - vs[0].onScreen[1]) * slope[0]) {
					vs[1].onScreen[0] = corner;
					switch (this.mode){ // todo: different edge clases?
						case modes.NDC:	
							vs[1].onScreen[1] = vs[0].onScreen[1] + (corner - vs[0].onScreen[0]) * slope[1] / slope[0];
							break;
						case modes.guard_band: // The displacement is given by the other vertex. We store the float 
							// check for overflow
							vs[1].onScreen[1]=slope[1]*(2<<16) / slope[0] // JRISC fixed point
							break;						
					}
					cc++;
					break;
				}
			}
			if (cc == 0) {
				vs[1].onScreen[1] = -1;
				vs[1].onScreen[1] = vs[0].onScreen[0] + (-1 - vs[0].onScreen[1]) * slope[0] / slope[1];
			}
			vs[1].onScreen[1] = -1;
		}
		return vs[1].onScreen;
	}

	get_edge_slope_onScreen(vertex: Array<Vertex_in_cameraSpace>): Array<number> {
		/*
		view Vector(x,y,1)
		edge= v1-v0
		normal= v0 x edge
		implicit=normal * view
		 */
		let view = new Vec3([vertex[0].inSpace])
		let edge = new Vec3([vertex[0].inSpace, vertex[1].inSpace])
		let normal = view.crossProduct(edge)  // The sign has a meaning 

		// normalize for jrisc
		// mul.w will be applied to x and y components only . 
		// I need to know the screen expontent . x and y on screen need the same exponent to match bias in implicict function.
		// Ah, basicall 16.16
		let list=normal.v.slice(0,2). map(s=> Math.ceil(Math.log2(s))  )  ; // z = bias and can stay 32 bit because FoV ( Sniper view? ) will always keep z-viewing compontenc < 16 bits for 8 bit pixel coords 
		let f=Math.pow(2,16-Math.max(...list)), n=normal.v.map(c=>c*f)   ; // Bitshift in JRISC. SHA accepts sign shifter values!   

		return n
	}
}



