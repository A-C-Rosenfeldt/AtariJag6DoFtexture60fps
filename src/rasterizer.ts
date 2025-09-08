import { Vec3, Matrix, Matrix2, Vec2, Vec } from './clipping.js';
//import { SimpleImage } from './GL.js';
import { Camera_in_stSpace, Mapper, CameraViewvector } from './infinite_plane_mapper.js'
import { EdgeShader, PixelShader } from './PixelShader.js';
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

// // I tried nullable properties ...
// class PointPointing{
// 	position: Array<number>
// 	vector: Vec2
// 	reverse:boolean
// 	border: any;
// }

// but ...Aparently, with parallel consideration, I need polymorphism very badly
export interface Item {

}

class Edge_on_Screen implements Item {

}

// class Edge_hollow extends Edge_on_Screen {

// }

class Edge_w_slope extends Edge_on_Screen {
	gradient: Vec2
}

class Edge_Horizon extends Edge_w_slope {
	bias: number
}

abstract class Point implements Item {
	abstract get_y(): number;
}

class vertex_behind_nearPlane implements Item {
	// this could be an enum?
}

// Just as projected
class Vertex_OnScreen extends Point {
	private _position = new Array<number>();
	public get position() {
		return this._position;
	}
	public set position(value) {
		if (isNaN(value[0]) || isNaN(value[0])) throw new Error(" value is nan")
		this._position = value;
	}
	get_y() { return Math.ceil(this.position[1]) }   // subpixel correction and drawing with increasing y mandates ceil() instead of my standard floor(). +1 wleads to minimal glitches. Ah, why risk. Addq 1. SAR .
	// I use the vector constructor to do this. Seems like a silly hack?
	fraction() { return this.position.map(p => p - Math.floor(p)) }  // AI thinks that this looks better than % 1. Floor is explicit and is the way JRISC with twos-complemnt fixed point works
}

class Corner extends Point {
	static screen: number[]
	static throttle=10000
	corner: number
	get_one_digit_coords() {
		const r = [ (this.corner+1 & 2)-1,  (this.corner + 0 & 2)-1];
		 return r 
		} // Todo: UnitTest
	get_y() { 
		// if (Corner.throttle--<0) {
		// 	throw new Error("endless loop")}
		const y = Corner.screen[ 1] * ( (this.corner & 2)-1);
		// console.log("Corner ",this.corner," -> y", y)
		// if (isNaN(y)) {
		// 	let lll=0
		// }
		return y
 	}
	constructor() {
		super();
		this.corner = -1;
	}
}

class Onthe_border extends Point {  // extends Corner leads to errors. So I guess that (once again ) inheritance is not the right tool here
	// the edge after the corner in mathematical sense of rotation
	private _border: number;
	public get border(): number {
		return this._border;
	}
	public set border(value: number) {
		if (value <0) throw new Error("<0");
		if (value >3) throw new Error(">3");
		if (!Number.isInteger(value ) ) throw new Error("!Number.isInteger");
		this._border = value;
	}
	get_one_digit_coords() { // Todo. Unit Test . Could be the wrong direction of rotation
		let t = [ (this.border & 2)-1, 0]
		if ((this.border & 1) == 0) return t
		return [0, t[0]]
	}
	private _pixel_ordinate_int: number;
	public get pixel_ordinate_int(): number {
		return this._pixel_ordinate_int;
	}
	public set pixel_ordinate_int(value: number) {
		if (isNaN(value) || value < -160 || value > 160) {
			throw "out of range for all axes. btw, border is " + this.border + " value is " + value
		}
		this._pixel_ordinate_int = value;
	}
	z_gt_nearplane: boolean
	half_screen: any;

	get_y() {

		return (this.border & 1) == 0 ? this.pixel_ordinate_int : this.half_screen[1] * ((this.border & 2) - 1)
		// this has to follow the generation of these objects. This was the orignal shortes formulation. It failed
		// return this.border & 1 ? this.pixel_ordinate_int : this.half_screen[this.corner & 1] * (1 - (this.corner & 2))
	}

	constructor(half_screen: number[]) {
		super();
		this.half_screen = half_screen;
	}
}

// Even without lazy precision, clipping and mapping tends to go back to the rotated vertex
export class Vertex_in_cameraSpace {
	inSpace: Array<number>   // Not a Vec3 because projection deals so differently with the z-component
	outside: boolean
	onScreen: Vertex_OnScreen //Point //Pointing
	constructor(inSpace: Array<number>) {
		this.inSpace = inSpace;
	}
}

enum modes { NDC, guard_band };

/*
class Edge_on_Screen {
	startingVertex: Array<number>  // I go around the polygon for clipping. Later, I go down on both sides. So, on the wrong side, data acces is a bit nasty
	// On screen for subpixel precision, 
	counter_rotation=false
	get_startingVertex():Array<number>{
		if (this.counter_rotation) return null  // double linked list?
		return this.startingVertex
	}
	slope: Array<number>  
	slope_as_fixed=0   // so actually, the rasterizer needs to calculate this if it insists on doing the sub-pixel precsion ( which might overflow )
}
*/

// do it in rasterizer?
class Cyclic_Collection<T extends any> {
	a: T[]
	constructor(a: T[]) {
		this.a = a
	}
	get_startingVertex(i: number): T {
		//via index and lenght?
		let n = this.a.length
		let j = ((i % n) + n) % n
		return this.a[j]
	}
}

class Cyclic_Indexer {
	length: number
	direction: number
	iterate_by_ref2(ref: number[]) {
		ref[2] = (ref[2] + this.direction * 2 - 1 + this.length) % this.length;
	}
}


export class Gradient {
	accumulator: number
	slope = new Array<number>(2)
	//	alongEdge = new Array<number>(2) // I use a new type for this callen accumulator_increment -- todo: Harmonize names!
}

// Todo: God class and too many dated comments
export class Polygon_in_cameraSpace {
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

	mode: modes = modes.NDC; // This is public. Change it to GuardBand to compare both versions ( artefacts, instruction count )

	// NDC -> pixel
	screen = [320, 200];
	half_screen = this.screen.map(s => s / 2);
	FoV = [0.8, 0.5]//[1.6, 1.0]  //
	FoV_rezi = this.FoV.map(f => 1 / f)  // todo: Multiply with rotation matrix . Need to be 1 <=   < 2

	// Square pixels on my dev machine make thise elements equal
	screen_FoV = this.FoV_rezi.map((f, i) => f * this.half_screen[i])     // Forward for vertices  ..Needs to be this.screen <  < 2*this.screen for the machine language optimized clipping
	infinite_plane_FoV = this.FoV.map((f, i) => f / this.half_screen[i])    // backwards for "ray tracing"

	epsilon = 0.001  // epsilon depends on the number of bits goint into IMUL. We need to factor-- in JRISC . So that floor() will work.
	readonly m: Mapper;

	constructor(m: Mapper) {
		this.m = m
		// for rasterization of clipped edges ( potentially very long) we want max precision (similar to vertices on opposed corners). So we expand the fraction
		//let whyDoWeCareBelo16=this.screen.map(s=> Math.ceil(Math.log2(s))  )   // the function is a native instruction in JRISC. Okay , two instructions. need to adjust the bias

	}

