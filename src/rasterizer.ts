import { Vec3,Matrix, Matrix2, Vec2, Vec } from './clipping.js';
import { SimpleImage } from './GL.js';
import {Camera_in_stSpace, Mapper,CameraViewvector} from './infinite_plane_mapper.js'
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

// I tried nullable properties ...
class PointPointing{
	position: Array<number>
	vector: Vec2
	reverse:boolean
	border: any;
}

// but ...Aparently, with parallel consideration, I need polymorphism very badly
export interface Item{

}

class Edge_on_Screen implements Item{

}

class Edge_hollow extends Edge_on_Screen{

}

class Edge_w_slope extends Edge_hollow{
	slope:Vec2
}

class Edge_Horizon extends Edge_w_slope{
	bias:number
}

interface Point extends Item{
	get_y():number;
}

class vertex_behind_nearPlane implements Item{
	// this could be an enum?
}

// Just as projected
class Vertex_OnScreen implements Point{
	postion:number[]
	get_y(){return Math.floor(this.postion[0])}
}

class Corner implements Point{
	static screen:number[]
	corner:number
	get_y(){return screen[this.corner & 1]*( 1-(this.corner & 2)) }
}

class Onthe_border extends Corner{
	// the edge after the corner in mathematical sense of rotation
	border :number
	pixel_ordinate_int: number
	z_gt_nearplane:boolean

	get_y(){
		return this.border & 1 ? this.pixel_ordinate_int: screen[this.corner & 1]*( 1-(this.corner & 2)) 
	}
}

// Even without lazy precision, clipping and mapping tends to go back to the rotated vertex
class Vertex_in_cameraSpace {
	inSpace: Array<number>
	outside: boolean
	onScreen: PointPointing
}

enum modes{NDC,guard_band};

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
class Cyclic_Collection<T extends any>  {
	a:T[]
	constructor(a:T[]){
		this.a=a
	}
	get_startingVertex(i:number): T {
 		//via index and lenght?
		let n=  this.a.length
		let j= ((i % n) + n) % n
		return this.a[j]
	} 
	
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

	mode:modes=modes.NDC  ; // This is public. Change it to GuardBand to compare both versions ( artefacts, instruction count )

		// NDC -> pixel
	screen = [320, 200];
	screen_FoV =[8,5,8]

	epsilon = 0.001  // epsilon depends on the number of bits goint into IMUL. We need to factor-- in JRISC . So that floor() will work.

	constructor(){
		// for rasterization of clipped edges ( potentially very long) we want max precision (similar to vertices on opposed corners). So we expand the fraction
		let whyDoWeCareBelo16=this.screen.map(s=> Math.ceil(Math.log2(s))  )   // the function is a native instruction in JRISC. Okay , two instructions. need to adjust the bias

	}

	// So to fight rounding errors, every culling will happen twice. Can I reuse code? Virtual functions for do_vertex do_edge do_face
	// Once in 3d to a power of two viewing frustum
	// reverse: cull unreferenced (count it) vertices and edges
	// then in 2d to a bounding rectangle.16 and later a BSP
	// In the second pass, vertices can move outside, edges can lose a vertex or become invisible. For faces depend on this. The face without-edges screen-filler stays.
	// corners of the rectangle!


