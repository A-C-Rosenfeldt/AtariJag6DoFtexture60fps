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

		// turn back faces to front. Todo: not do on
		const v3 = vs.slice(0, 3).map(v => new Vec3([v.xy.v.concat(v.z)]))  // backface culling in 3d. One of the perks of subpixel correction. // By my definition, the first two edges span up the plane (default s,t and basis for u,v mapping). The level editor needs to make sure that the rest align ( kinda like in Doom space ). I may add a scene graph just to allow to rotate Doomspace objects with infinite precision.			
		const edge: Vec3[] = []
		for (let i = 0; i < 2; i++) { // somehow array functions do not work for this. Todo: Move behind edge code
			edge.push(v3[i].subtract01(v3[1 + 1]))
		}
		const normal = edge[0].crossProduct(edge[1])  // Todo: Cross product optional parameter for z only? I don't want to leak the internal sign convention here
		if (normal.v[2] > 0) {
			vs.reverse(); console.log("reverse Cstr")  // inplace // This disturbed the parser, but I added an Array.slice
		} else {
			console.log("in order")
		}

		this.vertices = vs

		let lv = vs[vs.length - 1]
		this.edges = vs.map(v => {
			const e = new Edge_on_Screen()
			e.vs = [lv, v]; lv = v
			return e
		}
		)
		this.fillStyle = fillStyle
	}
	vertices: Array<Vertex_OnScreen>
	edges: Array<Edge_on_Screen> // double link: edges point to vertices, and may later point to faces in a mesh
	edges_in_BSP: BSPnode_edge[] = []
	nodes_in_BSP: BSPnode[] = []
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

class Vertex_decision {
	e: BSPnode_edge
	d: number
}

export class Vertex_OnScreen implements CanvasObject {
	cache_edge_decide: Vertex_decision[] = []
	cache_read_pointer = 0
	cache_ed: BSPnode_edge = null  // undefined would crash the if. is null implicit?
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