	// So to fight rounding errors, every culling will happen twice. Can I reuse code? Virtual functions for do_vertex do_edge do_face
	// Once in 3d to a power of two viewing frustum
	// reverse: cull unreferenced (count it) vertices and edges
	// then in 2d to a bounding rectangle.16 and later a BSP
	// In the second pass, vertices can move outside, edges can lose a vertex or become invisible. For faces depend on this. The face without-edges screen-filler stays.
	// corners of the rectangle!


	project(vertices: Array<Vertex_in_cameraSpace>): boolean {
		Corner.screen = this.half_screen //.screen
		this.outside = [false, false]; let pattern32 = 0
		vertices.forEach(v => {
			let z = v.inSpace[v.inSpace.length - 1], outside = false  // sometimes string would be easier: -1 . Field have name and id ?

			let l = v.inSpace.length - 1   // weird that special component z is last. Probably in assembler I will interate backwards
			for (let i = 0; i < l; i++) {
				if (Math.abs(v.inSpace[i]) > z) {
					outside = true; break
				}  // abs works because there is a (0,0) DMZ between the four center pixels. DMZ around the pixels are used as a kindof mini guard band. symmetric NDC. For Jaguar with its 2-port register file it may makes sense to skew and check for the sign bit (AND r0,r0 sets N-flag). Jaguar has abs()
			}
			if (v[2] < this.near_plane) {
				outside = true;
			} else v.onScreen = new Vertex_OnScreen()

			// stupid low level performance optimization: Apply 32 bit MUL only on some vertices .  NDC would apply 16 bit MUL on all visible vertices. NDC is so violating anything which brought me to engines: Bounding boxes and portals. Still, NDC has far less branches and code and wins if occlusion culling is not possible. Rounding is always a problem on the border -- not worse for NDC
			// On a computer without fast MUL, this would be the code. JRISC has single cycle MUL 16*16=>32 ( as fast as ADD !? )
			if (outside == false) {	 // this.mode==modes.guard_band &&   I only support this mode because it is compatible to portals and perhaps later also to the beamtree.

				// check critical pixels first   ( I know that this looks complicates. This is resarch to see how much I can trade code for DIVs. I guess for JRISC just doing DIV is faster)
				// NDCs are faster for the vertices here, but more difficult to clip the edge. Now I feel like vertices between FoV/2 and FoV are many, edges are a few. So even super complicated MUL32 just for the last bit precsion after clipping is better than this.
				const z2 = Math.floor(z / 2)  // JRISC SAR
				for (let i = 0; i < l; i++) {  // square pixels. Otherwise I need this.FoV[] ( not the real one w)
					// notice how thie method loses on bit on the 3d side. But 32 bit are enough there. 16 bit on 2d are plency also though for SD -- hmm					
					if (Math.abs(v.inSpace[i]) > z2) {
						v.onScreen.position[i] = v.inSpace[i] * this.screen_FoV[i] / z;  // screen_Fov just smaller than half_screen
						if (Math.abs(v.onScreen.position[i]) > this.half_screen[i]) {
							outside = true; break
						}
					} // Similar to early out in BSP union

					//if (Math.abs(v[i] * this.screen_FoV[i]) > z*this.screen_FoV[2]) { outside = true }  // Notice how z will be shifted, but two register because 3d is 32 bit
					// Since FoV is so small, the result will not be 64 bit. I can use two (signed ) 32 bit register with large overlap
					// 2-port Register file is annoying. Recipie: Start from the end: IMAC . Then have the last preparation instruction 2 cycles before
				}
				if (outside == false)
					for (let i = 0; i < l; i++) {
						if (Math.abs(v.inSpace[i]) <= z2) {
							v.onScreen.position[i] = v.inSpace[i] * this.screen_FoV[i] / z
						}  // This makes no sense behind a portal

						//if (Math.abs(v[i] * this.screen_FoV[i]) > z*this.screen_FoV[2]) { outside = true }  // Notice how z will be shifted, but two register because 3d is 32 bit
						// Since FoV is so small, the result will not be 64 bit. I can use two (signed ) 32 bit register with large overlap
						// 2-port Register file is annoying. Recipie: Start from the end: IMAC . Then have the last preparation instruction 2 cycles before
					}
				/*
				if (outside==false && Math.abs(v.onScreen.position[0])*2 > z&& Math.abs(v.onScreen.position[0])*2 > z){
					//code to do 32 bit MUL: scan bits , extend sign, mul high word on both directons, if still uncelar: low word
				}
				*/
			}

			if (outside) {
				v.onScreen = null  // On Jagurar I was thinking about using struct . Or perhaps this loop should map() ?
			}

			pattern32 <= 1
			pattern32 |= outside ? 1 : 0

			v.outside = outside
			this.outside[0] ||= outside
			this.outside[1] &&= outside
		})

		const vertex_control = vertices.filter(v => v.onScreen !== null).map(v => v.onScreen.position.map((p, i) => p + this.half_screen[i]))

		pattern32 = pattern32 << vertices.length | pattern32// pattern allows look ahead
		// Cull invisble Edges. Faces pull their z,s,t from 3d anyway. I cannot really clip edges here because it lets data explode which will be needed by the rasterizer (not for face culling)
		// I am unhappy about the need to basically repeat this step on the 2dBSP (for guard_band and portals).
		// MVP: Get code running on 256x256 with one polygon. Guard == NDC 
		// Optimized clipping on rectangle because one factor is zero. The other still need
		let on_screen = new Array<Item>(), cut = [], l = vertices.length
		this.corner11 = 0 // ref bitfield in JRISC ( or C# ) cannot do in JS

		/* too expensive
		// check if vertices are still outside if we use the (rounded) edge slopes
		// This has to be done after NDC -> px ( rounding!!) . We do this to iterate over the corners. Of course a serial splitter does not care. We don't need the exact cut, only need to know if sense of rotation changes.
		// no synergz with polygons with vertex.count > 3 . we don't look at the faces here
		vertices.forEach((v, i) => {
			let k = (i + 1) % vertices.length
			let w=pattern32 >> i
			if (( w&7) == 2) {  // edge going outside, back inside

				// It wuould really be faster to delay this
				// find cut with screen border
				//

				let pixels=this.findCut(vertices[i], vertices[k]); // find cut because rounding may have put it inside the screen again. This is a problem with all clipping algorithms
				if ( pixels.reduce((p,c,j)=>p|| (c<0 || c>this.screen[j]),false ) ) pattern32=~((~pattern32) | 1<< i)  // set vertex to inside 
			}
		})
		*/

		let v_w_n = new Cyclic_Collection<Vertex_in_cameraSpace>(vertices) //new Array<Vertex_OnScreen>


		// 2 vertices -> edge
		vertices.forEach((v, i) => {// edge stage. In a polygon an edge follows every vertex while circulating. In mesh it does not.
			//if (neighbours[0] instanceof Vertex_OnScreen ) {}
			let k = (i + 1) % vertices.length
			let neighbours = [v_w_n.get_startingVertex(i), v_w_n.get_startingVertex(i + 1)] // Error cannot access on_screen_read before initialization.


			if (neighbours[0].outside) {
				if (neighbours[1].outside) {
					let pattern4 = this.isEdge_visible([vertices[i], vertices[k]])
					console.log("pattern4",pattern4)
					if (0 !=pattern4  ) {
						let cuts: Item[] = this.edge_crossing_two_borders(vertices, pattern4)
						on_screen.push(...cuts)
					}
				} else {
					let cut_r = this.edge_fromVertex_toBorder([vertices[k], vertices[i]], l);
					on_screen.push(...cut_r.reverse())
				}
			} else {
				on_screen.push(v.onScreen)
				if (neighbours[1].outside) {
					// todo move into following method
					let cut_r = this.edge_fromVertex_toBorder([vertices[i], vertices[k]], l);
					on_screen.push(...cut_r)
					//let border=new Onthe_border()
				}
			}
		})

		let on_screen_read = new Cyclic_Collection<Item>(on_screen)
		const n = 4;

		let with_corners = new Array<Item>();
		// check: edges -> vertices ( happy path: add corners, Rounding Exception: remove edges)
		// corners. The code above does not know if trianle or more. The code below still does not care. 
		// funny that we need two passes to add and remove items
		on_screen.forEach((v, i) => {
			// 
			let neighbours = [-1, +1].map(d => on_screen_read.get_startingVertex(i + d))

			// two cases without edge between vertices. Add edge to ease drawing
			// In this case follow the border in the rotation sense of a front facing polygon
			if ((neighbours[0] instanceof Onthe_border && v instanceof vertex_behind_nearPlane && neighbours[1] instanceof Onthe_border)) {
				let n = 4;
				let i = neighbours[1].border - neighbours[0].border;
				//let s=Math.sign(i); 
				//i=Math.abs(i);
				var j = ((i % n) + n) % n
				if (j == 3) {
					let t = new Corner(); t.corner = neighbours[1].border
					with_corners.push(t) // debug.  This happens already when I check borders
					return
				} else {
					var range = neighbours.map(n => (n as Onthe_border).border)  // typeGuard failed
				}
			}
			else { // In this case, use the shortest path between the two vertices. This can endure the rounding errors from clipping. This should work for the BSP-tree.
				// In the MVP I will send only clipped polygons to the BSP tree. Perhaps later I will add a 32bit code path and do pure portals?
				// Anyway, BSP means portals because the leafs are convex polygons, and we add convex polygons whose clipped version becomes a new leaf.
				// BSP always wanrs heuristcs. The simple linear polygon-add will use all info about two polygons to decide how to construct the BSP,
				// though, the leaf is already integrated into the beam tree. I would need to consider tree vs convex polygon. 
				// When rendering a mesh in a stripe, surely I should reuse shared edges
				with_corners.push(v)
				if ((v instanceof Onthe_border && neighbours[1] instanceof Onthe_border))  // previous loop discards the vertex marker. This is for symmetry: not a property. Asymmetric code looks ugly. Perhaps optimize the container: Type in a pattern, but use same getter and setter
				{
					var range = [v.border, neighbours[1].border]
				}else return
				//else with_corners.push(v)  // this loop only adds corners. No need to skip due to a pattern nearby
				
			}

			if (range[1] < range[0]) range[1] += n

			//console.log("may add corner", range[0], range[1])
			for (let k = range[0]; k < range[1]; k++) { // corner is named after the border before it ( math sense of rotation )
				console.log("going to add corner")
				let t = new Corner(); t.corner = k % n
				with_corners.push(t) // debug.  This happens already when I check borders
			}
		})

		if (on_screen.length == 0) {  // no vertex nor edge on screen
			let null_egal = (this.corner11 >> 2 & 1) ^ (this.corner11 & 1)  // check if corner11 pierces the polygon in 3d ?
			if (null_egal == 0) return // polygon completely outside of viewing frustum
			// viewing frustum piercing through polygon
		}



		// screen as floats

		if (this.mode == modes.NDC) { }       // NDC -> pixel   . Rounding errors! Do this before beam tree. So beam tree is 2d and has no beams
		else { }  // Guard band  . Faster rejection at portals ( no MUL needed with its many register fetches). Still no 3d because we operate on 16 bit rounded screen coordinates after projection and rotation!!


		let texturemap = new Camera_in_stSpace()  // Camera is in (0,0) in its own space .
		//  I should probably pull the next line into the constructor
		//let s:Vec3=new Vec3([vertices[0].inSpace])
		let payload: Matrix
		{
			let t = vertices.slice(0, 3).map(v => (v.inSpace))  // take 3 vertices and avoid overdetermination for polygons
			texturemap.transform_into_texture_space__constructor(new Vec3([t[0], t[1]]), new Vec3([t[2], t[1]]))  // My first model will have the s and t vectors on edges 0-1-2  .  for z-comparison and texture maps		
			payload = texturemap.uvzw_from_viewvector(t[1])
		}

		//console.log("payload",payload.nominator) ; // Error: payload is not really constructed

		this.rasterize_onscreen(with_corners, payload, vertex_control);  // JRISC seems to love signed multiply. So, to use the full 16bit, (0,0) is center of screen at least after all occlusion and gradients are solved. The blitter on the other hand wants 12-bit unsigned values
		return true

		/*
		// Todo: The following code is wrong about corners
		// Any corner whose beam passes through the face, adds a new on_screen vertex (to the array )
		// This happens with both an empty or a full on_screen list up to this point
		// So I indeed need to know through which border an edge leaves the screen
		// so that we can insert the screen corners after it into the list.
		// so this code sits inside the rasterizer because the rasterizer inserst? For debugging I should do it before!
		// It makes no sense so send [-1,-1]... placeholder corners

		if (on_screen.length > 0) { // at least one vertex or even edge is visible on screen. NDC scales. GuardBand/2dBSP 
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
		*/
	}

