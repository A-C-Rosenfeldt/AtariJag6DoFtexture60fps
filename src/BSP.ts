// Todo: Add a mesh. Strips may or not may make sense. Backface culling. Global edge length sort. advance over longest edge with face on other side
/*
The arbitraryness of the BSP is hard to discuss away. With lazy precision it is worth more to recombine split polygons.
The biggest motivation are roughe splits needed for spatial subdivision of the scene.
So on both sides of this split polygons will meet. Occluded Polygons are not always convex. The data strucutre for the shape is also a BSP.
When I remove the cut, I may find out that multiple edges were cut, and one of them is higher in one side and the other in the other side.
So I gotta keep the BSP. I just need to hide cut edges from Bresenham (in the loop over y). Then flood fill the sector on the left.
So picking edges just got high memory needs.
Additionally, criss cross cuts can happen. The BSP just needs to make sure that they are inside the visible vertices.
The Rasterizer only needs the y of the visible vertices ( this the second inner loop ).
This cuts are T if different edges were chosen as grandchilds.
Invisible cuts pull precision for consistency. Once the sign is sure, it stops. This almost makes me beg for precision pulls.

Instead of floodfill into a BSP, I could store the visible polygon as a list of (not necessarily) convex polygons created by fusing BSP children.
So if the children have any overlap on the split of their parents: fuse.
Of course, I render each polygon in the list individually. I don't want to stress my linear sort.
Ah, debris seen from above with a huge ground plane will crash this. I need to limit the fusing: bottom up, only convex. I don't want to start with enclaves

This means that there is no BSP independent intermediate data structure, which could eliminate the influence of the decisions.
I kinda got rid of the idea that there is synergy between perspective correction and BSP ( thanks to the expensive precision ).

I do BSP before portals because portals are boring and BSP only needs two triangles ( and for portal: one portal and one triangle is quite artificial).
*/

import { assert } from "chai";
import { Vec, Vec2, Vec3 } from "./clipping.js"
//import { Vertex_OnScreen } from "./Item"

class CanvasObject {
	static screen = [640, 400];
	toCanvas(ctx: CanvasRenderingContext2D) { }   // virtual  todo Placeholder
}

// OOD of polygon shader got a bit messy in rasterizer.ts. Clean version 2025-12-05
// clearly the normalized data looks like this
class Vertex_in_cameraSpace {
	onScreen: Vertex_OnScreen  //nullable
}
export class Polygon_in_cameraSpace implements CanvasObject {
	fillStyle: string;
	// I feel like this will the method for all polygons not matter if clipped
	// Clipped edges behave special on projection, but actually clipping and projection happen shortly after each other
	// We persist screen coordinates ( ah, well, z does not exist for clipped edges ) . Just integers for scanlines
	toCanvas(ctx: CanvasRenderingContext2D): void {
		// leaf (debug) ToCanvas needs the area to fill
		if (false) {
			ctx.fillStyle = this.fillStyle
			ctx.beginPath()
			ctx.moveTo(...this.vertices[0].normalize(-debugshift))
			this.vertices.forEach(v => ctx.lineTo(...v.normalize(-debugshift)))
			ctx.closePath()
			ctx.fill()  // stroke()
		}
		this.edges.forEach(e => e.toCanvas(ctx))
		ctx.fillStyle = "#911"
		this.selected %= this.vertices.length
		this.vertices.forEach((v, i) => v.toCanvas(ctx, i == this.selected))
	}
	selected = -1
	constructor(vs?: Array<Vertex_OnScreen>, fillStyle = "rgba(0, 136, 0, 0.2)") {
		if (vs === undefined) return
		this.vertices = vs
		let lv = vs[vs.length - 1]
		this.edges = vs.map(v => {
			const e = new Edge_on_Screen()
			e.vs = [v, lv]; lv = v
			return e
		}
		)
		this.fillStyle = fillStyle
	}
	vertices: Array<Vertex_OnScreen>
	edges: Array<Edge_on_Screen> // double link: edges point to vertices, and may later point to faces in a mesh
}

