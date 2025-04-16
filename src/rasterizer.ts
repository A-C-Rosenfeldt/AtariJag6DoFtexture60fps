import { Vec3 } from './clipping.js';
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
		let on_screen = [],cut=[], l = vertices.length
		this.corner11=0 // ref bitfield in JRISC ( or C# ) cannot do in JS
		vertices.forEach((v, i) => {
			let k = (i + 1) % vertices.length
			switch ((pattern32 >> i) & 2) {
				case 3: // both outside, check if the edge is visble
					let pattern4=0
					if (0== (pattern4=this.isEdge_visible([vertices[i], vertices[k]])))  break;
						this.edge_crossing_two_borders(vertices,  pattern4, on_screen);
						//on_screen is pointer to collection:  on_screen.push(...cuts)
					break;
				case 1:
					on_screen.push(v)
					cut=this.edge_fromVertex_toBorder([vertices[i], vertices[k]],  l);
					on_screen.push(cut)
					break
				case 2:
					cut=this.edge_fromVertex_toBorder([vertices[k], vertices[i]],  l);
					on_screen.push(cut)
					break
				case 0: //none outside
					on_screen.push(v)  // Nothing to insert before   // of course in JRISC this would be in a fixed length pool
					break;
			}

		})

		if (on_screen.length>0) { this.rasterize_all_onscreen(on_screen) ;return true}

		// trace a single ray for check. But, can I use one of the patterns instead? pattern32=-1 because all vertices are outside. Pattern4 undefined because it is per vertex
		// tracing is so costly because I need to go over all vertices, actually edges, again.
		// Backface culling does not help.
		// 001 vector is simple to trace though
		// At least in 3d -- it looks -- I need official s,t edges (vertics) ( vertex 0 and 1)
		// v0 + s*S + t * T = z * 001  // we only care about the sign
		// normal = s x t 
		// ( vo | normal ) /  ( z | normal )      // similar equation to  UVZ mapping for txtures and occlusion
		let null_egal=(this.corner11 >> 2 & 1)^(this.corner11 & 1)
		if (null_egal==0 ) return // polygon completely outside of viewing frustm
		// viewing frustum piercing through polygon
		let m = new Mapper()
		// fill whole screen rectangle
		let coords=[-1,-1]
		for(coords[1]=-1;coords[1]<=1;coords[1]+=1/256)
			for(coords[0]=-1;coords[0]<=1;coords[0]+=1/256){{
				m.brute_force(coords)
		}}
			

		return 
		// infi . Though I could define the evil outside as 1. I need to rotate vertex.length to 0. Then logical and detects edges without visible vertex
		for (let shifter = 0; shifter < 32; shifter += vertices.length) {
			pattern32 = pattern32 << vertices.length | pattern32
		}

		// check for double 0  ( some JRISC trick? )
		pattern32 = ~pattern32  // C language cannot rotate. In JRISC I would rotate
		if ((pattern32 & (pattern32 << 1)) == 0) { let at_least_every_second = true }
		else this.rasterize(vertices, pattern32)

		return this.outside[0] // all vertices within viewing frustum  .  Why return?
	}

	rasterize(vertex: Array<Vertex_in_cameraSpace>, pattern32: number): boolean {
		if (this.outside[0] == false) return this.rasterize_every2nd_Inside(vertex)

		// Since I accept polygons in original geometry, and the allInside rasterizer looks clean,
		// I should adapt that function for clipped polygons for mixed cases

		if (this.outside[1]) {
			// trace a single ray for check
			let m = new Mapper()
		} else {
			// see if edges between vertices run inside of a corner
			// rough cull

			let l = vertex.length   //weird to proces second component first. Rotate?
			for (let i = 0; i <= l; i++) {
				let k = (i + 1) % l, pattern4 = 0
				if ((pattern32 >> i & 3) == 0 && 0 != (pattern4 = this.isEdge_visible([vertex[i], vertex[k]])))// huh? Since I already did this? Todo: find all cases!	
				{

					this.edge_crossing_two_borders(vertex, i, pattern4, k);
					vertex.splice(0, 0) // cutting points insert
				}
			}

		}
	}

	private edge_crossing_two_borders(vertex: Vertex_in_cameraSpace[], pattern4: number, on_screen) {
		let slope = this.get_edge_slope_onScreen(vertex);

		for (let border = 0; border < 4; border++) {
			if ((pattern4 >> border & 1) != (pattern4 >> (border + 1) & 1)) {


				// code duplicated from v->edge
				let coords=[0,0]
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
		let pattern4 = 0,inside=0
		for (corner_screen[1] = -1; corner_screen[1] <= +1; corner_screen[1] += 2) {
			for (corner_screen[0] = -1; corner_screen[0] <= +1; corner_screen[0] += 2) {
				inside = bias + corner_screen[0] * cross.v[0] + corner_screen[1] * cross.v[1]
				pattern4 <= 1; if (inside > 0) pattern4 |= 1
			}
		}
		this.corner11|= 1 << (Math.sign(inside)+1) // accumulate compact data to check if polygon covers the full screen or is invisible
		
		

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

	rasterize_all_onscreen(vertex: Array<number[]>) {
		let l = vertex.length, min = [0, vertex[0][1]]   //weird to proces second component first. Rotate?
		for (let i = 1; i < l; i++) {
			if ( vertex[i][1] < min[1]) min = [i, vertex[i][1]]
		}

		let i = min[0]
		let v = vertex[i]
		let active_vertices = [[i, (i + l - 1) % l], [i, (i + 1) % l]]

		// active_vertices.forEach(a => {
		// 	let vs = a.map(b => this.vertices[b])
		// 	if (vs[0].outside != vs[1].outside) {
		// 		// get edge data. Needs a data structure (for sure). Somehow for the rasterizer I calculate it on the fly now
		// 		 this.edge_fromVertex_toBorder(vs, l);
		// 	}
		// 	let v = this.vertices[a[1]]
		// 	v.outside
		// })

		let y = v[1]
		do {
			let ny = Math.min(...active_vertices.map(a => vertex[a[1]][1]))

			for (; y < ny; y += 1 / 256) {  // floating point trick to get from NDC to pixel cooridinates. 256x256px tech demo. Square pixels. Since I don't round, any factor is possible. Easy one is 256  * 5/4-> 320  .. 256 * 3/4 = 192

			}
		} while (active_vertices[0][1] != active_vertices[1][1])

	
	}

	// even if not perfectly convex, this will not crash: checked for find()
	// back-face culling  ->  mapper
	// I need this code as a start. Clipping is important to me. Frustum already demonstrates this
	// Later with the beam tree, the sectors are still convex.
	// Also I may defer some rendering / use bounding boxes and use this for unobstructed polygons on high-detail, smooth models (streets, vehicle, humans).
	// to combine multiple sectors, Doom like span rendering is necessary
	rasterize_every2nd_Inside(vertex: Array<Vertex_in_cameraSpace>): boolean {
		let l = vertex.length, min = [0, vertex[0].onScreen[1]]   //weird to proces second component first. Rotate?
		for (let i = 1; i < l; i++) {
			if (vertex[i].outside == false && vertex[i].onScreen[1] < min[1]) min = [i, vertex[i].onScreen[1]]
		}

		let i = min[0]
		let v = vertex[i]
		let active_vertices = [[i, (i + l - 1) % l], [i, (i + 1) % l]]

		// active_vertices.forEach(a => {
		// 	let vs = a.map(b => this.vertices[b])
		// 	if (vs[0].outside != vs[1].outside) {
		// 		// get edge data. Needs a data structure (for sure). Somehow for the rasterizer I calculate it on the fly now
		// 		 this.edge_fromVertex_toBorder(vs, l);
		// 	}
		// 	let v = this.vertices[a[1]]
		// 	v.outside
		// })

		let y = v.onScreen[1]
		do {
			let ny = Math.min(...active_vertices.map(a => this.vertices[a[1]].onScreen[1]))

			for (; y < ny; y += 1 / 256) {  // floating point trick to get from NDC to pixel cooridinates. 256x256px tech demo. Square pixels. Since I don't round, any factor is possible. Easy one is 256  * 5/4-> 320  .. 256 * 3/4 = 192

			}
		} while (active_vertices[0][1] != active_vertices[1][1])

		return false
	}



	private edge_fromVertex_toBorder(vs: Vertex_in_cameraSpace[],  l: number) {
		let slope = this.get_edge_slope_onScreen(vs).slice(0, 2);
		if (slope[0] < slope[1]) { // slope tells us that the edge comes from above
			 // correct order . At least every other vertex need to be on inside for this function

			// check the top screen corners
			let cc = 0;

			for (let corner = -1; corner <= +1; corner += 2) {
				if ((corner - vs[0].onScreen[0]) * slope[1] > (-1 - vs[0].onScreen[1]) * slope[0]) {
					vs[1].onScreen[0] = corner;
					vs[1].onScreen[1] = vs[0].onScreen[1] + (corner - vs[0].onScreen[0]) * slope[1] / slope[0];

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
		let normal = view.crossProduct(edge)

		return normal.v
	}


	sort_y_triangle(a, b, c) { // no life sort. Only program pointer. Struct will be sorted in branch
		if (a > b) {
			if (c > a);
			else;
			//fill a
			if (c < b);
			else;
		} else {

		}
	}
	sort_slope() { }

}

// looks like I use homogenous coordinates for vertices, even if I do not like the name. I like rational numbers
class Vertex_Q {
	is_cut: boolean
	ordinate: Array<number>
}

// to cater to the blitter, I need to pick the low-hanging fruits. Doom has a lot of quads. Portals often have more than three vertices. Clipping gives me even more. I want to allow clipping of a convex polygon into another.
class Polygon_clipped_by_portal extends Polygon_in_cameraSpace {
	vertices: Vertex_Q[]
	y_segment: number  // why again does TypeScript not have integers? This really complicates compiling to JRISC. Now I have to mark the vector class for really using float?
	branch: boolean // 2023-12-26 as a muse I play around with the idea of rendering polygon cut by other polygon. This is geared towards the original Elite with ships with convex shape in front of each other. I don't expand this towards a ridge in front of another polygon. At some point, the tree becomes faster. 
	rasterize(): void {
		let pv: Array<Array<number>> = this.vertices.map((v, i) => {
			//let z=1/v.ordinate[0]  // this works for cuts and for projection just as normal floats do
			//return [v.ordinate[1]*z,v.ordinate[2]*z]  // so these are floats because they share z. Sadly, in conflict with my concept 
			return [Math.floor(v.ordinate[2] / v.ordinate[0]), i]  // this agrees with  rasterizer.txt
		})
		pv.sort(v => v[0])
		// I use the good old algorithm: Scanline rendering
		let activeEdgeList = [[]]
		pv.forEach(v => {   // JRISC can only run the blitter in parallel to it. Theire is no internal paralle operation.
			activeEdgeList.forEach(ae => {
				if (Math.abs(v[1] - ae[0][1]) == 1) shift_active_vertices
			})
			this.vertices[v[1]]  // pointer instead? At least, that would be typed. I can also type indices I guess .. in TypeScript or my own language

			return v
		})

	}

	// To merge trees. This is not part of the rasterizer. At the moment it is a comment, how the data structure comes into life
	// Also I want to defer as much logic as possible into the rasterizer to keep the blitter busy without adding latency.
	// So this should sit in the same class sharing the same data ( which will be queued out to DRAM once).
	clip(other: Polygon_clipped_by_portal) {

	}
}