	// This may be useful for beam tree and non-convex polygons
	// I don't think that it is light enough to double check clipping after rounding errors
	// private findCut(v0: Vertex_in_cameraSpace, v1: Vertex_in_cameraSpace): Array<number> {
	// 	// find cut between two vertices. This is a 2d cut, so it is not a 3d cut. It is a 2d cut in the viewing frustum
	// 	let p0 = v0.onScreen.position
	// 	let p1 = v1.onScreen.position
	// 	let d =  new Vec2([p0,p1])  //p0.map((c, j) => p1[j]-c)  // vector from p0 to p1
	// 	//  [v0,v1] &* [s,t]  = d
	// 	// <=> [s,t] = inv([v0,v1]]
	// 	let m=new Matrix2()
	// 	m.nominator=[v0.onScreen.vector, v1.onScreen.vector]
	// 	let fac=m.inverse_rn(0)
	// 	let s=fac.innerProduct(d)
	// 	let xy=v0.onScreen.vector.scalarProduct(s).subtract(new Vec2([p0]).scalarProduct(-fac.den))  // 16*16 -> 32 bit
	// 	// no rounding errors allowed here
	// 	let pixels=xy.v.map(c => c / fac.den )  // 32/32 -> 8bit .  this feels wrong to do on the frustum. There we should use a while loop 