/* // // nodes seem to be edges
// // rasterizer.ts: edg_fun => item . Only lives as marker on the item list. It is nothing like a node
// // item.ts
// export class Edge_on_Screen implements Item {
// }// and children. Those have properties that we want. But : how to avoid double inheritance?
// for the BSP test I assume 2d. No borders
// This may return for portals. Or there is just convex polygon code
// Without portals, viewing frustum and BSP do not have much in common
function CreateTreeFromScreenBorders(): BSPtree {
	const b = new BSPtree()
	b.root=new BSPnode()
	b.root.split_line_beam=new Vec3([[1,0,1]])
	return b
} */


export class Vertex_OnScreen implements CanvasObject {
	constructor() {
		this.z = 1
	}
	toCanvas(ctx: CanvasRenderingContext2D, selected = false): void {
		const size = selected ? 3 : 1
		const full = 1 + 2 * size
		ctx.fillRect(...this.normalize(size - debugshift), full, full)
	}
	xy: Vec2 // co-ordinate
	z: number

	//const coordinates = (id: number) => [id, id] as const;
	// const coordinates: (id: number) => [number, number]

	normalize(offset = 0): [number, number] {
		const v = this.xy.scalarProduct(1 / this.z).subtract(new Vec2([[offset, offset]])).v
		// does not work if (v.length==2) return v ;// typeGuard 
		return [v[0], v[1]]  // okay for only 2
	}
}

// So he BSP is a construct hovering over the actual polygons. Like an index in the database
// If I feel the need for an edge object for debugging (and rendering), they are real
// Likewise infinite lines are a real way to focus on the parting propterty. Should I call them cuts? It is like cutting a polygon out of a sheet of paper using large scissors.
// But the name is already common. BSP Partitioning like in a database. No reference to cut. Probably because we keep both parts (after all, BSP is only necessary if we have more than one polygon)
// full Draw method for polygon. I call it "ToCanvas" to mark it as debug function. I could also call the debug view wireframe
// For the solid shading, the polygons don't have their own draw method, but are edge walkers called by the face => completely different interface. Also other state: uh, at one point I gotta include clipping on view frustum
// So this is like Edge_between_vertices, while the partition is like the Horizon_Edge 

const debugshift = 8

export class Edge_on_Screen implements CanvasObject {
	vs: [Vertex_OnScreen, Vertex_OnScreen]
	toCanvas(ctx: CanvasRenderingContext2D): void {
		ctx.strokeStyle = '#bbb'
		ctx.beginPath(); // Start a new path
		ctx.moveTo(...(this.vs[0].normalize(-debugshift))); // Move the pen to (30, 50)
		ctx.lineTo(...(this.vs[1].normalize(-debugshift))); // Draw a line to (150, 100)
		ctx.stroke(); // Render the path

		// Might be need if caller is BSPtree this.vs.forEach(v=>v.toCanvas(ctx))
	}
}

class BSPnode_ExtensiononStack extends Polygon_in_cameraSpace {
	ctx: CanvasRenderingContext2D;
	toCanvas(ctx: CanvasRenderingContext2D): void { // dupe
		ctx.fillStyle = "green";
		ctx.beginPath()
		ctx.moveTo(...this.vertices[0].normalize(-debugshift))
		this.vertices.forEach(v => ctx.lineTo(...v.normalize(-debugshift)))
		ctx.closePath()
		ctx.fill()  // stroke()
		throw new Error("Method not implemented.");
	}
	//convex_polygon: Array<Vertex_OnScreen>[]   // cuts and perspective correction both want a z value ( homogenous coordinates : w ). Z-buffer z lives in clipspace and is different. I don't care for z-buffer (because it is so cumbersome to use on Jaguar).
	face_or_edge: boolean
	DFS(n: BSPnode | Leaf, pi?: Array<Vec2> /*ref*/): number {
		let portal = [pi]

		if (this.face_or_edge) {
			if (n instanceof BSPnode) {
				portal = n.toCanvas(this.ctx, pi)
			} else {
				if (n instanceof Leaf) {
					console.log("Leaf.ToCanvas")
					if (pi == null) {
						console.warn("Polygon covers whole screen")
					}
					n.toCanvas(this.ctx, pi)
				}
			}
		}

		if (portal.length == 0) return 0
		if (n instanceof BSPnode) {
			n.children.forEach((c, i) => {
				console.log("child ", typeof c == "object" ? c.constructor.name : "u")
				const l = this.DFS(c, portal[i])
				// It is possible to hide the bug one level. Looks like ToCanvas is correct, but insertEdge is not . if (l==0) this.DFS(c, portal[1-i])  // debugging. There has to be a better way?
			})
		}
		return 1
		//constructor()
	}
}

