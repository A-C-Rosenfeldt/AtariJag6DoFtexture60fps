import { Vec3, Vec2 } from './clipping';
import { Camera_in_stSpace } from './infinite_plane_mapper';
import { PixelShader, EdgeShader } from './PixelShader';
import { modes, Corner, Vertex_OnScreen, Cyclic_Collection, Onthe_border, vertex_behind_nearPlane, Edge_Horizon, Point, Edge_on_Screen, Edge_hollow, Edge_w_slope } from './rasterizer';
export class Polygon_in_cameraSpace {
    constructor(m) {
        this.near_plane = 0.001;
        this.mode = modes.NDC; // This is public. Change it to GuardBand to compare both versions ( artefacts, instruction count )
        // NDC -> pixel
        this.screen = [320, 200];
        this.half_screen = this.screen.map(s => s / 2);
        this.FoV = [1.6, 1.0];
        this.FoV_rezi = this.FoV.map(f => 1 / f); // todo: Multiply with rotation matrix . Need to be 1 <=   < 2
        this.screen_FoV = this.FoV_rezi.map((f, i) => f * this.half_screen[i]); // Needs to be this.screen <  < 2*this.screen for the machine language optimized clipping
        this.epsilon = 0.001; // epsilon depends on the number of bits goint into IMUL. We need to factor-- in JRISC . So that floor() will work.
        this.m = m;
        // for rasterization of clipped edges ( potentially very long) we want max precision (similar to vertices on opposed corners). So we expand the fraction
        //let whyDoWeCareBelo16=this.screen.map(s=> Math.ceil(Math.log2(s))  )   // the function is a native instruction in JRISC. Okay , two instructions. need to adjust the bias
    }
    // So to fight rounding errors, every culling will happen twice. Can I reuse code? Virtual functions for do_vertex do_edge do_face
    // Once in 3d to a power of two viewing frustum
    // reverse: cull unreferenced (count it) vertices and edges
    // then in 2d to a bounding rectangle.16 and later a BSP
    // In the second pass, vertices can move outside, edges can lose a vertex or become invisible. For faces depend on this. The face without-edges screen-filler stays.
    // corners of the rectangle!
    project(vertices) {
        Corner.screen = this.screen;
        this.outside = [false, false];
        let pattern32 = 0;
        vertices.forEach(v => {
            var _a, _b;
            let z = v.inSpace[v.inSpace.length - 1], outside = false; // sometimes string would be easier: -1 . Field have name and id ?
            let l = v.inSpace.length - 1; // weird that special component z is last. Probably in assembler I will interate backwards
            for (let i = 0; i < l; i++) {
                if (Math.abs(v.inSpace[i]) > z) {
                    outside = true;
                    break;
                } // abs works because there is a (0,0) DMZ between the four center pixels. DMZ around the pixels are used as a kindof mini guard band. symmetric NDC. For Jaguar with its 2-port register file it may makes sense to skew and check for the sign bit (AND r0,r0 sets N-flag). Jaguar has abs()
            }
            if (v[2] < this.near_plane)
                outside = true;
            else
                v.onScreen = new Vertex_OnScreen();
            // stupid low level performance optimization: Apply 32 bit MUL only on some vertices .  NDC would apply 16 bit MUL on all visible vertices. NDC is so violating anything which brought me to engines: Bounding boxes and portals. Still, NDC has far less branches and code and wins if occlusion culling is not possible. Rounding is always a problem on the border -- not worse for NDC
            // On a computer without fast MUL, this would be the code. JRISC has single cycle MUL 16*16=>32 ( as fast as ADD !? )
            if (outside == false) { // this.mode==modes.guard_band &&   I only support this mode because it is compatible to portals and perhaps later also to the beamtree.
                for (let i = 0; i < l; i++) { // square pixels. Otherwise I need this.FoV[] ( not the real one w)
                    // notice how thie method loses on bit on the 3d side. But 32 bit are enough there. 16 bit on 2d are plency also though for SD -- hmm
                    if (Math.abs(v.inSpace[i]) > z) {
                        v.onScreen.position[i] = v.inSpace[i] * this.screen_FoV[i] / z;
                        if (Math.abs(v.onScreen.position[i]) > this.half_screen[i]) {
                            outside = true;
                            break;
                        }
                    } // Similar to early out in BSP union
                    //if (Math.abs(v[i] * this.screen_FoV[i]) > z*this.screen_FoV[2]) { outside = true }  // Notice how z will be shifted, but two register because 3d is 32 bit
                    // Since FoV is so small, the result will not be 64 bit. I can use two (signed ) 32 bit register with large overlap
                    // 2-port Register file is annoying. Recipie: Start from the end: IMAC . Then have the last preparation instruction 2 cycles before
                }
                if (outside == false)
                    for (let i = 0; i < l; i++) {
                        if (Math.abs(v.inSpace[i]) <= z) {
                            v.onScreen.position[i] = v.inSpace[i] * this.screen_FoV[i] / z;
                        } // This makes no sense behind a portal
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
                v.onScreen = null; // On Jagurar I was thinking about using struct . Or perhaps this loop should map() ?
            }
            pattern32 <= 1;
            pattern32 |= outside ? 1 : 0;
            v.outside = outside;
            (_a = this.outside)[0] || (_a[0] = outside);
            (_b = this.outside)[1] && (_b[1] = outside);
        });
        pattern32 = pattern32 << vertices.length | pattern32; // pattern allows look ahead
        // Cull invisble Edges. Faces pull their z,s,t from 3d anyway. I cannot really clip edges here because it lets data explode which will be needed by the rasterizer (not for face culling)
        // I am unhappy about the need to basically repeat this step on the 2dBSP (for guard_band and portals).
        // MVP: Get code running on 256x256 with one polygon. Guard == NDC 
        // Optimized clipping on rectangle because one factor is zero. The other still need
        let on_screen = new Array(), cut = [], l = vertices.length;
        this.corner11 = 0; // ref bitfield in JRISC ( or C# ) cannot do in JS
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
        let v_w_n = new Cyclic_Collection(vertices); //new Array<Vertex_OnScreen>
        // 2 vertices -> edge
        vertices.forEach((v, i) => {
            //if (neighbours[0] instanceof Vertex_OnScreen ) {}
            let k = (i + 1) % vertices.length;
            let neighbours = [v_w_n.get_startingVertex(i), v_w_n.get_startingVertex(i + 1)]; // Error cannot access on_screen_read before initialization.
            if (neighbours[0].outside) {
                if (neighbours[1].outside) {
                    let pattern4 = 0;
                    if (0 != (pattern4 = this.isEdge_visible([vertices[i], vertices[k]]))) {
                        let cuts = this.edge_crossing_two_borders(vertices, pattern4);
                        on_screen.push(...cuts);
                    }
                }
                else {
                    let cut_r = this.edge_fromVertex_toBorder([vertices[k], vertices[i]], l);
                    on_screen.push(...cut_r);
                }
            }
            else {
                on_screen.push(v.onScreen);
                if (neighbours[1].outside) {
                    // todo move into following method
                    let cut_r = this.edge_fromVertex_toBorder([vertices[k], vertices[i]], l);
                    on_screen.push(...cut_r);
                    //let border=new Onthe_border()
                }
            }
        });
        let on_screen_read = new Cyclic_Collection(on_screen);
        const n = 4;
        let with_corners = new Array();
        // check: edges -> vertices ( happy path: add corners, Rounding Exception: remove edges)
        // corners. The code above does not know if trianle or more. The code below still does not care. 
        // funny that we need two passes to add and remove items
        on_screen.forEach((v, i) => {
            // 
            let neighbours = [-1, +1].map(d => on_screen_read.get_startingVertex(i + d));
            // two cases without edge between vertices. Add edge to ease drawing
            // In this case follow the border in the rotation sense of a front facing polygon
            if ((neighbours[0] instanceof Onthe_border && v instanceof vertex_behind_nearPlane && neighbours[1] instanceof Onthe_border)) {
                let n = 4;
                let i = neighbours[1].border - neighbours[0].border;
                //let s=Math.sign(i); 
                //i=Math.abs(i);
                var j = ((i % n) + n) % n;
                if (j == 3) {
                    let t = new Corner();
                    t.corner = neighbours[1].border;
                    with_corners.push(t);
                    return;
                }
                else {
                    var range = neighbours.map(n => n.border); // typeGuard failed
                }
            }
            else { // In this case, use the shortest path between the two vertices. This can endure the rounding errors from clipping. This should work for the BSP-tree.
                // In the MVP I will send only clipped polygons to the BSP tree. Perhaps later I will add a 32bit code path and do pure portals?
                // Anyway, BSP means portals because the leafs are convex polygons, and we add convex polygons whose clipped version becomes a new leaf.
                // BSP always wanrs heuristcs. The simple linear polygon-add will use all info about two polygons to decide how to construct the BSP,
                // though, the leaf is already integrated into the beam tree. I would need to consider tree vs convex polygon. 
                // When rendering a mesh in a stripe, surely I should reuse shared edges
                if ((v instanceof Onthe_border && neighbours[1] instanceof Onthe_border)) // previous loop discards the vertex marker. This is for symmetry: not a property. Asymmetric code looks ugly. Perhaps optimize the container: Type in a pattern, but use same getter and setter
                 {
                    var range = [v.border, neighbours[1].border];
                }
                else
                    with_corners.push(v); // this loop only adds corners. No need to skip due to a pattern nearby
                return;
            }
            if (range[1] < range[0])
                range[1] += n;
            for (let k = range[0]; k < range[2]; k++) // corner is named after the border before it ( math sense of rotation )
             {
                let t = new Corner();
                t.corner = k % n;
                with_corners.push(t);
            }
        });
        if (on_screen.length == 0) { // no vertex nor edge on screen
            let null_egal = (this.corner11 >> 2 & 1) ^ (this.corner11 & 1); // check if corner11 pierces the polygon in 3d ?
            if (null_egal == 0)
                return; // polygon completely outside of viewing frustum
            // viewing frustum piercing through polygon
        }
        // screen as floats
        if (this.mode == modes.NDC) { } // NDC -> pixel   . Rounding errors! Do this before beam tree. So beam tree is 2d and has no beams
        else { } // Guard band  . Faster rejection at portals ( no MUL needed with its many register fetches). Still no 3d because we operate on 16 bit rounded screen coordinates after projection and rotation!!
        let texturemap = new Camera_in_stSpace(); // Camera is in (0,0) in its own space .
        //  I should probably pull the next line into the constructor
        //let s:Vec3=new Vec3([vertices[0].inSpace])
        let payload;
        {
            let t = vertices.slice(0, 3).map(v => (v.inSpace)); // take 3 vertices and avoid overdetermination for polygons
            texturemap.transform_into_texture_space__constructor(new Vec3([t[0], t[1]]), new Vec3([t[2], t[1]])); // My first model will have the s and t vectors on edges 0-1-2  .  for z-comparison and texture maps		
            payload = texturemap.uvz_from_viewvector(t[1]);
        }
        //console.log("payload",payload.nominator) ; // Error: payload is not really constructed
        this.rasterize_onscreen(with_corners, payload); // JRISC seems to love signed multiply. So, to use the full 16bit, (0,0) is center of screen at least after all occlusion and gradients are solved. The blitter on the other hand wants 12-bit unsigned values
        return true;
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
    edge_crossing_two_borders(vertex, pattern4) {
        const slope = this.get_edge_slope_onScreen(vertex);
        let border_count = 0;
        // with zero border crossing, no edge is visible. Or when both vertices are in front of the near plane. For speed
        if (vertex[0].inSpace[2] < this.near_plane && vertex[1].inSpace[2] < this.near_plane)
            return []; //false
        // some borders cannot be crossed and all corners are on the same side, but which? Sign does not make much sense here
        for (let border = 0; border < 4; border++) { // go over all screen borders
            if ((pattern4 >> border & 1) != (pattern4 >> (border + 1) & 1)) { // check if vertices lie on different sides of the 3d frustum plane
                border_count++;
            }
        }
        // check if crossing in front of us
        let qp = new Vec3([vertex[1].inSpace, vertex[0].inSpace]);
        //let nearest_point= (new Vec3([vertex[0].inSpace]).scalarProduct( qp.innerProduct(qp) ).subtract( qp.scalarProduct( qp.innerProduct( new Vec3([vertex[0].inSpace])   ) ))) ;  // this is in 3d so 32 bit. A lot of MUL.32.32 :-( . Similar to: face in front of me = z   or also: texture   . Log for performance.
        let z = vertex[0].inSpace[2] * qp.innerProduct(qp) - qp.v[2] * (qp.innerProduct(new Vec3([vertex[0].inSpace]))); // we only need nearest_point.z 
        if (z < 0)
            return [];
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
        const on_screen = new Array();
        {
            for (let j = 0; j < 2; j++) {
                // Calculate pixel cuts for the rasterizer . we don't care for cuts .. I mean we do, we need them for the beam tree. But with a single polygon we only need y_pixel
                // code duplicated from v->edge
                let coords = [0, 0];
                coords[border_count & 1] = this.screen[~border_count & 1] * ((border_count & 2) - 1);
                coords[~border_count & 1] = (slope[2] + this.screen[~border_count & 1] * ((border_count & 2) - 1) * slope[border_count & 1]) / slope[~border_count & 1]; // I do have to check for divide by zero. I already rounded to 16 bit. So MUL on corners is okay.
                let o = new Onthe_border();
                o.border = border_count;
                o.pixel_ordinate_int = coords[~border_count & 1];
                on_screen.push(o);
                let e = new Edge_Horizon();
                e.slope = new Vec2([slope.slice(0, 2)]);
                e.bias = slope[2];
                if (j == 0)
                    on_screen.push(e);
            }
        }
        return on_screen;
    }
    isEdge_visible(vertices) {
        // rough and fast
        const z = vertices[0].inSpace[2];
        for (let orientation = 0; orientation < 2; orientation++) {
            const xy = vertices.map(v => v.inSpace[orientation]);
            for (let side = 0; side < 2; side++) {
                if (+xy[0] > z && +xy[1] > z)
                    return 0; //false
                if (-xy[0] > z && -xy[1] > z)
                    return 0; //false
            }
        }
        // precise and unoptimized
        const v0 = new Vec3([vertices[0].inSpace]);
        const edge = new Vec3([vertices[0].inSpace, vertices[1].inSpace]); // todo: consolidate with edges with one vertex on screen
        const cross = v0.crossProduct(edge); // Like a water surface
        const corner_screen = [0, 0];
        const bias = corner_screen[2] * cross.v[2];
        //let head = [false, false]  // any corner under water any over water?
        let pattern4 = 0, inside = 0;
        for (corner_screen[1] = -1; corner_screen[1] <= +1; corner_screen[1] += 2) {
            for (corner_screen[0] = -1; corner_screen[0] <= +1; corner_screen[0] += 2) {
                inside = bias + corner_screen[0] * cross.v[0] + corner_screen[1] * cross.v[1];
                pattern4 <= 1;
                if (inside > 0)
                    pattern4 |= 1;
            }
        }
        this.corner11 |= 1 << (Math.sign(inside) + 1); // accumulate compact data to check if polygon covers the full screen or is invisible
        if (pattern4 == 15 || pattern4 == 0)
            return 0;
        // check for postive z
        const base = new Vec3([vertices[0].inSpace]);
        const direction = new Vec3([vertices[0].inSpace, vertices[1].inSpace]);
        // Gramm-Schmidt
        const corrector = direction.scalarProduct(base.innerProduct(direction) / direction.innerProduct(direction));
        const close = vertices[0].inSpace[2] - corrector.v[2]; // Does nearest point have positive z?  full equation. base - corrector  
        if (close < 0)
            return 0;
        // compfort repeat for caller
        pattern4 |= pattern4 << 4; // |= 1<<8 for zero temrination in JRISC
        // for(let i=0;i<4;i++){
        // 	let t=((pattern4 >> i)&1)
        // 	head[t]=true
        // }
        return pattern4; //head[0] && head[1]
    }
    // The beam tree will make everything convex and trigger a lot of MUL 16*16 in the process. Code uses Exception patter: First check if all vertices are convex -> break . Then check for self-cuts => split, goto first . ZigZag concave vertices. Find nearest for last. Zig-zag schould not self cut? 
    // For the MVP, we do best effort for polygons with nore than 3 edges: Ignore up slopes. Do backface culling per span. 
    rasterize_onscreen(vertex, Payload) {
        const l = vertex.length;
        let min = [0, -1]; //weird to proces second component first. Rotate?
        function instanceOfPoint(object) {
            return 'get_y' in object;
        }
        for (let i = 1; i < l; i++) {
            let v = vertex[i];
            if (instanceOfPoint(v) && v.get_y() < min[1])
                min = [i, v.get_y()];
        }
        let i = min[0];
        let v = vertex[i];
        const active_vertices = [[0, i], [0, i]]; // happens in loop first iteration, (i + l - 1) % l], [i, (i + 1) % l]]
        // active_vertices.forEach(a => {
        // 	let vs = a.map(b => this.vertices[b])
        // 	if (vs[0].outside != vs[1].outside) {
        // 		// get edge data. Needs a data structure (for sure). Somehow for the rasterizer I calculate it on the fly now
        // 		 this.edge_fromVertex_toBorder(vs, l);
        // 	}
        // 	let v = this.vertices[a[1]]
        // 	v.outside
        // })
        const m = this.m; // our interface to the hardware dependent side. Used for the whole mesh. Handels asset loading and frame buffer (even on the Jaguar we see the frame buffer only through the blitter)
        // The pixel shader does not care about the real 3d nature of the vectors
        // It just knows that it has to divide everything by z (= last element)
        // Matrix is trans-unit. There is no reason for it to be square
        const ps = new PixelShader(Payload, this.half_screen); // InfiniteCheckerBoard is PixelShader
        // this is probably pretty standard code. Just I want to explicitely show how what is essential for the inner loop and what is not
        // JRISC is slow on branches, but unrolling is easy (for my compiler probably), while compacting code is hard. See other files in this project.
        const slope_accu_c = [[0, 0], [0, 0]]; // (counter) circle around polygon edges as ordered in space / level-mesh geometry
        //let slope_int = [0, 0]
        // let slope_accu_s=[[0,0],[0,0]]  // sorted by x on screen  .. uh pre-mature optimization: needs to much code. And time. Check for backfaces in a prior pass? Solid geometry in a portal renderer or beam tree will cull back-faces automatically
        for (let y = v.get_y(); y < this.half_screen[1]; y++) { // the condition is for safety : Todo: remove from release version
            let width = 0;
            for (let k = 0; k < 2; k++) {
                const t0 = active_vertices[k][1];
                if (typeof t0 !== "number")
                    throw new Error("Invalid vertex ref");
                const t1 = vertex[t0];
                const t3 = t1 instanceof Point; // duplicated code. Looks like after clipping I should split into vertices and edges. Or at least use a fixed pattern will null placeholders?
                let t2;
                if (t3) {
                    t2 = t1.get_y();
                    if (typeof t2 !== "number")
                        throw new Error("Invalid vertex");
                    if (y < t2) { // todo: duplicate this code for the case that on vertex happens on one side
                        Bresenham[k][1] += Bresenham[k][0]; // on JRISC this sets flags .. but I still need to persist them. A useless. Just BitTest on sign. Single cycle to 
                        let ca = Bresenham[k][1] < 0; // Bresenham one line in advance would bloat code only by one instruction 
                        if (ca) {
                            Bresenham[k][1] += Bresenham[k][2];
                        }
                        slope_accu_c[k][1] += slope_accu_c[k][0] + (ca ? 1 : 0); //  JRISC/ADC  todo: rename as x	
                        ps.es[k].propagate_along(ca);
                    }
                    else {
                        if (k == 0 && active_vertices[0][1] == active_vertices[1][1])
                            break; // left and right side have met on a vertex. The y condition is more specific. That's why here this odd k==0 appears
                        // while ( edge not processed)
                        active_vertices[k][0] = active_vertices[k][1];
                        active_vertices[k][1] = active_vertices[k][1] + (k * 2 - 1 + l) % l;
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
                        let v_val = active_vertices[k].map(a => vertex[a]); // JRISC does not like addressing modes, but automatic caching in registers is easy for a compiler. I may even want to pack data to save on LOADs with Q-displacement
                        if (!(instanceOfPoint(v_val[0]) && (v_val[1] instanceof Edge_on_Screen) && instanceOfPoint(v_val[2])))
                            continue;
                        if (v_val[0].get_y() >= v_val[2].get_y())
                            continue;
                        if (v_val[1] instanceof Edge_Horizon) // This can only happen at start or end. But this does not help with simplifying the flow
                         {
                            var y_int = v_val[0].get_y(); // int
                            var ambi = v_val[0];
                            var x_at_y_int = ambi.border & 1 ? ambi.pixel_ordinate_int : this.screen[0] * (1 - (ambi.border & 2));
                            var Bresenham = v_val[1].bias + slope.wedgeProduct(new Vec2([[x_at_y_int, y_int]])); //y_int*d[0]+x_at_y_int*d[1]
                        }
                        else {
                            // Point supports get_y . So I only need to consider mirror cases for pattern matchting and subpixel, but not for the for(y) .
                            if (v_val[0] instanceof Vertex_OnScreen && v_val[1] instanceof Edge_hollow && v_val[2] instanceof Vertex_OnScreen) {
                                var slope = new Vec2([(v_val[2]).position, v_val[0].position]);
                                // for(let i=0;i< v_val[0].postion.length;i+=2){
                                // 	d[i]=(v_val[i] as Vertex_OnScreen).postion[i]-v_val[0].postion[i]
                                // }
                                //var slope=d// see belowvar slope_integer=
                                let d = slope.v;
                                if (d[1] <= 0) {
                                    continue;
                                }
                                var y_int = v_val[0].get_y(); // int
                                var x_at_y_int = Math.floor(v_val[0][0] + d[0] * (y_int - v_val[0][1]) / d[1]); // frac -> int
                                var Bresenham = slope.wedgeProduct(new Vec2([[x_at_y_int, y_int], v_val[0].position])); //(y_int- v_val[0][1] )*d[0]+(x_at_y_int- v_val[0][0] )*d[1]  // this should be the same for all edges not instance of Edge_Horizon
                            }
                            else {
                                if (v_val[0] instanceof Vertex_OnScreen && v_val[1] instanceof Edge_w_slope && v_val[2] instanceof Onthe_border) {
                                    var slope = v_val[1].slope; // see belowvar slope_integer=
                                    // duplicated code. Function call?
                                    var d = slope.v;
                                    var y_int = v_val[0].get_y(); // int
                                    if (y_int <= v_val[2].get_y()) {
                                        continue;
                                    }
                                    var x_at_y_int = Math.floor(v_val[0][0] + d[0] * (y_int - v_val[0][1]) / d[1]); // frac -> int
                                    var Bresenham = slope.wedgeProduct(new Vec2([[x_at_y_int, y_int], v_val[0].position])); // this should be the same for all edges not instance of Edge_Horizon
                                }
                                else {
                                    if (v_val[2] instanceof Vertex_OnScreen && v_val[1] instanceof Edge_w_slope && v_val[0] instanceof Onthe_border) {
                                        var slope = v_val[1].slope; // see belowvar slope_integer=
                                        // duplicated code. Function call?
                                        var d = slope.v;
                                        var y_int = v_val[2].get_y(); // int
                                        var x_at_y_int = ambi.border & 1 ? ambi.pixel_ordinate_int : this.screen[0] * (1 - (ambi.border & 2)); // todo: method!
                                        var Bresenham = slope.wedgeProduct(new Vec2([[x_at_y_int, y_int], v_val[2].position])); // this should be the same for all edges not instance of Edge_Horizon									
                                    }
                                }
                            }
                        }
                        // Bresenham still needs integer slope
                        slope_accu_c[k] = [d[0] > 0 ? d[1] / d[0] : this.screen[1] * Math.sign(d[1]), x_at_y_int];
                        const e = new EdgeShader(v_val[2], x_at_y_int, slope_accu_c[k][0]);
                        ps.es[k] = e;
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
            ps.y = y;
            console.log("width:", width, "y", ps.y);
            if (width > 0) {
                ps.span(slope_accu_c[0][0], width, m);
            }
        } //while (active_vertices[0][1] != active_vertices[1][1]) // full circle, bottom vertex found on the fly		
    }
    edge_fromVertex_toBorder(vs, l) {
        const on_screen = new Array();
        const slope = this.get_edge_slope_onScreen(vs).slice(0, 2); // 3d cros  product with meaningful sign. Swap x,y to get a vector pointint to the outside vertex. float the fractions
        let edge = new Edge_w_slope();
        edge.slope = new Vec2([slope]);
        on_screen.push(edge);
        const abs = slope.map(s => Math.abs(s));
        switch (this.mode) {
            case modes.NDC:
                var swap = abs[0] > abs[1];
                if (swap) {
                    slope.reverse();
                }
                if (slope[0] == 0)
                    return;
                break;
            case modes.guard_band:
                // I guess that this is not really about guard bands, but the second version of my code where roudning of slope can have ( polymorphism, will need a branch ) with positions.
                if (Math.abs(slope[0]) * this.screen[0] < Math.abs(slope[1]))
                    return;
                break;
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
        //if (  slope[0] > slope[1]) { // Nonsense  slope tells us that the edge comes from above.  This is branching only for NDC
        // correct order . At least every other vertex need to be on inside for this function
        let cc = 0;
        for (var corner = -1; corner <= +1; corner += 2) {
            if ((corner - vs[0].onScreen[0]) * slope[1] > (-1 - vs[0].onScreen[1]) * slope[0]) {
                vs[1].onScreen[0] = corner; //, vs[1].onScreen.border=corner // Todo: I need corners with rotation sense to fill the polygon
                switch (this.mode) { // todo: different edge clases?
                    case modes.NDC:
                        vs[1].onScreen[1] = vs[0].onScreen[1] + (this.screen[1 & 1] * corner - vs[0].onScreen[0]) * slope[1] / slope[0];
                        break;
                    case modes.guard_band: // The displacement is given by the other vertex. We store the float 
                        // check for overflow
                        vs[1].onScreen[1] = slope[1] * (2 << 16) / slope[0]; // JRISC fixed point
                        break;
                }
                cc++;
                break;
            }
        }
        if (cc == 0) {
            vs[1].onScreen[1] = -1;
            vs[1].onScreen[1] = (vs[0].onScreen[0] * slope[1] + this.screen[1 & 1] * (-1 - vs[0].onScreen[1]) * slope[0]) / slope[1]; // no rounding error allowed
        }
        vs[1].onScreen[1] = -1;
        let border = new Onthe_border();
        border.border = corner; // todo : or 0
        border.pixel_ordinate_int = vs[1].onScreen[1];
        border.z_gt_nearplane = vs[1].onScreen[1] > this.near_plane;
        on_screen.push(border);
        //}
        return on_screen;
    }
    get_edge_slope_onScreen(vertex) {
        /*
        view Vector(x,y,1)
        edge= v1-v0
        normal= v0 x edge
        implicit=normal * view
         */
        const view = new Vec3([vertex[0].inSpace]);
        const edge = new Vec3([vertex[0].inSpace, vertex[1].inSpace]);
        const normal = view.crossProduct(edge); // The sign has a meaning 
        // normalize for jrisc
        // mul.w will be applied to x and y components only . 
        // I need to know the screen expontent . x and y on screen need the same exponent to match bias in implicict function.
        // Ah, basicall 16.16
        const list = normal.v.slice(0, 2).map(s => Math.ceil(Math.log2(s))); // z = bias and can stay 32 bit because FoV ( Sniper view? ) will always keep z-viewing compontenc < 16 bits for 8 bit pixel coords 
        const f = Math.pow(2, 16 - Math.max(...list)), n = normal.v.map(c => c * f); // Bitshift in JRISC. SHA accepts sign shifter values!   
        // Even for a float slope 16.8 I would float the fraction before-hand
        // I cannot have two inner loops. So vertex-vertex needs to use floats and may hit the border before the vertex due to rounding
        // likewise rounding could change the side we pass a corner
        // I want texture mapping. Along the edges, I want perspective correction for any larger delta_Z . So I need branches for the Bresenham condition anyway
        // So why not stick to it? Gouraud would only have one add: Second render path for small gouraud with 1px away from edge? Real, 1px guradband in hardware?
        // slopes which miss create a non-convex shape. How does this even work with a BSP? Even if the cuts are correct, the algorithm might glitch
        // This has nothing to do with NDC vs GuardBand, though rounding errors in NDC start vertex worsen this effect
        // NDC cannot use slopes. Before scaling to pixels, the cuts need to be set on the borders. Slopes might not pass on the correct side of the corner. 
        // Yeah, how does NDC work with the slopes in a BSP? The wobble due to scaling changes everything
        return n;
    }
}
//# sourceMappingURL=Polygon_in_cameraSpace.js.map