	// 	return pixels
	// }

	/* When we no the border, lets go ahead and calculate the pixel. So: see edge from vertex to border
	which_border(arg0: Vertex_in_cameraSpace): any {
		let v=arg0.onScreen.vector[0]
		let si=v.map(s=>Math.sign(s))
		// join position and vector then flip signs. Code is in this file. Write as MatrixMul?
		if (arg0.onScreen.vector[0]<0)   {} //
		
		let dis=arg0.onScreen.vector[0].cross(this.screen[0]-1)/2 - arg0.onScreen.position)
		
		throw new Error('Method not implemented.');
	}
		*/

	private edge_crossing_two_borders(vertex: Vertex_in_cameraSpace[], pattern4: number): Item[] {
		const slope = this.get_edge_slope_onScreen(vertex, this.infinite_plane_FoV)
		let border_count = 0

		// with zero border crossing, no edge is visible. Or when both vertices are in front of the near plane. For speed
		if (vertex[0].inSpace[2] < this.near_plane && vertex[1].inSpace[2] < this.near_plane) return [] //false

		// some borders cannot be crossed and all corners are on the same side, but which? Sign does not make much sense here
		for (let border = 0; border < 4; border++) {  // go over all screen borders
			if ((pattern4 >> border & 1) != (pattern4 >> (border + 1) & 1)) {   // check if vertices lie on different sides of the 3d frustum plane
				border_count++
			}
		}

		// check if crossing in front of us
		let qp: Vec3 = new Vec3([vertex[1].inSpace, vertex[0].inSpace])
		//let nearest_point= (new Vec3([vertex[0].inSpace]).scalarProduct( qp.innerProduct(qp) ).subtract( qp.scalarProduct( qp.innerProduct( new Vec3([vertex[0].inSpace])   ) ))) ;  // this is in 3d so 32 bit. A lot of MUL.32.32 :-( . Similar to: face in front of me = z   or also: texture   . Log for performance.
		let z = vertex[0].inSpace[2] * qp.innerProduct(qp) - qp.v[2] * (qp.innerProduct(new Vec3([vertex[0].inSpace])));   // we only need nearest_point.z 
		if (z < 0) return []

		/*
		for (let corner=0;corner<4;corner++){
			let side= (slope[2] + ((border & 2) - 1) * slope[border & 1])
		}
		// there are zero or two side changes 		


		switch( border)
		{
			case 2: // 
				
		}
		*/

		const on_screen = new Array<Item>()
		{
			for (let j = 0; j < 2; j++) {
				// Calculate pixel cuts for the rasterizer . we don't care for cuts .. I mean we do, we need them for the beam tree. But with a single polygon we only need y_pixel
				// code duplicated from v->edge
				let coords = [0, 0]
				coords[border_count & 1] = this.screen[~border_count & 1] * ((border_count & 2) - 1)
				coords[~border_count & 1] = (slope[2] + this.screen[~border_count & 1] * ((border_count & 2) - 1) * slope[border_count & 1]) / slope[~border_count & 1];  // I do have to check for divide by zero. I already rounded to 16 bit. So MUL on corners is okay.

				let o = new Onthe_border(this.half_screen)
				o.border = border_count
				o.pixel_ordinate_int = coords[1^ border_count & 1]
				on_screen.push(o)
				const e = new Edge_Horizon()
				e.gradient = new Vec2([slope.slice(0, 2)])
				e.bias = slope[2]
				if (j == 0) on_screen.push(e)
				
				// Cutting off an edge of the screen introduces two vertices ( and one edge )
				o.border = (border_count+1 )&3
				o.pixel_ordinate_int = coords[ border_count & 1]
				on_screen.push(o)


			}
		}
		return on_screen
	}

	private isEdge_visible(vertices: Array<Vertex_in_cameraSpace>): number {
		// rough and fast  like with the vertices I check if stuff is inside a 45 half angle FoV. Of course in JRISC this is free to change with 2^n
		const z = vertices[0].inSpace[2]
		for (let orientation = 0; orientation < 2; orientation++) {
			const xy = vertices.map(v => v.inSpace[orientation])
			for (let side = 0; side < 2; side++) {
				if (+xy[0] > z && +xy[1] > z) return 0 //false
				if (-xy[0] > z && -xy[1] > z) return 0 //false
			}
		}
		// precise and unoptimized
		const v0 = new Vec3([vertices[0].inSpace])
		const edge = new Vec3([vertices[0].inSpace, vertices[1].inSpace])   // todo: consolidate with edges with one vertex on screen
		const cross = v0.crossProduct(edge) // Like a water surface
		const corner_screen = [0, 0, 1]
		const bias = corner_screen[2] * cross.v[2]

		//let head = [false, false]  // any corner under water any over water?
		let pattern4 = 0, inside = 0
		for (corner_screen[1] = -1; corner_screen[1] <= +1; corner_screen[1] += 2) {
			for (corner_screen[0] = -1; corner_screen[0] <= +1; corner_screen[0] += 2) {
				inside = bias + corner_screen[0] * cross.v[0] + corner_screen[1] * cross.v[1]
				pattern4 <<= 1; if (inside > 0) pattern4 |= 1
			}
		}
		this.corner11 |= 1 << (Math.sign(inside) + 1) // accumulate compact data to check if polygon covers the full screen or is invisible


		if (pattern4 == 15 || pattern4 == 0) return 0
		// check for postive z
		const base = new Vec3([vertices[0].inSpace])
		const direction = new Vec3([vertices[0].inSpace, vertices[1].inSpace]);
		// Gramm-Schmidt
		const corrector = direction.scalarProduct(base.innerProduct(direction) / direction.innerProduct(direction));
		const close = vertices[0].inSpace[2] - corrector.v[2] // Does nearest point have positive z?  full equation. base - corrector  
		if (close < 0) return 0

		// compfort repeat for caller
		pattern4 |= pattern4 << 4  // |= 1<<8 for zero temrination in JRISC
		// for(let i=0;i<4;i++){
		// 	let t=((pattern4 >> i)&1)
		// 	head[t]=true
		// }

		return pattern4 //head[0] && head[1]
	}