var variance = 0

// to harmonize splitting with lazy precision
class BSPnode_edge {
	xy: Vec2  //normal
	z: number  // bias
	decide(v: Vertex_OnScreen): number {
		return this.xy.innerProduct(v.xy) + this.z * v.z  // I changed sign of z to make this a 3d inner product as mandated by a beam tree
	}

	// import {Portal} from "./pyramid.js"
	// import { Vec, Vec2, Vec3 } from "./clipping.js"

	toCanvas(ctx: CanvasRenderingContext2D, pi?: Array<Vec2> /*ref*/) {


		let r: [number, number], last = 0, current = last, l = 0, last_v: Vec2
		const count_splits = 2
		let portal = new Array<Array<Vec2>>(count_splits) // We split the parent polygon into two -1 ==0 and +1= 1
		for (let i = 0; i < count_splits; i++) portal[i] = Array<Vec2>()

		// let JRSICbitfield32 = 0

		const pi_eq_null = pi == null;
		if (pi_eq_null) {
			const count = 4
			var pi = new Array<Vec2>(count)
			for (let corner = 0; corner < count; corner++) {
				const gray_xy = corner ^ ((corner & 2) >> 1)  // check code in screen clipping for single polygon
				// cycle => xy   00 01 ! 10 11 ! 00
				//               00 01   11 10   00
				pi[corner] = new Vec2([BSPnode.screen.map((s, i) => (((gray_xy >> i) & 1) == 0 ? 0 : s))]) // one goal was to use explicit code to show the edge cases and allow logs and break points. So this code will stay and be amended by polygon (portal) code. 
			}
		}

		ctx.strokeStyle = "#FF01"
		ctx.beginPath()
		const cache = new Array<number>(length);// cache lazy infinite precision values
		for (let corner = 0; corner < pi.length; corner++) {
			var v = pi[corner]; // one goal was to use explicit code to show the edge cases and allow logs and break points. So this code will stay and be amended by polygon (portal) code. 
			// This is not the inner loop. If I want to remove branches, I need to optimize the compiler to unroll loops and implement those lag by one iteration variables
			//const v = new Vec2([cxy])
			co = [v.v[0] + debugshift, v.v[1] + debugshift] //;console.log("v",co[0],co[1])
			if (l++ == 0) ctx.moveTo(...co)
			else {
				ctx.lineTo(...co)

			}

			current = this.xy.innerProduct(v) + this.z  // todo: * v.z . inner product when corners are assumed to be vertices at a distance
			// let sign = 0
			// // Make JRISC behaves like this! Signed int2
			if (current < 0) { last = current; last_v = v }
			if (current > 0) { last = current; last_v = v }
			cache[corner] = current //JRSICbitfield32 |= sign << (corner * 2)   // *2 becomes <<1 in JRISC

		}
		ctx.closePath()
		ctx.stroke(); l = 0
		const back = ctx.lineWidth
		ctx.lineWidth = 5
		ctx.strokeStyle = "#0" + variance.toString() + "F"; variance = (variance + 1) % 10
		ctx.beginPath()

		for (let corner = 0; corner < pi.length; corner++) {  // todo: polyon aka portal code

			v = pi[corner]
			current = cache[corner] //(JRSICbitfield32 >> (corner*2)) & 3
			//if (current == 2) current = -1 // 2-complement, aka Shift Arithmethic Right in JRISC and some high level languages
			if (Math.abs(Math.sign(last) - Math.sign(current)) > 1) { // todo: bug does not work 
				if (pi_eq_null) {
					// todo: reactivate this fast path. Perhaps bring back typed vertices
					let cxy = v.v.slice()
					const from_last = (corner ^ 1) & 1;
					let from_corner = current / this.xy.v[from_last]
					cxy[from_last] -= from_corner
					var co: [number, number] = [cxy[0] + debugshift, cxy[1] + debugshift]
					ctx.fillStyle = "#F80"
					ctx.fillRect(co[0], co[1], 1, 1)
					var cut = new Vec2([cxy]);
					//console.log("cut",cut.v)
				} else {
					const edge = last_v.subtract01(v);
					let from_corner = current / edge.innerProduct(this.xy)
					var cut = v.subtract(edge.scalarProduct(from_corner))
					co = [cut.v[0] + debugshift, cut.v[1] + debugshift]
					ctx.fillStyle = "#288"
					ctx.fillRect(co[0], co[1], 1, 1)

				}
				for (let i = 0; i < 2; i++) {
					if (typeof cut === undefined) console.warn("undef split")
					portal[i].push(cut)
				}

				if (l++ == 0) ctx.moveTo(...co)
				else {
					ctx.lineTo(...co)
					ctx.stroke()
				}
				// console.log("check for splits",co,last_v.v)
				const dummy = 0
				// It looks like there is no way around data oriented code as the portal is cut from the borders
				// placeholders seem to bloat code. Do not use in 2d. Perhaps merge with 
			}


			if (typeof v === undefined) console.warn("undef passthrough")
			if (current == 0) {
				for (let i = 0; i < portal.length; i++) portal[i].push(v)
			} else {
				const i = (Math.sign(current) + 1) / 2
				if (i != 0 && i != 1) { console.warn("only two sides of a coin", i) }

				try {
					portal[i].push(v)
				} catch {
					console.log("portal", portal, i)
					const dummy = i
				}

				last = current// Hysteresis				
			}

			last_v = v
		}
		if (l > 2) {
			console.warn(" 2 < l== ", l, pi_eq_null)  // 0 happens pretty ofte !?
		}

		ctx.lineWidth = 1 //back
		return portal


	}

