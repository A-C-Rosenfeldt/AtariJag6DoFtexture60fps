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

import { Vec, Vec2, Vec3 } from "./clipping.js"
//import { Vertex_OnScreen } from "./Item"

class CanvasObject {
	static screen = [320, 200];
	toCanvas(ctx: CanvasRenderingContext2D) { }   // virtual  todo Placeholder
}

// OOD of polygon shader got a bit messy in rasterizer.ts. Clean version 2025-12-05
// clearly the normalized data looks like this
class Vertex_in_cameraSpace {
	onScreen: Vertex_OnScreen  //nullable
}
export class Polygon_in_cameraSpace implements CanvasObject {
	// I feel like this will the method for all polygons not matter if clipped
	// Clipped edges behave special on projection, but actually clipping and projection happen shortly after each other
	// We persist screen coordinates ( ah, well, z does not exist for clipped edges ) . Just integers for scanlines
	toCanvas(ctx: CanvasRenderingContext2D): void {
		ctx.fillStyle = "green";
		ctx.beginPath()
		ctx.moveTo(...this.vertices[0].normalize() )
		this.vertices.forEach(v => ctx.lineTo(...v.normalize()))
		ctx.closePath()
		ctx.fill()  // stroke()

		this.edges.forEach(e => e.toCanvas(ctx))
		ctx.fillStyle = "#911"
		this.vertices.forEach(v => v.toCanvas(ctx))

	}
	constructor(vs?:Array<Vertex_OnScreen>){
		if (vs === undefined) return
		this.vertices=vs
		let lv=vs[vs.length-1]
		this.edges=vs.map(v=>{
			const e=new Edge_on_Screen()
			e.vs=[v,lv];lv=v
			return e
		}
		)
	}
	vertices: Array<Vertex_OnScreen>
	edges:Array<Edge_on_Screen> // double link: edges point to vertices, and may later point to faces in a mesh
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
	toCanvas(ctx: CanvasRenderingContext2D): void {
		ctx.fillRect(...this.normalize(1), 3, 3)
	}
	xy: Vec2 // co-ordinate
	z: number

	//const coordinates = (id: number) => [id, id] as const;
	// const coordinates: (id: number) => [number, number]

	normalize(offset=0): [number, number] {
		const v = this.xy.scalarProduct(1 / this.z).subtract(new Vec([[offset,offset]])).v
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
export class Edge_on_Screen implements CanvasObject {
	vs:[Vertex_OnScreen,Vertex_OnScreen]
	toCanvas(ctx: CanvasRenderingContext2D): void {
		ctx.strokeStyle = '#FFF'
		ctx.beginPath(); // Start a new path
		ctx.moveTo(...(this.vs[0].normalize()) ); // Move the pen to (30, 50)
		ctx.lineTo(...(this.vs[1].normalize())); // Draw a line to (150, 100)
		ctx.stroke(); // Render the path

		// Might be need if caller is BSPtree this.vs.forEach(v=>v.toCanvas(ctx))
	}
}

class BSPnode_ExtensiononStack extends Polygon_in_cameraSpace {
	ctx: CanvasRenderingContext2D;
	toCanvas(ctx: CanvasRenderingContext2D): void { // dupe
		ctx.fillStyle = "green";
		ctx.beginPath()
		ctx.moveTo(...this.vertices[0].normalize() )
		this.vertices.forEach(v => ctx.lineTo(...v.normalize()))
		ctx.closePath()
		ctx.fill()  // stroke()
		throw new Error("Method not implemented.");
	}
	//convex_polygon: Array<Vertex_OnScreen>[]   // cuts and perspective correction both want a z value ( homogenous coordinates : w ). Z-buffer z lives in clipspace and is different. I don't care for z-buffer (because it is so cumbersome to use on Jaguar).
	face_or_edge: boolean
	DFS(n: BSPnode | Leaf) {


		if (!this.face_or_edge) { if (n instanceof Leaf) this.toCanvas(this.ctx) }
		if (this.face_or_edge) {
			if (n instanceof BSPnode) {
				n.children.forEach(c => {
					this.DFS(c)
				})
				n.toCanvas(this.ctx)
			}
		}
	}
	//constructor()
}

// So this is like Horizon_Edge , while the partition is like the Edge_between_vertices
class BSPnode extends CanvasObject {
	children: (BSPnode | Leaf)[]  // 0,1   


	// local in a mesh : local variables hold Vertice  see Edge_on_Screen
	// elsewhere : the math likes this
	//split_line_beam: Vec3  // no rounding for lazy_precision_float
	// I flatten the structure her. Node is not fat enough for more structure. Vec3 is misleading
	xy: Vec2  //normal
	z: number  // bias
	decide(v: Vertex_OnScreen): number {
		return this.xy.innerProduct(v.xy) - this.z * v.z
	}

	decide_edge(cp: Vertex_OnScreen[]) { }

	toCanvas(ctx: CanvasRenderingContext2D) {
		let r: [number, number], last = 0, current = last, l = 0
		for (let corner = 0; corner <= 4; corner++) {
			const gray_xy = corner ^ ((corner & 2) >> 1)  // check code in screen clipping for single polygon
			// cycle => xy   00 01 ! 10 11 ! 00
			//               00 01   11 01   00
			current = this.xy.innerProduct(new Vec2([BSPnode.screen.map((s, i) => s * r[i])])) - this.z
			if (Math.sign(current) != Math.sign(last)) {
				const from_corner = current / this.xy.v[corner & 1]
				let co: [number, number]
				co[corner & 1] = from_corner
				co[(corner ^ 1) & 1] = BSPnode.screen[(corner ^ 1) & 1]
				if (l++ == 0) ctx.moveTo(...co)
			}

		}
	}


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

}  // InfinitePlane  -- z info and shader


export class BSPtree implements CanvasObject {
	// constructor  
	root: BSPnode // I come to the conclusion that basically a tree with zero nodes is valid, for example after culling
	insertPolygon() {
		// run the vertices down the tree . So, like clipping to screen borders. Vertice, edges , planes? Ah, plane check is the same for the whole screen.
		const b = new BSPnode   // on common parent
		b.insertPolygon()  // todo: still happens on a node
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
			ne.DFS(n)
			//stack.push(n) // well, a manual stack is combersome and error prone

			//let sn=new BSPnode_ExtensiononStack()

			//stack.pop()
		}

		const p = new Polygon_in_cameraSpace()
		p.toCanvas(ctx)
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