	// for insert face
	index_in_polygon = 0  // JRISC has no undefined. C and JRISC like to use 0 as index. Though, not sure about JRISC, loadQ 1 is as fast. I could tell the compiler to back correct all pointers to arrays
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
					//console.log("Leaf.ToCanvas")
					if (pi == null) {
						console.warn("Polygon covers whole screen")
					}
					n.toCanvas(this.ctx, pi)
					// toDo: on the way to the root, check the siblings if they are also covered by the polygon
				}
			}
		}

		if (portal.length == 0) return 0
		if (n instanceof BSPnode) {
			n.children.forEach((c, i) => {
				//console.log("child ", typeof c == "object" ? c.constructor.name : "u")
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
export class BSPnode_edge {
	xy: Vec2  //normal
	z: number  // bias

	index = 0
	cache_face: Polygon_in_cameraSpace;
	decide(v: Vertex_OnScreen): number {

		let side = this.xy.innerProduct(v.xy) + this.z * v.z;
		if (v.z < 0) side = -side  // sorry to mutate local variables, but I need it for debug and JRISC does it all the time
		//console.log("decide vertex", v.normalize(), "edge xy", this.xy.v, "z", this.z, "side", side, this.xy.innerProduct(v.xy), this.z * v.z) // todo: make sure that cuts point towards bigger z
		if (side > 0) {
			const dummy = 0
		}
		return side  // I changed sign of z to make this a 3d inner product as mandated by a beam tree
	}

	// import {Portal} from "./pyramid.js"
	// import { Vec, Vec2, Vec3 } from "./clipping.js"

	toCanvas(ctx: CanvasRenderingContext2D, pi?: Array<Vec2> /*ref*/, verbose = true) {


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

		if (ctx != null) {
			ctx.strokeStyle = "#FF01"
			ctx.beginPath()
		}
		const cache = new Array<number>(length);// cache lazy infinite precision values
		for (let corner = 0; corner < pi.length; corner++) {
			var v = pi[corner]; // one goal was to use explicit code to show the edge cases and allow logs and break points. So this code will stay and be amended by polygon (portal) code. 			
			if (ctx != null && verbose) {
				// This is not the inner loop. If I want to remove branches, I need to optimize the compiler to unroll loops and implement those lag by one iteration variables
				//const v = new Vec2([cxy])
				co = [v.v[0] + debugshift, v.v[1] + debugshift] //;console.log("v",co[0],co[1])
				if (l++ == 0) ctx.moveTo(...co)
				else {
					ctx.lineTo(...co)
				}
			}

			current = this.xy.innerProduct(v) + this.z  // todo: * v.z . inner product when corners are assumed to be vertices at a distance
			// let sign = 0
			// // Make JRISC behaves like this! Signed int2
			if (current < 0) { last = current; last_v = v }
			if (current > 0) { last = current; last_v = v }
			cache[corner] = current //JRSICbitfield32 |= sign << (corner * 2)   // *2 becomes <<1 in JRISC

		}
		if (ctx != null) {
			ctx.closePath()
			ctx.stroke(); l = 0
			const back = ctx.lineWidth
			ctx.lineWidth = 1
			ctx.strokeStyle = "#0" + variance.toString() + "F"; variance = (variance + 1) % 10
			ctx.beginPath()
		}

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
					if (ctx != null && verbose) {
						ctx.fillStyle = "#F80"
						ctx.fillRect(co[0], co[1], 1, 1)
					}
					var cut = new Vec2([cxy]);
					//console.log("cut",cut.v)
				} else {
					const edge = last_v.subtract01(v);
					let from_corner = current / edge.innerProduct(this.xy)
					var cut = v.subtract(edge.scalarProduct(from_corner))

					co = [cut.v[0] + debugshift, cut.v[1] + debugshift]
					if (ctx != null && verbose) {
						ctx.fillStyle = "#288"
						ctx.fillRect(co[0], co[1], 1, 1)
					}

				}
				for (let i = 0; i < 2; i++) {
					if (typeof cut === undefined) console.warn("undef split")
					portal[i].push(cut)
				}

				if (ctx != null) {
					if (l++ == 0) ctx.moveTo(...co)
					else {
						ctx.lineTo(...co)
						ctx.stroke()
					}
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

		if (ctx != null) { ctx.lineWidth = 1 } //back
		return portal


	}

	verts: [Vertex_OnScreen, Vertex_OnScreen]

	cache_cut: Edge_cut[] = []
	cache_read_pointer = 0  // cache is for lazy precision
}

export class Edge_cut {
	e: BSPnode_edge = null
	c: Vertex_OnScreen
	constructor(v: Vertex_OnScreen) { // So, I learned that typeScript does not really support the old JS way of constructing objects (because it cannot interfere the interface? I only have properties)
		this.c = v
	}
}

// class Edge_cut {
// 	c: Vertex_OnScreen
// 	e: BSPnode_edge
// }

// So this is like Horizon_Edge , while the partition is like the Edge_between_vertices
export class BSPnode extends CanvasObject {
	ID: number;
	cut2children: Vertex_OnScreen;
	constructor(p: number) {
		super()
		this.ID = p //.vertices.length
	}

	children: (BSPnode | Leaf)[] = new Array<BSPnode>() // 0,1   
	edge: BSPnode_edge   // real vertices to match mesh and shorten float calc
	cuts: Edge_cut[] = []
	getEnds(): [Vertex_OnScreen, Vertex_OnScreen] {
		const r: [Vertex_OnScreen, Vertex_OnScreen] = [null, null]
		var c: Edge_cut
		for (let i = 0; i < 2; i++) {
			r[i] = this.edge.verts[i]
			// console.log(i," -> ",r[i])
			const cond: boolean = (c = this.cuts[i]) && c ? true : false
			// console.log("cond",cond)
			if (cond) r[i] = c.c   // why are records so difficult?
			// console.log(i," -> ",r[i])
			if (r[i] == null) console.warn("ri should not be null")
		}
		return r // array gave me a bug once, now I am bitter: this.cuts.map((c, i) => c?.c ?? this.edge.verts[i])
	}
	//cut_others: BSPnode_edge[] = [] // temporary vertices while inserting an edge into a BSP. Oh wait, keep for face

	// local in a mesh : local variables hold Vertice  see Edge_on_Screen
	// elsewhere : the math likes this
	//split_line_beam: Vec3  // no rounding for lazy_precision_float
	// I flatten the structure her. Node is not fat enough for more structure. Vec3 is misleading

	ref_count: number;
	//cut: Vertex_OnScreen;



	// chronologically this belongs before decide_face. todo: refactor
	decide_edge(node: BSPnode, fillStyle: string, last_edge_of_polygon = false): void {//:BSPnode_childref { 
		const e = node.edge
		//console.log("ncuts ", node.cuts.map(c => c.c.normalize()).toString(), "this cuts", this.cuts.map(c => c.c.normalize()).toString())
		// probably I should just reserve memory for Edge_cut from the start on Jaguar
		const node_merged = e.verts.map((v, i) => node.cuts[i] ?? new Edge_cut(v)) // Certainly the Doom level editor just used floats and epsilon. But I am on Jaguar
		const this_merged = this.edge.verts.map((v, i) => this.cuts[i] ?? new Edge_cut(v)) // Certainly the Doom level editor just used floats and epsilon. But I am on Jaguar
		//const explicit_mesh = node_merged.map(v => this_merged.indexOf(v))
		//console.log("sides{",)
		// if (this.ID===3 && this.edge.index==0){
		// 	console.log("does it really look at the cuts?",node_merged.map(n=>n.c.normalize())) // todo: cuts went to wrong child
		// }
		const sides = this.decide_vertices(node_merged) //node.cuts)

		// explicit_mesh.map((f, i) => {
		// 	if (f >= 0) {//console.log("vertex eq by index");
		// 		return 0
		// 	}
		// 	const v = node.cuts[i] ?? e.verts[i]
		// 	return Math.sign(this.edge.decide(v))
		// })
		let s = ""
		for (let i = 0; i < 2; i++) s += this.children[i] ? " truey" : " falsy"
		// console.log("sides:", sides,"this ID", this.ID,this.edge.index,this.edge.xy,"this.children",s)

		//if (Math.abs(sides[0]-sides[1])>1) console.log("decide edge", sides)
		if (Math.abs(sides[1] - sides[0]) > 1) { // calculate cut. I already added the code to "ToCanvas", but I need it here while inserting ( and while instering the face ). I thought, BSP is pure. Weird that I don't need to keep the cut after insertion
			cut = null
			// Thanks to the explict mesh, each edge is inserted only once. There will be no prior cut (instance). Face harvests cuts
			// while (node.edge.cache_cut.length > node.edge.cache_read_pointer) {
			// 	const kv = node.edge.cache_cut[node.edge.cache_read_pointer++]
			// 	if (kv.e == this.edge) cut = kv
			// }

			if (cut == null) {
				// beam tree
				var cut = this.Cutter(e); // kinda : go to derived class
				//cut.c = c
				cut.e = this.edge
				console.log("push cut", node.edge.index, this.ID, this.edge.index, sides)
				node.edge.cache_cut.push(cut) // how does hits look in JRISC? I don't find any trick. Needs bound check, needs capacity, needs pointer to grow
				// if (c.z < 0) {  // todo move inside this.Cutter
				// 	//console.warn("z<0")
				// 	const dummy = 0
				// }
			}

			//this.cut_others[cut.z > 0 ? 1 : 0] = node  //  z>0 ? aparently not a good idea // I feel like cuts should be sorted by direction of border, not by length of edge
			//console.log("me", this.debugy, this.edge.verts.map(v => v.index_in_polygon), "inserted cuts", this.cuts, "@", cut.z > 0 ? 1 : 0) // Todo PolygonIndex
			//const dummy = 0
			//node.cut2children=cut
			// var inverse = [-1, -1];
			// for (let i = 0; i < 2; i++) inverse[sides[i]] = i  // since there are only two, there are only two cases. I could probably remove this code?
		}
		for (let s = 0; s < 2; s++) {
			if (sides.map(si => si == (2 * s) - 1).reduce((p, c) => p || c, false)) { // any points to insert on this side of tree
				let c = this.children[s]
				const n = new BSPnode(node.ID)
				n.edge = e  // why no cut at this point? The "sides" code depends on it. The face wants to reuse it
				n.cuts = node.cuts.slice() // temporarly for insert.


				if (typeof cut != 'undefined') {  // My explicit way of doing things will add "exception" branches into JRISC. So usually they only cost one cycle, +1 if I cannot fill the slot before with some copy
					// cuts go along the edge. They don't care about this.normal.
					// Todo: do I need to flip?
					const iso = sides.indexOf(-2 * s + 1) // point on the other side // I tweaked ToCanvas to show if I got this right
					n.cuts[iso] = cut   // the other end of the line is replaced. Why did I flip this ever?
					// console.log("cuts on inserted and split edge", n.debugy, n.cuts)
				}

				if (c == null || (c instanceof Leaf)) {
					// console.log("try to insert on side",s)
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
						// This seems to be backwards. Rather I should use all poylgon vertices and find the root node of the polygon (the last one where all vertices aggree on the side of the edge)
						// save the root and go from there for all edges and the finally face ?
						// Go with the edges as long they don't get split.
						// How do I compare polygon against portal? Looks likes nested loops. I could join / merge them by angle?: (ToDo)
						// this vertex inside portal. Border goes more to the outside than edge => next vertex stays inside till next corner
						// Angle comparison still means cross product, but less
						// Equivalent: Insert all edges and find top common node to start for face. Still, every vertex will have been compared twice ( this hurts due to (lazy ) precision )
						if (last_edge_of_polygon) {
							const l = new Leaf();
							l.fillStyle = [fillStyle]
							n.children[0] = l  // 0 should be inside . front faces go around the clock. clean uo 2d resr data
							//console.log("new leaf", n.children[0].fillStyle)
						}
					}
				} else {
					// console.log("try to insert on side",s,"there already is",c.ID,c.edge.index)
					//return 
					// todo: store cuts
					c.decide_edge(n, fillStyle, last_edge_of_polygon) // todo: so at least one child should be filled, but right now I see none
				}
			}
		}
	}


	private Cutter(e: BSPnode_edge) {
		const e_to_insert = new Vec3([e.xy.v.concat(e.z)]);
		const e_in_BSP = new Vec3([this.edge.xy.v.concat(this.edge.z)]);
		const cut3d = e_to_insert.crossProduct(e_in_BSP);
		//allocation problem for cached cuts  const cut3d_forward = cut3d.scalarProduct(Math.sign(cut3d.v[2]))
		const c = new Vertex_OnScreen();
		if (e.index > 0) { // always
			c.index_in_polygon = -e.index;
		} else {
			const dummy = 0;
		}
		console.log(c.index_in_polygon);
		// const d = new Vertex_decision();
		// d.d = 0
		// d.e = this.edge
		// c.cache_edge_decide[0] = d // todo: probably useless
		c.xy = new Vec2([cut3d.v.slice(0, 2)]);
		c.z = cut3d.v[2];
		var cut = new Edge_cut(c); // kinda : go to derived class
		return cut
	}

	decide_face(p: Polygon_in_cameraSpace, cuts?: Edge_cut[]) { // todo: use edges to pull the vsp==undefined case out of this function


		//console.log("deciding face : this cuts these edges",this.cut_others.map(c=>[c.debugy,c.edge.index])) //, "is cut", eg.map(e=>[e.cuts,e.cut2children]))

		// this.decide_edge will make this edge.cut through p.edges twice. Allocation uses sign of product
		// temporary data does not really belong in the tree (=> Garbage). Store it in this class using an entry method. Still use the sign.
		// uh, this.edge is the key. So it looks like I need to store it there
		// Polygon.edge cannot be the key because they are cut multiple times
		// Polyon.node have 0..1 cut in the middle, but are not naturally referenced deep in the depth-first inserter
		// Should I connect this? the cut stores the edge => key is there
		// parameters: current edge  start end by cut
		//  are easy for decide_edge
		//  but in decide_face , each sub_face has a list of node-edges
		// so cut off ends need to be stored on nodes -> still garbage. But I could write tests about consistency!
		// when I cut a face to generate internal sub-faces, these have nodes at edges which only live in the method
		// ah, this is the other case:

		// but this.edge could have been cut by others just like p.face
		// so the parameters are that of a cut polygon with no own vertices, just references to cuts prior to insertion of this polygon
		//  mark them as those : index_into_polygon = -1, index_to_own_edge_cut = -1
		// roles get reversed: sub-polygon acquired a reference to edges, which cut its current cutter
		// So in the tree, on a node, we need to store the edges which cut its own edge

		// Okay, it is weird to persist edge->face data on existing edges (not even nodes) in the tree
		// A hint is that this an accidentally possiblity because I prototpye with convex polygons
		// Later I want to remove this limitations because Doom levels allow for holes in floors for pits and mesas.

		// So compatible with nummeric calculation, each node stores its cuts
		// it stores the vertices = results, but also the "other parent", an edge.
		// For the new polygon, this allows the face to recognize how its own nodes have been cut.
		// And for the face it allows, the tree.node has been cut by the same edges (not nodes) like itself
		// so the decide_face really needs the actual edge (not the face) as parameter

		if (typeof cuts != 'undefined') {
			var cs = cuts
			//console.log("vsp", cuts.map(cut => cut.c.normalize()))
		} else {
			const vs = p.vertices
			// ¿Perhaps cut the reference
			vs.forEach((v, i) => {
				v.index_in_polygon = 1 + i
				v.cache_read_pointer = 0
			})
			cs = vs.map(v => {
				const c = new Edge_cut(v)
				//c.c = v
				return c
			})
		}
		if (cs.length < 3) {
			console.warn("vs.length=", cs.length)
			return
		}

		// if (typeof edges != 'undefined') {
		// 	var eg = edges
		// } else {
		// 	eg = p.edges_in_BSP
		// 	eg.forEach(e => { e.cache_read_pointer = 0 }) // todo: pull out into wrapper function
		// }

		// I cannot use the adjacent edges
		// Same as in my explicit view frustum code, it is important to know if a vertex is original
		// with two edges, I would still like to know which is my edge, and what border did cut us
		// thanks to an explicit mesh, I insert every edge only once
		// So this.edge (aka border) could not have seen node.edge before
		// insert face is just a replay. Doom space here means: faces in 3d (Quake) would cut stuff, but in 2d they cannot
		const sides_v = this.decide_vertices(cs)



		// const edge_match=eg.map(e=>{
		// 	if (e==this.edge) return 2
		// 	const vf=this.cuts.findIndex((cut,ci)=>{  //???
		// 		if (typeof cut != 'undefined'){
		// 			return cut.e == e
		// 		}
		// 		return false
		// 	})

		// })

		// to recognize cuts I do not need the cutting edge
		this.cuts.map((cut, i) => {
			if (typeof cut == 'undefined') {
				const v = this.edge.verts[i]
				cs.map(c => c.c).indexOf(v)  // todo
			} else {
				// if (typeof edges !== 'undefined') {
				// 	const j = edges.indexOf(cut.e)
				// 	cut.c
				// }
			}
		})

		const sides = this.decide_vertices(cs)
		// const explicit_mesh = cs.map(v => this.edge.verts.indexOf(v)) // some "cuts" are actually just the original vertices
		// const explicit_medg = eg.map(e => this.cuts.indexOf(eg))
		// const sides = explicit_mesh.map((f, i) => {
		// 	if (f >= 0) {//console.log("vertex eq by index");
		// 		return 0
		// 	}
		// 	if (explicit_medg[i] >= 0) {//console.log("vertex eq by index");
		// 		return 0
		// 	}
		// 	return Math.sign(this.edge.decide(cs[i]))  // I could just cache these, but do I need a list, or is a pair enough?
		// })

		// const children=new Polygon_in_cameraSpace() // new for the vertices
		// // old for the refs for the polygon

		// find cuts. I have done this before
		// All this reference dictionary stuff probably loves short reference in JRISC, aka IDs. I can see 16 bit IDs, but 10 bit is pushing it.
		for (let retry = 0; retry < 2; retry += 2) {
			var children: Edge_cut[][] = []   // was const before I wrapped the loop around 
			//var children: [number,Edge_cut][][] = []   
			for (let side = 0; side < 2; side++) {
				children[side] = []
			}
			// todo: check if explicit edges can be paired with the next vertex in the polygon.
			// todo: actually pair them in class
			//var childree: BSPnode[][] = []   // was const before I wrapped the loop around 
			// for (let side = 0; side < 2; side++) {
			// 	childree[side] = []
			// }

			let last = -1
			let c = sides[sides.length - 2], last_vertex_part_of_current_polygon = cs[sides.length - 2].c
			let vertex_i = sides.length - 1;
			let next = sides[vertex_i]
			let cut_counter = 0
			for (let vertex_next = 0; vertex_next < sides.length; vertex_next++) {
				if (false) { // still not sure about the replay bug
					//for (let vertex_i = 0; vertex_i < sides.length; vertex_i++) {
					const es = BSPtree.BSP_heuristic(p.edges) // re-play order of edges of this new polygon.
					// order of old edges is fixed. Cache order will be reproduced because I walk the tree
					for (let i = es.length - 1; i >= 0; i--) {
						const vertex_i = es[i][2] // into sides. Not polygon
						const l = sides.length;
						const from = (vertex_i + l - 1) % l
						const range = [from, vertex_i].map(j => cs.findIndex(o => o.c.index_in_polygon == j))
						//const till_c=cs.findIndex(o=>o.c.index_in_polygon==vertex_i)
						const restor = range.map(r => {
							if (r < 0) return -1
							if (cs[r].c.index_in_polygon == -1) return 1
							return 0
						})
						if (restor[0] * restor[1] == -1) {
							range[(restor[0] + 1) / 2] = 0;
						}
						// fragil and confusing
						// How many cuts do I even do?
						// 2. So I could try out which of them hits the cache?
						// this is given by the tree
						// there are two cuts => edge is defined. But node?
						// I don't think that I need to look in the cache (because both could be hit?)
						// of the two cuts I need to know who was first
						// edges are already in tree
						// so the next edges need to be direct children of this.node
						let last = sides[from]
					}
				}
				last = c; c = next; next = sides[vertex_next]
				// const j_pre = cs[vertex_i].c.index_in_polygon // only!=null if e==null . todo: compress state
				// const j = j_pre >= 0 ? j_pre : vertex_i
				if (Math.abs(c - last) > 0) { // ensure cut
					cut_counter++
					if (Math.abs(c - last) > 1) { // find cut of edge  . Cut as a verb . Clean cut
						//const e = eg[vertex_i]  // edge leading towards this vertex
						const cut = cs[vertex_i]
						let e: BSPnode_edge = null // cut.e  // for facelets this may not be the original polygon edge
						if (e == null) {
							const i = cut.c.index_in_polygon  // This is for facelets at the edges . I am now very sure that I have to store in the tree which border the child hits.
							if (i > 0) { // vertex is orginal vertex
								e = p.edges_in_BSP.find(e => e.verts[1].index_in_polygon == +i)  // We only care about cuts going to the vertex. Reuse those, next edge comes later  // Todo: double link, or pre-alloc array and fill
							}
							if (i < 0) {
								if (last_vertex_part_of_current_polygon.index_in_polygon > 0) { // vertex is one cut of original vertex so still sits on ede
									//console.warn("this is only okay if the last vertex.index>0")
									e = p.edges_in_BSP.find(e => e.verts[1].index_in_polygon == -i)  // We only care about cuts going to the vertex. Reuse those, next edge comes later  // Todo: double link, or pre-alloc array and fill
								}
								console.log(last_vertex_part_of_current_polygon)
							}
							if (i == 0) {
								console.warn("faces should just go with the flow of the BSP.")
							}
						}
						if (e != null) {
							if (e.cache_face != p || retry == 1) {  // p meaning face because I already inserted the edges
								e.cache_face = p
								e.cache_read_pointer = 0
							}
							if (e.cache_cut.length == 0) {
								console.warn("there has to be a cut", e.index, this.ID, this.edge.index, [last, c], cut.c.index_in_polygon)
								const dummy = 0
							}
							while (e.cache_cut.length > e.cache_read_pointer) {
								const kv = e.cache_cut[e.cache_read_pointer++]
								if (kv.e == this.edge) {
									var cut_1 = kv
								}
							}
						} {
							return // give up
							// todo: store two edges on each cut. Or at least with direction.
							// todo. Cache in tree. Not the actuall vertex, just border numbers
							// todo: I still need the edge in this loop
							//if (last_vertex_part_of_current_polygon)
							cut_1 = this.Cutter(cut.e); // kinda : go to derived class
							//cut_1=cut.e this.edge
						}

						// does not work in mesh var cut = this.cuts[(-c + 1) / 2] // cuts must have been (over-)written when we inserted one of the edges.
						if (retry > 0) console.log("cut", cut, this.ID, this.edge.verts.map(v => v.index_in_polygon))
						// todo: unify insertion and ToCanvas code to share debugging
						// the following code looks just like ToCanvas for face?
						if (typeof cut_1 != 'undefined') {
							//var vsi = new Vertex_OnScreen()
							// try {
							// 	vsi.xy = cut.c.xy
							// } catch {
							// 	console.log("this.cuts", this.cuts)
							// }

							// vsi.z = cut.c.z
							for (let c1 = 0; c1 < 2; c1++) {
								if (retry > 0) {
									console.log("c1", c1, last > c ? 1 - c1 : c1)
									const dummy = null

								}
								//?? todo: remove the order
								children[last > c ? 1 - c1 : c1].push(cut_1) //[vertex_i,cut_1]);// console.log("dupes ", last > c ? 1 - c : c, "<-", vsi.index_in_polygon)
								// we need to pass on the reference to both children so that a face can recognize
								//childree[c1].push(eg[vertex_i])
								//vsi.index_in_polygon = j  // todo: struct (value type) to make this have an effect  .for the old polyline, the cut is still in order. This is for debugging and profiling. Some might want to enforce a valid state by setting index eagerly.
							}
							children[(c + 1) / 2].push(cs[vertex_i])//push([vertex_i,cs[vertex_i]])  // debugging made me duplicate code here. Todo: unite with vertex on border?
							//childree[(c + 1) / 2].push(eg[vertex_i])
						}
					} else {
						// vsi = vs[vertex_i]
						// // c = 1  // I kinda feel that I did this, even though for consistency inside should be 0. Inside is smaller than outside (todo)
						// if (explicit_mesh[vertex_i] < 0)
						// 	console.warn("polygon vertex on border(aka portal edge), but no corner (aka portal vertex) reference matches") // last was on edge. We are leaving
						// // c = (c + 1) / 2
						let index = 0  // JRISC: i=1  cmp last jump cmp c jump i=0 label: store . Hopefully 2-complement bit is faster. 11 00 01 . copy shift xor. 10 00 01 . Or 10 01 . 10-x . 0 1. Or rather: add 1: 00 01 10. or 01 10. sub . 0 1
						if (last == 1) index = 1
						if (c == 1) index = 1
						children[index].push(cs[vertex_i])
						//childree[index].push(eg[vertex_i])
						// no duplicate if no real crossing! Check: ToCanvas: 0 0 -1 is no cut!
						// IMHO, the only way for the face to know this border is when it is actually one of its own edges
						// todo: Can this happen? // cut was already in vsp, . Todo: correct the toCanvas()
					}
				} else {
					// the second vertex on the border
					if (c == 0) { // always counter clockwise. Edges don't loose this property on insertions
						// I could check the results of the other vertices. So, I would need two passes like in ToCanvas? Perhaps it was wrong there, too?
						//c = 1  // I kinda feel that I did this, even though for consistency inside should be 0. Inside is smaller than outside (todo)
						// if (Math.max(...explicit_mesh[vertex_i]) < 0) {
						// 	console.warn("polygon vertex on border(aka portal edge), but no corner (aka portal vertex) reference matches", cs[vertex_i])
						// 	const dummy = 0
						// }
					}
					// if (c==0 ) last==0 in this branch. That's why we need next . Actually comes up in the first test: single triangle.
					const ci = c == 0 ? next : (c + 1) / 2
					// if (cut_counter == 0) {
					//todo ask inserting edge for side
					children[ci].push(cs[vertex_i])
					// childree[ci].push(eg[vertex_i])
					// } else {
					// 	// Why would I modify a Vertex object after creation? (like not here but later on)
					// 	const vsi = new Vertex_OnScreen()
					// 	vsi.index_in_polygon = j
					// 	vsi.xy = vs[vertex_i].xy
					// 	vsi.z = vs[vertex_i].z
					// 	children[ci].push(vsi)
					// }
				}
				//console.log("beforeSplit:", vertex_i, " c0: ", children[0].length, " c1: ", children[1].length,"c",c,"last",last)
				last_vertex_part_of_current_polygon = cs[vertex_i].c //.index_in_polygon
				vertex_i = vertex_next // I am not sure about the "," syntax in C / TypeScript. So I have to write this at the tail
			}

			// todo: sort children
			for (let side = 0; side < 2; side++) {
				const l = children[side].length;
				if (l == 1 || l == 2) {
					console.warn("retry", l, retry)
					retry--
					break
				}
			}
		}

		for (let side = 0; side < 2; side++) {
			// sort back from lenght first to rotation. This must be conserving because splits share vertex_i, but are already ordered
			// Since version 10 (or ECMAScript 2019), the specification dictates that Array.prototype.sort is stable.
			// Of course, I could give the cut an index as the average of the orginal indices. SHR upfront
			//const childs = children[side].sort((a, b) => a[0] - b[0]).map(c => c[1])
			if (children[side].length > 0) {
				let child = this.children[side];
				if (typeof child == 'undefined') {  // once again I don't understand why null is not enough. Objects?
					child = new Leaf()
					child.fillStyle = [p.fillStyle]
					this.children[side] = child
				} else {
					if (child instanceof BSPnode) {
						child.decide_face(p, children[side]) //, childree[side]) // todo: distribute egs  also
					} else {
						if (child instanceof Leaf) { // child undefined
							child.fillStyle.push(p.fillStyle)
						}
					}
				}
			}
		}
	}

	// todo: ed: as property, not parameter
	decide_vertices(cs: Edge_cut[]): number[] {

		return cs.map((c, vi) => { // the callback function is a JS artifact. JRISC uses releative branch. Even Java has a sane forEach
			const v = c.c
			const vf = this.cuts.findIndex((cut, ci) => {
				if (typeof cut == 'undefined') {
					return this.edge.verts[ci] == v
				}
				return false
			})
			if (vf > -1) return 0
			// for (let w = 0; w < 2; w++) {
			// 	if (eg[(vi + w) % eg.length] == this.edge) { return 0 } // same as: c.e == this.e? no !
			// }

			// can I prove the order? Do other edges need a different order?
			// same code for edge and face as users
			// edges can have a similar cache for their cuts. Ordered. Order given by edges for faces and vertices. So this is differnt then the Transformation pipeline: V -> E-> F

			// premature optimization, but I am mostly intersted in the JRISC cost!
			const ed = c.e
			if (ed != null) {
				if (v.cache_ed != ed) {
					v.cache_ed = ed
					v.cache_read_pointer = 0
				}
				while (v.cache_edge_decide.length > v.cache_read_pointer) {
					const kv = v.cache_edge_decide[v.cache_read_pointer++]
					if (kv.e == this.edge) return kv.d
				}
			}

			const dis = Math.sign(this.edge.decide(v));
			// how do I cache vertices
			// it should already work for insert_edges ( of a mesh)
			// the faces then should find it. Parameter edges is the correct one
			const keyValue = new Vertex_decision()
			keyValue.e = this.edge
			keyValue.d = dis
			v.cache_edge_decide.push(keyValue)

			return dis  // I could just cache these, but do I need a list, or is a pair enough?			
		}
		);
	}



	toCanvas(ctx: CanvasRenderingContext2D, pi?: Array<Vec2> /*ref*/) {

		let r: [number, number], l = 0
		const back = ctx.lineWidth
		ctx.lineWidth = 5
		ctx.strokeStyle = "#0" + variance.toString() + "F"; variance = (variance + 1) % 10
		ctx.beginPath()

		const ends = this.getEnds().map(h => h.normalize())
		for (let end = 0; end < ends.length; end++) {
			const cxy = ends[end]
			var co: [number, number] = [cxy[0] + debugshift, cxy[1] + debugshift]

			ctx.fillStyle = "#F80"
			ctx.fillRect(co[0] - 3, co[1] - 3, 1 + 6, 1 + 6)

			if (l++ == 0) ctx.moveTo(...co)
			else {
				ctx.lineTo(...co)
				ctx.stroke()
			}
		}

		ctx.lineWidth = 1 //back
		// return
		// if (this.cuts.length > 0) console.warn("Todo: use ", this.cuts)
		// orininally I wrote the clipping in the draw method for instant debugging
		// I rewrote (cleaned up) so much when transfering to insert (sorry)
		// it also draws the portal. Todo?: put back in
		return this.edge.toCanvas(ctx, pi, false)
		// return this.edge.toCanvas(ctx, pi)
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



		var sum = this.JavaScriptCSS_bloat(this.fillStyle[0])

		const i2 = [0]
		//const sum = i2.reduce((p, c) => p.map((q, i) => q + c[i], [0, 0, 0]));
		const avg = sum.map(s => (s / i2.length).toString()).join() // //.toString(16)).join()
		ctx.fillStyle = "rgba(" + avg + ")" // this.fillStyle[0] //avg  // todo: sort by z  (find cut, decide edge, choose fillStyle)
		//console.log("ToCanvas ", ctx.fillStyle, avg)
		ctx.beginPath()
		//console.log(pi)
		if (pi.length < 3) return
		const v = pi[0] //.normalize(-debugshift);  v should be xyz (Vec3) because either it is a projected vertex, or some cross product
		//const co = [v.v[0] + debugshift, v.v[1] + debugshift]
		ctx.moveTo(v.v[0] + debugshift, v.v[1] + debugshift)
		pi.forEach(v => {
			ctx.lineTo(v.v[0] + debugshift, v.v[1] + debugshift)
		})
		ctx.closePath()
		ctx.fill()  // stroke()

	}

	private JavaScriptCSS_bloat(layer: String) {
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
	// todo: don't insert duplicated vertices or edges.
	// fileformat => binary sets up the links
	// mark object on insertion. Dedicated property? Indes into polygyon? chache.length>=0 ?
	insertPolygon(p: Polygon_in_cameraSpace) {
		console.log("insertPolygon", p.vertices.length, p.fillStyle)
		// clear memory. I do it explicit here (not tested) perhaps this shows how to change the data structure
		p.vertices.forEach(o => {
			o.cache_edge_decide = []
		});
		p.edges_in_BSP = []
			;
		{//if (this.root == null) { // I imply the screen borders to be match my clipping code
			//moved to polygon consructor
			//const v3 = p.vertices.slice(0, 3).map(v => new Vec3([v.xy.v.concat(v.z)]))  // backface culling in 3d. One of the perks of subpixel correction. // By my definition, the first two edges span up the plane (default s,t and basis for u,v mapping). The level editor needs to make sure that the rest align ( kinda like in Doom space ). I may add a scene graph just to allow to rotate Doomspace objects with infinite precision.			


			// const edge: Vec3[] = []
			// for (let i = 0; i < 2; i++) { // somehow array functions do not work for this. Todo: Move behind edge code
			// 	edge.push(v3[i].subtract01(v3[1 + 1]))
			// }
			// const normal = edge[0].crossProduct(edge[1])  // Todo: Cross product optional parameter for z only? I don't want to leak the internal sign convention here
			// if (normal.v[2] < 0) {
			// 	p.vertices.reverse(); console.log("reverse Insert") // ToDo: this rips meshes apart and confuses ToCanvas // This disturbed the parser, but I added an Array.slice
			// }

			const s = BSPtree.BSP_heuristic(p.edges);
			for (let i = s.length - 1; i >= 0; i--) {
				const n = new BSPnode_edge()
				n.index = 1 + s[i][2] //; console.log("new edge",n.index)
				p.edges_in_BSP.push(n) // for the cuts
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
				const b = new BSPnode(p.vertices.length)
				b.edge = n
				p.nodes_in_BSP.push(b)
				if (this.root == null) {
					this.root = b
				}
				else {
					// todo: reset all read pointers on vertex cache
					this.root.decide_edge(b, p.fillStyle, false) // I could not find synergy going bottom up. There is some top down ratched thing when inserting the first edge and it does not get split.  i == 0) // insert edge

					// this.root.insertPolygon(s.slice(0,i)) // to work for all sides 
					// const midpoint_w=verts.map(v=>parent.decide(v)).reduce((p,c)=>p+c)  // fractions // Does this need an epsilon, or check vertex indices or infinite precision?
					// parent.children[(Math.sign(midpoint_w)+1)/2]=n

				}

			}

			// todo: reset all cache read pointers on edges because facelets harvest cuts of foreign edges
			console.log("decide face")
			this.root.decide_face(p)  // todo: obviously we could check under which node the edges did end up. I do not know if the current way of recognizing pointer is a fast way to deal with our "own" edges as inserted in the tree. Less code is top priority. I see the 4kB limit slipping.
		}
		// run the vertices down the tree . So, like clipping to screen borders. Vertice, edges , planes? Ah, plane check is the same for the whole screen.
		// const b = new BSPnode   // on common parent
		// b.insertPolygon()  // todo: still happens on a node
	}
	public static BSP_heuristic(edges: Edge_on_Screen[]) {
		const s = edges.map((e, i) => {
			const vecs = e.vs.map(v => new Vec2([v.normalize()])); // vertices start with v. I should rename to point to differentiate from vector -- but what about Transformation?
			const delta = vecs[0].subtract01(vecs[1]);
			//if (normal.v[2] >= 0) e.vs.reverse()  // uh too much cognitive load. Pehaps there is a way to figure out backfaces within a BSP, but not for me
			const r: [number, Edge_on_Screen, number] = [delta.innerProduct(delta), e, i]; //  ref type
			return r;
		});
		s.sort((a, b) => a[0] - b[0]);
		return s;
	}

	// this algorithm can queue in a compact data structure to draw trapezoids deferred if I wanna try vsync tricks
	floodfill() {
		// start with one node
		// punch through seams (on both sides because I don't want sort overhead)
		let y_max: number // keep track of the y when the next vertex will be passed
		let invaded: BSPnode[][]  // [left, right],[distance]

		let self = new PartialFilled(0)  // or do I mark nodes as filled in some other way? I could define the toggle to start with state=filled and then switch beyond y_max

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