	verts: [Vertex_OnScreen, Vertex_OnScreen]
}

// So this is like Horizon_Edge , while the partition is like the Edge_between_vertices
class BSPnode extends CanvasObject {
	children: (BSPnode | Leaf)[] = new Array<BSPnode>() // 0,1   
	edge: BSPnode_edge

	// local in a mesh : local variables hold Vertice  see Edge_on_Screen
	// elsewhere : the math likes this
	//split_line_beam: Vec3  // no rounding for lazy_precision_float
	// I flatten the structure her. Node is not fat enough for more structure. Vec3 is misleading

	ref_count: number;


	decide_edge(e: BSPnode_edge, fillStyle: string, last_edge_of_polygon = false): void {//:BSPnode_childref { 
		const explicit_mesh = e.verts.map(v => this.edge.verts.indexOf(v))
		const sides = explicit_mesh.map((f, i) => {
			if (f >= 0) {//console.log("vertex eq by index");
				return 0
			}
			return Math.sign(this.edge.decide(e.verts[i]))
		})
		//if (Math.abs(sides[0]-sides[1])>1) console.log("decide edge", sides)
		//if (Math.abs(sides[1]-sides[0])>1) // split ausrechnen
		for (let s = 0; s < 2; s++) {
			if (sides.map(si => si == (2 * s) - 1).reduce((p, c) => p || c, false)) {
				let c = this.children[s]
				if (c == null || (c instanceof Leaf)) {
					const n = new BSPnode()
					n.edge = e
					this.children[s] = n  // I don't want too many instanceOf in my code.

					if (c != null) {					// todo : Check for z
						if (c instanceof Leaf) {
							// reuse Leaf to avoid garbage
							c.fillStyle.push(fillStyle)
							n.children[0] = c

							// Leaf is going to hold flood fill data because it lives outside the stack
							// so: keep it a tree!
							const l = new Leaf();
							l.fillStyle = c.fillStyle
							n.children[1] = l

						}
					} else {
						if (last_edge_of_polygon) {
							const l = new Leaf();
							l.fillStyle = [fillStyle]
							n.children[0] = l  // 0 should be inside . front faces go around the clock. clean uo 2d resr data
							console.log("new leaf", n.children[0].fillStyle)
						}
					}
				} else {
					//return 
					c.decide_edge(e, fillStyle, last_edge_of_polygon) // todo: so at least one child should be filled, but right now I see none
				}
			}
		}
	}