	// The beam tree will make everything convex and trigger a lot of MUL 16*16 in the process. Code uses Exception patter: First check if all vertices are convex -> break . Then check for self-cuts => split, goto first . ZigZag concave vertices. Find nearest for last. Zig-zag schould not self cut? 
	// For the MVP, we do best effort for polygons with nore than 3 edges: Ignore up slopes. Do backface culling per span. 
	private rasterize_onscreen(vertex: Array<Item>, payload: Matrix, vertex_control: number[][]) {  // may be a second pass like in the original JRISC. Allows us to wait for the backbuffer to become available.
		const l = vertex.length
		let min_max = [[0, this.half_screen[1]], [0, -this.half_screen[1]]]  //weird to proces second component first. Rotate?

		// todo: why not go over prototype? There is no other class with this property  // perhaps, while designing, there was
		function instanceOfPoint(object: any): object is Point {
			return 'get_y' in object;
		}

		console.log("vertex.length",vertex.length)
		vertex.forEach((v, i) => {
			// const checkme = v instanceof Onthe_border//;console.log("checkme",checkme)
			// if (checkme) {
			// 	//console.log("border", v.border, v.pixel_ordinate_int, v.get_y())
			// 	const d = v.get_y()
			// }
			if (instanceOfPoint(v)) {

				if (v.get_y() < min_max[0][1]) min_max[0] = [i, v.get_y()]
				if (v.get_y() > min_max[1][1]) min_max[1] = [i, v.get_y()]
			}
		});

		//console.log("min_max", [].concat.apply([], min_max), vertex_control)  // change ES to newer then 2019? todo

		const i = min_max[0][0]
		const active_vertices = [[-1, -1, i], [-1, -1, i]] // happens in loop first iteration, (i + l - 1) % l], [i, (i + 1) % l]]
		const Bresenham = new Array<Gradient>(2).fill(undefined).map(() => new Gradient()); // I need to allocate memory because edges reuse this. Otherwise I would need threads for both sides of the polygon or yield 
		// active_vertices.forEach(a => {
		// 	let vs = a.map(b => this.vertices[b])
		// 	if (vs[0].outside != vs[1].outside) {
		// 		// get edge data. Needs a data structure (for sure). Somehow for the rasterizer I calculate it on the fly now
		// 		 this.edge_fromVertex_toBorder(vs, l);
		// 	}
		// 	let v = this.vertices[a[1]]
		// 	v.outside
		// })
		const m = this.m    // our interface to the hardware dependent side. Used for the whole mesh. Handels asset loading and frame buffer (even on the Jaguar we see the frame buffer only through the blitter)

		// The pixel shader does not care about the real 3d nature of the vectors
		// It just knows that it has to divide everything by z (= last element)
		// Matrix is trans-unit. There is no reason for it to be square

		const ps = new PixelShader(payload, this.half_screen)  // InfiniteCheckerBoard is PixelShader
		const es = Array<EdgeShader>(2)
		// this is probably pretty standard code. Just I want to explicitely show how what is essential for the inner loop and what is not
		// JRISC is slow on branches, but unrolling is easy (for my compiler probably), while compacting code is hard. See other files in this project.

		const slope_accu_c = [[0, 0], [0, 0]]  // for debugging. Todo: remove // (counter) circle around polygon edges as ordered in space / level-mesh geometry
		//let slope_int = [0, 0]
		// let slope_accu_s=[[0,0],[0,0]]  // sorted by x on screen  .. uh pre-mature optimization: needs to much code. And time. Check for backfaces in a prior pass? Solid geometry in a portal renderer or beam tree will cull back-faces automatically
		//console.log("min_max", min_max)
		let count_to_one = false
		for (let y = min_max[0][1]; y < min_max[1][1]; y++) {  // the condition is for safety : Todo: remove from release version
			let width = 0
			for (let k = 0; k < 2; k++) {
				const t0 = active_vertices[k][2]; if (typeof t0 !== "number") throw new Error("Invalid vertex ref")
				const t1 = vertex[t0];
				const t3 = t1 instanceof Point;  // duplicated code. Looks like after clipping I should split into vertices and edges. Or at least use a fixed pattern will null placeholders?
				let t2: number
				if (t3) {
					t2 = t1.get_y(); if (typeof t2 !== "number") throw new Error("Invalid vertex")

					if (y < t2) {	//  y < t2   <=  for y=t2             .todo: duplicate this code for the case that on vertex happens on one side
						slope_accu_c[k][1] = es[k].propagate_along()
					}
					else {
						if (count_to_one && active_vertices[0][2] == active_vertices[1][2]) break; // left and right side already aim at the lowest vertex. No need to set up new Bresenham coefficients

						const ind = new Cyclic_Indexer()
						ind.length = l, ind.direction = k
						//console.log("y",y)
						var { x_at_y_int, overshot } = this.streamIn_newVertex(active_vertices[k],active_vertices[1-k][2], Bresenham[k], ind, vertex, count_to_one);
						if (overshot) {
							console.log("overshot")
							break
						}
						if (Bresenham[k].slope[1] < 0 || (x_at_y_int === undefined)) {
							throw new Error("go down!." + x_at_y_int)
						} // I messed up the sign
						count_to_one = true; if (overshot) { console.log("overshot", overshot); break }; // if the last edge is horizontal between two vertices on screen

						{
							let d = Bresenham[k].slope
							//console.log("Bresenham.slope",Bresenham[k].slope)
							if (Bresenham[k].slope[0]==undefined){
								const lll=0
							}
							for(let j=0;j<2;j++)
								if (Bresenham[k].slope[j]==undefined) Bresenham[k].slope[j]=j
							// Bresenham still needs integer slope
							if (d[1] < 0) {
								throw new Error("go down!.")
							} // I messed up the sign
							const way_to_go_to_horizontal_border = this.half_screen[0] - x_at_y_int * Math.sign(d[0])
							if (way_to_go_to_horizontal_border < 0) {
								throw new Error("I figured this is positive") // I messed up the sign
								}
							slope_accu_c[k] = [d[1] * way_to_go_to_horizontal_border > Math.abs(d[0]) ? Math.floor(d[0] / d[1]) : way_to_go_to_horizontal_border, x_at_y_int] // debug with small values
							if (!isFinite(slope_accu_c[k][0]) ||!isFinite(slope_accu_c[k][1]) || isNaN(slope_accu_c[k][0])) {
								throw new Error("slope is NaN")
							}
							//console.log("slope_accu_c", k, slope_accu_c[k], "d", d, "x_at_y_int", x_at_y_int, "y", y)
							if (x_at_y_int==160)
							{
								let lll=0
							}
						}

						es[k] = new EdgeShader(x_at_y_int, y, slope_accu_c[k][0], Bresenham[k], payload, this.infinite_plane_FoV)





						// Alternatives
						// ps.inject_checkerboard(k) 
						// ps.create(e) builder pattern 
						// Either e needs to know parent or parent needs to 
						/*
						if (mode=float_slope)
						if  (d[1]!=0)	slope_accu_c[k][0]=d[0]/d[1]  // we only care for edges with actual height on screen. And exact vertical will not glitch too badly
						// I am going all in to floats / fixed point. No rounding => No DAA  aka  Bresenham. Let the glitches come. 4 kB might be enough code to have a macro to convert all MUL to 16.16*16 muls. I want to check that!
						// Bresenham has an IF. But I need an if for all gradients anyway and the condition and register usage is not better with fixed.point.
						// Fixed point only works better with edge interpolation (no master spanning vectors)- But then Subpixel correcton then needs one MUL per line. Division looks less degenerated though because span length is 16.16 in that case.
						// But what about beam trees? The interpolation is a hack in screen space. It does not work for edges projected from occluding polygons.
						// sub-pixel correction against PlayStation1 (TM) wobble
						slope_accu_c[k][1]= slope_accu_c[k][0] * (y-v_val[0][1])
		
						// Do I allow back faces ? I cannot belive that I want to support non-planar poylgons in any way. Use this as assert / for initial debugging?
						// Clipping leads to polygons with more than 3 vertices. And in both ways: Serially with new vertices in 3d, or (my way) parallel with slopes, those can be non-planar
						// To keep a mesh air-tight, I need (be able) to  cull back-spans 
						//let no_mirror= slope_accu_c[0][0]<slope_accu_c[1][0]  
						//for_mapper.sort()  // non-planar poylgons will vanish. Once again: 16.16 will eliminate this glitch to 1 px every hour. 16.16 still fast than guarding IF commands here! Level is checked for planarity. Keyframe animated characters use triangles. Only stuff like head or armor has poylgons.
						*/
					}
				}
			}

			if (overshot) {
				console.log("overshot")
				break
			}			

			ps.y = y

			width = slope_accu_c[1][1] - slope_accu_c[0][1]

			//console.log("left", slope_accu_c[0][1], "right", slope_accu_c[1][1], "y", ps.y) // Test failed: Width is zero all the time
			if (width > 0 && width < this.screen[0]) {
				ps.span(slope_accu_c[0][1], width, m, es)
			} else {
				//	ps.span(-155, 310, m, es)
			}
		} //while (active_vertices[0][1] != active_vertices[1][1]) // full circle, bottom vertex found on the fly		

		m.drawCanvasGame(vertex_control)
	}