	project(vertices: Array<Vertex_in_cameraSpace>): boolean {
		Corner.screen=this.screen
		this.outside = [false, false]; let pattern32 = 0
		vertices.forEach(v => {
			let z = v.inSpace[v.inSpace.length - 1], outside = false  // sometimes string would be easier: -1

			let l = v.inSpace.length - 1   // weird that special component z is last. Probably in assembler I will interate backwards
			for (let i = 0; i < l; i++) {
				if (Math.abs(v.inSpace[i]) > z) { outside = true;break }  // abs works because there is a (0,0) DMZ between the four center pixels. DMZ around the pixels are used as a kindof mini guard band. symmetric NDC. For Jaguar with its 2-port register file it may makes sense to skew and check for the sign bit (AND r0,r0 sets N-flag). Jaguar has abs()
			}
			if (v[2]<this.near_plane) outside=true

			// stupid low level performance optimization: Apply 32 bit MUL only on some vertices .  NDC would apply 16 bit MUL on all visible vertices. NDC is so violating anything which brought me to engines: Bounding boxes and portals. Still, NDC has far less branches and code and wins if occlusion culling is not possible. Rounding is always a problem on the border -- not worse for NDC
			// On a computer without fast MUL, this would be the code. JRISC has single cycle MUL 16*16=>32 ( as fast as ADD !? )
			if (this.mode==modes.guard_band && outside == false){				
				for (let i = 0; i < l; i++) {  // square pixels. Otherwise I need this.FoV[] ( not the real one w)
					// notice how thie method loses on bit on the 3d side. But 32 bit are enough there. 16 bit on 2d are plency also though for SD -- hmm
					if (Math.abs(v.onScreen.position[i])*2 > z) { v.onScreen.position[i]=v.inSpace[i]/z ; if ( Math.abs(v.onScreen.position[i])>this.screen[i]) {outside = true;break }} // Similar to early out in BSP union

					//if (Math.abs(v[i] * this.screen_FoV[i]) > z*this.screen_FoV[2]) { outside = true }  // Notice how z will be shifted, but two register because 3d is 32 bit
					// Since FoV is so small, the result will not be 64 bit. I can use two (signed ) 32 bit register with large overlap
					// 2-port Register file is annoying. Recipie: Start from the end: IMAC . Then have the last preparation instruction 2 cycles before
				}
				if (outside==false)	
					for (let i = 0; i < l; i++) {			
					if (Math.abs(v.onScreen.position[i])*2 <= z) { v.onScreen.position[i]=v.inSpace[i]/z }  // This makes no sense behind a portal

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

			if (!outside && z > this.near_plane) {  // "pure" z checks last because they are not really specific. I need a near plane for z comparison. Far plane might be the level size as in Doom?
				v.onScreen.position = v.inSpace.slice(0, -1).map(c => c / z)    // DIV happens in a loop and will not be very asycn without blowing up code size
				// symmetric NDC. For Jaguar with its 2-port register file it may makes sense to skew and check for the sign bit (AND r0,r0 sets N-flag). Jaguar has abs()				

				
				
				switch( this.mode){
					case  modes.guard_band :  // So for guardband, we now project and once again check if a vertex is outside ( this duplicated check looks so silly, but I blame JRISC ).
						if  ( !outside && Math.abs(v.onScreen.position[0]) > this.screen[0] ) outside=true ;  // Some divisions are thrown away. This is an artifact of JRISC (68k), where DIV is not really more expensive than MUL. Or is it? DIV happens in a loop above
						break;
					case modes.NDC:  //  So for NDC this result is perfect. Now go from NDC -> pixels ( this pointless mul looks so silly )
						v.onScreen.position.forEach( (p,j)=> {  v.onScreen.position[j]+=(p>>8) * this.screen[j] } )  // only normalizesd mantissa of this.screen[j] ( 24 bit due to 16.16 DIV ). ADD is onyl single cycle because it feeds on the result of the previous MUL
						v.onScreen.vector.v.forEach( (p,j)=> {  v.onScreen.vector.v[j]+=(p>>8) * this.screen[j] } )  // renormalize?
						break;
				}
								
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

		let v_w_n=new Cyclic_Collection<Vertex_in_cameraSpace>( vertices ) //new Array<Vertex_OnScreen>


		// 2 vertices -> edge
		vertices.forEach((v, i) => {// edge stage. In a polygon an edge follows every vertex while circulating. In mesh it does not.
			let neighbours=on_screen_read.get_startingVertex(i)

			if (neighbours[0] instanceof Vertex_OnScreen ) {}

			let k = (i + 1) % vertices.length
			switch ((pattern32 >> i) & 3) {  // todo: rewrite as above
				case 3: // both outside, check if the edge is visble. In case of a guard band I need this code to avoid overflow later on

					let pattern4 = 0
					if (0 == (pattern4 = this.isEdge_visible([vertices[i], vertices[k]]))) break;
					let cuts:Item[]=this.edge_crossing_two_borders(vertices, pattern4) //, on_screen);
					
					/* too expensive
					// find cuts with slopes before ( after looks at us )
					let j=(i-1 + vertices.length)% vertices.length
					let c=this.findCut(vertices[i], vertices[j])
					if (c) {on_screen.push(c);pattern32=~((~pattern32) | 1<< i) } // set vertex to inside }
					else */ {on_screen.push(cuts)}
					

					//on_screen is pointer to collection:  on_screen.push(...cuts)
					break;
				case 1:
					// don't push yet
					// due to rounding, a 1001 pattern may lead to a cut inside the screen


					// this place is too late if (this.mode==modes.guard_band && vertices[i][0] > this.screen[0]/2 && slope[0]>0 ) { } // edge only in guardband 
					on_screen.push(v.onScreen)  // this push order is for a single polygon. In a mesh there would be references

					// todo move into following method
					let cut_r = this.edge_fromVertex_toBorder([vertices[k], vertices[i]], l);
					let edge=new Edge_w_slope()
					edge.slope=cut_r.vector
					on_screen.push(edge)
					let border=new Onthe_border()
					border.border=cut_r.border
					border.pixel_ordinate_int=cut_r.position[cut_r.border & 1]
					border.z_gt_nearplane=vertices[k].inSpace[2]>this.near_plane

					if (vertices[k].inSpace[2]>this.near_plane) {} // keep outside vertex
					
					// This is like a non-planar polygon after 3d clipping. And like for all non-planar polygons, to keept the mesh air-tight, we need to no cull back-faces, but back-spans. Should work here. Edges are shared.
					// So when a vertex has 6 edges leading to it and all the cuts disagree, what happens? Vertex sits 1 px outside of the viewing frustum ( like: we could have a guard band, but we didn't)
					// How can this be air tight?
					// I thought about this for float slopes with fixed scanlines: Do back-face scanes
					// Here we have the fixed screen border. If it is the side border, we need to act like doing scan rows? We know the faces which meet the border before and after ( rotation around the borders ). So within this it needs be forth (Draw) and back and forth (overdraw)
					// Intersting version is the screen corner. Rows or columns? So actually we need to determine back by the cuts which veered into the screen. => don't draw behind them, but do if real face is back?
					// Once I wanted pure code, but now I calculate cuts for the beam tree. For a non-planar polygon I can also calculate cuts. I shuold do this before I insert the convex parts into the beam tree.
					// It doesn't even matter if NDC. NDC keeps vertices on the same side of the frustum border. vertex-vertex slopes can be calcualted after NDC -mul-> px . Clipped edges have rounded slopes anyway          
					// After the screen list is debugged: todo: Cuts will be managed by the rasterizer
					on_screen.push(cut)
					break
				case 2: {
					// like in 3
					let cut = this.edge_fromVertex_toBorder([vertices[k], vertices[i]], l);
					on_screen.push(cut)// The asymmetry fits the counting: When the borders cut a corner of the polygon, the vertex count++ , but we have cuts=2
				}
					break
				case 0: //none outside
					on_screen.push(v.onScreen)  // Nothing to insert before   // of course in JRISC this would be in a fixed length pool
					break;
				// For a single poylgon rasterizer her I may want to check if this vertex is convex: All edge 2d cross products should have the same sign.
				// To insert in beam tree, first use the "flipped" vertex to cut into two convext sectors
				// Check for Self-intersection!

				// Doom has no near nor far plane. The Jaguar SDK deals with them like with the other planes
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

		let on_screen_read=new Cyclic_Collection<Item>(on_screen)
		const n=4;

		let with_corners=new Array<Item>();
		// check: edges -> vertices ( happy path: add corners, Rounding Exception: remove edges)
		// corners. The code above does not know if trianle or more. The code below still does not care. 
		// funny that we need two passes to add and remove items
		on_screen.forEach((v, i) => {
			// 
			let neighbours=[-1,+1].map(d=> on_screen_read.get_startingVertex(i+d) )
			
			// two cases without edge between vertices. Add edge to ease drawing
			if ((neighbours[0] instanceof Onthe_border && v instanceof vertex_behind_nearPlane && neighbours[1] instanceof Onthe_border) ) 
				{					
									let n=4 ;
						let i=  neighbours[1].border - neighbours[0].border ;
						//let s=Math.sign(i); 
						//i=Math.abs(i);
						var j=((i % n) + n) % n
						if (j==3){
							let t=new Corner();t.corner=neighbours[1].border
							with_corners.push(t)
							return							
						}else{	
							var range=neighbours.map(n=>(n as Onthe_border).border)  // typeGuard failed
				}
			}
				else {
					 if ((v instanceof Onthe_border && neighbours[1] instanceof Onthe_border) )  // previous loop discards the vertex marker. This is for symmetry: not a property. Asymmetric code looks ugly. Perhaps optimize the container: Type in a pattern, but use same getter and setter
						{
							var range=[v.border,neighbours[1].border]
						}
					else with_corners.push(v)  // this loop only adds corners. No need to skip due to a pattern nearby
					return
			}

			if (range[1]<range[0]) range[1]+=n

			for (let k=range[0];k<range[2];k++) // corner is named after the border before it ( math sense of rotation )
				{
					let t=new Corner();t.corner=k % n
					with_corners.push(t)			
				}
		})

		if (on_screen.length == 0) {  // no vertex nor edge on screen
		let null_egal = (this.corner11 >> 2 & 1) ^ (this.corner11 & 1)  // check if corner11 pierces the polygon in 3d ?
		if (null_egal == 0) return // polygon completely outside of viewing frustum
		// viewing frustum piercing through polygon
		}



		// screen as floats
		
		if (this.mode ==modes.NDC){}       // NDC -> pixel   . Rounding errors! Do this before beam tree. So beam tree is 2d and has no beams
		else   {}  // Guard band  . Faster rejection at portals ( no MUL needed with its many register fetches). Still no 3d because we operate on 16 bit rounded screen coordinates after projection and rotation!!


		let texturemap=new Camera_in_stSpace()  // Camera is in (0,0) in its own space .
		//  I should probably pull the next line into the constructor
		//let s:Vec3=new Vec3([vertices[0].inSpace])
		let payload:Matrix
		{
			let t=vertices.slice(0,3).map( v=>(v.inSpace)  )  // take 3 vertices and avoid overdetermination for polygons
			texturemap.transform_into_texture_space__constructor( new Vec3([t[0],t[1]]) ,new Vec3([t[2],t[1]]) )  // My first model will have the s and t vectors on edges 0-1-2  .  for z-comparison and texture maps		
			payload=texturemap.uvz_from_viewvector(   t[1]   )
		}

		this.rasterize_onscreen(with_corners,payload); return true
		return
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
	findCut(v0: Vertex_in_cameraSpace, v1: Vertex_in_cameraSpace): Array<number> {
		// find cut between two vertices. This is a 2d cut, so it is not a 3d cut. It is a 2d cut in the viewing frustum
		let p0 = v0.onScreen.position
		let p1 = v1.onScreen.position
		let d =  new Vec2([p0,p1])  //p0.map((c, j) => p1[j]-c)  // vector from p0 to p1
		//  [v0,v1] &* [s,t]  = d
		// <=> [s,t] = inv([v0,v1]]
		let m=new Matrix2()
		m.nominator=[v0.onScreen.vector, v1.onScreen.vector]
		let fac=m.inverse_rn(0)
		let s=fac.innerProduct(d)
		let xy=v0.onScreen.vector.scalarProduct(s).subtract(new Vec2([p0]).scalarProduct(-fac.den))  // 16*16 -> 32 bit
		// no rounding errors allowed here
		let pixels=xy.v.map(c => c / fac.den )  // 32/32 -> 8bit .  this feels wrong to do on the frustum. There we should use a while loop 

		return pixels
	}

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

	private edge_crossing_two_borders(vertex: Vertex_in_cameraSpace[], pattern4: number):Item[] {
		let slope = this.get_edge_slope_onScreen(vertex), border=0

		// with zero border crossing, no edge is visible. Or when both vertices are in front of the near plane. For speed
		if (vertex[0].inSpace[2]<this.near_plane && vertex[1].inSpace[2]<this.near_plane) return [] //false

		// some borders cannot be crossed and all corners are on the same side, but which? Sign does not make much sense here
		for (let border = 0; border < 4; border++) {  // go over all screen borders
			if ((pattern4 >> border & 1) != (pattern4 >> (border + 1) & 1)) {   // check if vertices lie on different sides of the 3d frustum plane
				border++
			}
		}

		// check if crossing in front of us
		let qp:Vec3=new Vec3([vertex[1].inSpace , vertex[0].inSpace ])
		//let nearest_point= (new Vec3([vertex[0].inSpace]).scalarProduct( qp.innerProduct(qp) ).subtract( qp.scalarProduct( qp.innerProduct( new Vec3([vertex[0].inSpace])   ) ))) ;  // this is in 3d so 32 bit. A lot of MUL.32.32 :-( . Similar to: face in front of me = z   or also: texture   . Log for performance.
		let z= vertex[0].inSpace[2] * qp.innerProduct(qp) - qp.v[2]*(qp.innerProduct(new Vec3([vertex[0].inSpace])));   // we only need nearest_point.z 
		if (z<0) return []

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

		let on_screen=new Array<Item>()
		{ 
			for(let j=0;j<2;j++)
			{
				// Calculate pixel cuts for the rasterizer . we don't care for cuts .. I mean we do, we need them for the beam tree. But with a single polygon we only need y_pixel
				// code duplicated from v->edge
				let coords = [0, 0]
				coords[border & 1] = (border & 2) - 1;
				coords[~border & 1] = (slope[2] + ((border & 2) - 1) * slope[border & 1]) / slope[~border & 1];  // I do have to check for divide by zero. I already rounded to 16 bit. So MUL on corners is okay.

				let o=new Onthe_border()
				o.border=border
				o.pixel_ordinate_int=coords[~border & 1]
				on_screen.push(o)
				let e=new Edge_Horizon()
				e.slope=new Vec2([slope.slice(0,2)])
				e.bias=slope[2]
				if (j==0) on_screen.push(e)

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

	// The beam tree will make everything convex and trigger a lot of MUL 16*16 in the process. Code uses Exception patter: First check if all vertices are convex -> break . Then check for self-cuts => split, goto first . ZigZag concave vertices. Find nearest for last. Zig-zag schould not self cut? 
	// For the MVP, we do best effort for polygons with nore than 3 edges: Ignore up slopes. Do backface culling per span. 
	rasterize_onscreen(vertex: Array<Item>, Payload: Matrix) {  // may be a second pass like in the original JRISC. Allows us to wait for the backbuffer to become available.
		let l = vertex.length, min = [0, -1]   //weird to proces second component first. Rotate?

		function instanceOfPoint(object: any): object is Point {
			return 'get_y' in object;
		}

		for (let i = 1; i < l; i++) {
			let v = vertex[i]
			if (instanceOfPoint(v) && v[i].get_y() < min[1]) min = [i, v.get_y()]
		}

		let i = min[0]
		let v = vertex[i]
		let active_vertices = [[0, i], [0, i]] // happens in loop first iteration, (i + l - 1) % l], [i, (i + 1) % l]]

		// active_vertices.forEach(a => {
		// 	let vs = a.map(b => this.vertices[b])
		// 	if (vs[0].outside != vs[1].outside) {
		// 		// get edge data. Needs a data structure (for sure). Somehow for the rasterizer I calculate it on the fly now
		// 		 this.edge_fromVertex_toBorder(vs, l);
		// 	}
		// 	let v = this.vertices[a[1]]
		// 	v.outside
		// })
		let m = new Mapper(new SimpleImage())   // our interface to the hardware dependent side. Used for the whole mesh

		// The pixel shader does not care about the real 3d nature of the vectors
		// It just knows that it has to divide everything by z (= last element)
		// Matrix is trans-unit. There is no reason for it to be square

		let ps=new PixelShader( Payload )  // InfiniteCheckerBoard is PixelShader

		// this is probably pretty standard code. Just I want to explicitely show how what is essential for the inner loop and what is not
		// JRISC is slow on branches, but unrolling is easy (for my compiler probably), while compacting code is hard. See other files in this project.

		let slope_accu_c = [[0, 0], [0, 0]]  // (counter) circle around polygon edges as ordered in space / level-mesh geometry
		let slope_int = [0, 0]
		// let slope_accu_s=[[0,0],[0,0]]  // sorted by x on screen  .. uh pre-mature optimization: needs to much code. And time. Check for backfaces in a prior pass? Solid geometry in a portal renderer or beam tree will cull back-faces automatically
		for (let y = (v as Point).get_y(); y < this.screen[1]; y++) {  // the condition is for safety : Todo: remove from release version			
			let width=0
			for (let k = 0; k < 2; k++) {
				if (y == vertex[active_vertices[k][1]][1]) {	// todo: duplicate this code for the case that on vertex happens on one side
					Bresenham[k][1] += Bresenham[k][0] // on JRISC this sets flags .. but I still need to persist them. A useless. Just BitTest on sign. Single cycle to 
					let ca=Bresenham[k][1] < 0   // Bresenham one line in advance would bloat code only by one instruction 
					if (ca) {
						Bresenham[k][1] += Bresenham[k][2]						
					}
					slope_accu_c[k][1] += slope_accu_c[k][0] + (ca ? 1 :0 )  //  JRISC/ADC  todo: rename as x	


					ps.es[k].propagate_along(ca  )
				}
				else {
					if (k == 0 && active_vertices[0][1] == active_vertices[1][1]) break  // left and right side have met. The y condition is more specific. That's why here this odd k==0 appears

					active_vertices[k][0] = active_vertices[k][1]
					active_vertices[k][1] = active_vertices[k][1] + (k * 2 - 1 + l) % l
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
					let v_val = active_vertices[k].map(a => vertex[a]) 		// JRISC does not like addressing modes, but automatic caching in registers is easy for a compiler. I may even want to pack data to save on LOADs with Q-displacement

					if (!(instanceOfPoint(v_val[0]) && (v_val[1] instanceof Edge_on_Screen) && instanceOfPoint(v_val[2]))) continue
					if (v_val[0].get_y() >= v_val[2].get_y()) continue

					if (v_val[1] instanceof Edge_Horizon) // This can only happen at start or end. But this does not help with simplifying the flow
					{
						var y_int = (v_val[0] as Onthe_border).get_y()  // int
						var ambi = v_val[0] as Onthe_border
						var x_at_y_int = ambi.border & 1 ? ambi.pixel_ordinate_int : this.screen[0] * (1 - (ambi.border & 2))
						var Bresenham = v_val[1].bias + slope.wedgeProduct(new Vec2([[x_at_y_int, y_int]]))  //y_int*d[0]+x_at_y_int*d[1]
					} else {

						// Point supports get_y . So I only need to consider mirror cases for pattern matchting and subpixel, but not for the for(y) .
						if (v_val[0] instanceof Vertex_OnScreen && v_val[1] instanceof Edge_hollow && v_val[2] instanceof Vertex_OnScreen) {

							var slope = new Vec2([(v_val[2]).postion, v_val[0].postion])
							// for(let i=0;i< v_val[0].postion.length;i+=2){
							// 	d[i]=(v_val[i] as Vertex_OnScreen).postion[i]-v_val[0].postion[i]
							// }

							//var slope=d// see belowvar slope_integer=
							let d = slope.v; if (d[1] <= 0) { continue }
							var y_int = v_val[0].get_y()  // int
							var x_at_y_int = Math.floor(v_val[0][0] + d[0] * (y_int - v_val[0][1]) / d[1]) // frac -> int
							var Bresenham = slope.wedgeProduct(new Vec2([[x_at_y_int, y_int], v_val[0].postion])) //(y_int- v_val[0][1] )*d[0]+(x_at_y_int- v_val[0][0] )*d[1]  // this should be the same for all edges not instance of Edge_Horizon

						} else {
							if (v_val[0] instanceof Vertex_OnScreen && v_val[1] instanceof Edge_w_slope && v_val[2] instanceof Onthe_border) {
								var slope = v_val[1].slope // see belowvar slope_integer=
								// duplicated code. Function call?
								var d = slope.v
								var y_int = v_val[0].get_y()  // int
								if (y_int <= v_val[2].get_y()) { continue }
								var x_at_y_int = Math.floor(v_val[0][0] + d[0] * (y_int - v_val[0][1]) / d[1]) // frac -> int
								var Bresenham = slope.wedgeProduct(new Vec2([[x_at_y_int, y_int], v_val[0].postion]))  // this should be the same for all edges not instance of Edge_Horizon

							} else {
								if (v_val[2] instanceof Vertex_OnScreen && v_val[1] instanceof Edge_w_slope && v_val[0] instanceof Onthe_border) {
									var slope = v_val[1].slope // see belowvar slope_integer=
									// duplicated code. Function call?
									var d = slope.v
									var y_int = v_val[2].get_y()  // int
									var x_at_y_int = ambi.border & 1 ? ambi.pixel_ordinate_int : this.screen[0] * (1 - (ambi.border & 2)) // todo: method!
									var Bresenham = slope.wedgeProduct(new Vec2([[x_at_y_int, y_int], v_val[2].postion]))  // this should be the same for all edges not instance of Edge_Horizon									
								}
							}
						}
					}

					// Bresenham still needs integer slope
					slope_accu_c[k] = [d[0] > 0 ? d[1] / d[0] : this.screen[1] * Math.sign(d[1]), x_at_y_int]

					let e=new EdgeShader( v_val[2] , x_at_y_int , slope_accu_c[k][0] )
					ps.es[ k ]=e 
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


			if (width>0){
				ps.span( slope_accu_c[0][0], width  ,m )
			}	



		} //while (active_vertices[0][1] != active_vertices[1][1]) // full circle, bottom vertex found on the fly		
	}
	private edge_fromVertex_toBorder(vs: Vertex_in_cameraSpace[], l: number):PointPointing {
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

		if (  slope[0] > slope[1]) { // Nonsense  slope tells us that the edge comes from above.  This is branching only for NDC
			// correct order . At least every other vertex need to be on inside for this function

			 
			let cc = 0;

			for (let corner = -1; corner <= +1; corner += 2) {
				if ((corner - vs[0].onScreen[0]) * slope[1] > (-1 - vs[0].onScreen[1]) * slope[0]) {
					vs[1].onScreen[0] = corner, vs[1].onScreen.border=corner // Todo: I need corners with rotation sense to fill the polygon
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
				vs[1].onScreen[1] = ( vs[0].onScreen[0] * slope[1]+ (-1 - vs[0].onScreen[1]) * slope[0] ) / slope[1]; // no rounding error allowed
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