	toCanvas(ctx: CanvasRenderingContext2D, pi?: Array<Vec2> /*ref*/) {
		return this.edge.toCanvas(ctx, pi)
	}


	// This only should live while inserting a mesh
	// In JS Objects can aquire and lose properties during their lifetime.
	// On Jaguar I would probably live with nullable. Or I use references. Shrinking objects are a memory allocation nightmare



	// For the test bench: Still: Don't haluzinate the existance of vertices withing in the tree
	// ViewVector.InnerProduct(beam)


	// 2d vectors are used in my renderers to postpone DIVs . After BSP unit tests Do: Import the correct type with precision
	// this could be 0,0 if merging still needs to happen, for this.resolve_occlusion_order

	// These methods live on the node because I plan to use bounding volumes and portals
	// 3d polygons are convex in my engine. There is a BSPtree.insert()
	insertPolygon() {
		// Block extreme degeneration where addressing in a tree cannot be done with a 32bit pointer anymore. JRISC is 32bit!!!! Log error, don't freeze.

		// Heurisitc is usally a problem for BSP. Random is hard to debug and unfair. I found some cheap heuristic for my limited soup
		// after splitting down the polygon into cells of the BSP
		// prefer any edge which crosses the whole cell  ( boolean logig)
		//  close to center: Convex polygon can be triangluated as a fan. Calculate cg of each triangle. Sum . Expensive
		// Add this (toned down): Short cut, aka the length of the clipped edge (within this sector) . If we only do short cut, we would get chipped of corners.
		// prefer edges with at least one end on the border (or maybe not? The TieBreak seems to hint )
		//  with multiple edges on different borders: normalize border vector. Biggest wedge product wins
		//   fast inverse sqrt is a thing, but I did not need it elsewhere in the renderer, why here? Code smell!
		//   I propose: wedge product of the parent, but only the part which is also a part of the sector border
		// edge with biggest wedge product with parent edge (no need to normalize because we compare all candidates to the same parent)
		//  this is really cheap and breakes the tie! It could be uses within the previous groups
		// Tie brake does not care about tolerance, but of course likes to use the highest quality parameters it can fit into 16x16 
		// convex polygons don't cut into themselves. So, with the given information there is not much left to optimize
		//  I can find no reason to follow the polyon after the first edge has been identified. This would work if the first edge sticks in the border on one side?
		//   if another edge sticks, we should prefer that one
		// Insertion is serial, so the model mesh could be stored in a serial fashion as a strip/fan ( flags says, which vertex will be reused)
		//  prefer shared edges 

		// For portals I did only need to deal with polygons, but with two beam tree, I need sectors on the outside
		// So I need to check above rules for rectangular borders
		//  imposing order on those feels wrong (but after choosing, KD-tree motivates the symmetry break)
		// The other rules translate to my old code
		//  prefer horizon
		//   then vertex to border
		//   then vertex vertex
		// then prefer
		//  longer ( R^2 norm )

		// Debugging: Seems like I not only need to show vertices. But also edges and those of the tree. Use color and allow toggle ( number keys? ).
		// BSP edges are stored like polygon edges
		//  elongation can "upgrade" a vertex to border -- an edge to horizon
	}
	// before insertion?
	resolve_occlusion_order(split_from_3d_cut: number[], grandchildren: BSPnode[]) { }
}