	private streamIn_newVertex(active_vertices: number[],other_verticex:number, Bresenham: Gradient, ind: Cyclic_Indexer, vertex: Item[], count_to_one: boolean): { x_at_y_int: number, overshot: boolean } {
		let v_val: Array<Point> = null, edge: Edge_on_Screen = null // for debugging
		let other_path_already_met = false
		for (let eat_edges = 0; eat_edges < 10 /* safety */; eat_edges++) {
			active_vertices[0] = active_vertices[1]; // This might be null.
			active_vertices[1] = active_vertices[2];  // for debugging I better keep indieces around for a while

			ind.iterate_by_ref2(active_vertices) //[2] = active_vertices[2] + (k * 2 - 1 + l) % l;

			if (other_path_already_met) {
				return { x_at_y_int: 0, overshot: true };
			}
			if (count_to_one && active_vertices[2] == other_verticex) {
				console.log("vertices meet",active_vertices[2] , active_vertices[1][2])
				other_path_already_met = true 
			} // only stream in the last (shared) vertex once
			count_to_one = true

			// So I do need a window over two vertices?
			// tell it like it is! Probable hoist up to the sort
			v_val = new Array<Point>(2)
			edge = null// edge can be impli
			{
				const v_and_e = active_vertices.map(a => a < 0 ? null : vertex[a]); // JRISC does not like addressing modes, but automatic caching in registers is easy for a compiler. I may even want to pack data to save on LOADs with Q-displacement

				if ((v_and_e[2] instanceof Point)) {
					var v_val2: Item = v_val[1] = v_and_e[2];
				} else continue

				let oldest = 1
				if ((v_and_e[1] instanceof Edge_on_Screen)) {
					edge = v_and_e[1];
					oldest = 0
				}

				const lv = v_and_e[oldest]
				if (lv instanceof Point) {
					v_val[0] = lv
				} else continue
			}
			// if (edge==null){
			// 	console.log("edge is null");
			// }


			{
				const a = v_val[0].get_y(), b = v_val[1].get_y();
				//console.log("a", a, "b", b);
				if (a >= b) continue;
			}

			if (edge instanceof Edge_Horizon) // This can only happen at start or end. But this does not help with simplifying the flow
			{
				const for_subpixel = v_val[0]
				if (!(for_subpixel instanceof Onthe_border)) throw new Error("Expected Onthe_border");
				const y_int = for_subpixel.get_y(); // int to seed the Bresenham akkumulator

				var x_at_y_int = for_subpixel.border & 1 ? for_subpixel.pixel_ordinate_int : this.half_screen[0] * (1 - (for_subpixel.border & 2));
				if (x_at_y_int === undefined  || x_at_y_int<-160 || x_at_y_int>160) {
					throw new Error("No edge found")
				}				
				Bresenham.accumulator = edge.bias + gradient.wedgeProduct(new Vec2([[x_at_y_int, y_int]])); //y_int*d[0]+x_at_y_int*d[1]
				break
			}

			// Point supports get_y . So I only need to consider mirror cases for pattern matchting and subpixel, but not for the for(y) .
			if (v_val[0] instanceof Vertex_OnScreen && edge === null && v_val[1] instanceof Vertex_OnScreen) {

				var gradient = new Vec2([(v_val[1]).position, v_val[0].position]);
				//console.log("slope", slope.v)
				// for(let i=0;i< v_val[0].postion.length;i+=2){
				// 	d[i]=(v_val[i] as Vertex_OnScreen).postion[i]-v_val[0].postion[i]
				// }
				//var slope=d// see belowvar slope_integer=
				var d = gradient.v; if (d[1] <= 0) { continue; }
				var y_int = v_val[0].get_y(); // int
				const x_at_y = (v_val[0].position[0] + d[0] * (y_int - v_val[0].position[1]) / d[1]); // frac -> int
				{
					const range = (v_val as Vertex_OnScreen[]).map(v => v.position[0])
					range.sort((a, b) => a - b)
					if (!(range[0] <= x_at_y && x_at_y <= range[1])) {
						console.log("x_at_y", x_at_y, "y - vertex_y", y_int - v_val[0].position[1])
						let x = 1
					}

				}
				var x_at_y_int = Math.floor(x_at_y); // float -> int
				if (x_at_y_int === undefined || x_at_y_int<-160 || x_at_y_int>160) {
					throw new Error("No edge found")
				}

				Bresenham.accumulator = gradient.wedgeProduct(new Vec2([[x_at_y_int, y_int], v_val[0].position])); //(y_int- v_val[0][1] )*d[0]+(x_at_y_int- v_val[0][0] )*d[1]  // this should be the same for all edges not instance of Edge_Horizon
				Bresenham.slope = d
				
				if (Bresenham.slope[1] < 0) {
					throw new Error("go down!.")
				} // I messed up the sign
				//console.log("Bresenham.slope",Bresenham.slope)  Todo: 32bit integer
				break
			}
			var done = false
			if (edge instanceof Edge_w_slope) {
				const both_ways = v_val.slice()
				for (let k = 0; k < 2; k++) {
					var { done, x_at_y_int } = this.clipped_edge_to_Bresenham(both_ways, edge, Bresenham);
					//console.log("x_at_y_int",x_at_y_int)
					if (x_at_y_int === undefined || x_at_y_int<-160 || x_at_y_int>160) {
						throw new Error("No edge found")
					}					
					//console.log("Bresenham.slope",Bresenham.slope,done,k)
					if (done) {
						if (k==0)
						{
							Bresenham.slope = [-Bresenham.slope[0], -Bresenham.slope[1]]
							Bresenham.accumulator = -Bresenham.accumulator;  // I guess

						}
						if (v_val[0] instanceof Vertex_OnScreen){

							x_at_y_int= v_val[0].position[0]; // Todo remove cliiped edge to bresenham calc
							console.log("x_at_y_int overwrite",x_at_y_int,"k",k)
						}
						if (Bresenham.slope[1] < 0) {
							throw new Error("go down!." + k);
						} // I messed up the sign
						//console.log("Bresenham.slope",Bresenham.slope)
						break;
					}
					both_ways.reverse();
				}
				if (done) break
			}

			// todo: unite with corner.
			if (edge == null) {
				const c = [[0, 0], [0, 0]]
				let checker=true  // center of screen would be vertex on screen
				for (let j = 0; j < 2; j++) {
					const v= v_val[j]  // I had a problem with intheritnace.  InstanceOf only here fits both these types
					if (v instanceof Onthe_border) {c[j]=v.get_one_digit_coords()}//;console.log("border",v.border)}
					if (v instanceof Corner) {c[j]=v.get_one_digit_coords()}//;console.log("corner",v.corner)}
					checker &&=  (c[j][0]!=0 || c[j][1]!=0 )
				}
				console.log("checks", c[0],c[1],checker )
				if (  checker ) {  //v_val[1] instanceof Onthe_border && edge == null && v_val[0] instanceof Onthe_border) {
					//const c = [v_val[0].get_one_digit_coords(), v_val[1].get_one_digit_coords()]
					//const b= v_val.slice(0,2).map(v=>v.get_one_digit_coords() )  // TypeGuard does not understand
					let d = [1, 1]
					for (let i = 0; i < 2; i++) {
						if (c[0][i] == c[1][i] && c[1][i] != 0) d[i] = 0
					}
					if (d[0] == d[1]) {
						throw Error("Diagonal lines need Edge with Slope")
					}
					Bresenham.slope = d
					if (v_val[1] instanceof Onthe_border) {
						x_at_y_int = (v_val[1].border & 1) == 0 ? this.half_screen[0] * c[1][0] : v_val[1].pixel_ordinate_int   // This is a dupe
						console.log("x_at_y_int=", (v_val[1].border & 1) == 1, "?", this.half_screen[0] * c[1][0], ":", v_val[1].pixel_ordinate_int)
					}
					if (v_val[1] instanceof Corner) {
						x_at_y_int =  this.half_screen[0] * c[1][0] 
						console.log("x_at_y_int=",  this.half_screen[0] * c[1][0] )
					}
					Bresenham.accumulator = 0
					console.log("y", v_val[1].get_y(), ">", v_val[0].get_y()) ; // Sometiems after hits the code crashes
					break

				}
			}
			// // Inherit edge from screen -- or in the future: from the portal or the (smallest covering) leaf
			// if (v_val[1] instanceof Corner && edge == null && v_val[0] instanceof Corner) {
			// 	const c = [v_val[0].get_one_digit_coords(), v_val[1].get_one_digit_coords()]
			// 	//const b= v_val.slice(0,2).map(v=>v.get_one_digit_coords() )  // TypeGuard does not understand
			// 	let d = [0, 0]
			// 	for (let i = 0; i < 2; i++) {
			// 		if (c[0][i] == c[1][i]) d[i] = 1
			// 	}
			// 	if (d[0] == d[1]) throw Error("Diagonal lines need Edge with Slope")

			// 	Bresenham.accumulator = 0
			// 	break

			// }
		}
		const overshot = false
		//console.log("x_at_y_int",x_at_y_int)
		if (x_at_y_int === undefined|| x_at_y_int<-160 || x_at_y_int>160) {
			throw new Error("No edge found")
		}

		if (Bresenham.slope[0] == undefined) {
			const lll = 0
		}

		return { x_at_y_int, overshot }
	}