class Leaf {
	fillStyle: string[]  // InfinitePlane  -- z info and shader
	toCanvas(ctx: CanvasRenderingContext2D, pi?: Array<Vec2>): void {



		var sum = this.JavaScriptCSS_bloat( this.fillStyle[0] )
		
		const i2=[0]
		//const sum = i2.reduce((p, c) => p.map((q, i) => q + c[i], [0, 0, 0]));
		const avg = sum.map(s => (s / i2.length).toString()).join() // //.toString(16)).join()
		ctx.fillStyle = "rgba("+avg+")" // this.fillStyle[0] //avg  // todo: sort by z  (find cut, decide edge, choose fillStyle)
		console.log("ToCanvas ", ctx.fillStyle, avg)
		ctx.beginPath()
		console.log(pi)
		if (pi.length<3) return
		const v = pi[0] //.normalize(-debugshift);  v should be xyz (Vec3) because either it is a projected vertex, or some cross product
		//const co = [v.v[0] + debugshift, v.v[1] + debugshift]
		ctx.moveTo(v.v[0] + debugshift, v.v[1] + debugshift)
		pi.forEach(v => {
			ctx.lineTo(v.v[0] + debugshift, v.v[1] + debugshift)
		})
		ctx.closePath()
		ctx.fill()  // stroke()

	}

	private JavaScriptCSS_bloat(layer : String) {
		// Source - https://stackoverflow.com/a
		// Posted by Niet the Dark Absol, modified by community. See post 'Timeline' for change history
		// Retrieved 2026-01-08, License - CC BY-SA 3.0
		// Source - https://stackoverflow.com/a
		// Posted by Paul
		// Retrieved 2026-01-08, License - CC BY-SA 3.0
		//		/^[+-]?\d+(\.\d+)?$/		
		const m = layer.match(/^rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*[+-]?\d+(\.\d+)?\s*\)$/i);
		if (m) {
			sum = m.slice(1).map(t => parseFloat(t));
		} // End stack overflow

		else {
			var items = this.fillStyle[0].match(/[0-9a-z]{2}/gi);
			//.map(s => s.match(/[0-9a-z]{2}/gi).map(t => parseInt(t, 16)))
			var sum = items.map(t => parseInt(t, 16));
		}
		return sum;
	}
}


export class BSPtree implements CanvasObject {
	// constructor  
	root: BSPnode // I come to the conclusion that basically a tree with zero nodes is valid, for example after culling
	insertPolygon(p: Polygon_in_cameraSpace) {
		//console.log("insertPolygon", p.fillStyle)
		{//if (this.root == null) { // I imply the screen borders to be match my clipping code
			const v3=p.vertices.slice(0,3).map(v=>new Vec3([v.xy.v.concat(v.z)]))  // backface culling in 3d. One of the perks of subpixel correction. // By my definition, the first two edges span up the plane (default s,t and basis for u,v mapping). The level editor needs to make sure that the rest align ( kinda like in Doom space ). I may add a scene graph just to allow to rotate Doomspace objects with infinite precision.
			const edge:Vec3[]=[]
			for(let i=0;i<2;i++){ // somehow array functions do not work for this. Todo: Move behind edge code
				edge.push( v3[i].subtract01(v3[1+1]) )
			}
			
			const normal=edge[0].crossProduct(edge[1])  // Todo: Cross product optional parameter for z only? I don't want to leak the internal sign convention here
			if (normal.v[2]<0){
				// p.vertices.reverse(); console.log("reverse")  // This disturbs the parser. Todo: Prepass! On level load: Polygon -> binary. Then fix order. Per frame: backface culling / mark for debug
			}

			const s = p.edges.map(e => {
				const vecs = e.vs.map(v => new Vec2([v.normalize()]))  // vertices start with v. I should rename to point to differentiate from vector -- but what about Transformation?
				const delta = vecs[0].subtract01(vecs[1]) 
				if (normal.v[2] >= 0) e.vs.reverse()  ;// Do I want to support back faces? With a decoupled loader, this can move out of here
				const r: [number, Edge_on_Screen] =
					[delta.innerProduct(delta), e]   //  ref type
				return r
			})
			s.sort((a, b) => a[0] - b[0])
			for (let i = s.length - 1; i >= 0; i--) {
				const n = new BSPnode_edge()
				const verts = (s[i][1]).vs    //new Vec2( [ lv[1].normalize() ]  ) )

				// cross product of the beam tree. Trying to optimize, but still 6 multiplications = 2+2+2
				const delta = verts[0].xy.scalarProduct(verts[1].z).subtract01(verts[1].xy.scalarProduct(verts[0].z)).v  // calculation with fractions. No division. Looks random. Should this the duty of the compiler?
				// n.xy = new Vec2([[delta[1], -delta[0]]])  // wedge
				// n.z = -verts[0].xy.innerProduct(n.xy) / verts[0].z // be obvious how the implicit function would be 0 on a vertex => no wedge here and not "source of truth" ref to verts

				n.xy = new Vec2([[delta[1], -delta[0]]])//.scalarProduct( verts[0].z) // cross
				n.z = -verts[0].xy.innerProduct(n.xy)  // be obvious how the implicit function would be 0 on a vertex => no wedge here and not "source of truth" ref to verts
				//n.xy = n.xy.scalarProduct( verts[0].z) // cross

				// see:  this.xy.innerProduct(v.xy) - this.z * v.z              this=edge=n  = function    apply to ->  <- parameter  v= vertex =verts[], not normalized
				// first the * v.z is compensated by / v.z , then the - does not need to be compensated here. Is it weird that I compensate at application?

				// mesh insertion needs references to vertices
				n.verts = verts  // Todo: check that this is readonly ! 

				if (this.root == null) {
					const b = new BSPnode()
					b.edge = n
					this.root = b
				}
				else {
					this.root.decide_edge(n, p.fillStyle, i == 0) // insert edge

					// this.root.insertPolygon(s.slice(0,i)) // to work for all sides 
					// const midpoint_w=verts.map(v=>parent.decide(v)).reduce((p,c)=>p+c)  // fractions // Does this need an epsilon, or check vertex indices or infinite precision?
					// parent.children[(Math.sign(midpoint_w)+1)/2]=n

				}

			}


		}
		// run the vertices down the tree . So, like clipping to screen borders. Vertice, edges , planes? Ah, plane check is the same for the whole screen.
		// const b = new BSPnode   // on common parent
		// b.insertPolygon()  // todo: still happens on a node
	}
	// this algorithm can queue in a compact data structure to draw trapezoids deferred if I wanna try vsync tricks
	floodfill() {
		// start with one node
		// punch through seams (on both sides because I don't want sort overhead)
		let y_max: number // keep track of the y when the next vertex will be passed
		let invaded: BSPnode[][]  // [left, right],[distance]

		let self = new PartialFilled()  // or do I mark nodes as filled in some other way? I could define the toggle to start with state=filled and then switch beyond y_max

		let covered: BSPtree // subtree . Child pointers are useless. The bits need to mean left and right in the base tree. Floodfill stops at the 32th child, and falls back to sector
	}

	toCanvas(ctx: CanvasRenderingContext2D) {
		if (this.root == null) return
		let n = this.root
		let ne = new BSPnode_ExtensiononStack
		ne.ctx = ctx
		for (let i = 0; i < 2; i++) { // lines in front of faces
			ne.face_or_edge = i == 1
			const stack = new Array<BSPnode>
			ne.DFS(n, null)  // null means: No portal, yet. Use screen borders . Their size is injected as static/singleton upfront (before the frame)
			//stack.push(n) // well, a manual stack is combersome and error prone

			//let sn=new BSPnode_ExtensiononStack()

			//stack.pop()
		}


	}
}

class PartialFilled extends BSPnode {
	// tuned=8 ; Here I can use a fixed size because flood fill can just fall back to sector fill
	flips: number[]  // y where state flips from not filled to filled ( and back )
}