	// So again sorting is a big thing. Sorting by z, sorting around the polygon in world space, sorting inside outside of the screen
	private clipped_edge_to_Bresenham(v_val: Array<Point>, edge: Edge_w_slope, Bresenham: Gradient): { done: boolean, x_at_y_int: number } {
		let done=false
		if (v_val[1] instanceof Vertex_OnScreen && v_val[0] instanceof Onthe_border) {
			const gradient = edge.gradient; // see belowvar slope_integer=


			// duplicated code. Function call?
			const d = gradient.v;
			const y_int = v_val[0].get_y(); // int
			var x_at_y_int = (v_val[0].border & 1) == 1 ? v_val[0].pixel_ordinate_int : this.half_screen[0] * ((v_val[0].border & 2) - 1); // todo: method!
				//console.log("x_at_y_int",x_at_y_int);
				if (x_at_y_int === undefined || isNaN(x_at_y_int) || x_at_y_int<-160 || x_at_y_int>160) {
					throw new Error("No edge found")
				}		
			Bresenham.accumulator = gradient.innerProduct(new Vec2([[x_at_y_int, y_int], v_val[1].position])); // this should be the same for all edges not instance of Edge_Horizon
			Bresenham.slope = [-d[1], d[0]]; // I messed up the sign somewhere. Check with test case;
			//console.log("Bresenham.slope",Bresenham.slope)
			done=true
			
		}else{
				
			var x_at_y_int=0
		}

		return {done,x_at_y_int};
	}

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


	private edge_fromVertex_toBorder(vs: Vertex_in_cameraSpace[], l: number): Item[] {

		const on_screen = new Array<Item>()

		const gradient = this.get_edge_slope_onScreen(vs, this.infinite_plane_FoV).slice(0, 2); // 3d cros  product with meaningful sign. Swap x,y to get a vector pointint to the outside vertex. float the fractions
		let edge = new Edge_w_slope()
		edge.gradient = new Vec2([gradient])
		on_screen.push(edge)

		const slope = [-gradient[1], gradient[0]]  // check in test: when hitting the upper border, slope[1] should be negative.

		// switch (this.mode) {
		// 	case modes.NDC:
		// 		var swap = abs[0] > abs[1]
		// 		if (swap) { slope.reverse() }

		// 		if (slope[0] == 0) return
		// 		break
		// 	case modes.guard_band:
		// 		// I guess that this is not really about guard bands, but the second version of my code where roudning of slope can have ( polymorphism, will need a branch ) with positions.
		// 		if (Math.abs(slope[0]) * this.screen[0] < Math.abs(slope[1])) return
		// 		break
		// }

		/*
		// check the top screen corners. Why not check all corners (ah that is the case if both vertices are outside) ? Or rather one!
		// similar code for both cases
		vs[1].onScreen = vs[0].onScreen.slice()
		var si=slope.map(l=>Math.sign(l))  // sign bitTest in JRISC

		vs[0].onScreen
		// Rasterizer sub pixel-precision start value. No NDC or GuardBand here. Just full 32bit maths
		// I use a lot of 32 bit math here. It would be a shame to meddle with the results. So why NDC which rounds the lsb? Why a guard band
		// This code will be called by the rasterizer
		let scanline=(vs[0].onScreen[1] * this.screen[1]  ) 
		let flip=false;if (slope[1]<0) {slope[1]=-slope[1]; scanline=-scanline;flip=true}
		let fraction=scanline % 1
		let integer=Math.floor(scanline)

		// To avoid overflow, I also need x .
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

		*/

		// todo unify with
		//this.which_border(vs[0])




		//if (  slope[0] > slope[1]) { // Nonsense  slope tells us that the edge comes from above.  This is branching only for NDC
		// correct order . At least every other vertex need to be on inside for this function


		let border = -1
		{
			const t = Math.max(0, Math.sign(slope[0])) | Math.max(0, (Math.sign(slope[1]))) << 1  // corner
			// border before. I just went through the truth table in my head
			border = ((t & 1) ^ ((t >> 1) & 1))
			border |= t & 2

			// console.log("slope => border: ",Math.sign(slope[0]), Math.sign(slope[1])," => "+t+" => "+border)

			let d = 0
		}

		// The signs of the slope have a meaning.
		let corner = this.half_screen.map((s, i) => s * Math.sign(slope[i]))  // slope from 3d vector is permutated // I need the corner coordinates to calculate the intersection with the border

		let verts = new Vec2([corner, vs[0].onScreen.position])  // going from vertex to corner. Vertex is sure, corner just a candidate. I hate how minus makes me reverse the entries in this list. Todo?
		let slope_v = new Vec2([gradient]) // slope is already wedged. Just apply the inner product
		const g = (verts.innerProduct(slope_v) > 0)  // Vector going outside. Checking with the corner in the same sense of rotation.
		//  Sign for ++ should always be the same. No, the vector selects a corner, not an edge. 
		// Imagine a vertex close to a border. The vector points towards this border. But now it looks slight left or right;
		// hence it checks out differnt corners.
		// todo: g == value on border .. Somehow the signs seem to flip? .
		if (g) {   // lower border says <0   upper borders says>0
			border++
			border &= 3; console.log("adjusted border", border)
		}

		const to_border_signed = verts.v[border & 1]
		const gradient_builing_up = to_border_signed * gradient[border & 1]
		let chosen_gradient=gradient[1 ^ (border & 1)]  // int 
		//if (chosen_gradient!=0) throw new Error("averted a crash") //chosen_gradient=100 // probably some bug
		const compensate_along_border = chosen_gradient==0 ? 0: gradient_builing_up / chosen_gradient  // can be infinite
		const pixel_ordinate = vs[0].onScreen.position[1 ^ (border & 1)] - compensate_along_border  // compensate means minus

		//for (var corner = -1; corner <= +1; corner += 2) {
		//	if ((corner - vs[0].onScreen[0]) * slope[1] > (-1 - vs[0].onScreen[1]) * slope[0]) {  // ERror Verex 1 is on screen, but vertex 2 is not. outside=true should mean a diferent type!
		// 		vs[1].onScreen[0] = corner //, vs[1].onScreen.border=corner // Todo: I need corners with rotation sense to fill the polygon
		// 		switch (this.mode) { // todo: different edge clases?
		// 			case modes.NDC:


		// 				break;
		// 			case modes.guard_band: // The displacement is given by the other vertex. We store the float 
		// 				// check for overflow
		// 				vs[1].onScreen[1] = slope[1] * (2 << 16) / slope[0] // JRISC fixed point
		// 				break;
		// 		}
		// 		cc++;
		// 		break;	
		// 	}
		// }
		// if (cc == 0) {
		// 	vs[1].onScreen=new Vertex_OnScreen()  // todo: looks like this object will be destroyed right after this function. Or rather: it leaks!!
		// 	vs[1].onScreen.position[0] = -1;
		// 	vs[1].onScreen.position[1] = (vs[0].onScreen.position[0] * slope[1] + this.screen[1 & 1] * (-1 - vs[0].onScreen.position[1]) * slope[0]) / slope[1]; // no rounding error allowed // Error: slope is NaN
		// }
		// else vs[1].onScreen.position[1] = -1;

		let onborder = new Onthe_border(this.half_screen) // todo
		onborder.border = border

		// const axis = border & 1  // border++ implies that we need to look at the lsb
		// {
		// 	const nxs = (~border & 1)  // fail for border=2
		onborder.pixel_ordinate_int = Math.floor(pixel_ordinate) //vs[0].onScreen.position[axis] - (corner[nxs] - vs[0].onScreen.position[nxs]) * slope[nxs] / slope[axis]   // wedge product // The index galore would be a bunch of move in JRISC in the if above.
		//	}

		onborder.z_gt_nearplane = true // todo    . vs[1].onScreen.position[1] > this.near_plane

		on_screen.push(onborder)  // todo check if border edge is defined enough. Then check out why rasterizer cannot get a gradient ( fromt the border / corner info)
		//}

		return on_screen
	}

	private get_edge_slope_onScreen(vertex: Array<Vertex_in_cameraSpace>, half_screen: number[]): Array<number> {
		/*
		view Vector(x,y,1)
		edge= v1-v0
		normal= v0 x edge
		implicit=normal * view
		 */
		const view = new Vec3([vertex[0].inSpace])
		const edge = new Vec3([vertex[0].inSpace, vertex[1].inSpace])
		const normal = view.crossProduct(edge)  // The sign has a meaning 
		for (let i = 0; i < 2; i++) {
			normal.v[i] *= half_screen[i]   // Todo: Move up to the rotation transformation
		}
		// normalize for jrisc
		// mul.w will be applied to x and y components only . 
		// I need to know the screen expontent . x and y on screen need the same exponent to match bias in implicict function.
		// Ah, basicall 16.16
		const list = normal.v.slice(0, 2).map(s => Math.ceil(Math.log2(Math.abs(s))))  // z = bias and can stay 32 bit because FoV ( Sniper view? ) will always keep z-viewing compontenc < 16 bits for 8 bit pixel coords 
		const f = Math.pow(2, 16 - Math.max(...list)), n = normal.v.map(c => Math.floor(c * f))   // Bitshift in JRISC. SHA accepts sign shifter values!   

		// Even for a float slope 16.8 I would float the fraction before-hand
		// I cannot have two inner loops. So vertex-vertex needs to use floats and may hit the border before the vertex due to rounding
		// likewise rounding could change the side we pass a corner
		// I want texture mapping. Along the edges, I want perspective correction for any larger delta_Z . So I need branches for the Bresenham condition anyway
		// So why not stick to it? Gouraud would only have one add: Second render path for small gouraud with 1px away from edge? Real, 1px guradband in hardware?
		// slopes which miss create a non-convex shape. How does this even work with a BSP? Even if the cuts are correct, the algorithm might glitch
		// This has nothing to do with NDC vs GuardBand, though rounding errors in NDC start vertex worsen this effect
		// NDC cannot use slopes. Before scaling to pixels, the cuts need to be set on the borders. Slopes might not pass on the correct side of the corner. 
		// Yeah, how does NDC work with the slopes in a BSP? The wobble due to scaling changes everything
		return n
	}
}