/* So it occured to me that my hard limit is cache memory. I feel like a BSP is most efficient to keep temporary data for occlusion between solid polygons. Transparent textures ($0000$) may come later.
With forward or backwards ray tracing the math subroutines throw exceptions when they are unsure.
With backward tracing I set up a graph of dependencies ( and may keep it frame to frame ) and pull in more precision.
With forward tracing (now that I understood normalized device coordinates and really accepted MUL to be cheap), I set up 2x2 px boxes around critical cuts.
These boxes are represented by a special (for fast rasterization) BSP ( to allow merge ) top, bottom, left, right ( from root to leaf ). Yeah, a little degenrated, but that may change on merge with balance?

Inside these boxes and later perhaps also inside of small height nodes I use a traditional method to solve occlusion.
I also calculate z at every pixel and compare it. It does not really matter how I nest the loops. With a low number of pixels I can keep it all in SRAM?
At least I feel like I don't want to compare delta-z . This may lead to new questions about precision. So no scanline-algorithm in version 1.

For each leaf I keep a z range to use it as an occluder. Before all children are drawn, one border is the far plane.
It feels weird to compare aligned planes inside my BSP world. I had a good reason to do it on screen, but not in 3d? Hierachical Z seems more consistent.
Ah I remember, for z I use the parent node. The children are only needed for opacy.
Even the pixel based renderer must report back if all pixel have been filled. Collsion control on the backplane can be used, perhaps? Though we don't want to write anything !?
	F02278

This BSP code can be linked to either forward or backward maths ( JS sure can to this and on JRISC I want to employ some kind of JIT for DRAM -> SRAM anyway (even if memory constraints push this onto the 68k)).
The interface asks about the "spin" of an intersection of three edges and some more simple stuff.
The result is boolean for building a tree.
Then there is the interface to project stuff onto the NDC on screen. It involves division (overflow outside of [-1,+1] indicates that the BSP code has a bug) and gives us one of the ordinates (x,y,z).

In the backward case the math routines operate on Vec3. In the formward case they operate on Vec2.
The "not sure" result lets the BSP call back solutions .. Oh wait. With backward the math part solves this internally. For this I already need to have the dependency graph in memory. No BSP replay, I guess.
With forward the BSP gets projections anyway I think? With unsure set, it sets up a that 2x2 box ( hard coded routine ). This then goes to the default merge code ( recursion).
Do axis aligned lines overflow? NDC stresses that the frustum is not only aligned, but at a spedific position.
*/

/*
The thing is that I already specified that I will have 16 bits for each ordinate. So most of the screen is glitch free even with fixed point math.
I can just go ahead and code a simple forward rasterizer with upper, left pixel rule and so.
I don't even need an extra bit for uncertain results. I just check if ABS(fraction) after round to neareast is too small (or something like this).
So the code just goes ahead and divides for cuts and slopes, and throws in case. Slopes are not a problem right away, but we could need to have two checks.
Scrap that. Jaguar ( and 0x86 and SH2 ) have 32 input to div. So we know the slope in an integer precise way. Feels weird man. 
*/

/**
 * I feared that I cannot write readable code if I am not allowed to use operators, but it looks like that I need vector operations anyway. These don't use operators in most programming languages.
 * So I can plug in math modules with (low precision) integers or infinite precision (and profiling on memory use and instruction count). Going from forward to backward.
 * To motivate the precision issue I would have to simulate different word sizes ( 8bit, 16 bit(Jaguar), and 32 bit (PC)).
 * It will be interesting to see some performance regarding the BSP splitting. With Heuristics I cannot come up with a clear winner, so maybe use none? Let's test. Then some length or area based version.
 * Then keep the BSP over frames and iterate? Fuse polygons before span rendering (like Doom floor)?
 * Then in a second step I may look for a heuristc when to switch to horizontal spans or even pixels. With pixels there is this problem that z-buffer either destroys shading or introduces an overflow problem (buggy).
 * There is no nice mathematical reason. I could just follow JC and accept that the z-buffer is broken.
 */